import { requireOwner } from "@/lib/api/auth";
import { Errors, jsonError } from "@/lib/api/errors";
import { createRequestLogger } from "@/lib/api/logger";
import { checkWriteRateLimit } from "@/lib/api/rate-limit";
import { BranchIdParam } from "@/lib/api/schemas/queries";
import { ReplaceTipBody } from "@/lib/api/schemas/requests";
import { ReplaceTipResponse } from "@/lib/api/schemas/responses";
import { parseParams } from "@/lib/api/validators";
import { validateAndSend } from "@/lib/api/validators";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ branchId: string }> }
) {
  try {
    const ownerOrRes = await requireOwner();
    if (ownerOrRes instanceof Response) return ownerOrRes;
    const { owner } = ownerOrRes;

    const rl = checkWriteRateLimit(
      owner.id,
      "POST /v1/branches/:id/replace-tip"
    );
    if (rl) {
      const { log } = createRequestLogger(req, {
        route: "POST /v1/branches/:id/replace-tip",
        userId: owner.id,
      });
      log.warn({
        event: "rate_limit_reject",
        limit: "writes_per_min",
        max: 60,
      });
      return rl;
    }

    const parsedParams = await parseParams(params, BranchIdParam);
    if (parsedParams instanceof Response) return parsedParams;
    const { branchId } = parsedParams;
    const body = await req.json().catch(() => null);
    const parsed = ReplaceTipBody.safeParse(body);
    const { log, ctx } = createRequestLogger(req, {
      route: "POST /v1/branches/:id/replace-tip",
      userId: owner.id,
    });
    log.info({ event: "request_start" });
    if (!parsed.success) {
      log.info({ event: "validation_result", ok: false });
      return Errors.validation("Invalid request body", parsed.error.flatten());
    }
    log.info({ event: "validation_result", ok: true });
    const { newContent, expectedVersion } = parsed.data;

    const txStart = Date.now();
    const result = await prisma.$transaction(async (tx) => {
      const br = await tx.branch.findUnique({
        where: { id: branchId },
        include: { graph: true },
      });
      if (!br) return { error: Errors.notFound("Branch") };
      if (br.graph.userId !== owner.id) return { error: Errors.forbidden() };
      if (!br.tipNodeId)
        return { error: Errors.validation("Branch tip missing") };

      // Find incoming follows edge to current tip
      const incoming = await tx.blockEdge.findFirst({
        where: {
          graphId: br.graphId,
          childNodeId: br.tipNodeId,
          relation: "follows",
          deletedAt: null,
        },
        orderBy: { createdAt: "desc" },
      });
      if (!incoming)
        return {
          error: Errors.validation("Cannot replace root tip without parent"),
        };

      // Soft-delete old edge
      await tx.blockEdge.update({
        where: { id: incoming.id },
        data: { deletedAt: new Date() },
      });

      // Create new block/node
      const block = await tx.contextBlock.create({
        data: {
          userId: owner.id,
          kind: "user",
          content: newContent as unknown as Prisma.InputJsonValue,
          public: false,
        },
      });
      const node = await tx.graphNode.create({
        data: { graphId: br.graphId, blockId: block.id },
      });

      // Insert replacement follows edge preserving ord
      await tx.blockEdge.create({
        data: {
          graphId: br.graphId,
          parentNodeId: incoming.parentNodeId,
          childNodeId: node.id,
          relation: "follows",
          ord: incoming.ord ?? 0,
        },
      });

      // CAS tip/version
      const updated = await tx.branch.updateMany({
        where: { id: br.id, version: expectedVersion ?? br.version },
        data: { tipNodeId: node.id, version: { increment: 1 } },
      });
      if (updated.count === 0)
        return { error: Errors.conflictTip(br.tipNodeId, br.version) };

      await tx.graph.update({
        where: { id: br.graphId },
        data: { lastActivityAt: new Date() },
      });

      return {
        item: { nodeId: node.id, block },
        newTip: node.id,
        version: br.version + 1,
      };
    });
    log.info({ event: "tx_end", ok: true, durationMs: Date.now() - txStart });

    if ("error" in result && result.error instanceof Response)
      return result.error;
    const res = validateAndSend(result, ReplaceTipResponse, 200);
    log.info({ event: "request_end", durationMs: Date.now() - ctx.startedAt });
    return res;
  } catch (err) {
    console.error("POST /v1/branches/{branchId}:replaceTip error", err);
    return jsonError("INTERNAL", "Internal server error");
  }
}
