import { createHash, randomUUID } from "crypto";
import pino, { type Logger } from "pino";

export const baseLogger: Logger = pino({
  level: process.env.LOG_LEVEL || "info",
  base: undefined, // don't auto-add pid/hostname
  redact: {
    paths: [
      // Ensure we never accidentally log cookies/headers
      "req.headers.authorization",
      "req.headers.cookie",
    ],
  },
});

export function sha256(value: string | null | undefined): string | null {
  if (!value) return null;
  return createHash("sha256").update(value).digest("hex");
}

export type RequestLogContext = {
  reqId: string;
  userId: string | "anon";
  route: string;
  method: string;
  path: string;
  ipHashed: string | null;
  idempotencyKeyHashed: string | null;
  startedAt: number;
};

export function createRequestLogger(
  req: Request,
  params: { route: string; userId?: string | null }
) {
  const url = new URL(req.url);
  const reqId = randomUUID();
  const forwardedFor =
    req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null;
  const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : null;
  const idempotencyKey = req.headers.get("Idempotency-Key");
  const ctx: RequestLogContext = {
    reqId,
    userId: params.userId ?? "anon",
    route: params.route,
    method: req.method,
    path: url.pathname,
    ipHashed: sha256(ip),
    idempotencyKeyHashed: sha256(idempotencyKey),
    startedAt: Date.now(),
  };
  const log = baseLogger.child(ctx);
  return { log, ctx };
}
