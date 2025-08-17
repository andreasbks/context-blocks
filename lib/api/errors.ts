export type ErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_FAILED"
  | "DAG_CYCLE"
  | "INVALID_REACHABILITY"
  | "CONFLICT_TIP_MOVED"
  | "CANNOT_DELETE_BRANCH_ROOT"
  | "IDEMPOTENCY_REPLAY"
  | "RATE_LIMITED"
  | "INTERNAL";

export function jsonError(
  code: ErrorCode,
  message: string,
  details?: unknown,
  status?: number
) {
  const statusMap: Record<ErrorCode, number> = {
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    VALIDATION_FAILED: 400,
    DAG_CYCLE: 400,
    INVALID_REACHABILITY: 400,
    CONFLICT_TIP_MOVED: 409,
    CANNOT_DELETE_BRANCH_ROOT: 409,
    IDEMPOTENCY_REPLAY: 200,
    RATE_LIMITED: 429,
    INTERNAL: 500,
  };
  return new Response(JSON.stringify({ error: { code, message, details } }), {
    status: status ?? statusMap[code] ?? 500,
    headers: { "Content-Type": "application/json" },
  });
}

export const Errors = {
  forbidden: () => jsonError("FORBIDDEN", "Forbidden"),
  notFound: (what = "Resource") => jsonError("NOT_FOUND", `${what} not found`),
  validation: (message = "Validation failed", details?: unknown) =>
    jsonError("VALIDATION_FAILED", message, details),
  conflictTip: (currentTip: string | null, currentVersion: number) =>
    jsonError("CONFLICT_TIP_MOVED", "Branch tip has advanced", {
      currentTip,
      currentVersion,
    }),
  rateLimited: (retryAfterSeconds = 60) =>
    new Response(
      JSON.stringify({
        error: { code: "RATE_LIMITED", message: "Too many requests" },
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retryAfterSeconds),
        },
      }
    ),
};
