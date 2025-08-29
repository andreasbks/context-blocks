import { requireOwner } from "@/lib/api/auth";
import { Errors } from "@/lib/api/errors";
import { createRequestLogger } from "@/lib/api/logger";
import { GraphsListQuery } from "@/lib/api/schemas/queries";
import { GraphsListResponse } from "@/lib/api/schemas/responses";
import { parseQuery } from "@/lib/api/validators";
import { validateAndSend } from "@/lib/api/validators";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const ownerOrRes = await requireOwner();
    if (ownerOrRes instanceof Response) return ownerOrRes;
    const { owner } = ownerOrRes;

    const url = new URL(req.url);
    const { log, ctx } = createRequestLogger(req, {
      route: "GET /v1/graphs",
      userId: owner.id,
    });
    log.info({ event: "request_start" });
    const query = parseQuery(url.searchParams, GraphsListQuery);
    if (query instanceof Response) return query;
    const { limit, cursor } = query;

    const items = await prisma.graph.findMany({
      where: { userId: owner.id },
      orderBy: { lastActivityAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, title: true, createdAt: true, lastActivityAt: true },
    });

    let nextCursor: string | null = null;
    if (items.length > limit) {
      const next = items.pop();
      nextCursor = next?.id ?? null;
    }

    const res = validateAndSend({ items, nextCursor }, GraphsListResponse, 200);
    log.info({ event: "request_end", durationMs: Date.now() - ctx.startedAt });
    return res;
  } catch (err) {
    console.error("GET /v1/graphs error", err);
    return Errors.notFound("Graphs");
  }
}
