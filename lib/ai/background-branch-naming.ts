import { type Message, generateBranchName } from "@/lib/ai/naming";
import { type Logger } from "@/lib/api/logger";
import { prisma } from "@/lib/db";
import { ensureUniqueBranchName } from "@/lib/utils/unique-name";

/**
 * Asynchronously generates and updates a branch name based on recent conversation context.
 * This runs in the background and does not block the response.
 *
 * @param branchId - The ID of the new branch to name
 * @param forkFromNodeId - The node ID where the fork occurred
 * @param graphId - The graph ID containing the branch
 * @param userMessageText - Optional user message text to include as context
 * @param log - Logger instance for tracking events
 */
export async function generateAndUpdateBranchName(
  branchId: string,
  forkFromNodeId: string,
  graphId: string,
  userMessageText: string | null,
  log: Logger
): Promise<void> {
  try {
    // Fetch last 5 messages from the timeline leading to fork point
    const rows = await prisma.$queryRaw<Array<{ nodeId: string }>>`
      with recursive backtrack(id, depth) as (
        select ${forkFromNodeId}::text as id, 0 as depth
        union all
        select e."parentNodeId", backtrack.depth + 1
        from backtrack
        join "BlockEdge" e on e."childNodeId" = backtrack.id
        where e."graphId" = ${graphId} 
          and e."relation" = 'follows' 
          and e."deletedAt" is null
          and backtrack.depth < 5
      )
      select id as "nodeId" 
      from backtrack
      where id is not null
      order by depth desc
    `;

    const recentMessages: Message[] = [];
    for (const { nodeId } of rows) {
      const node = await prisma.graphNode.findUnique({
        where: { id: nodeId },
        include: { block: true },
      });
      if (node && !node.hiddenAt) {
        const contentText =
          typeof node.block.content === "string"
            ? node.block.content
            : ((node.block.content as { text?: string })?.text ?? "");
        recentMessages.push({
          role: node.block.kind === "user" ? "user" : "assistant",
          content: contentText,
        });
      }
    }

    // Generate branch name from context
    const generatedName = userMessageText
      ? await generateBranchName(recentMessages, userMessageText)
      : await generateBranchName(recentMessages);

    if (generatedName) {
      const uniqueName = await ensureUniqueBranchName(graphId, generatedName);
      await prisma.branch.update({
        where: { id: branchId },
        data: { name: uniqueName },
      });
      log.info({
        event: "branch_name_generated",
        branchId,
        name: uniqueName,
      });
    }
  } catch (err) {
    log.error({
      event: "branch_name_generation_failed",
      branchId,
      error: err,
    });
  }
}
