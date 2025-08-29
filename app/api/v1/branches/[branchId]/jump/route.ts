import { requireOwner } from "@/lib/api/auth";
import { Errors, jsonError } from "@/lib/api/errors";
import { createRequestLogger } from "@/lib/api/logger";
import { checkWriteRateLimit } from "@/lib/api/rate-limit";
import { BranchIdParam } from "@/lib/api/schemas/queries";
import { JumpBody } from "@/lib/api/schemas/requests";
import { JumpResponse } from "@/lib/api/schemas/responses";
import { parseParams } from "@/lib/api/validators";
import { validateAndSend } from "@/lib/api/validators";
import { prisma } from "@/lib/db";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ branchId: string }> }
) {
  try {
    const ownerOrRes = await requireOwner();
    if (ownerOrRes instanceof Response) return ownerOrRes;
    const { owner } = ownerOrRes;

    const parsedParams = await parseParams(params, BranchIdParam);
    if (parsedParams instanceof Response) return parsedParams;
    const { branchId } = parsedParams;
    const rl = checkWriteRateLimit(owner.id, "POST /v1/branches/:id/jump");
    if (rl) {
      const { log } = createRequestLogger(req, {
        route: "POST /v1/branches/:id/jump",
        userId: owner.id,
      });
      log.warn({
        event: "rate_limit_reject",
        limit: "writes_per_min",
        max: 60,
      });
      return rl;
    }
    const body = await req.json().catch(() => null);
    const parsed = JumpBody.safeParse(body);
    const { log, ctx } = createRequestLogger(req, {
      route: "POST /v1/branches/:id/jump",
      userId: owner.id,
    });
    log.info({ event: "request_start" });
    if (!parsed.success) {
      log.info({ event: "validation_result", ok: false });
      return Errors.validation("Invalid request body", parsed.error.flatten());
    }
    log.info({ event: "validation_result", ok: true });
    const { toNodeId, expectedVersion } = parsed.data;

    const txStart = Date.now();
    const result = await prisma.$transaction(async (tx) => {
      const br = await tx.branch.findUnique({
        where: { id: branchId },
        include: { graph: true },
      });
      if (!br) return { error: Errors.notFound("Branch") };
      if (br.graph.userId !== owner.id) return { error: Errors.forbidden() };
      if (!br.rootNodeId)
        return { error: Errors.validation("Branch root missing") };

      // Verify reachability root ->* toNodeId via follows
      const reachableRows = await tx.$queryRawUnsafe<Array<{ ok: boolean }>>(
        `with recursive walk(id) as (
            select $1::text as id
            union all
            select e."childNodeId" from walk
            join "BlockEdge" e on e."parentNodeId" = walk.id
            where e."graphId" = $2 and e."relation" = 'follows' and e."deletedAt" is null
          )
          select exists(select 1 from walk where id = $3) as ok`,
        br.rootNodeId,
        br.graphId,
        toNodeId
      );
      const reachable = reachableRows[0]?.ok === true;
      if (!reachable)
        return {
          error: jsonError(
            "INVALID_REACHABILITY",
            "Target node is not on branch path"
          ),
        };

      const updated = await tx.branch.updateMany({
        where: { id: br.id, version: expectedVersion ?? br.version },
        data: { tipNodeId: toNodeId, version: { increment: 1 } },
      });
      if (updated.count === 0)
        return { error: Errors.conflictTip(br.tipNodeId ?? null, br.version) };

      await tx.graph.update({
        where: { id: br.graphId },
        data: { lastActivityAt: new Date() },
      });

      return {
        branch: {
          id: br.id,
          tipNodeId: toNodeId,
          version: br.version + 1,
        },
      };
    });
    log.info({ event: "tx_end", ok: true, durationMs: Date.now() - txStart });
    if ("error" in result && result.error instanceof Response)
      return result.error;
    const res = validateAndSend(result, JumpResponse, 200);
    log.info({ event: "request_end", durationMs: Date.now() - ctx.startedAt });
    return res;
  } catch (err) {
    console.error("POST /v1/branches/{branchId}/jump error", err);
    return jsonError("INTERNAL", "Internal server error");
  }
}
