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

    // Walk follows from root or cursor forward, skipping deleted/hidden
    // Use explicit sequence tracking for deterministic chronological order
    const haveCursor = Boolean(cursorNodeId);
    const sql = `with recursive walk(id, seq) as (
        select $1::text as id, 0 as seq
        union all
        select e."childNodeId", walk.seq + 1
        from walk
        join "BlockEdge" e on e."parentNodeId" = walk.id
        where e."graphId" = $2 and e."relation" = 'follows' and e."deletedAt" is null
      )
      select id as "nodeId" from walk
      ${haveCursor ? "where id >= $3" : ""}
      order by seq
      limit ${haveCursor ? "$4" : "$3"}`;
    const paramsArr = haveCursor
      ? [br.rootNodeId, br.graphId, cursorNodeId, limit + 1]
      : [br.rootNodeId, br.graphId, limit + 1];
    const rows = await prisma.$queryRawUnsafe<Array<{ nodeId: string }>>(
      sql,
      ...paramsArr
    );

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
