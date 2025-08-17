import { auth } from "@clerk/nextjs/server";

import { Errors, jsonError } from "@/lib/api/errors";
import {
  cacheIdempotentResponse,
  getCachedIdempotentResponse,
} from "@/lib/api/idempotency";
import { StartGraphBody } from "@/lib/api/validation";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma";
import { ensureCurrentUserExists } from "@/lib/users/ensure-user";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return Errors.forbidden();

    // Ensure DB user exists and get internal user id (cuid)
    await ensureCurrentUserExists();
    const owner = await prisma.user.findUnique({
      where: { clerkUserId: userId },
    });
    if (!owner) {
      return jsonError("INTERNAL", "Authenticated user record missing");
    }

    // Idempotency replay
    const cached = await getCachedIdempotentResponse(req, userId);
    if (cached) {
      return new Response(JSON.stringify(cached.body ?? {}), {
        status: cached.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const json = await req.json().catch(() => null);
    const parsed = StartGraphBody.safeParse(json);
    if (!parsed.success) {
      return Errors.validation("Invalid request body", parsed.error.flatten());
    }
    const { title, firstMessage, branchName } = parsed.data;

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

    // Cache idempotent result
    await cacheIdempotentResponse({
      req,
      userId,
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: result,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("/v1/graphs:start error", err);
    return jsonError("INTERNAL", "Internal server error");
  }
}
