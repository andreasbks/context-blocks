import OpenAI from "openai";

import { buildSimpleContext } from "@/lib/ai/build-context";
import { requireOwner } from "@/lib/api/auth";
import { Errors } from "@/lib/api/errors";
import {
  cacheIdempotentResponse,
  getCachedIdempotentResponse,
} from "@/lib/api/idempotency";
import { createRequestLogger } from "@/lib/api/logger";
import { acquireSSESlot, checkWriteRateLimit } from "@/lib/api/rate-limit";
import { createSSEContext } from "@/lib/api/sse-context";
import { GenerateStreamBody } from "@/lib/api/validation";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // avoids any caching of the SSE route

const openaiClient = new OpenAI({
  apiKey: process.env["OPENAI_API_KEY"],
});

/**
 * Streamed generation SSE endpoint
 * Flow:
 * 1) Authenticate and read params
 * 2) Rate-limit check and acquire SSE slot (concurrency control)
 * 3) Idempotency replay: if a final exists for this key, stream it and exit
 * 4) Validate request body and report validation errors over SSE
 * 5) Start keepalive heartbeats to keep the stream open
 * 6) Start a background worker that:
 *    - builds conversation context
 *    - calls OpenAI with streaming and emits "delta" chunks
 *    - commits assistant block and branch tip in one TX
 *    - emits "final" and closes the stream
 * 7) Immediately return the SSE Response so the client can receive events
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ branchId: string }> }
) {
  const requestedModel = process.env["OPENAI_MODEL"] ?? "gpt-4"; // TODO: Put defaults into a central config.
  let effectiveModel = requestedModel;
  let effectiveTokenCount: null | number = null;

  // Initialize SSE transport (headers + readable + writer) for event emission
  const sse = createSSEContext();
  const headers = sse.headers;

  let closed = false;
  let slot: { release: () => void; current: number } | undefined;

  // Abort controller placeholder for potential upstream cancellation
  const controller = new AbortController();

  const cleanupOnce = () => {
    if (closed) return;
    closed = true;
    if (slot) slot.release();
    controller.abort();
    sse.teardown();
  };

  // Safety net: if writer closes for any reason
  void sse.writer.closed.finally(() => cleanupOnce());

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
    slot = slotOrRes;

    // Check idempotency replay for SSE: if final cached, emit final and close
    const cached = await getCachedIdempotentResponse(req, owner.id);

    const { log, ctx } = createRequestLogger(req, {
      route: "POST /v1/branches/:id/generate/stream",
      userId: owner.id,
    });
    log.info({ event: "request_start", concurrentStreamsNow: slot.current });

    if (cached) {
      // immediate final replay
      queueMicrotask(async () => {
        await sse.writeEventSafe("final", cached.body ?? {});
        await sse.writer.close();
        cleanupOnce();
      });
      log.info({ event: "idempotency_check", result: "hit" });
      return new Response(sse.readable, { status: cached.status, headers });
    }
    log.info({ event: "idempotency_check", result: "miss" });

    const json = await req.json().catch(() => null);
    const parsed = GenerateStreamBody.safeParse(json);
    if (!parsed.success) {
      // emit error envelope over SSE
      queueMicrotask(async () => {
        await sse.writeEventSafe("error", {
          error: {
            code: "VALIDATION_FAILED",
            message: "Invalid request body",
            details: parsed.error.flatten(),
          },
        });
        await sse.writer.close();
        cleanupOnce();
      });
      log.info({ event: "validation_result", ok: false });
      return new Response(sse.readable, { headers });
    }
    log.info({ event: "validation_result", ok: true });
    const { expectedVersion, forkFromNodeId, newBranchName } = parsed.data;

    const keepalive = setInterval(() => {
      // ignore failure of writes after close
      void sse.writeEventSafe("keepalive", {});
    }, 15000);

    // Start work in background so events can flush immediately
    void (async () => {
      try {
        // Generate assistant message while streaming deltas to the client
        let accumulatedResponse = "";
        let finalAssistantResponse = "";

        const input = await buildSimpleContext(branchId);

        const stream = await openaiClient.responses.create({
          model: requestedModel,
          input,
          stream: true,
        });

        let streamedDeltas = 0;

        for await (const event of stream) {
          switch (event.type) {
            case "response.output_text.delta": {
              const chunk = event.delta ?? "";
              accumulatedResponse += chunk;
              await sse.writeEventSafe("delta", { text: chunk });
              streamedDeltas += 1;
              if (streamedDeltas == 1) {
                log.info({
                  event: "first_byte",
                  durationMs: Date.now() - ctx.startedAt,
                });
              }
              break;
            }
            case "response.output_text.done": {
              finalAssistantResponse = event.text ?? accumulatedResponse;
              break;
            }
            case "response.completed": {
              if (event.response?.model) effectiveModel = event.response.model;
              if (event.response?.usage?.output_tokens)
                effectiveTokenCount = event.response.usage.output_tokens;
              if (!finalAssistantResponse)
                finalAssistantResponse = accumulatedResponse;
              log.info({
                event: "model_completed",
                durationMs: Date.now() - ctx.startedAt,
              });
              break;
            }
            case "response.failed": {
              throw new Error(
                event.response.error?.message ?? "upstream_error"
              );
            }
            default:
              break;
          }
        }

        // Final commit transaction
        const txStart = Date.now();
        const finalPayload = await prisma.$transaction(async (tx) => {
          const baseBranch = await tx.branch.findUnique({
            where: { id: branchId },
            include: { graph: true },
          });
          if (!baseBranch) return { error: Errors.notFound("Branch") };
          if (baseBranch.graph.userId !== owner.id)
            return { error: Errors.forbidden() };

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

          const block = await tx.contextBlock.create({
            data: {
              userId: owner.id,
              kind: "assistant",
              content: {
                text: finalAssistantResponse,
              } as unknown as Prisma.InputJsonValue,
              model: effectiveModel,
              tokenCount: effectiveTokenCount,
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
              version: forkFromNodeId
                ? 0
                : (expectedVersion ?? baseBranch.version),
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
        log.info({
          event: "tx_end",
          ok: true,
          durationMs: Date.now() - txStart,
        });

        if (
          (finalPayload as unknown as { error?: unknown }).error instanceof
          Response
        ) {
          clearInterval(keepalive);
          await sse.writeEventSafe("error", {
            error: {
              code: "CONFLICT_TIP_MOVED",
              message: "Branch tip has advanced",
            },
          });
          await sse.writer.close();
          return;
        }

        await sse.writeEventSafe("final", finalPayload);
        log.info({
          event: "sse_final_emit",
          durationMs: Date.now() - ctx.startedAt,
        });
        await sse.writer.close();
        cleanupOnce();

        await cacheIdempotentResponse({
          req,
          userId: owner.id,
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: finalPayload,
        });
      } catch (err) {
        console.error(
          "POST /v1/branches/{branchId}/generate/stream background error",
          err
        );
        await sse.writeEventSafe("error", {
          error: { code: "INTERNAL", message: "Internal server error" },
        });
        await sse.writer.close();
      } finally {
        void sse.writer.closed.then(() => {
          clearInterval(keepalive);
          cleanupOnce();
          log.info({
            event: "sse_close",
            reason: "client_closed",
            durationMs: Date.now() - ctx.startedAt,
          });
        });
      }
    })();

    const res = new Response(sse.readable, { headers });
    log.info({
      event: "sse_open",
      durationMs: Date.now() - ctx.startedAt,
    });
    return res;
  } catch (err) {
    console.error("POST /v1/branches/{branchId}/generate/stream error", err);
    queueMicrotask(async () => {
      await sse.writeEventSafe("error", {
        error: { code: "INTERNAL", message: "Internal server error" },
      });
      await sse.writer.close();
    });
    return new Response(sse.readable, { status: 500, headers });
  }
}
