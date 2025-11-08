import { ErrorEnvelopeSchema } from "@/lib/api/schemas/shared";
import { SSEKeepaliveSchema } from "@/lib/api/schemas/sse";
import { type SSEContext } from "@/lib/api/sse-context";
import { writeSSE } from "@/lib/api/validators";
import { SSE_KEEPALIVE_INTERVAL_MS } from "@/lib/config";

/**
 * Sends a quota exceeded error over SSE and closes the connection.
 */
export async function sendQuotaExceededError(
  sse: SSEContext,
  details: {
    used: number;
    limit: number;
    resetDate: string;
  }
): Promise<void> {
  await writeSSE(
    ErrorEnvelopeSchema,
    "error",
    {
      error: {
        code: "QUOTA_EXCEEDED",
        message: "Monthly token quota exceeded",
        details,
      },
    },
    sse
  );
  await sse.writer.close();
}

/**
 * Sends a validation error over SSE and closes the connection.
 */
export async function sendValidationError(
  sse: SSEContext,
  details: unknown
): Promise<void> {
  await writeSSE(
    ErrorEnvelopeSchema,
    "error",
    {
      error: {
        code: "VALIDATION_FAILED",
        message: "Invalid request body",
        details,
      },
    },
    sse
  );
  await sse.writer.close();
}

/**
 * Sends a conflict error over SSE and closes the connection.
 */
export async function sendConflictError(sse: SSEContext): Promise<void> {
  await writeSSE(
    ErrorEnvelopeSchema,
    "error",
    {
      error: {
        code: "CONFLICT_TIP_MOVED",
        message: "Branch tip has advanced",
      },
    },
    sse
  );
  await sse.writer.close();
}

/**
 * Sends a generic internal error over SSE and closes the connection.
 */
export async function sendInternalError(
  sse: SSEContext,
  errorCode: string = "INTERNAL",
  errorMessage: string = "Internal server error"
): Promise<void> {
  await writeSSE(
    ErrorEnvelopeSchema,
    "error",
    { error: { code: errorCode, message: errorMessage } },
    sse
  );
  await sse.writer.close();
}

/**
 * Starts a keepalive interval that sends periodic keepalive events.
 * Returns the interval ID so it can be cleared later.
 */
export function startKeepalive(
  sse: SSEContext,
  intervalMs: number = SSE_KEEPALIVE_INTERVAL_MS
): NodeJS.Timeout {
  return setInterval(() => {
    void writeSSE(SSEKeepaliveSchema, "keepalive", {}, sse);
  }, intervalMs);
}
