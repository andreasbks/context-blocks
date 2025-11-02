import { buildSimpleContext } from "@/lib/ai/build-context";
import { type Message, generateBranchName } from "@/lib/ai/naming";
import { openai } from "@/lib/ai/openai";
import { requireOwner } from "@/lib/api/auth";
import { Errors } from "@/lib/api/errors";
import {
  cacheIdempotentResponse,
  getCachedIdempotentResponse,
} from "@/lib/api/idempotency";
import { createRequestLogger } from "@/lib/api/logger";
import { checkQuota, recordTokenUsage } from "@/lib/api/quota";
import { acquireSSESlot, checkWriteRateLimit } from "@/lib/api/rate-limit";
import { BranchIdParam } from "@/lib/api/schemas/queries";
import { SendStreamBody } from "@/lib/api/schemas/requests";
import { ErrorEnvelopeSchema } from "@/lib/api/schemas/shared";
import {
  SSEDeltaSchema,
  SSEFinalSchema,
  SSEItemSchema,
  SSEKeepaliveSchema,
} from "@/lib/api/schemas/sse";
import { createSSEContext } from "@/lib/api/sse-context";
import { writeSSE } from "@/lib/api/validators";
import { parseParams } from "@/lib/api/validators";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma";
import { ensureUniqueBranchName } from "@/lib/utils/unique-name";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // avoids any caching of the SSE route

const openaiClient = openai;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ branchId: string }> }
) {
  const requestedModel = process.env["OPENAI_MODEL"] ?? "gpt-4";
  let effectiveModel = requestedModel;
  let effectiveTokenCount: null | number = null;

  const sse = createSSEContext();
  const headers = sse.headers;

  let closed = false;
  let slot: { release: () => void; current: number } | undefined;

  const controller = new AbortController();

  const cleanupOnce = () => {
    if (closed) return;
    closed = true;
    if (slot) slot.release();
    controller.abort();
    sse.teardown();
  };

  void sse.writer.closed.finally(() => cleanupOnce());

  try {
    const ownerOrRes = await requireOwner();
    if (ownerOrRes instanceof Response) return ownerOrRes;
    const { owner } = ownerOrRes;

    const paramOk = await parseParams(params, BranchIdParam);
    if (paramOk instanceof Response) return paramOk;
    const { branchId } = paramOk;

    const rl = checkWriteRateLimit(
      owner.id,
      "POST /v1/branches/:id/send/stream"
    );
    if (rl) return rl;
    const slotOrRes = acquireSSESlot(
      owner.id,
      "POST /v1/branches/:id/send/stream"
    );
    if (slotOrRes instanceof Response) return slotOrRes;
    slot = slotOrRes;

    // Check quota before processing request
    const quotaStatus = await checkQuota(owner.id);
    if (quotaStatus.remaining <= 0) {
      return new Response(
        JSON.stringify(
          ErrorEnvelopeSchema.parse({
            error: {
              code: "QUOTA_EXCEEDED",
              message: "Monthly token quota exceeded",
              details: {
                used: quotaStatus.used,
                limit: quotaStatus.limit,
                resetDate: quotaStatus.resetDate,
              },
            },
          })
        ),
        {
          status: 429,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const cached = await getCachedIdempotentResponse(req, owner.id);

    const { log, ctx } = createRequestLogger(req, {
      route: "POST /v1/branches/:id/send/stream",
      userId: owner.id,
    });
    log.info({ event: "request_start", concurrentStreamsNow: slot.current });

    if (cached) {
      queueMicrotask(async () => {
        await writeSSE(SSEFinalSchema, "final", cached.body ?? {}, sse);
        await sse.writer.close();
        cleanupOnce();
      });
      log.info({ event: "idempotency_check", result: "hit" });
      return new Response(sse.readable, { status: cached.status, headers });
    }
    log.info({ event: "idempotency_check", result: "miss" });

    const json = await req.json().catch(() => null);
    const parsed = SendStreamBody.safeParse(json);
    if (!parsed.success) {
      queueMicrotask(async () => {
        await writeSSE(
          ErrorEnvelopeSchema,
          "error",
          {
            error: {
              code: "VALIDATION_FAILED",
              message: "Invalid request body",
              details: parsed.error.flatten(),
            },
          },
          sse
        );
        await sse.writer.close();
        cleanupOnce();
      });
      log.info({ event: "validation_result", ok: false });
      return new Response(sse.readable, { headers });
    }
    log.info({ event: "validation_result", ok: true });
    const { userMessage, expectedVersion, forkFromNodeId } = parsed.data;

    const keepalive = setInterval(() => {
      void writeSSE(SSEKeepaliveSchema, "keepalive", {}, sse);
    }, 15000);

    // Start work in background so events can flush immediately
    void (async () => {
      try {
        // 1) Optionally fork, 2) append user (emit userItem)
        const txStart = Date.now();
        const firstTxResult = await prisma.$transaction(async (tx) => {
          const baseBranch = await tx.branch.findUnique({
            where: { id: branchId },
            include: { graph: true },
          });
          if (!baseBranch) return { error: Errors.notFound("Branch") };
          if (baseBranch.graph.userId !== owner.id)
            return { error: Errors.forbidden() };

          let targetBranch = baseBranch;
          let casVersion = 0;
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
                name: "Generating name...",
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
            return {
              error: Errors.conflictTip(
                baseBranch.tipNodeId ?? null,
                baseBranch.version
              ),
            };
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

          return {
            targetBranch,
            userNodeId: userNode.id,
            userBlock,
            casVersion,
          };
        });
        log.info({
          event: "tx_user_append_end",
          ok: true,
          durationMs: Date.now() - txStart,
        });

        if (
          (firstTxResult as unknown as { error?: unknown }).error instanceof
          Response
        ) {
          clearInterval(keepalive);
          await sse.writeEventSafe("error", { error: { code: "INTERNAL" } });
          await sse.writer.close();
          cleanupOnce();
          return;
        }

        const { targetBranch, userNodeId, userBlock, casVersion } =
          firstTxResult as unknown as {
            targetBranch: {
              id: string;
              graphId: string;
              tipNodeId: string | null;
              name: string;
              rootNodeId: string | null;
            };
            userNodeId: string;
            userBlock: unknown;
            casVersion: number;
          };

        // Unified item envelope for persisted user message
        await writeSSE(
          SSEItemSchema,
          "item",
          { role: "user", item: { nodeId: userNodeId, block: userBlock } },
          sse
        );
        log.info({
          event: "business_event",
          kind: "graph_write",
          details: { branchId: targetBranch.id, newNodeId: userNodeId },
        });

        // Stream assistant delta tokens
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
              await writeSSE(SSEDeltaSchema, "delta", { text: chunk }, sse);
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

        // Final assistant commit
        const tx2Start = Date.now();
        const commitResult = await prisma.$transaction(async (tx) => {
          // Fetch the branch again to get the updated tip (which is now the userNode)
          const freshBranch = await tx.branch.findUnique({
            where: { id: targetBranch.id },
          });
          if (!freshBranch?.tipNodeId) {
            return {
              error: Errors.validation("Branch tip missing after user append"),
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
              parentNodeId: freshBranch.tipNodeId, // Use fresh tip (userNode), not stale targetBranch
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
            return {
              error: Errors.conflictTip(
                br?.tipNodeId ?? null,
                br?.version ?? 0
              ),
            };
          }
          await tx.graph.update({
            where: { id: targetBranch.graphId },
            data: { lastActivityAt: new Date() },
          });

          if (forkFromNodeId) {
            return {
              nodeId: node.id,
              block,
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

          const br = await tx.branch.findUnique({
            where: { id: targetBranch.id },
          });
          return {
            nodeId: node.id,
            block,
            newTip: node.id,
            version: br ? br.version : casVersion + 1,
          };
        });
        log.info({
          event: "tx_assistant_commit_end",
          ok: true,
          durationMs: Date.now() - tx2Start,
        });

        if (
          (commitResult as unknown as { error?: unknown }).error instanceof
          Response
        ) {
          clearInterval(keepalive);
          await writeSSE(
            ErrorEnvelopeSchema,
            "error",
            {
              error: {
                code: "CONFLICT_TIP_MOVED",
                message: "Branch tip has advanced",
              },
            },
            sse
          );
          await sse.writer.close();
          return;
        }

        // Record token usage for quota tracking
        if (effectiveTokenCount && effectiveTokenCount > 0) {
          await recordTokenUsage(owner.id, effectiveTokenCount);
        }

        // Unified final envelope: include both user and assistant items
        const { nodeId, block, ...rest } = commitResult as unknown as {
          nodeId: string;
          block: unknown;
        } & Record<string, unknown>;
        const finalUnified = {
          items: [
            {
              role: "user" as const,
              item: { nodeId: userNodeId, block: userBlock },
            },
            { role: "assistant" as const, item: { nodeId, block } },
          ],
          ...rest,
        };
        await writeSSE(SSEFinalSchema, "final", finalUnified, sse);
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
          body: finalUnified,
        });

        // Asynchronously generate and update branch name if fork was created
        if (forkFromNodeId && "branch" in finalUnified) {
          void (async () => {
            try {
              // Fetch last 5 messages from the timeline leading to fork point
              const backtrackSql = `
                with recursive backtrack(id, depth) as (
                  select $1::text as id, 0 as depth
                  union all
                  select e."parentNodeId", backtrack.depth + 1
                  from backtrack
                  join "BlockEdge" e on e."childNodeId" = backtrack.id
                  where e."graphId" = $2 
                    and e."relation" = 'follows' 
                    and e."deletedAt" is null
                    and backtrack.depth < 5
                )
                select id as "nodeId" 
                from backtrack
                where id is not null
                order by depth desc
              `;

              const contextResult = await prisma.$transaction(async (tx) => {
                const branch = await tx.branch.findUnique({
                  where: { id: branchId },
                  include: { graph: true },
                });
                if (!branch) return { graphId: null, rows: [] };

                const rows = await prisma.$queryRawUnsafe<
                  Array<{ nodeId: string }>
                >(backtrackSql, forkFromNodeId, branch.graphId);

                return { graphId: branch.graphId, rows };
              });

              if (!contextResult.graphId) return;

              const recentMessages: Message[] = [];
              for (const { nodeId } of contextResult.rows) {
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

              // Add the user message as context for the fork
              const userMessageText =
                typeof userMessage === "string"
                  ? userMessage
                  : ((userMessage as { text?: string })?.text ?? "");

              const generatedName = await generateBranchName(
                recentMessages,
                userMessageText
              );
              if (generatedName) {
                const uniqueName = await ensureUniqueBranchName(
                  contextResult.graphId,
                  generatedName
                );
                await prisma.branch.update({
                  where: { id: (finalUnified.branch as { id: string }).id },
                  data: { name: uniqueName },
                });
                log.info({
                  event: "branch_name_generated",
                  branchId: (finalUnified.branch as { id: string }).id,
                  name: uniqueName,
                });
              }
            } catch (err) {
              log.error({
                event: "branch_name_generation_failed",
                error: err,
              });
            }
          })();
        }
      } catch (err) {
        console.error(
          "POST /v1/branches/{branchId}/send/stream background error",
          err
        );

        // Handle specific error types
        let errorCode = "INTERNAL";
        let errorMessage = "Internal server error";

        // Check for Prisma unique constraint violation (P2002)
        if (err && typeof err === "object" && "code" in err) {
          const prismaErr = err as {
            code: string;
            meta?: { target?: string[] };
          };
          if (prismaErr.code === "P2002") {
            errorCode = "DUPLICATE_BRANCH_NAME";
            const target = prismaErr.meta?.target?.join(", ") || "name";
            errorMessage = `A branch with this name already exists. Please try a different name. (Constraint: ${target})`;
          }
        }

        await writeSSE(
          ErrorEnvelopeSchema,
          "error",
          { error: { code: errorCode, message: errorMessage } },
          sse
        );
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
    log.info({ event: "sse_open", durationMs: Date.now() - ctx.startedAt });
    return res;
  } catch (err) {
    console.error("POST /v1/branches/{branchId}/send/stream error", err);
    queueMicrotask(async () => {
      await writeSSE(
        ErrorEnvelopeSchema,
        "error",
        { error: { code: "INTERNAL", message: "Internal server error" } },
        sse
      );
      await sse.writer.close();
    });
    return new Response(sse.readable, { status: 500, headers });
  }
}
