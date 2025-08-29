import { prisma } from "@/lib/db";

import { BlockKind } from "../generated/prisma";

// Rough but simple way to estimate tokens, if not available at the block
const estimateTokens = (text: string) =>
  Math.max(1, Math.ceil(text?.length ?? 0) / 4);

export async function buildSimpleContext(
  branchId: string,
  tokenLimit = 10000,
  maxNodes = 20
) {
  try {
    // Fetch up to 20 nodes walking backwards from branch tip
    const rows = await prisma.$queryRawUnsafe<
      Array<{
        node_id: string;
        depth: number;
        kind: BlockKind;
        content: { text: string };
        token_count: number | null;
      }>
    >(
      `
    WITH RECURSIVE trail AS (
      SELECT b."graphId" AS graph_id, n.id AS node_id, 0 AS depth
      FROM "Branch" b
      JOIN "GraphNode" n ON n.id = b."tipNodeId"
      WHERE b.id = $1 AND n."hiddenAt" IS NULL
      UNION ALL
      SELECT t.graph_id, e."parentNodeId", t.depth + 1
      FROM trail t
      JOIN "BlockEdge" e
        ON e."childNodeId" = t.node_id
       AND e."graphId"     = t.graph_id
       AND e."relation"    = 'follows'
       AND e."deletedAt"   IS NULL
      JOIN "GraphNode" pn
        ON pn.id = e."parentNodeId"
       AND pn."hiddenAt" IS NULL
      WHERE t.depth < 200
    )
    SELECT t.node_id, t.depth, cb."kind", cb."content", cb."tokenCount" AS token_count
    FROM trail t
    JOIN "GraphNode" gn ON gn.id = t.node_id
    JOIN "ContextBlock" cb ON cb.id = gn."blockId"
    ORDER BY t.depth DESC
    LIMIT $2;
    `,
      branchId,
      maxNodes
    );

    // Now we want to make sure the retrived 20 context blocks are within the token limit

    let currentTokens = 0;
    let context = "";

    for (const r of rows) {
      const blockTokens = r.token_count ?? estimateTokens(r.content.text);

      currentTokens += blockTokens;
      if (currentTokens <= tokenLimit) context += `${r.content?.text} \n`;
    }

    return context;
  } catch (e) {
    // TODO: Implement proper errors
    throw new Error("This did not work: " + e);
  }
}
