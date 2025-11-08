/**
 * Application configuration with environment variable support
 * All values have sensible defaults but can be overridden via ENV
 */

// ============================================================================
// OpenAI Configuration
// ============================================================================

export const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4";

// ============================================================================
// Quota Configuration
// ============================================================================

export const QUOTA_LIMIT = parseInt(process.env.QUOTA_LIMIT ?? "100000", 10);

export const QUOTA_WINDOW_DAYS = parseInt(
  process.env.QUOTA_WINDOW_DAYS ?? "30",
  10
);

// ============================================================================
// Rate Limiting Configuration
// ============================================================================

export const RATE_LIMIT_WRITE_PER_MINUTE = parseInt(
  process.env.RATE_LIMIT_WRITE_PER_MINUTE ?? "60",
  10
);

export const RATE_LIMIT_READ_PER_MINUTE = parseInt(
  process.env.RATE_LIMIT_READ_PER_MINUTE ?? "300",
  10
);

export const RATE_LIMIT_SSE_CONCURRENT = parseInt(
  process.env.RATE_LIMIT_SSE_CONCURRENT ?? "8",
  10
);

// ============================================================================
// Context Building Configuration
// ============================================================================

export const CONTEXT_TOKEN_LIMIT = parseInt(
  process.env.CONTEXT_TOKEN_LIMIT ?? "10000",
  10
);

export const CONTEXT_MAX_NODES = parseInt(
  process.env.CONTEXT_MAX_NODES ?? "20",
  10
);

// ============================================================================
// SSE (Server-Sent Events) Configuration
// ============================================================================

export const SSE_KEEPALIVE_INTERVAL_MS = parseInt(
  process.env.SSE_KEEPALIVE_INTERVAL_MS ?? "15000",
  10
);

// ============================================================================
// Logging Configuration
// ============================================================================

export const LOG_LEVEL = process.env.LOG_LEVEL ?? "info";

// ============================================================================
// Configuration Validation & Logging
// ============================================================================

if (process.env.NODE_ENV !== "production") {
  console.log("[Config] Loaded configuration:", {
    OPENAI_MODEL,
    QUOTA_LIMIT,
    QUOTA_WINDOW_DAYS,
    RATE_LIMIT_WRITE_PER_MINUTE,
    RATE_LIMIT_READ_PER_MINUTE,
    RATE_LIMIT_SSE_CONCURRENT,
    CONTEXT_TOKEN_LIMIT,
    CONTEXT_MAX_NODES,
    SSE_KEEPALIVE_INTERVAL_MS,
    LOG_LEVEL,
  });
}
