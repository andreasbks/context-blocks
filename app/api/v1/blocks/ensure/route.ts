import { requireOwner } from "@/lib/api/auth";
import { Errors, jsonError } from "@/lib/api/errors";
import {
  cacheIdempotentResponse,
  getCachedIdempotentResponse,
} from "@/lib/api/idempotency";
import { createRequestLogger } from "@/lib/api/logger";
import { checkWriteRateLimit } from "@/lib/api/rate-limit";
import { EnsureBlockBody } from "@/lib/api/validation";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma";

export async function POST(req: Request) {
  try {
    const ownerOrRes = await requireOwner();
    if (ownerOrRes instanceof Response) return ownerOrRes;
    const { owner } = ownerOrRes;

    const rl = checkWriteRateLimit(owner.id, "POST /v1/blocks/ensure");
    if (rl) {
      const { log } = createRequestLogger(req, {
        route: "POST /v1/blocks/ensure",
        userId: owner.id,
      });
      log.warn({
        event: "rate_limit_reject",
        limit: "writes_per_min",
        max: 60,
      });
      return rl;
    }

    const cached = await getCachedIdempotentResponse(req, owner.id);
    const { log, ctx } = createRequestLogger(req, {
      route: "POST /v1/blocks/ensure",
      userId: owner.id,
    });
    log.info({ event: "request_start" });
    if (cached) {
      log.info({ event: "idempotency_check", result: "hit" });
      return new Response(JSON.stringify(cached.body ?? {}), {
        status: cached.status,
        headers: { "Content-Type": "application/json" },
      });
    }
    log.info({ event: "idempotency_check", result: "miss" });

    const json = await req.json().catch(() => null);
    const parsed = EnsureBlockBody.safeParse(json);
    if (!parsed.success) {
      log.info({ event: "validation_result", ok: false });
      return Errors.validation("Invalid request body", parsed.error.flatten());
    }
    log.info({ event: "validation_result", ok: true });
    const { kind, content, checksum, public: isPublic, model } = parsed.data;

    const txStart = Date.now();
    let block;
    if (checksum) {
      block = await prisma.contextBlock.findUnique({ where: { checksum } });
      if (!block) {
        block = await prisma.contextBlock.create({
          data: {
            userId: owner.id,
            kind,
            content: content as unknown as Prisma.InputJsonValue,
            checksum,
            public: isPublic ?? true,
            model: model ?? null,
          },
        });
      }
    } else {
      block = await prisma.contextBlock.create({
        data: {
          userId: owner.id,
          kind,
          content: content as unknown as Prisma.InputJsonValue,
          public: isPublic ?? true,
          model: model ?? null,
        },
      });
    }

    const resBody = { block };
    log.info({ event: "tx_end", ok: true, durationMs: Date.now() - txStart });

    await cacheIdempotentResponse({
      req,
      userId: owner.id,
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: resBody,
    });

    const res = new Response(JSON.stringify(resBody), {
      headers: { "Content-Type": "application/json" },
    });
    log.info({ event: "request_end", durationMs: Date.now() - ctx.startedAt });
    return res;
  } catch (err) {
    console.error("POST /v1/blocks/ensure error", err);
    return jsonError("INTERNAL", "Internal server error");
  }
}
