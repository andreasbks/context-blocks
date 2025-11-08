import { requireOwner } from "@/lib/api/auth";
import { Errors, jsonError } from "@/lib/api/errors";
import {
  cacheIdempotentResponse,
  getCachedIdempotentResponse,
} from "@/lib/api/idempotency";
import { createRequestLogger } from "@/lib/api/logger";
import { checkWriteRateLimit } from "@/lib/api/rate-limit";
import { GraphIdParam } from "@/lib/api/schemas/queries";
import {
  DeleteGraphResponse,
  GraphDetailResponse,
} from "@/lib/api/schemas/responses";
import { parseParams } from "@/lib/api/validators";
import { validateAndSend } from "@/lib/api/validators";
import { prisma } from "@/lib/db";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ graphId: string }> }
) {
  try {
    const ownerOrRes = await requireOwner();
    if (ownerOrRes instanceof Response) return ownerOrRes;
    const { owner } = ownerOrRes;

    const { log, ctx } = createRequestLogger(_, {
      route: "GET /v1/graphs/:id",
      userId: owner.id,
    });
    log.info({ event: "request_start" });

    const parsedParams = await parseParams(params, GraphIdParam);
    if (parsedParams instanceof Response) return parsedParams;
    const { graphId } = parsedParams;

    const graph = await prisma.graph.findFirst({
      where: { id: graphId, userId: owner.id },
      select: { id: true, title: true, createdAt: true, lastActivityAt: true },
    });
    if (!graph) return Errors.notFound("Graph");

    const branches = await prisma.branch.findMany({
      where: { graphId: graph.id },
      select: {
        id: true,
        name: true,
        rootNodeId: true,
        tipNodeId: true,
        version: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const res = validateAndSend({ graph, branches }, GraphDetailResponse, 200);
    log.info({ event: "request_end", durationMs: Date.now() - ctx.startedAt });
    return res;
  } catch (err) {
    const { log } = createRequestLogger(_, {
      route: "GET /v1/graphs/:id",
      userId: "unknown",
    });
    log.error({ event: "request_error", error: err });
    return jsonError("INTERNAL", "Internal server error");
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ graphId: string }> }
) {
  try {
    const ownerOrRes = await requireOwner();
    if (ownerOrRes instanceof Response) return ownerOrRes;
    const { owner } = ownerOrRes;

    const rl = checkWriteRateLimit(owner.id, "DELETE /v1/graphs/:id");
    if (rl) {
      const { log } = createRequestLogger(req, {
        route: "DELETE /v1/graphs/:id",
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
      route: "DELETE /v1/graphs/:id",
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

    const parsedParams = await parseParams(params, GraphIdParam);
    if (parsedParams instanceof Response) return parsedParams;
    const { graphId } = parsedParams;

    // Verify ownership
    const graph = await prisma.graph.findFirst({
      where: { id: graphId, userId: owner.id },
      select: { id: true },
    });
    if (!graph) return Errors.notFound("Graph");

    // Delete graph (cascade will handle nodes, edges, branches)
    const txStart = Date.now();
    await prisma.graph.delete({
      where: { id: graphId },
    });
    log.info({ event: "tx_end", ok: true, durationMs: Date.now() - txStart });

    const result = {
      graphId,
      deletedAt: new Date().toISOString(),
    };

    // Cache idempotent result
    await cacheIdempotentResponse({
      req,
      userId: owner.id,
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: result,
    });

    const res = validateAndSend(result, DeleteGraphResponse, 200);
    log.info({ event: "request_end", durationMs: Date.now() - ctx.startedAt });
    return res;
  } catch (err) {
    const { log } = createRequestLogger(req, {
      route: "DELETE /v1/graphs/:id",
      userId: "unknown",
    });
    log.error({ event: "request_error", error: err });
    return jsonError("INTERNAL", "Failed to delete graph");
  }
}
