import { requireOwner } from "@/lib/api/auth";
import { Errors } from "@/lib/api/errors";
import {
  cacheIdempotentResponse,
  getCachedIdempotentResponse,
} from "@/lib/api/idempotency";
import { createRequestLogger } from "@/lib/api/logger";
import { acquireSSESlot, checkWriteRateLimit } from "@/lib/api/rate-limit";
import { GenerateStreamBody } from "@/lib/api/validation";
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
  try {
    const ownerOrRes = await requireOwner();
    if (ownerOrRes instanceof Response) return ownerOrRes;
    const { owner } = ownerOrRes;

    const { branchId } = await params;
    const rl = checkWriteRateLimit(
      owner.id,
      "POST /v1/branches/:id/generate/stream"
    );
    if (rl) return rl;
    const slotOrRes = acquireSSESlot(
      owner.id,
      "POST /v1/branches/:id/generate/stream"
    );
    if (slotOrRes instanceof Response) return slotOrRes;
    const slot = slotOrRes;

    // Check idempotency replay for SSE: if final cached, emit final and close
    const cached = await getCachedIdempotentResponse(req, owner.id);
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const headers = {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    } as Record<string, string>;

    const { log, ctx } = createRequestLogger(req, {
      route: "POST /v1/branches/:id/generate/stream",
      userId: owner.id,
    });
    log.info({ event: "request_start", concurrentStreamsNow: slot.current });

    if (cached) {
      // immediate final replay
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
    const parsed = GenerateStreamBody.safeParse(json);
    if (!parsed.success) {
      // emit error envelope over SSE
      queueMicrotask(async () => {
        await writeEvent(writer, "error", {
          error: {
            code: "VALIDATION_FAILED",
            message: "Invalid request body",
            details: parsed.error.flatten(),
          },
        });
        await writer.close();
        slot.release();
      });
      log.info({ event: "validation_result", ok: false });
      return new Response(readable, { headers });
    }
    log.info({ event: "validation_result", ok: true });
    const { expectedVersion, forkFromNodeId, newBranchName } = parsed.data;

    const keepalive = setInterval(() => {
      // ignore failure of writes after close
      void writer.write(`event: keepalive\n` + `data: {}\n\n`);
    }, 15000);

    // Perform final commit in one transaction (providerless MVP)
    const txStart = Date.now();
    const finalPayload = await prisma.$transaction(async (tx) => {
      // Load base branch
      const baseBranch = await tx.branch.findUnique({
        where: { id: branchId },
        include: { graph: true },
      });
      if (!baseBranch) return { error: Errors.notFound("Branch") };
      if (baseBranch.graph.userId !== owner.id)
        return { error: Errors.forbidden() };

      // Optional fork
      let targetBranch = baseBranch;
      if (forkFromNodeId) {
        const fromNode = await tx.graphNode.findUnique({
          where: { id: forkFromNodeId },
        });
        if (!fromNode || fromNode.graphId !== baseBranch.graphId) {
          return {
            error: Errors.validation(
              "forkFromNodeId must belong to the same graph"
            ),
          };
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
      }

      if (
        !forkFromNodeId &&
        expectedVersion != null &&
        expectedVersion !== baseBranch.version
      ) {
        return {
          error: Errors.conflictTip(
            baseBranch.tipNodeId ?? null,
            baseBranch.version
          ),
        };
      }

      const assistantText = "Assistant response (provider not configured)";
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
      const updated = await tx.branch.updateMany({
        where: {
          id: targetBranch.id,
          version: forkFromNodeId ? 0 : (expectedVersion ?? baseBranch.version),
        },
        data: { tipNodeId: node.id, version: { increment: 1 } },
      });
      if (updated.count === 0) {
        return {
          error: Errors.conflictTip(
            targetBranch.tipNodeId ?? null,
            targetBranch.version ?? 0
          ),
        };
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

      return {
        assistantItem: { nodeId: node.id, block },
        newTip: node.id,
        version: baseBranch.version + 1,
      };
    });
    log.info({ event: "tx_end", ok: true, durationMs: Date.now() - txStart });

    if (
      (finalPayload as unknown as { error?: unknown }).error instanceof Response
    ) {
      clearInterval(keepalive);
      queueMicrotask(async () => {
        await writeEvent(writer, "error", {
          error: {
            code: "CONFLICT_TIP_MOVED",
            message: "Branch tip has advanced",
          },
        });
        await writer.close();
      });
      return new Response(readable, { headers });
    }

    // Emit final and cache idempotent
    queueMicrotask(async () => {
      await writeEvent(writer, "final", finalPayload);
      await writer.close();
      slot.release();
    });
    log.info({ event: "sse_final_emit" });

    // Cache final for idempotency
    await cacheIdempotentResponse({
      req,
      userId: owner.id,
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: finalPayload,
    });

    // Ensure keepalive cleared when stream closes
    void writer.closed.then(() => {
      clearInterval(keepalive);
      slot.release();
      log.info({
        event: "sse_close",
        reason: "client_closed",
        durationMs: Date.now() - ctx.startedAt,
      });
    });
    setTimeout(() => clearInterval(keepalive), 60_000);

    const res = new Response(readable, { headers });
    log.info({ event: "request_end", durationMs: Date.now() - ctx.startedAt });
    return res;
  } catch (err) {
    console.error("POST /v1/branches/{branchId}:generate:stream error", err);
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    queueMicrotask(async () => {
      await writeEvent(writer, "error", {
        error: { code: "INTERNAL", message: "Internal server error" },
      });
      await writer.close();
    });
    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }
}
