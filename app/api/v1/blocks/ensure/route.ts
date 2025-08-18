import { requireOwner } from "@/lib/api/auth";
import { Errors, jsonError } from "@/lib/api/errors";
import {
  cacheIdempotentResponse,
  getCachedIdempotentResponse,
} from "@/lib/api/idempotency";
import { EnsureBlockBody } from "@/lib/api/validation";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma";

export async function POST(req: Request) {
  try {
    const ownerOrRes = await requireOwner();
    if (ownerOrRes instanceof Response) return ownerOrRes;
    const { owner } = ownerOrRes;

    const cached = await getCachedIdempotentResponse(req, owner.id);
    if (cached) {
      return new Response(JSON.stringify(cached.body ?? {}), {
        status: cached.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const json = await req.json().catch(() => null);
    const parsed = EnsureBlockBody.safeParse(json);
    if (!parsed.success)
      return Errors.validation("Invalid request body", parsed.error.flatten());
    const { kind, content, checksum, public: isPublic, model } = parsed.data;

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

    await cacheIdempotentResponse({
      req,
      userId: owner.id,
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: resBody,
    });

    return new Response(JSON.stringify(resBody), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("POST /v1/blocks/ensure error", err);
    return jsonError("INTERNAL", "Internal server error");
  }
}
