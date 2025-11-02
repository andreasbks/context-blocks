/**
 * Centralized query keys for TanStack Query
 * This ensures consistent caching and invalidation across the app
 *
 * Add specific keys as needed during development
 */

export const QUERY_KEYS = {
  graphsList: () => ["graphs", "list"] as const,
  graphDetail: (graphId: string) => ["graphs", graphId, "detail"] as const,
  branchLinear: (branchId: string, includeRefs: boolean) =>
    [
      "branches",
      branchId,
      "linear",
      includeRefs ? "withRefs" : "noRefs",
    ] as const,
  branchPreview: (branchId: string) =>
    ["branches", branchId, "preview"] as const,
} as const;
