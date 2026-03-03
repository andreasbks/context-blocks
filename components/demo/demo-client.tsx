"use client";

import { useCallback, useEffect, useState } from "react";

import Link from "next/link";

import { ArrowRight, Loader2, Sparkles } from "lucide-react";

import WorkspaceClient from "@/app/workspace/client";
import { Button } from "@/components/ui/button";

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

  return (
    <div className="relative h-[calc(100vh-4rem)]">
      {/* Floating demo label on top edge */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 flex items-center gap-3 px-4 py-1.5 rounded-full border bg-background shadow-sm">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="h-3 w-3 text-primary" />
          <span className="font-medium">Demo Session</span>
          <span className="text-muted-foreground/60">
            &mdash; expires in 24h
          </span>
        </div>
        <Link href="/auth/sign-up">
          <Button
            variant="outline"
            size="sm"
            className="h-5 px-2 text-[10px] rounded-full"
          >
            Sign up
            <ArrowRight className="ml-1 h-2.5 w-2.5" />
          </Button>
        </Link>
      </div>

      {/* Frame around the workspace */}
      <div className="h-full m-2 mt-3 rounded-xl border overflow-hidden bg-background shadow-sm">
        <WorkspaceClient isDemo />
      </div>
    </div>
  );
}
