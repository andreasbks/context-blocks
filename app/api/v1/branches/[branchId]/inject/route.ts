import { requireOwner } from "@/lib/api/auth";
import { Errors, jsonError } from "@/lib/api/errors";
import { createRequestLogger } from "@/lib/api/logger";
import { checkWriteRateLimit } from "@/lib/api/rate-limit";
import { InjectBody } from "@/lib/api/validation";
import { prisma } from "@/lib/db";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ branchId: string }> }
) {
  try {
    const ownerOrRes = await requireOwner();
    if (ownerOrRes instanceof Response) return ownerOrRes;
    const { owner } = ownerOrRes;

    const rl = checkWriteRateLimit(owner.id, "POST /v1/branches/:id/inject");
    if (rl) {
      const { log } = createRequestLogger(req, {
        route: "POST /v1/branches/:id/inject",
        userId: owner.id,
      });
      log.warn({
        event: "rate_limit_reject",
        limit: "writes_per_min",
        max: 60,
      });
      return rl;
    }

    const { branchId } = await params;
    const body = await req.json().catch(() => null);
    const parsed = InjectBody.safeParse(body);
    const { log, ctx } = createRequestLogger(req, {
      route: "POST /v1/branches/:id/inject",
      userId: owner.id,
    });
    log.info({ event: "request_start" });
    if (!parsed.success) {
      log.info({ event: "validation_result", ok: false });
      return Errors.validation("Invalid request body", parsed.error.flatten());
    }
    log.info({ event: "validation_result", ok: true });
    const { blockId, reuseExistingNode } = parsed.data;

    // Verify branch ownership
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      include: { graph: true },
    });
    if (!branch) return Errors.notFound("Branch");
    if (branch.graph.userId !== owner.id) return Errors.forbidden();

    // Verify block ownership
    const block = await prisma.contextBlock.findUnique({
      where: { id: blockId },
    });
    if (!block || block.userId !== owner.id) return Errors.forbidden();

    // Reuse existing node in this graph or create a new one
    let node = null as null | { id: string };
    if (reuseExistingNode) {
      node = await prisma.graphNode.findFirst({
        where: { graphId: branch.graphId, blockId },
      });
    }
    if (!node) {
      node = await prisma.graphNode.create({
        data: { graphId: branch.graphId, blockId },
      });
    }

    // Insert references edge from current tip to node
    const txStart = Date.now();
    const ref = await prisma.blockEdge.create({
      data: {
        graphId: branch.graphId,
        parentNodeId: branch.tipNodeId!,
        childNodeId: node.id,
        relation: "references",
        ord: 0,
      },
      include: {
        childNode: { include: { block: true } },
      },
    });
    log.info({ event: "tx_end", ok: true, durationMs: Date.now() - txStart });

    const res = new Response(
      JSON.stringify({
        reference: { nodeId: ref.childNodeId, block: ref.childNode.block },
      }),
      { headers: { "Content-Type": "application/json" } }
    );
    log.info({ event: "request_end", durationMs: Date.now() - ctx.startedAt });
    return res;
  } catch (err) {
    console.error("POST /v1/branches/{branchId}/inject error", err);
    return jsonError("INTERNAL", "Internal server error");
  }
}
