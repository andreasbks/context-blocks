import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";

import {
  DeleteGraphResponse,
  GraphsListResponse,
  StartGraphResponse,
} from "@/lib/api/schemas/responses";
import { QUERY_KEYS } from "@/lib/constants/query-keys";

type GraphListItem = z.infer<typeof GraphsListResponse>["items"][number];
type StartGraphResult = z.infer<typeof StartGraphResponse>;

interface CreateGraphOptions {
  title?: string;
  firstMessage: string;
  onSuccess?: (data: StartGraphResult) => void;
}

interface DeleteGraphOptions {
  graphId: string;
  onSuccess?: () => void;
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
          title: title ?? "Generating name...",
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
        title: title ?? "Generating name...",
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

    onSuccess: (data) => {
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

      // Initialize the linear query cache with the user's first message
      const branchId = data.branch.id;
      const queryKey = QUERY_KEYS.branchLinear(branchId, true);

      queryClient.setQueryData(queryKey, {
        items: data.items.map((item) => ({
          nodeId: item.nodeId,
          block: item.block,
        })),
        nextCursor: null,
      });
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
