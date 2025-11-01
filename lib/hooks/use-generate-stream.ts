import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";

import {
  GraphDetailResponse,
  LinearResponse,
} from "@/lib/api/schemas/responses";
import { QUERY_KEYS } from "@/lib/constants/query-keys";

type TimelineItem = z.infer<typeof LinearResponse>["items"][number];
type GraphDetail = z.infer<typeof GraphDetailResponse>;

// Helper function to call generate/stream endpoint
async function generateStreamRequest({
  branchId,
  expectedVersion,
  onDelta,
  onFinal,
  onError,
}: {
  branchId: string;
  expectedVersion?: number;
  onDelta?: (chunk: string) => void;
  onFinal?: (data: {
    items: Array<{ role: "user" | "assistant"; item: TimelineItem }>;
    newTip?: string;
    version?: number;
  }) => void;
  onError?: (error: { code: string; message: string }) => void;
}) {
  const res = await fetch(`/api/v1/branches/${branchId}/generate/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({
      expectedVersion,
    }),
  });

  // Handle quota exceeded error (429 status)
  if (res.status === 429) {
    const errorData = await res.json().catch(() => ({}));
    const resetDate = errorData?.error?.details?.resetDate
      ? new Date(errorData.error.details.resetDate).toLocaleDateString(
          "en-US",
          {
            month: "short",
            day: "numeric",
            year: "numeric",
          }
        )
      : "soon";

    const quotaError = {
      code: "QUOTA_EXCEEDED",
      message: `You've reached your monthly token limit. Your quota will reset on ${resetDate}.`,
    };

    if (onError) onError(quotaError);
    return;
  }

  if (!res.ok || !res.body) {
    const error = { code: "HTTP_ERROR", message: `HTTP ${res.status}` };
    if (onError) onError(error);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    let idx;

    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const lines = chunk.split("\n");

      let event: string | null = null;
      let data = "";

      for (const line of lines) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }

      if (!event || !data) continue;

      try {
        const parsed = JSON.parse(data);

        switch (event) {
          case "delta":
            if (parsed.text && onDelta) onDelta(parsed.text);
            break;

          case "final":
            if (onFinal) onFinal(parsed);
            break;

          case "error":
            // Handle quota exceeded error with user-friendly message
            if (parsed.error?.code === "QUOTA_EXCEEDED") {
              const resetDate = parsed.error?.details?.resetDate
                ? new Date(parsed.error.details.resetDate).toLocaleDateString(
                    "en-US",
                    {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    }
                  )
                : "soon";
              const quotaError = {
                code: "QUOTA_EXCEEDED",
                message: `You've reached your monthly token limit. Your quota will reset on ${resetDate}.`,
              };
              if (onError) onError(quotaError);
              return;
            }

            if (onError) onError(parsed.error || parsed);
            return;

          case "keepalive":
            break;
        }
      } catch (parseError) {
        console.error("Failed to parse SSE event:", event, data, parseError);
      }
    }
  }
}

export function useGenerateStream() {
  const queryClient = useQueryClient();

  const generateStream = async ({
    branchId,
    graphId,
    expectedVersion,
    onStreamDelta,
    onStreamComplete,
  }: {
    branchId: string;
    graphId: string;
    expectedVersion?: number;
    onStreamDelta?: (chunk: string) => void;
    onStreamComplete?: () => void;
  }) => {
    const queryKey = QUERY_KEYS.branchLinear(branchId, true);

    try {
      await generateStreamRequest({
        branchId,
        expectedVersion,

        onDelta: (chunk) => {
          if (onStreamDelta) {
            onStreamDelta(chunk);
          }
        },

        onFinal: (finalData) => {
          // Update cache with the assistant's response
          queryClient.setQueryData<{
            items: TimelineItem[];
            nextCursor: string | null;
          }>(queryKey, (old) => {
            if (!old?.items) return old;

            // Add assistant message from final event
            const assistantMessages = finalData.items
              .filter((item) => item.role === "assistant")
              .map((item) => item.item);

            return {
              ...old,
              items: [...old.items, ...assistantMessages],
            };
          });

          // Update graph detail with new version
          if (finalData.version !== undefined) {
            queryClient.setQueryData<GraphDetail>(
              QUERY_KEYS.graphDetail(graphId),
              (old) => {
                if (!old?.branches) return old;
                return {
                  ...old,
                  branches: old.branches.map((b) =>
                    b.id === branchId
                      ? {
                          ...b,
                          version: finalData.version,
                          tipNodeId: finalData.newTip,
                        }
                      : b
                  ),
                };
              }
            );
          }

          // Invalidate quota query to reflect updated token usage
          void queryClient.invalidateQueries({
            queryKey: ["quota"],
          });

          if (onStreamComplete) {
            onStreamComplete();
          }
        },

        onError: (error) => {
          console.error("Stream error:", error);

          // Show user-friendly toast notification
          if (error.code === "QUOTA_EXCEEDED") {
            toast.error("Monthly token limit reached", {
              description: error.message,
              duration: 5000,
            });
          } else {
            toast.error("Failed to generate response", {
              description: error.message || "Please try again.",
            });
          }

          if (onStreamComplete) {
            onStreamComplete();
          }
        },
      });
    } catch (err) {
      console.error("Generate stream error:", err);
      toast.error("Failed to generate response", {
        description: err instanceof Error ? err.message : "Please try again.",
      });

      if (onStreamComplete) {
        onStreamComplete();
      }
    }
  };

  return { generateStream };
}
