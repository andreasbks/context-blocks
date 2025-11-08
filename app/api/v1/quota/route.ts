import { requireOwner } from "@/lib/api/auth";
import { jsonError } from "@/lib/api/errors";
import { createRequestLogger } from "@/lib/api/logger";
import { checkQuota } from "@/lib/api/quota";
import { checkReadRateLimit } from "@/lib/api/rate-limit";

export const runtime = "nodejs";

/**
 * GET /api/v1/quota
 * Returns the current user's token quota status
 */
export async function GET(req: Request) {
  try {
    const ownerOrRes = await requireOwner();
    if (ownerOrRes instanceof Response) return ownerOrRes;
    const { owner } = ownerOrRes;

    const rl = checkReadRateLimit(owner.id, "GET /v1/quota");
    if (rl) {
      const { log } = createRequestLogger(req, {
        route: "GET /v1/quota",
        userId: owner.id,
      });
      log.warn({
        event: "rate_limit_reject",
        limit: "reads_per_min",
        max: 300,
      });
      return rl;
    }

    const { log, ctx } = createRequestLogger(req, {
      route: "GET /v1/quota",
      userId: owner.id,
    });
    log.info({ event: "request_start" });

    const quotaStatus = await checkQuota(owner.id);

    log.info({ event: "request_end", durationMs: Date.now() - ctx.startedAt });

    return new Response(JSON.stringify(quotaStatus), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const { log } = createRequestLogger(req, {
      route: "GET /v1/quota",
      userId: "unknown",
    });
    log.error({ event: "request_error", error: err });
    return jsonError("INTERNAL", "Internal server error");
  }
}
