"use client";

import { useState } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

interface QueryProviderProps {
  children: React.ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  // Create a new QueryClient instance for each component tree
  // This ensures that data is not shared between different users/sessions
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000, // 30 seconds
            // Retry failed requests up to 3 times
            retry: 3,
            // Refetch on window focus for real-time updates
            refetchOnWindowFocus: true,
            // Refetch when user comes back online
            refetchOnReconnect: true,
            // Refetch on mount if data is stale
            refetchOnMount: true,
          },
          mutations: {
            // Retry failed mutations once
            retry: 1,
            // Show error notifications for failed mutations
            onError: (error) => {
              if (process.env.NODE_ENV === "development") {
                console.error("Mutation error:", error);
              }
              // Error boundary will catch unhandled errors
              // Individual mutations should handle their own toast notifications
            },
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Only show devtools in development */}
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools
          initialIsOpen={false}
          buttonPosition="bottom-right"
          position="bottom"
        />
      )}
    </QueryClientProvider>
  );
}
