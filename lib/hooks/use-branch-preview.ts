import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { BranchPreviewResponse } from "@/lib/api/schemas/responses";
import { QUERY_KEYS } from "@/lib/constants/query-keys";

type BranchPreview = z.infer<typeof BranchPreviewResponse>;

async function fetchBranchPreview(branchId: string): Promise<BranchPreview> {
  const res = await fetch(`/api/v1/branches/${branchId}/preview`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

interface UseBranchPreviewOptions {
  branchId: string;
  enabled?: boolean;
}

export function useBranchPreview({
  branchId,
  enabled = false,
}: UseBranchPreviewOptions) {
  const query = useQuery({
    queryKey: QUERY_KEYS.branchPreview(branchId),
    queryFn: () => fetchBranchPreview(branchId),
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes - previews rarely change
    gcTime: 10 * 60 * 1000, // 10 minutes cache time
  });

  return {
    preview: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
