import { requireOwner } from "@/lib/api/auth";
import { Errors, jsonError } from "@/lib/api/errors";
import { InjectBody } from "@/lib/api/validation";
import { prisma } from "@/lib/db";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ branchId: string }> }
) {
  try {
    const ownerOrRes = await requireOwner();
    if (ownerOrRes instanceof Response) return ownerOrRes;
    const { owner } = ownerOrRes;

    const { branchId } = await params;
    const body = await req.json().catch(() => null);
    const parsed = InjectBody.safeParse(body);
    if (!parsed.success) {
      return Errors.validation("Invalid request body", parsed.error.flatten());
    }
    const { blockId, reuseExistingNode } = parsed.data;

    // Verify branch ownership
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      include: { graph: true },
    });
    if (!branch) return Errors.notFound("Branch");
    if (branch.graph.userId !== owner.id) return Errors.forbidden();

    // Verify block ownership
    const block = await prisma.contextBlock.findUnique({
      where: { id: blockId },
    });
    if (!block || block.userId !== owner.id) return Errors.forbidden();

    // Reuse existing node in this graph or create a new one
    let node = null as null | { id: string };
    if (reuseExistingNode) {
      node = await prisma.graphNode.findFirst({
        where: { graphId: branch.graphId, blockId },
      });
    }
    if (!node) {
      node = await prisma.graphNode.create({
        data: { graphId: branch.graphId, blockId },
      });
    }

    // Insert references edge from current tip to node
    const ref = await prisma.blockEdge.create({
      data: {
        graphId: branch.graphId,
        parentNodeId: branch.tipNodeId!,
        childNodeId: node.id,
        relation: "references",
        ord: 0,
      },
      include: {
        childNode: { include: { block: true } },
      },
    });

    return new Response(
      JSON.stringify({
        reference: { nodeId: ref.childNodeId, block: ref.childNode.block },
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("POST /v1/branches/{branchId}:inject error", err);
    return jsonError("INTERNAL", "Internal server error");
  }
}
