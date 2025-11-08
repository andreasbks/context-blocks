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

    // Get the first 2 messages starting from the branch's divergence point
    // Strategy: backtrack from tip to root, then take the first 2 messages after the root
    if (!br.tipNodeId) {
      // Empty branch (no tip yet)
      return validateAndSend({ items: [] }, BranchPreviewResponse, 200);
    }

    // Backtrack from tip to root to get the full timeline of THIS branch
    const allRows = await prisma.$queryRaw<
      Array<{ nodeId: string; depth: number }>
    >`
      with recursive backtrack(id, depth) as (
        select ${br.tipNodeId}::text as id, 0 as depth
        union all
        select e."parentNodeId", backtrack.depth + 1
        from backtrack
        join "BlockEdge" e on e."childNodeId" = backtrack.id
        join "GraphNode" pn on pn.id = e."parentNodeId"
        where e."graphId" = ${br.graphId} 
          and e."relation" = 'follows' 
          and e."deletedAt" is null
          and pn."hiddenAt" is null
          and backtrack.depth < 200
      )
      select id as "nodeId", depth 
      from backtrack
      where id is not null
      order by depth desc
    `;

    // Find the index of the root node in the timeline
    const rootIndex = allRows.findIndex((row) => row.nodeId === br.rootNodeId);

    // If root not found or it's at the end, no preview available
    if (rootIndex === -1 || rootIndex === allRows.length - 1) {
      return validateAndSend({ items: [] }, BranchPreviewResponse, 200);
    }

    // Get the first 2 messages AFTER the root (unique to this branch)
    const rows = allRows.slice(rootIndex + 1, rootIndex + 3);

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
