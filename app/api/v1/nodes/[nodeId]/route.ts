import { requireOwner } from "@/lib/api/auth";
import { Errors, jsonError } from "@/lib/api/errors";
import { createRequestLogger } from "@/lib/api/logger";
import { checkWriteRateLimit } from "@/lib/api/rate-limit";
import { NodeIdParam } from "@/lib/api/schemas/queries";
import { DeleteNodeBody } from "@/lib/api/schemas/requests";
import { DeleteNodeResponse } from "@/lib/api/schemas/responses";
import { parseParams } from "@/lib/api/validators";
import { validateAndSend } from "@/lib/api/validators";
import { prisma } from "@/lib/db";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  try {
    const ownerOrRes = await requireOwner();
    if (ownerOrRes instanceof Response) return ownerOrRes;
    const { owner } = ownerOrRes;

    const parsedParams = await parseParams(params, NodeIdParam);
    if (parsedParams instanceof Response) return parsedParams;
    const { nodeId } = parsedParams;
    const rl = checkWriteRateLimit(owner.id, "DELETE /v1/nodes/:id");
    if (rl) {
      const { log } = createRequestLogger(req, {
        route: "DELETE /v1/nodes/:id",
        userId: owner.id,
      });
      log.warn({
        event: "rate_limit_reject",
        limit: "writes_per_min",
        max: 60,
      });
      return rl;
    }
    const json = await req.json().catch(() => ({}));
    const parsed = DeleteNodeBody.safeParse(json);
    const { log, ctx } = createRequestLogger(req, {
      route: "DELETE /v1/nodes/:id",
      userId: owner.id,
    });
    log.info({ event: "request_start" });
    if (!parsed.success) {
      log.info({ event: "validation_result", ok: false });
      return Errors.validation("Invalid request body", parsed.error.flatten());
    }
    log.info({ event: "validation_result", ok: true });
    const { removeReferences = true, expectedVersions } = parsed.data;

    const txStart = Date.now();
    const result = await prisma.$transaction(async (tx) => {
      const node = await tx.graphNode.findUnique({
        where: { id: nodeId },
      });
      if (!node) return { error: Errors.notFound("Node") };

      const graph = await tx.graph.findUnique({ where: { id: node.graphId } });
      if (!graph || graph.userId !== owner.id)
        return { error: Errors.forbidden() };

      // Check if node is root for any branch
      const rootBranches = await tx.branch.findMany({
        where: { graphId: node.graphId, rootNodeId: nodeId },
        select: { id: true },
      });
      if (rootBranches.length > 0)
        return {
          error: jsonError(
            "CANNOT_DELETE_BRANCH_ROOT",
            "Node is the root for one or more branches.",
            {
              branchIds: rootBranches.map((b) => b.id),
            }
          ),
        };

      // Find incoming follows parent (latest by createdAt)
      const incoming = await tx.blockEdge.findFirst({
        where: {
          graphId: node.graphId,
          childNodeId: nodeId,
          relation: "follows",
          deletedAt: null,
        },
        orderBy: { createdAt: "desc" },
      });

      // Retarget any branches whose tip equals this node to the incoming parent
      const branchesToRetarget = await tx.branch.findMany({
        where: { graphId: node.graphId, tipNodeId: nodeId },
      });

      const retargetedTips: Array<{
        branchId: string;
        oldTip: string;
        newTip: string | null;
        version: number;
      }> = [];
      for (const br of branchesToRetarget) {
        const expected = expectedVersions?.[br.id] ?? br.version;
        const newTip = incoming?.parentNodeId ?? null;
        const updated = await tx.branch.updateMany({
          where: { id: br.id, version: expected },
          data: { tipNodeId: newTip, version: { increment: 1 } },
        });
        if (updated.count === 0) {
          return {
            error: Errors.conflictTip(br.tipNodeId ?? null, br.version),
          };
        }
        retargetedTips.push({
          branchId: br.id,
          oldTip: nodeId,
          newTip,
          version: br.version + 1,
        });
      }

      // Hide node
      const hidden = await tx.graphNode.update({
        where: { id: nodeId },
        data: { hiddenAt: new Date() },
      });

      // Soft-delete references touching it
      let deletedEdges = 0;
      if (removeReferences) {
        const res1 = await tx.blockEdge.updateMany({
          where: {
            graphId: node.graphId,
            OR: [{ parentNodeId: nodeId }, { childNodeId: nodeId }],
            relation: "references",
            deletedAt: null,
          },
          data: { deletedAt: new Date() },
        });
        deletedEdges += res1.count;
      }

      await tx.graph.update({
        where: { id: node.graphId },
        data: { lastActivityAt: new Date() },
      });

      const out = {
        nodeId,
        hiddenAt: hidden.hiddenAt,
        affected: {
          deletedEdges,
          retargetedTips,
        },
      };
      return out;
    });

    log.info({ event: "tx_end", ok: true, durationMs: Date.now() - txStart });

    if (result instanceof Response) return result;
    if ("error" in result && result.error instanceof Response)
      return result.error;
    const res = validateAndSend(result, DeleteNodeResponse, 200);
    log.info({ event: "request_end", durationMs: Date.now() - ctx.startedAt });
    return res;
  } catch (err) {
    console.error("DELETE /v1/nodes/{nodeId} error", err);
    return jsonError("INTERNAL", "Internal server error");
  }
}
