import { requireOwner } from "@/lib/api/auth";
import { Errors, jsonError } from "@/lib/api/errors";
import { prisma } from "@/lib/db";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  try {
    const ownerOrRes = await requireOwner();
    if (ownerOrRes instanceof Response) return ownerOrRes;
    const { owner } = ownerOrRes;

    const { nodeId } = await params;
    const url = new URL(req.url);
    const limit = Math.min(
      parseInt(url.searchParams.get("limit") || "20", 10),
      100
    );
    const cursor = url.searchParams.get("cursor");

    const node = await prisma.graphNode.findUnique({
      where: { id: nodeId },
      include: { graph: true },
    });
    if (!node) return Errors.notFound("Node");
    const graph = await prisma.graph.findUnique({
      where: { id: node.graphId },
    });
    if (!graph || graph.userId !== owner.id) return Errors.forbidden();

    const refs = await prisma.blockEdge.findMany({
      where: {
        graphId: node.graphId,
        parentNodeId: nodeId,
        relation: "references",
        deletedAt: null,
      },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { childNode: { include: { block: true } } },
      orderBy: { createdAt: "asc" },
    });

    let nextCursor: string | null = null;
    if (refs.length > limit) {
      const next = refs.pop();
      nextCursor = next?.id ?? null;
    }

    const items = refs.map((r) => ({
      nodeId: r.childNodeId,
      block: r.childNode.block,
    }));
    return new Response(JSON.stringify({ items, nextCursor }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("GET /v1/nodes/{nodeId}:references error", err);
    return jsonError("INTERNAL", "Internal server error");
  }
}
