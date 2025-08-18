import { requireOwner } from "@/lib/api/auth";
import { Errors, jsonError } from "@/lib/api/errors";
import { DeleteNodeBody } from "@/lib/api/validation";
import { prisma } from "@/lib/db";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  try {
    const ownerOrRes = await requireOwner();
    if (ownerOrRes instanceof Response) return ownerOrRes;
    const { owner } = ownerOrRes;

    const { nodeId } = await params;
    const json = await req.json().catch(() => ({}));
    const parsed = DeleteNodeBody.safeParse(json);
    if (!parsed.success)
      return Errors.validation("Invalid request body", parsed.error.flatten());
    const { removeReferences = true, expectedVersions } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const node = await tx.graphNode.findUnique({
        where: { id: nodeId },
      });
      if (!node) return { error: Errors.notFound("Node") };

      const graph = await tx.graph.findUnique({ where: { id: node.graphId } });
      if (!graph || graph.userId !== owner.id)
        return { error: Errors.forbidden() };

      // Check if node is root for any branch
      const rootBranches = await tx.branch.findMany({
        where: { graphId: node.graphId, rootNodeId: nodeId },
        select: { id: true },
      });
      if (rootBranches.length > 0)
        return {
          error: jsonError(
            "CANNOT_DELETE_BRANCH_ROOT",
            "Node is the root for one or more branches.",
            {
              branchIds: rootBranches.map((b) => b.id),
            }
          ),
        };

      // Find incoming follows parent (latest by createdAt)
      const incoming = await tx.blockEdge.findFirst({
        where: {
          graphId: node.graphId,
          childNodeId: nodeId,
          relation: "follows",
          deletedAt: null,
        },
        orderBy: { createdAt: "desc" },
      });

      // Retarget any branches whose tip equals this node to the incoming parent
      const branchesToRetarget = await tx.branch.findMany({
        where: { graphId: node.graphId, tipNodeId: nodeId },
      });

      const retargetedTips: Array<{
        branchId: string;
        oldTip: string;
        newTip: string | null;
        version: number;
      }> = [];
      for (const br of branchesToRetarget) {
        const expected = expectedVersions?.[br.id] ?? br.version;
        const newTip = incoming?.parentNodeId ?? null;
        const updated = await tx.branch.updateMany({
          where: { id: br.id, version: expected },
          data: { tipNodeId: newTip, version: { increment: 1 } },
        });
        if (updated.count === 0) {
          return {
            error: Errors.conflictTip(br.tipNodeId ?? null, br.version),
          };
        }
        retargetedTips.push({
          branchId: br.id,
          oldTip: nodeId,
          newTip,
          version: br.version + 1,
        });
      }

      // Hide node
      const hidden = await tx.graphNode.update({
        where: { id: nodeId },
        data: { hiddenAt: new Date() },
      });

      // Soft-delete references touching it
      let deletedEdges = 0;
      if (removeReferences) {
        const res1 = await tx.blockEdge.updateMany({
          where: {
            graphId: node.graphId,
            OR: [{ parentNodeId: nodeId }, { childNodeId: nodeId }],
            relation: "references",
            deletedAt: null,
          },
          data: { deletedAt: new Date() },
        });
        deletedEdges += res1.count;
      }

      await tx.graph.update({
        where: { id: node.graphId },
        data: { lastActivityAt: new Date() },
      });

      return {
        nodeId,
        hiddenAt: hidden.hiddenAt,
        affected: {
          deletedEdges,
          retargetedTips,
        },
      };
    });

    if (result instanceof Response) return result;
    if ("error" in result && result.error instanceof Response)
      return result.error;
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("DELETE /v1/nodes/{nodeId} error", err);
    return jsonError("INTERNAL", "Internal server error");
  }
}
