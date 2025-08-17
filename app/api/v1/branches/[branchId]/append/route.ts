import { requireOwner } from "@/lib/api/auth";
import { Errors, jsonError } from "@/lib/api/errors";
import {
  cacheIdempotentResponse,
  getCachedIdempotentResponse,
} from "@/lib/api/idempotency";
import { AppendBody } from "@/lib/api/validation";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ branchId: string }> }
) {
  try {
    const ownerOrRes = await requireOwner();
    if (ownerOrRes instanceof Response) return ownerOrRes;
    const { owner } = ownerOrRes;

    // Idempotency replay
    const cached = await getCachedIdempotentResponse(req, owner.id);
    if (cached) {
      return new Response(JSON.stringify(cached.body ?? {}), {
        status: cached.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => null);
    const parsed = AppendBody.safeParse(body);
    if (!parsed.success) {
      return Errors.validation("Invalid request body", parsed.error.flatten());
    }
    const {
      author,
      content,
      model,
      expectedVersion,
      forkFromNodeId,
      newBranchName,
    } = parsed.data;

    // Preload branch and verify ownership (clear error semantics)
    const { branchId } = await params;
    const baseBranch = await prisma.branch.findUnique({
      where: { id: branchId },
      include: { graph: true },
    });
    if (!baseBranch) return Errors.notFound("Branch");
    if (baseBranch.graph.userId !== owner.id) return Errors.forbidden();

    // If forking, ensure fromNode belongs to same graph
    if (forkFromNodeId) {
      const fromNode = await prisma.graphNode.findUnique({
        where: { id: forkFromNodeId },
      });
      if (!fromNode || fromNode.graphId !== baseBranch.graphId) {
        return Errors.validation(
          "forkFromNodeId must belong to the same graph"
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // Optional fork
      const targetBranch = forkFromNodeId
        ? await tx.branch.create({
            data: {
              graphId: baseBranch.graphId,
              name: newBranchName ?? `fork-${forkFromNodeId.slice(-6)}`,
              rootNodeId: forkFromNodeId,
              tipNodeId: forkFromNodeId,
              version: 0,
            },
          })
        : baseBranch;

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

      const block = await tx.contextBlock.create({
        data: {
          userId: owner.id,
          kind: author,
          content: content as unknown as Prisma.InputJsonValue,
          model: model ?? null,
          public: false,
        },
      });
      const node = await tx.graphNode.create({
        data: { graphId: targetBranch.graphId, blockId: block.id },
      });

      // Insert follows edge and advance tip with CAS
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
        throw Errors.conflictTip(
          targetBranch.tipNodeId ?? null,
          targetBranch.version ?? 0
        );
      }

      await tx.graph.update({
        where: { id: targetBranch.graphId },
        data: { lastActivityAt: new Date() },
      });

      if (forkFromNodeId) {
        return {
          branch: {
            id: targetBranch.id,
            graphId: targetBranch.graphId,
            name: targetBranch.name,
            rootNodeId: targetBranch.rootNodeId,
            tipNodeId: node.id,
            version: 1,
          },
          item: { nodeId: node.id, block },
        };
      }

      return {
        item: { nodeId: node.id, block },
        newTip: node.id,
        version: baseBranch.version + 1,
      };
    });

    // Always expect a result object at this point

    await cacheIdempotentResponse({
      req,
      userId: owner.id,
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: result,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("POST /v1/branches/{branchId}:append error", err);
    return jsonError("INTERNAL", "Internal server error");
  }
}
