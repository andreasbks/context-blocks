import { auth } from "@clerk/nextjs/server";

import { Errors } from "@/lib/api/errors";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return Errors.forbidden();

    const url = new URL(req.url);
    const limit = Math.min(
      parseInt(url.searchParams.get("limit") || "20", 10),
      100
    );
    const cursor = url.searchParams.get("cursor");

    const items = await prisma.graph.findMany({
      where: { userId },
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

    return new Response(JSON.stringify({ items, nextCursor }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("GET /v1/graphs error", err);
    return Errors.notFound("Graphs");
  }
}
