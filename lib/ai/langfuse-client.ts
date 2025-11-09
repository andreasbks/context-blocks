import { LangfuseClient } from "@langfuse/client";

import {
  LANGFUSE_BASE_URL,
  LANGFUSE_ENABLED,
  LANGFUSE_PUBLIC_KEY,
  LANGFUSE_SECRET_KEY,
} from "@/lib/config";

/**
 * Singleton Langfuse client instance
 * Used for prompt management and other Langfuse API interactions
 */
let langfuseClientInstance: LangfuseClient | null = null;

/**
 * Get or create the Langfuse client singleton
 * Returns null if Langfuse is not enabled or credentials are missing
 */
export function getLangfuseClient(): LangfuseClient | null {
  if (!LANGFUSE_ENABLED) {
    return null;
  }

  if (!langfuseClientInstance) {
    try {
      langfuseClientInstance = new LangfuseClient({
        publicKey: LANGFUSE_PUBLIC_KEY,
        secretKey: LANGFUSE_SECRET_KEY,
        baseUrl: LANGFUSE_BASE_URL,
      });

      if (process.env.NODE_ENV !== "production") {
        console.log("[Langfuse] Client initialized successfully");
      }
    } catch (error) {
      console.error("[Langfuse] Failed to initialize client:", error);
      return null;
    }
  }

  return langfuseClientInstance;
}

/**
 * Reset the Langfuse client singleton (useful for testing)
 */
export function resetLangfuseClient(): void {
  langfuseClientInstance = null;
}
