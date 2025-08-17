import { requireOwner } from "@/lib/api/auth";
import { Errors } from "@/lib/api/errors";
import { prisma } from "@/lib/db";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ graphId: string }> }
) {
  try {
    const ownerOrRes = await requireOwner();
    if (ownerOrRes instanceof Response) return ownerOrRes;
    const { owner } = ownerOrRes;

    const { graphId } = await params;

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

    return new Response(JSON.stringify({ graph, branches }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("GET /v1/graphs/{graphId} error", err);
    return Errors.notFound("Graph");
  }
}
