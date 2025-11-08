import { requireOwner } from "@/lib/api/auth";
import { Errors, jsonError } from "@/lib/api/errors";
import {
  cacheIdempotentResponse,
  getCachedIdempotentResponse,
} from "@/lib/api/idempotency";
import { createRequestLogger } from "@/lib/api/logger";
import { checkWriteRateLimit } from "@/lib/api/rate-limit";
import { StartGraphBody } from "@/lib/api/schemas/requests";
import { StartGraphResponse } from "@/lib/api/schemas/responses";
import { validateAndSend } from "@/lib/api/validators";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma";

export async function POST(req: Request) {
  try {
    const ownerOrRes = await requireOwner();
    if (ownerOrRes instanceof Response) return ownerOrRes;
    const { owner } = ownerOrRes;

    const rl = checkWriteRateLimit(owner.id, "POST /v1/graphs/start");
    if (rl) {
      const { log } = createRequestLogger(req, {
        route: "POST /v1/graphs/start",
        userId: owner.id,
      });
      log.warn({
        event: "rate_limit_reject",
        limit: "writes_per_min",
        max: 60,
      });
      return rl;
    }

    const { log, ctx } = createRequestLogger(req, {
      route: "POST /v1/graphs/start",
      userId: owner.id,
    });
    log.info({ event: "request_start" });

    // Idempotency replay
    const cached = await getCachedIdempotentResponse(req, owner.id);
    if (cached) {
      log.info({ event: "idempotency_check", result: "hit" });
      return new Response(JSON.stringify(cached.body ?? {}), {
        status: cached.status,
        headers: { "Content-Type": "application/json" },
      });
    }
    log.info({ event: "idempotency_check", result: "miss" });

    const json = await req.json().catch(() => null);
    const parsed = StartGraphBody.safeParse(json);
    if (!parsed.success) {
      log.info({ event: "validation_result", ok: false });
      return Errors.validation("Invalid request body", parsed.error.flatten());
    }
    log.info({ event: "validation_result", ok: true });
    const { title, firstMessage, branchName } = parsed.data;

    const txStart = Date.now();
    const result = await prisma.$transaction(async (tx) => {
      const graph = await tx.graph.create({
        data: { userId: owner.id, title: title ?? null },
      });

      const block = await tx.contextBlock.create({
        data: {
          userId: owner.id,
          kind: firstMessage.author,
          content: firstMessage.content as unknown as Prisma.InputJsonValue,
          model: firstMessage.model ?? null,
          public: false,
        },
      });
      const rootNode = await tx.graphNode.create({
        data: { graphId: graph.id, blockId: block.id },
      });
      const branch = await tx.branch.create({
        data: {
          graphId: graph.id,
          name: branchName ?? "main",
          rootNodeId: rootNode.id,
          tipNodeId: rootNode.id,
        },
      });

      await tx.graph.update({
        where: { id: graph.id },
        data: { lastActivityAt: new Date() },
      });

      return {
        graph: {
          id: graph.id,
          title: graph.title,
          createdAt: graph.createdAt,
          lastActivityAt: graph.lastActivityAt,
        },
        branch: {
          id: branch.id,
          graphId: graph.id,
          name: branch.name,
          rootNodeId: branch.rootNodeId,
          tipNodeId: branch.tipNodeId,
          version: branch.version,
          createdAt: branch.createdAt,
        },
        items: [{ nodeId: rootNode.id, block }],
      };
    });
    log.info({ event: "tx_end", ok: true, durationMs: Date.now() - txStart });

    // Cache idempotent result
    await cacheIdempotentResponse({
      req,
      userId: owner.id,
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: result,
    });

    const res = validateAndSend(result, StartGraphResponse, 200);
    log.info({ event: "request_end", durationMs: Date.now() - ctx.startedAt });
    return res;
  } catch (err) {
    console.error("/v1/graphs:start error", err);
    return jsonError("INTERNAL", "Internal server error");
  }
}
