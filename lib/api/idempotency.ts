import { prisma } from "@/lib/db";

function cacheKeyParts(req: Request, userId: string) {
  // Normalize path without query for idempotency scope
  const url = new URL(req.url);
  return { userId, method: req.method, path: url.pathname };
}

export async function getCachedIdempotentResponse(
  req: Request,
  userId: string
) {
  const key = req.headers.get("Idempotency-Key");
  if (!key) return null;
  const { userId: uid, method, path } = cacheKeyParts(req, userId);
  const found = await prisma.idempotencyRequest.findUnique({
    where: { userId_method_path_key: { userId: uid, method, path, key } },
  });
  return found;
}

export async function cacheIdempotentResponse(params: {
  req: Request;
  userId: string;
  status: number;
  headers?: Record<string, string>;
  body?: unknown;
}) {
  const key = params.req.headers.get("Idempotency-Key");
  if (!key) return;
  const {
    userId: uid,
    method,
    path,
  } = cacheKeyParts(params.req, params.userId);
  await prisma.idempotencyRequest.upsert({
    where: { userId_method_path_key: { userId: uid, method, path, key } },
    update: {},
    create: {
      userId: uid,
      method,
      path,
      key,
      status: params.status,
      headers: params.headers ?? {},
      body: params.body ?? {},
    },
  });
}
