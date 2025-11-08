import { requireOwner } from "@/lib/api/auth";
import { Errors, jsonError } from "@/lib/api/errors";
import { createRequestLogger } from "@/lib/api/logger";
import { BranchIdParam } from "@/lib/api/schemas/queries";
import { BranchPreviewResponse } from "@/lib/api/schemas/responses";
import { parseParams } from "@/lib/api/validators";
import { validateAndSend } from "@/lib/api/validators";
import { prisma } from "@/lib/db";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ branchId: string }> }
) {
  try {
    const ownerOrRes = await requireOwner();
    if (ownerOrRes instanceof Response) return ownerOrRes;
    const { owner } = ownerOrRes;

    const parsedParams = await parseParams(params, BranchIdParam);
    if (parsedParams instanceof Response) return parsedParams;
    const { branchId } = parsedParams;

    const { log, ctx } = createRequestLogger(req, {
      route: "GET /v1/branches/:id/preview",
      userId: owner.id,
    });
    log.info({ event: "request_start" });

    const br = await prisma.branch.findUnique({
      where: { id: branchId },
      include: { graph: true },
    });

    if (!br) return Errors.notFound("Branch");
    if (br.graph.userId !== owner.id) return Errors.forbidden();

    // Get the first 3 messages starting from the branch's divergence point
    // This means starting from the CHILD of the rootNode (the first unique message in this branch)
    if (!br.rootNodeId) {
      // Empty branch (no root yet)
      return validateAndSend({ items: [] }, BranchPreviewResponse, 200);
    }

    // First, find the child of the root node (the divergence point)
    const firstEdge = await prisma.blockEdge.findFirst({
      where: {
        graphId: br.graphId,
        parentNodeId: br.rootNodeId,
        relation: "follows",
        deletedAt: null,
      },
      select: { childNodeId: true },
    });

    // If there's no child, the branch hasn't diverged yet (just the root node)
    if (!firstEdge) {
      return validateAndSend({ items: [] }, BranchPreviewResponse, 200);
    }

    // Walk forward from the first divergent node (child of root) following 'follows' edges
    const forwardWalkSql = `
      with recursive walk(id, depth) as (
        select $1::text as id, 0 as depth
        union all
        select e."childNodeId", walk.depth + 1
        from walk
        join "BlockEdge" e on e."parentNodeId" = walk.id
        join "GraphNode" cn on cn.id = e."childNodeId"
        where e."graphId" = $2 
          and e."relation" = 'follows' 
          and e."deletedAt" is null
          and cn."hiddenAt" is null
          and walk.depth < 3
      )
      select id as "nodeId", depth 
      from walk
      where id is not null
      order by depth asc
      limit 3
    `;

    const rows = await prisma.$queryRawUnsafe<
      Array<{ nodeId: string; depth: number }>
    >(forwardWalkSql, firstEdge.childNodeId, br.graphId);

    const items = await Promise.all(
      rows.map(async ({ nodeId }) => {
        const node = await prisma.graphNode.findUnique({
          where: { id: nodeId },
          include: { block: true },
        });
        if (!node || node.hiddenAt) return null;

        return {
          nodeId,
          block: {
            id: node.block.id,
            kind: node.block.kind,
            content: node.block.content,
          },
        };
      })
    );

    const res = validateAndSend(
      { items: items.filter(Boolean) },
      BranchPreviewResponse,
      200
    );
    log.info({ event: "request_end", durationMs: Date.now() - ctx.startedAt });
    return res;
  } catch (err) {
    console.error("GET /v1/branches/{branchId}/preview error", err);
    return jsonError("INTERNAL", "Internal server error");
  }
}
