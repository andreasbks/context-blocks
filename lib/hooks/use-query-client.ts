"use client";

import { useQueryClient } from "@tanstack/react-query";

/**
 * Custom hook that provides access to the QueryClient
 * Add helper methods as needed during development
 */
export function useAppQueryClient() {
  const queryClient = useQueryClient();

  return {
    queryClient,
  };
}
