import { requireOwner } from "@/lib/api/auth";
import { Errors } from "@/lib/api/errors";
import {
  cacheIdempotentResponse,
  getCachedIdempotentResponse,
} from "@/lib/api/idempotency";
import { createRequestLogger } from "@/lib/api/logger";
import { acquireSSESlot, checkWriteRateLimit } from "@/lib/api/rate-limit";
import { SendStreamBody } from "@/lib/api/validation";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma";

function writeEvent(
  writer: WritableStreamDefaultWriter,
  event: string,
  data: unknown
) {
  const payload = typeof data === "string" ? data : JSON.stringify(data);
  return writer.write(`event: ${event}\n` + `data: ${payload}\n\n`);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ branchId: string }> }
) {
  const ownerOrRes = await requireOwner();
  if (ownerOrRes instanceof Response) return ownerOrRes;
  const { owner } = ownerOrRes;

  const { branchId } = await params;
  const rl = checkWriteRateLimit(owner.id, "POST /v1/branches/:id/send/stream");
  if (rl) return rl;

  // SSE setup
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const headers = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  } as Record<string, string>;

  const slotOrRes = acquireSSESlot(
    owner.id,
    "POST /v1/branches/:id/send/stream"
  );
  if (slotOrRes instanceof Response) return slotOrRes;
  const slot = slotOrRes;

  const { log, ctx } = createRequestLogger(req, {
    route: "POST /v1/branches/:id/send/stream",
    userId: owner.id,
  });
  log.info({ event: "request_start", concurrentStreamsNow: slot.current });

  // Idempotency final replay
  const cached = await getCachedIdempotentResponse(req, owner.id);
  if (cached) {
    queueMicrotask(async () => {
      await writeEvent(writer, "final", cached.body ?? {});
      await writer.close();
      slot.release();
    });
    log.info({ event: "idempotency_check", result: "hit" });
    return new Response(readable, { status: cached.status, headers });
  }
  log.info({ event: "idempotency_check", result: "miss" });

  const json = await req.json().catch(() => null);
  const parsed = SendStreamBody.safeParse(json);
  if (!parsed.success) {
    queueMicrotask(async () => {
      await writeEvent(writer, "error", {
        error: {
          code: "VALIDATION_FAILED",
          message: "Invalid request body",
          details: parsed.error.flatten(),
        },
      });
      await writer.close();
    });
    slot.release();
    log.info({ event: "validation_result", ok: false });
    return new Response(readable, { headers });
  }
  log.info({ event: "validation_result", ok: true });
  const { userMessage, expectedVersion, forkFromNodeId, newBranchName } =
    parsed.data;

  const keepalive = setInterval(() => {
    void writer.write(`event: keepalive\n` + `data: {}\n\n`);
  }, 15000);

  try {
    // 1) Optionally fork, 2) append user (emit userItem), 3) append assistant as stub and final
    const txStart = Date.now();
    const { targetBranch, userNodeId, userBlock, casVersion } =
      await prisma.$transaction(async (tx) => {
        const baseBranch = await tx.branch.findUnique({
          where: { id: branchId },
          include: { graph: true },
        });
        if (!baseBranch) throw Errors.notFound("Branch");
        if (baseBranch.graph.userId !== owner.id) throw Errors.forbidden();

        let targetBranch = baseBranch;
        let casVersion = 0;
        if (forkFromNodeId) {
          const fromNode = await tx.graphNode.findUnique({
            where: { id: forkFromNodeId },
          });
          if (!fromNode || fromNode.graphId !== baseBranch.graphId) {
            throw Errors.validation(
              "forkFromNodeId must belong to the same graph"
            );
          }
          targetBranch = await tx.branch.create({
            data: {
              graphId: baseBranch.graphId,
              name: newBranchName ?? `fork-${fromNode.id.slice(-6)}`,
              rootNodeId: fromNode.id,
              tipNodeId: fromNode.id,
              version: 0,
            },
            include: { graph: true },
          });
          casVersion = 0;
        }

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
        if (!forkFromNodeId) {
          casVersion = expectedVersion ?? baseBranch.version;
        }

        const userBlock = await tx.contextBlock.create({
          data: {
            userId: owner.id,
            kind: "user",
            content: userMessage as unknown as Prisma.InputJsonValue,
            public: false,
          },
        });
        const userNode = await tx.graphNode.create({
          data: { graphId: targetBranch.graphId, blockId: userBlock.id },
        });
        await tx.blockEdge.create({
          data: {
            graphId: targetBranch.graphId,
            parentNodeId: targetBranch.tipNodeId!,
            childNodeId: userNode.id,
            relation: "follows",
            ord: 0,
          },
        });
        await tx.branch.update({
          where: { id: targetBranch.id },
          data: { tipNodeId: userNode.id },
        });
        await tx.graph.update({
          where: { id: targetBranch.graphId },
          data: { lastActivityAt: new Date() },
        });

        return { targetBranch, userNodeId: userNode.id, userBlock, casVersion };
      });
    log.info({ event: "tx_end", ok: true, durationMs: Date.now() - txStart });

    await writeEvent(writer, "userItem", {
      nodeId: userNodeId,
      block: userBlock,
    });
    log.info({
      event: "business_event",
      kind: "graph_write",
      details: { branchId: targetBranch.id, newNodeId: userNodeId },
    });

    // Simulate generation; in real impl, stream deltas then commit on final
    const assistantText = "Assistant response (provider not configured)";

    const finalPayload = await prisma.$transaction(async (tx) => {
      const block = await tx.contextBlock.create({
        data: {
          userId: owner.id,
          kind: "assistant",
          content: { text: assistantText } as unknown as Prisma.InputJsonValue,
          model: "stub",
          public: false,
        },
      });
      const node = await tx.graphNode.create({
        data: { graphId: targetBranch.graphId, blockId: block.id },
      });
      await tx.blockEdge.create({
        data: {
          graphId: targetBranch.graphId,
          parentNodeId: targetBranch.tipNodeId!,
          childNodeId: node.id,
          relation: "follows",
          ord: 0,
        },
      });
      const where = forkFromNodeId
        ? { id: targetBranch.id, version: 0 }
        : { id: targetBranch.id, version: casVersion };
      const updated = await tx.branch.updateMany({
        where,
        data: { tipNodeId: node.id, version: { increment: 1 } },
      });
      if (!forkFromNodeId && updated.count === 0) {
        const br = await tx.branch.findUnique({
          where: { id: targetBranch.id },
        });
        throw Errors.conflictTip(br?.tipNodeId ?? null, br?.version ?? 0);
      }
      await tx.graph.update({
        where: { id: targetBranch.graphId },
        data: { lastActivityAt: new Date() },
      });

      if (forkFromNodeId) {
        return {
          assistantItem: { nodeId: node.id, block },
          branch: {
            id: targetBranch.id,
            graphId: targetBranch.graphId,
            name: targetBranch.name,
            rootNodeId: targetBranch.rootNodeId,
            tipNodeId: node.id,
            version: 1,
          },
        };
      }

      const br = await tx.branch.findUnique({ where: { id: targetBranch.id } });
      return {
        assistantItem: { nodeId: node.id, block },
        newTip: node.id,
        version: br ? br.version : casVersion + 1,
      };
    });

    // Emit final
    await writeEvent(writer, "final", finalPayload);
    await writer.close();
    slot.release();
    log.info({ event: "sse_final_emit" });

    await cacheIdempotentResponse({
      req,
      userId: owner.id,
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: finalPayload,
    });

    void writer.closed.then(() => {
      clearInterval(keepalive);
      slot.release();
    });
    setTimeout(() => clearInterval(keepalive), 60_000);

    return new Response(readable, { headers });
  } catch {
    try {
      await writeEvent(writer, "error", {
        error: { code: "INTERNAL", message: "Internal server error" },
      });
      await writer.close();
    } catch {}
    clearInterval(keepalive);
    slot.release();
    log.info({
      event: "sse_close",
      reason: "error",
      durationMs: Date.now() - ctx.startedAt,
    });
    const res = new Response(readable, { headers });
    log.info({ event: "request_end", durationMs: Date.now() - ctx.startedAt });
    return res;
  }
}
