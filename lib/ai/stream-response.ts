import { openai } from "@/lib/ai/openai";
import { type Logger } from "@/lib/api/logger";

export interface StreamResponseOptions {
  context: string;
  model?: string;
  onDelta?: (chunk: string) => void;
  log: Logger;
  requestStartedAt: number;
}

export interface StreamResponseResult {
  finalText: string;
  model: string;
  tokenCount: number | null;
}

/**
 * Streams a response from OpenAI and handles all the event parsing.
 * Returns the final response text, model used, and token count.
 */
export async function streamOpenAIResponse(
  options: StreamResponseOptions
): Promise<StreamResponseResult> {
  const {
    context,
    model: requestedModel,
    onDelta,
    log,
    requestStartedAt,
  } = options;

  const model = requestedModel ?? process.env["OPENAI_MODEL"] ?? "gpt-4";
  const input = context; // context is already built with system prompt

  let accumulatedResponse = "";
  let finalAssistantResponse = "";
  let effectiveModel = model;
  let effectiveTokenCount: null | number = null;

  const stream = await openai.responses.create({
    model,
    input,
    stream: true,
  });

  let streamedDeltas = 0;

  for await (const event of stream) {
    switch (event.type) {
      case "response.output_text.delta": {
        const chunk = event.delta ?? "";
        accumulatedResponse += chunk;
        if (onDelta) {
          onDelta(chunk);
        }
        streamedDeltas += 1;
        if (streamedDeltas === 1) {
          log.info({
            event: "first_byte",
            durationMs: Date.now() - requestStartedAt,
          });
        }
        break;
      }
      case "response.output_text.done": {
        finalAssistantResponse = event.text ?? accumulatedResponse;
        break;
      }
      case "response.completed": {
        if (event.response?.model) effectiveModel = event.response.model;
        if (event.response?.usage?.output_tokens) {
          effectiveTokenCount = event.response.usage.output_tokens;
        }
        if (!finalAssistantResponse) {
          finalAssistantResponse = accumulatedResponse;
        }
        log.info({
          event: "model_completed",
          durationMs: Date.now() - requestStartedAt,
        });
        break;
      }
      case "response.failed": {
        throw new Error(event.response.error?.message ?? "upstream_error");
      }
      default:
        break;
    }
  }

  return {
    finalText: finalAssistantResponse,
    model: effectiveModel,
    tokenCount: effectiveTokenCount,
  };
}
