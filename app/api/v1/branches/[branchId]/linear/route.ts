import { requireOwner } from "@/lib/api/auth";
import { Errors, jsonError } from "@/lib/api/errors";
import { createRequestLogger } from "@/lib/api/logger";
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

    const { branchId } = await params;
    const { log, ctx } = createRequestLogger(req, {
      route: "GET /v1/branches/:id/linear",
      userId: owner.id,
    });
    log.info({ event: "request_start" });
    const url = new URL(req.url);
    const limit = Math.min(
      parseInt(url.searchParams.get("limit") || "50", 10),
      200
    );
    const cursorNodeId = url.searchParams.get("cursorNodeId");
    const includeRefs = (url.searchParams.get("include") || "")
      .split(",")
      .includes("references");

    const br = await prisma.branch.findUnique({
      where: { id: branchId },
      include: { graph: true },
    });
    if (!br) return Errors.notFound("Branch");
    if (br.graph.userId !== owner.id) return Errors.forbidden();

    // Walk follows from root or cursor forward, skipping deleted/hidden
    const haveCursor = Boolean(cursorNodeId);
    const sql = `with recursive walk(id) as (
        select $1::text as id
        union all
        select e."childNodeId" from walk
        join "BlockEdge" e on e."parentNodeId" = walk.id
        where e."graphId" = $2 and e."relation" = 'follows' and e."deletedAt" is null
      )
      select id as "nodeId" from walk
      ${haveCursor ? "where id >= $3" : ""}
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

    const res = new Response(
      JSON.stringify({ items: items.filter(Boolean), nextCursor }),
      { headers: { "Content-Type": "application/json" } }
    );
    log.info({ event: "request_end", durationMs: Date.now() - ctx.startedAt });
    return res;
  } catch (err) {
    console.error("GET /v1/branches/{branchId}:linear error", err);
    return jsonError("INTERNAL", "Internal server error");
  }
}
