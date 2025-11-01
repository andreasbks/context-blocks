import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";

import {
  DeleteGraphResponse,
  GraphDetailResponse,
  GraphsListResponse,
  LinearResponse,
  StartGraphResponse,
} from "@/lib/api/schemas/responses";
import { QUERY_KEYS } from "@/lib/constants/query-keys";

type GraphListItem = z.infer<typeof GraphsListResponse>["items"][number];
type StartGraphResult = z.infer<typeof StartGraphResponse>;
type TimelineItem = z.infer<typeof LinearResponse>["items"][number];
type GraphDetail = z.infer<typeof GraphDetailResponse>;

interface CreateGraphOptions {
  title?: string;
  firstMessage: string;
  onSuccess?: (data: StartGraphResult) => void;
  onStreamDelta?: (chunk: string) => void;
  onStreamComplete?: () => void;
}

interface DeleteGraphOptions {
  graphId: string;
  onSuccess?: () => void;
}

// Helper function to call generate/stream endpoint
async function generateStream({
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

export function useGraphMutations() {
  const queryClient = useQueryClient();

  const createGraph = useMutation({
    mutationFn: async ({
      title,
      firstMessage,
    }: {
      title?: string;
      firstMessage: string;
      onStreamDelta?: (chunk: string) => void;
      onStreamComplete?: () => void;
    }) => {
      const response = await fetch("/api/v1/graphs/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          title: title ?? "Untitled Session",
          firstMessage: {
            author: "user",
            content: { text: firstMessage },
          },
          branchName: "main",
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.error?.message || "Failed to create session");
      }

      return (await response.json()) as StartGraphResult;
    },

    onMutate: async ({ title }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({
        queryKey: QUERY_KEYS.graphsList(),
      });

      // Get previous value
      const previous = queryClient.getQueryData<{
        items: GraphListItem[];
        nextCursor: string | null;
      }>(QUERY_KEYS.graphsList());

      // Optimistically add new graph
      const optimisticGraph: GraphListItem = {
        id: `optimistic-${Date.now()}`,
        title: title ?? "Untitled Session",
        createdAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
      };

      queryClient.setQueryData<{
        items: GraphListItem[];
        nextCursor: string | null;
      }>(QUERY_KEYS.graphsList(), (old) => {
        if (!old) return { items: [optimisticGraph], nextCursor: null };
        return {
          ...old,
          items: [optimisticGraph, ...old.items],
        };
      });

      return { previous };
    },

    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(QUERY_KEYS.graphsList(), context.previous);
      }

      toast.error("Failed to create session", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    },

    onSuccess: async (data, variables) => {
      // Replace optimistic with real data
      queryClient.setQueryData<{
        items: GraphListItem[];
        nextCursor: string | null;
      }>(QUERY_KEYS.graphsList(), (old) => {
        if (!old) return { items: [data.graph], nextCursor: null };

        // Remove optimistic and add real
        const withoutOptimistic = old.items.filter(
          (g) => !g.id.startsWith("optimistic-")
        );

        return {
          ...old,
          items: [data.graph, ...withoutOptimistic],
        };
      });

      toast.success("Session created");

      // Immediately start streaming the assistant response
      const branchId = data.branch.id;
      const graphId = data.graph.id;

      // Initialize the linear query cache with the user's first message
      const queryKey = QUERY_KEYS.branchLinear(branchId, true);
      queryClient.setQueryData<{
        items: TimelineItem[];
        nextCursor: string | null;
      }>(queryKey, {
        items: data.items.map((item) => ({
          nodeId: item.nodeId,
          block: item.block,
        })),
        nextCursor: null,
      });

      // Start streaming the assistant response
      try {
        await generateStream({
          branchId,
          expectedVersion: data.branch.version,

          onDelta: (chunk) => {
            if (variables.onStreamDelta) {
              variables.onStreamDelta(chunk);
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

            if (variables.onStreamComplete) {
              variables.onStreamComplete();
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
          },
        });
      } catch (err) {
        console.error("Generate stream error:", err);
        toast.error("Failed to generate response", {
          description: err instanceof Error ? err.message : "Please try again.",
        });
      }
    },
  });

  const deleteGraph = useMutation({
    mutationFn: async ({ graphId }: { graphId: string }) => {
      const response = await fetch(`/api/v1/graphs/${graphId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.error?.message || "Failed to delete session");
      }

      return (await response.json()) as z.infer<typeof DeleteGraphResponse>;
    },

    onMutate: async ({ graphId }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({
        queryKey: QUERY_KEYS.graphsList(),
      });

      // Get previous value
      const previous = queryClient.getQueryData<{
        items: GraphListItem[];
        nextCursor: string | null;
      }>(QUERY_KEYS.graphsList());

      // Optimistically remove graph
      queryClient.setQueryData<{
        items: GraphListItem[];
        nextCursor: string | null;
      }>(QUERY_KEYS.graphsList(), (old) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.filter((g) => g.id !== graphId),
        };
      });

      return { previous };
    },

    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(QUERY_KEYS.graphsList(), context.previous);
      }

      toast.error("Failed to delete session", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    },

    onSuccess: () => {
      toast.success("Session deleted");
    },
  });

  return {
    createGraph: (options: CreateGraphOptions) =>
      createGraph.mutate(
        {
          title: options.title,
          firstMessage: options.firstMessage,
          onStreamDelta: options.onStreamDelta,
          onStreamComplete: options.onStreamComplete,
        },
        { onSuccess: options.onSuccess }
      ),
    deleteGraph: (options: DeleteGraphOptions) =>
      deleteGraph.mutate(
        { graphId: options.graphId },
        { onSuccess: options.onSuccess }
      ),
    isCreating: createGraph.isPending,
    isDeleting: deleteGraph.isPending,
  };
}
