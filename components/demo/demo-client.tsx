"use client";

import { useCallback, useEffect, useState } from "react";

import { Loader2 } from "lucide-react";

import WorkspaceClient from "@/app/workspace/client";

export default function DemoClient() {
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );

  const bootstrap = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/demo/session", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus("ready");
    } catch (err) {
      console.error("Failed to create demo session:", err);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  if (status === "loading") {
    return (
      <div className="flex-1 flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Setting up your demo session...
          </p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex-1 flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center space-y-4 max-w-md">
          <h2 className="text-xl font-semibold">Something went wrong</h2>
          <p className="text-muted-foreground">
            We couldn&apos;t set up the demo session. Please try refreshing the
            page.
          </p>
          <button
            onClick={() => {
              setStatus("loading");
              void bootstrap();
            }}
            className="text-primary underline underline-offset-4 hover:text-primary/80"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return <WorkspaceClient isDemo />;
}
