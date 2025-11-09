/**
 * Application configuration with environment variable support
 * All values have sensible defaults but can be overridden via ENV
 */

// ============================================================================
// OpenAI Configuration
// ============================================================================

export const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4";

// ============================================================================
// Langfuse Configuration (Prompt Management)
// ============================================================================

/**
 * Langfuse public key (required for prompt management)
 */
export const LANGFUSE_PUBLIC_KEY = process.env.LANGFUSE_PUBLIC_KEY ?? "";

/**
 * Langfuse secret key (required for prompt management)
 */
export const LANGFUSE_SECRET_KEY = process.env.LANGFUSE_SECRET_KEY ?? "";

/**
 * Langfuse base URL (cloud.langfuse.com for EU or us.cloud.langfuse.com for US)
 */
export const LANGFUSE_BASE_URL =
  process.env.LANGFUSE_BASE_URL ?? "https://cloud.langfuse.com";

/**
 * Langfuse prompt label to fetch (defaults to environment-based label)
 * Supports: "production", "staging", "development", or "latest"
 */
export const LANGFUSE_PROMPT_LABEL =
  process.env.LANGFUSE_PROMPT_LABEL ?? "production";

/**
 * System prompt name in Langfuse
 */
export const LANGFUSE_SYSTEM_PROMPT_NAME =
  process.env.LANGFUSE_SYSTEM_PROMPT_NAME ?? "context-blocks-system";

/**
 * Enable/disable Langfuse prompt management
 */
export const LANGFUSE_ENABLED =
  process.env.LANGFUSE_ENABLED !== "false" &&
  Boolean(LANGFUSE_PUBLIC_KEY && LANGFUSE_SECRET_KEY);

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
// Preview Mode Configuration
// ============================================================================

/**
 * Enable/disable preview mode (password-protected access)
 */
export const PREVIEW_MODE_ENABLED = process.env.PREVIEW_MODE_ENABLED === "true";

/**
 * Password for preview mode access
 */
export const PREVIEW_MODE_PASSWORD =
  process.env.PREVIEW_MODE_PASSWORD ?? "preview";

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
    LANGFUSE_ENABLED,
    LANGFUSE_BASE_URL,
    LANGFUSE_PROMPT_LABEL,
    LANGFUSE_SYSTEM_PROMPT_NAME,
    PREVIEW_MODE_ENABLED,
    PREVIEW_MODE_PASSWORD: PREVIEW_MODE_PASSWORD ? "***" : "(not set)",
  });
}
