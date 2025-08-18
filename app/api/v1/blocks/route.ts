import { requireOwner } from "@/lib/api/auth";
import { Errors } from "@/lib/api/errors";
import { createRequestLogger } from "@/lib/api/logger";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma";

export async function GET(req: Request) {
  try {
    const ownerOrRes = await requireOwner();
    if (ownerOrRes instanceof Response) return ownerOrRes;
    const { owner } = ownerOrRes;

    const url = new URL(req.url);
    const { log, ctx } = createRequestLogger(req, {
      route: "GET /v1/blocks",
      userId: owner.id,
    });
    log.info({ event: "request_start" });
    const limit = Math.min(
      parseInt(url.searchParams.get("limit") || "20", 10),
      100
    );
    const cursor = url.searchParams.get("cursor");
    const publicOnly =
      (url.searchParams.get("public") ?? "true").toLowerCase() !== "false";
    const kind = url.searchParams.get("kind");
    const q = url.searchParams.get("q")?.trim();

    const kindFilter: "user" | "assistant" | undefined =
      kind === "user" || kind === "assistant"
        ? (kind as "user" | "assistant")
        : undefined;

    const where: Prisma.ContextBlockWhereInput = {
      userId: owner.id,
      ...(publicOnly ? { public: true } : {}),
      ...(kindFilter ? { kind: kindFilter } : {}),
      ...(q
        ? {
            content: {
              path: ["text"],
              string_contains: q,
            } as Prisma.JsonFilter,
          }
        : {}),
    };

    const items = await prisma.contextBlock.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        kind: true,
        content: true,
        public: true,
        createdAt: true,
        checksum: true,
        model: true,
      },
    });

    let nextCursor: string | null = null;
    if (items.length > limit) {
      const next = items.pop();
      nextCursor = next?.id ?? null;
    }

    const res = new Response(JSON.stringify({ items, nextCursor }), {
      headers: { "Content-Type": "application/json" },
    });
    log.info({ event: "request_end", durationMs: Date.now() - ctx.startedAt });
    return res;
  } catch (err) {
    console.error("GET /v1/blocks error", err);
    return Errors.notFound("Blocks");
  }
}
