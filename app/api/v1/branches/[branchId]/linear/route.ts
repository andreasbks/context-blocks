import { requireOwner } from "@/lib/api/auth";
import { Errors, jsonError } from "@/lib/api/errors";
import { createRequestLogger } from "@/lib/api/logger";
import { BranchIdParam, LinearQuery } from "@/lib/api/schemas/queries";
import { LinearResponse } from "@/lib/api/schemas/responses";
import { parseParams, parseQuery } from "@/lib/api/validators";
import { validateAndSend } from "@/lib/api/validators";
import { prisma } from "@/lib/db";
import type { ContextBlock } from "@/lib/generated/prisma";

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
      route: "GET /v1/branches/:id/linear",
      userId: owner.id,
    });
    log.info({ event: "request_start" });
    const url = new URL(req.url);
    const q = parseQuery(url.searchParams, LinearQuery);
    if (q instanceof Response) return q;
    const { limit, cursorNodeId, include } = q as unknown as {
      limit: number;
      cursorNodeId?: string;
      include?: string;
    };
    const includeRefs = (include || "").split(",").includes("references");

    const br = await prisma.branch.findUnique({
      where: { id: branchId },
      include: { graph: true },
    });
    if (!br) return Errors.notFound("Branch");
    if (br.graph.userId !== owner.id) return Errors.forbidden();

    // Walk backwards from tip to beginning of conversation
    // This ensures we only get nodes on THIS branch's specific path (no sibling branches)
    // Shared history before the fork is INCLUDED (that's the expected behavior)
    if (!br.tipNodeId) {
      // Empty branch (no tip yet)
      return validateAndSend(
        { items: [], nextCursor: null },
        LinearResponse,
        200
      );
    }

    // Backtrack from tip following the 'follows' edges backwards to the conversation start
    // This matches the context-building algorithm and gives the full conversation history
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

    // Apply cursor-based pagination if needed
    let rows = allRows;
    if (cursorNodeId) {
      const cursorIdx = rows.findIndex((r) => r.nodeId === cursorNodeId);
      if (cursorIdx >= 0) {
        rows = rows.slice(cursorIdx);
      }
    }

    let nextCursor: string | null = null;
    const slice = rows.slice(0, limit);
    if (rows.length > limit) nextCursor = rows[limit].nodeId;

    const items = await Promise.all(
      slice.map(async ({ nodeId }) => {
        const node = await prisma.graphNode.findUnique({
          where: { id: nodeId },
          include: { block: true },
        });
        if (!node || node.hiddenAt) return null;
        let references:
          | Array<{ nodeId: string; block: ContextBlock }>
          | undefined;
        if (includeRefs) {
          const refs = await prisma.blockEdge.findMany({
            where: {
              graphId: br.graphId,
              parentNodeId: nodeId,
              relation: "references",
              deletedAt: null,
            },
            include: { childNode: { include: { block: true } } },
          });
          references = refs.map((r) => ({
            nodeId: r.childNodeId,
            block: r.childNode.block as unknown as ContextBlock,
          }));
        }
        return { nodeId, block: node.block, references };
      })
    );

    const res = validateAndSend(
      { items: items.filter(Boolean), nextCursor },
      LinearResponse,
      200
    );
    log.info({ event: "request_end", durationMs: Date.now() - ctx.startedAt });
    return res;
  } catch (err) {
    console.error("GET /v1/branches/{branchId}:linear error", err);
    return jsonError("INTERNAL", "Internal server error");
  }
}
