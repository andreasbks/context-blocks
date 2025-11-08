import { baseLogger } from "@/lib/api/logger";

import { openai } from "./openai";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

/**
 * Generate a concise graph title from the initial user message using LLM.
 * Returns null if generation fails.
 */
export async function generateGraphName(
  firstMessage: string
): Promise<string | null> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that generates concise, descriptive titles for conversations. Generate a 3-7 word title that captures the essence of the conversation topic. Do not use quotes or special formatting. Just return the plain title.",
        },
        {
          role: "user",
          content: `Generate a concise title for a conversation starting with this message:\n\n${firstMessage}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 50,
    });

    const generatedName = response.choices[0]?.message?.content?.trim();
    if (!generatedName) {
      baseLogger.error({ event: "empty_graph_name", firstMessage });
      return null;
    }

    // Remove quotes if the LLM added them
    const cleanedName = generatedName.replace(/^["']|["']$/g, "");

    // Ensure it's not too long (max 120 chars per schema)
    return cleanedName.slice(0, 120);
  } catch (error) {
    baseLogger.error({ event: "graph_name_generation_failed", error });
    return null;
  }
}

/**
 * Generate a concise branch name from recent conversation context using LLM.
 * Returns null if generation fails.
 */
export async function generateBranchName(
  recentMessages: Message[],
  forkMessage?: string
): Promise<string | null> {
  try {
    // Build context from recent messages
    const contextLines = recentMessages
      .map(
        (msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`
      )
      .join("\n");

    const forkContext = forkMessage
      ? `\n\nThe new branch starts with: ${forkMessage}`
      : "";

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that generates concise, descriptive branch names for conversation threads. Generate a 3-7 word name that captures what makes this branch exploration unique or different. Do not use quotes or special formatting. Just return the plain branch name.",
        },
        {
          role: "user",
          content: `Generate a concise branch name for a conversation exploration diverging from this context:\n\n${contextLines}${forkContext}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 50,
    });

    const generatedName = response.choices[0]?.message?.content?.trim();
    if (!generatedName) {
      baseLogger.error({ event: "empty_branch_name" });
      return null;
    }

    // Remove quotes if the LLM added them
    const cleanedName = generatedName.replace(/^["']|["']$/g, "");

    // Ensure it's not too long (max 120 chars per schema)
    return cleanedName.slice(0, 120);
  } catch (error) {
    baseLogger.error({ event: "branch_name_generation_failed", error });
    return null;
  }
}
