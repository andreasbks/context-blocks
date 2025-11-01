import { useEffect, useRef, useState } from "react";

import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import {
  GraphDetailResponse,
  LinearResponse,
} from "@/lib/api/schemas/responses";
import { QUERY_KEYS } from "@/lib/constants/query-keys";

type LinearQueryData = z.infer<typeof LinearResponse>;
type GraphDetail = z.infer<typeof GraphDetailResponse>;
type TimelineItem = z.infer<typeof LinearResponse>["items"][number];

interface UseChatOptions {
  branchId: string | null;
  graphId: string | null;
}

export function useChat({ branchId, graphId }: UseChatOptions) {
  const [composer, setComposer] = useState("");
  const [streamingAssistant, setStreamingAssistant] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const qc = useQueryClient();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [streamingAssistant]);

  const sendMessage = async (
    text: string,
    expectedVersion: number | undefined
  ) => {
    if (!branchId || !graphId) return;

    const capturedBranchId = branchId;
    const capturedGraphId = graphId;

    // Generate optimistic IDs
    const optimisticUserNodeId = `optimistic-user-${Date.now()}`;

    // Clear composer immediately for better UX
    setComposer("");
    setIsStreaming(true);
    setStreamingAssistant("");

    // Create optimistic user message
    const optimisticUserItem: TimelineItem = {
      nodeId: optimisticUserNodeId,
      block: {
        id: optimisticUserNodeId,
        kind: "user",
        content: { text },
        public: false,
        createdAt: new Date().toISOString(),
      },
    };

    // Add optimistic user message to cache immediately
    const queryKey = QUERY_KEYS.branchLinear(capturedBranchId, true);
    qc.setQueryData<LinearQueryData>(queryKey, (old) => {
      if (!old?.items) return old;
      return {
        ...old,
        items: [...old.items, optimisticUserItem],
      };
    });

    try {
      await sendStream({
        branchId: capturedBranchId,
        userText: text,
        expectedVersion,

        onDelta: (chunk) => {
          // Accumulate streaming assistant response
          setStreamingAssistant((prev) => (prev + chunk).slice(-8000));
        },

        onFinal: (data) => {
          // Stream complete - replace optimistic with real messages from backend
          qc.setQueryData<LinearQueryData>(queryKey, (old) => {
            if (!old?.items) return old;

            // Remove optimistic user message and add real messages
            const withoutOptimistic = old.items.filter(
              (item) => item.nodeId !== optimisticUserNodeId
            );

            // Add all real messages from final event (user + assistant)
            const realMessages = data.items.map((item) => item.item);

            return {
              ...old,
              items: [...withoutOptimistic, ...realMessages],
            };
          });

          // Update graph detail with new version
          if (data.version !== undefined) {
            qc.setQueryData<GraphDetail>(
              QUERY_KEYS.graphDetail(capturedGraphId),
              (old) => {
                if (!old?.branches) return old;
                return {
                  ...old,
                  branches: old.branches.map((b) =>
                    b.id === capturedBranchId
                      ? {
                          ...b,
                          version: data.version,
                          tipNodeId: data.newTip,
                        }
                      : b
                  ),
                };
              }
            );
          }

          setStreamingAssistant("");
          setIsStreaming(false);

          // Invalidate quota query to reflect updated token usage
          void qc.invalidateQueries({
            queryKey: ["quota"],
          });

          /* Invalidate queries to refresh data
          void qc.invalidateQueries({
            queryKey: QUERY_KEYS.branchLinear(capturedBranchId, true),
          });
          void qc.invalidateQueries({
            queryKey: QUERY_KEYS.graphsList(),
          });
          */
        },

        onError: (error) => {
          console.error("Stream error:", error);
          // Remove optimistic messages on error
          qc.setQueryData<LinearQueryData>(queryKey, (old) => {
            if (!old?.items) return old;
            return {
              ...old,
              items: old.items.filter(
                (item) => item.nodeId !== optimisticUserNodeId
              ),
            };
          });
          setStreamingAssistant("");
          setIsStreaming(false);
        },
      });
    } catch (err) {
      console.error("Send stream error:", err);
      // Remove optimistic message on error
      qc.setQueryData<LinearQueryData>(queryKey, (old) => {
        if (!old?.items) return old;
        return {
          ...old,
          items: old.items.filter(
            (item) => item.nodeId !== optimisticUserNodeId
          ),
        };
      });
      setStreamingAssistant("");
      setIsStreaming(false);
    }
  };

  return {
    composer,
    setComposer,
    streamingAssistant,
    isStreaming,
    scrollRef,
    sendMessage,
  };
}

async function sendStream({
  branchId,
  userText,
  expectedVersion,
  onDelta,
  onFinal,
  onError,
}: {
  branchId: string;
  userText: string;
  expectedVersion?: number;
  onDelta?: (chunk: string) => void;
  onFinal?: (data: {
    items: Array<{ role: "user" | "assistant"; item: TimelineItem }>;
    newTip?: string;
    version?: number;
  }) => void;
  onError?: (error: { code: string; message: string }) => void;
}) {
  const res = await fetch(`/api/v1/branches/${branchId}/send/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({
      userMessage: { text: userText },
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
    throw new Error(quotaError.message);
  }

  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

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
              throw new Error(quotaError.message);
            }

            if (onError) onError(parsed.error || parsed);
            throw new Error(parsed.error?.message || "Stream error");

          case "keepalive":
            break;
        }
      } catch (parseError) {
        console.error("Failed to parse SSE event:", event, data, parseError);
      }
    }
  }
}
