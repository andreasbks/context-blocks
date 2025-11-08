import { type Message, generateBranchName } from "@/lib/ai/naming";
import { requireOwner } from "@/lib/api/auth";
import { Errors, jsonError } from "@/lib/api/errors";
import {
  cacheIdempotentResponse,
  getCachedIdempotentResponse,
} from "@/lib/api/idempotency";
import { createRequestLogger } from "@/lib/api/logger";
import { checkWriteRateLimit } from "@/lib/api/rate-limit";
import { BranchIdParam } from "@/lib/api/schemas/queries";
import { AppendBody } from "@/lib/api/schemas/requests";
import {
  AppendForkResponse,
  AppendResponse,
} from "@/lib/api/schemas/responses";
import { parseParams } from "@/lib/api/validators";
import { validateAndSend } from "@/lib/api/validators";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma";
import { ensureUniqueBranchName } from "@/lib/utils/unique-name";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ branchId: string }> }
) {
  try {
    const ownerOrRes = await requireOwner();
    if (ownerOrRes instanceof Response) return ownerOrRes;
    const { owner } = ownerOrRes;

    const rl = checkWriteRateLimit(owner.id, "POST /v1/branches/:id/append");
    if (rl) {
      const { log } = createRequestLogger(req, {
        route: "POST /v1/branches/:id/append",
        userId: owner.id,
      });
      log.warn({
        event: "rate_limit_reject",
        limit: "writes_per_min",
        max: 60,
      });
      return rl;
    }

    // Idempotency replay
    const cached = await getCachedIdempotentResponse(req, owner.id);
    const { log, ctx } = createRequestLogger(req, {
      route: "POST /v1/branches/:id/append",
      userId: owner.id,
    });
    log.info({ event: "request_start" });
    if (cached) {
      log.info({ event: "idempotency_check", result: "hit" });
      return new Response(JSON.stringify(cached.body ?? {}), {
        status: cached.status,
        headers: { "Content-Type": "application/json" },
      });
    }
    log.info({ event: "idempotency_check", result: "miss" });

    const body = await req.json().catch(() => null);
    const parsed = AppendBody.safeParse(body);
    if (!parsed.success) {
      log.info({ event: "validation_result", ok: false });
      return Errors.validation("Invalid request body", parsed.error.flatten());
    }
    log.info({ event: "validation_result", ok: true });
    const { author, content, model, expectedVersion, forkFromNodeId } =
      parsed.data;

    // Preload branch and verify ownership (clear error semantics)
    const paramOk = await parseParams(params, BranchIdParam);
    if (paramOk instanceof Response) return paramOk;
    const { branchId } = paramOk;
    const baseBranch = await prisma.branch.findUnique({
      where: { id: branchId },
      include: { graph: true },
    });
    if (!baseBranch) return Errors.notFound("Branch");
    if (baseBranch.graph.userId !== owner.id) return Errors.forbidden();

    // If forking, ensure fromNode belongs to same graph
    if (forkFromNodeId) {
      const fromNode = await prisma.graphNode.findUnique({
        where: { id: forkFromNodeId },
      });
      if (!fromNode || fromNode.graphId !== baseBranch.graphId) {
        return Errors.validation(
          "forkFromNodeId must belong to the same graph"
        );
      }
    }

    const txStart = Date.now();
    const result = await prisma.$transaction(async (tx) => {
      // Optional fork
      const targetBranch = forkFromNodeId
        ? await tx.branch.create({
            data: {
              graphId: baseBranch.graphId,
              name: "Generating name...",
              rootNodeId: forkFromNodeId,
              tipNodeId: forkFromNodeId,
              version: 0,
            },
          })
        : baseBranch;

      if (
        !forkFromNodeId &&
        expectedVersion != null &&
        expectedVersion !== baseBranch.version
      ) {
        throw Errors.conflictTip(
          baseBranch.tipNodeId ?? null,
          baseBranch.version
        );
      }

      const block = await tx.contextBlock.create({
        data: {
          userId: owner.id,
          kind: author,
          content: content as unknown as Prisma.InputJsonValue,
          model: model ?? null,
          public: false,
        },
      });
      const node = await tx.graphNode.create({
        data: { graphId: targetBranch.graphId, blockId: block.id },
      });

      // Insert follows edge and advance tip with CAS
      await tx.blockEdge.create({
        data: {
          graphId: targetBranch.graphId,
          parentNodeId: targetBranch.tipNodeId!,
          childNodeId: node.id,
          relation: "follows",
          ord: 0,
        },
      });

      const updated = await tx.branch.updateMany({
        where: {
          id: targetBranch.id,
          version: forkFromNodeId ? 0 : (expectedVersion ?? baseBranch.version),
        },
        data: { tipNodeId: node.id, version: { increment: 1 } },
      });
      if (updated.count === 0) {
        throw Errors.conflictTip(
          targetBranch.tipNodeId ?? null,
          targetBranch.version ?? 0
        );
      }

      await tx.graph.update({
        where: { id: targetBranch.graphId },
        data: { lastActivityAt: new Date() },
      });

      if (forkFromNodeId) {
        return {
          branch: {
            id: targetBranch.id,
            graphId: targetBranch.graphId,
            name: targetBranch.name,
            rootNodeId: targetBranch.rootNodeId,
            tipNodeId: node.id,
            version: 1,
          },
          item: { nodeId: node.id, block },
        };
      }

      return {
        item: { nodeId: node.id, block },
        newTip: node.id,
        version: baseBranch.version + 1,
      };
    });
    log.info({ event: "tx_end", ok: true, durationMs: Date.now() - txStart });

    // Always expect a result object at this point

    await cacheIdempotentResponse({
      req,
      userId: owner.id,
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: result,
    });

    const res =
      "branch" in result
        ? validateAndSend(result, AppendForkResponse, 200)
        : validateAndSend(result, AppendResponse, 200);
    log.info({ event: "request_end", durationMs: Date.now() - ctx.startedAt });

    // Asynchronously generate and update branch name if fork was created
    if ("branch" in result && forkFromNodeId && result.branch) {
      const newBranchId = result.branch.id;
      const graphId = baseBranch.graphId;
      void (async () => {
        try {
          // Fetch last 5 messages from the timeline leading to fork point
          const rows = await prisma.$queryRaw<Array<{ nodeId: string }>>`
            with recursive backtrack(id, depth) as (
              select ${forkFromNodeId}::text as id, 0 as depth
              union all
              select e."parentNodeId", backtrack.depth + 1
              from backtrack
              join "BlockEdge" e on e."childNodeId" = backtrack.id
              where e."graphId" = ${graphId} 
                and e."relation" = 'follows' 
                and e."deletedAt" is null
                and backtrack.depth < 5
            )
            select id as "nodeId" 
            from backtrack
            where id is not null
            order by depth desc
          `;

          const recentMessages: Message[] = [];
          for (const { nodeId } of rows) {
            const node = await prisma.graphNode.findUnique({
              where: { id: nodeId },
              include: { block: true },
            });
            if (node && !node.hiddenAt) {
              const contentText =
                typeof node.block.content === "string"
                  ? node.block.content
                  : ((node.block.content as { text?: string })?.text ?? "");
              recentMessages.push({
                role: node.block.kind === "user" ? "user" : "assistant",
                content: contentText,
              });
            }
          }

          // Add the fork message as context
          const forkMessageText =
            typeof content === "string" ? content : content.text;

          const generatedName = await generateBranchName(
            recentMessages,
            forkMessageText
          );
          if (generatedName) {
            const uniqueName = await ensureUniqueBranchName(
              graphId,
              generatedName
            );
            await prisma.branch.update({
              where: { id: newBranchId },
              data: { name: uniqueName },
            });
            log.info({
              event: "branch_name_generated",
              branchId: newBranchId,
              name: uniqueName,
            });
          }
        } catch (err) {
          log.error({
            event: "branch_name_generation_failed",
            branchId: newBranchId,
            error: err,
          });
        }
      })();
    }

    return res;
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("POST /v1/branches/{branchId}:append error", err);
    return jsonError("INTERNAL", "Internal server error");
  }
}
