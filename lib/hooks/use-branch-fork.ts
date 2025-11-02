import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";

import {
  AppendForkResponse,
  GraphDetailResponse,
} from "@/lib/api/schemas/responses";
import { QUERY_KEYS } from "@/lib/constants/query-keys";

type GraphDetail = z.infer<typeof GraphDetailResponse>;
type ForkResponse = z.infer<typeof AppendForkResponse>;

interface BranchForkOptions {
  graphId: string;
  branchId: string;
  forkFromNodeId: string;
  newBranchName: string;
  onSuccess?: (newBranchId: string) => void;
  onError?: (error: Error) => void;
}

export function useBranchFork() {
  const qc = useQueryClient();

  const forkBranch = async ({
    graphId,
    branchId,
    forkFromNodeId,
    newBranchName,
    onSuccess,
    onError,
  }: BranchForkOptions) => {
    try {
      const res = await fetch(`/api/v1/branches/${branchId}/append`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          author: "user",
          content: {
            text: `📍 Branch "${newBranchName}" created from checkpoint`,
          },
          forkFromNodeId,
          newBranchName,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData?.error?.message ||
            `Failed to create branch: HTTP ${res.status}`
        );
      }

      const data = (await res.json()) as ForkResponse;

      // Update graph detail cache with the new branch
      qc.setQueryData<GraphDetail>(QUERY_KEYS.graphDetail(graphId), (old) => {
        if (!old) return old;
        return {
          ...old,
          branches: [
            ...old.branches,
            {
              id: data.branch.id,
              name: data.branch.name,
              rootNodeId: data.branch.rootNodeId,
              tipNodeId: data.branch.tipNodeId,
              version: data.branch.version,
            },
          ],
        };
      });

      // Invalidate graphs list to update lastActivityAt
      void qc.invalidateQueries({
        queryKey: QUERY_KEYS.graphsList(),
      });

      // Show success toast
      toast.success("Branch created", {
        description: `Switched to "${newBranchName}"`,
      });

      // Call success callback with new branch ID
      if (onSuccess) {
        onSuccess(data.branch.id);
      }

      return data;
    } catch (error) {
      console.error("Fork branch error:", error);

      // Show error toast
      toast.error("Failed to create branch", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });

      // Call error callback
      if (onError) {
        onError(error instanceof Error ? error : new Error("Unknown error"));
      }

      throw error;
    }
  };

  return { forkBranch };
}
