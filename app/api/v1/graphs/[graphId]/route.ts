import { requireOwner } from "@/lib/api/auth";
import { Errors } from "@/lib/api/errors";
import { createRequestLogger } from "@/lib/api/logger";
import { GraphIdParam } from "@/lib/api/schemas/queries";
import { GraphDetailResponse } from "@/lib/api/schemas/responses";
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
    console.error("GET /v1/graphs/{graphId} error", err);
    return Errors.notFound("Graph");
  }
}
