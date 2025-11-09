"use client";

import { useEffect, useState } from "react";

import { UseQueryResult } from "@tanstack/react-query";
import { GitBranch } from "lucide-react";
import { z } from "zod";

import { MarkdownContent } from "@/components/markdown-content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  GraphDetailResponse,
  LinearResponse,
} from "@/lib/api/schemas/responses";

import { BranchPoint } from "./branch-point";
import { MessageItem } from "./message-item";
import {
  SessionLoadingSkeleton,
  TimelineMessageSkeleton,
} from "./skeleton-loaders";

type TimelineItem = z.infer<typeof LinearResponse>["items"][number];
type GraphDetail = z.infer<typeof GraphDetailResponse>;

interface BranchContext {
  nodeId: string;
  branchName: string;
  messageText: string;
}

interface ChatAreaProps {
  selectedGraphId: string | null;
  selectedBranchId: string | null;
  onSelectBranch: (branchId: string) => void;
  graphDetailQuery: UseQueryResult<GraphDetail, Error>;
  linearQuery: UseQueryResult<
    { items: TimelineItem[]; nextCursor: string | null },
    Error
  >;
  composer: string;
  setComposer: (value: string) => void;
  streamingAssistant: string;
  isStreaming: boolean;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onSubmit: (e: React.FormEvent) => void;
  onBranchFromTip: (text: string) => Promise<void>;
  branchContext: BranchContext | null;
  onStartBranch: (nodeId: string, messageText: string) => void;
  onCancelBranch: () => void;
  branchComposer: string;
  setBranchComposer: (value: string) => void;
  onSubmitBranch: (e: React.FormEvent) => void;
}

export function ChatArea({
  selectedGraphId,
  selectedBranchId,
  onSelectBranch,
  graphDetailQuery,
  linearQuery,
  composer,
  setComposer,
  streamingAssistant,
  isStreaming,
  scrollRef,
  onSubmit,
  onBranchFromTip,
  branchContext,
  onStartBranch,
  onCancelBranch,
  branchComposer,
  setBranchComposer,
  onSubmitBranch,
}: ChatAreaProps) {
  const [shouldAnimate, setShouldAnimate] = useState(true);

  // Track branch changes to control animations
  useEffect(() => {
    // Reset animation on branch change (async to avoid linter warning)
    const timer1 = setTimeout(() => setShouldAnimate(true), 0);

    // Disable animation after initial render
    const timer2 = setTimeout(() => setShouldAnimate(false), 500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [selectedBranchId]);

  if (selectedGraphId == null) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-background via-background to-accent/5">
        <div className="text-center space-y-6 max-w-2xl px-8 animate-in fade-in duration-700">
          {/* Animated Icon */}
          <div className="relative mx-auto w-24 h-24 mb-2">
            <div className="absolute inset-0 bg-primary/10 rounded-full animate-pulse" />
            <div
              className="absolute inset-2 bg-primary/20 rounded-full animate-ping"
              style={{ animationDuration: "2s" }}
            />
            <div className="relative flex items-center justify-center h-full">
              <span className="text-6xl">💭</span>
            </div>
          </div>

          {/* Main Heading */}
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
              Welcome to Context Blocks
            </h1>
            <p className="text-lg text-muted-foreground">
              Think in branches, not lines
            </p>
          </div>

          {/* Description */}
          <p className="text-base text-muted-foreground max-w-md mx-auto leading-relaxed">
            Start a new conversation session, explore different paths with
            branches, and never lose context again.
          </p>

          {/* Visual Guide */}
          <div className="flex items-center justify-center gap-8 pt-4 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="w-8 h-8 rounded-lg bg-accent/50 flex items-center justify-center">
                <span>←</span>
              </div>
              <span>Browse sessions</span>
            </div>
            <div className="text-muted-foreground/30">or</div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center font-bold text-primary">
                +
              </div>
              <span>Create new session</span>
            </div>
          </div>

          {/* Keyboard Shortcut Hint */}
          <div className="pt-4 text-xs text-muted-foreground/60">
            <span className="inline-flex items-center gap-1">
              Press{" "}
              <kbd className="px-2 py-1 bg-accent/50 rounded border border-border/50 font-mono">
                ⌘B
              </kbd>{" "}
              to toggle sidebar
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Show skeleton when loading OR when data doesn't match selected graph (prevents wrong data flash)
  if (graphDetailQuery.isLoading || !graphDetailQuery.data) {
    return <SessionLoadingSkeleton />;
  }

  const currentBranchName = graphDetailQuery.data?.branches.find(
    (b) => b.id === selectedBranchId
  )?.name;

  return (
    <div className="flex flex-col h-full">
      {/* Compact Header - Fixed, Not Scrollable */}
      <div className="flex-shrink-0 bg-card/50">
        <div className="flex items-center justify-between px-3 py-3 max-w-4xl mx-auto">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-sm font-bold truncate">
              {graphDetailQuery.data?.graph.title ?? "Untitled Session"}
            </span>
            {currentBranchName && (
              <>
                <span className="text-sm text-muted-foreground">•</span>
                <Badge
                  variant="outline"
                  className="text-xs font-medium flex-shrink-0"
                >
                  <GitBranch className="mr-1 h-3 w-3" />
                  {currentBranchName}
                </Badge>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Timeline - Scrollable Chat Area with Inline Composer */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-4">
          <div className="space-y-4">
            {linearQuery.isLoading || !linearQuery.data ? (
              <>
                <TimelineMessageSkeleton />
                <TimelineMessageSkeleton />
                <TimelineMessageSkeleton />
              </>
            ) : (linearQuery.data?.items ?? []).length === 0 ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground">
                No messages yet. Start the conversation below.
              </div>
            ) : (
              linearQuery.data!.items.map((item, index) => {
                // Find the current branch object
                const currentBranch = graphDetailQuery.data?.branches.find(
                  (b) => b.id === selectedBranchId
                );

                // Check if this node is the root of the current branch
                const isCurrentBranchRoot =
                  currentBranch?.rootNodeId === item.nodeId;

                // Find all branches that fork from this node (have this node as their root)
                const branchesFromNode = (
                  graphDetailQuery.data?.branches ?? []
                ).filter((b) => b.rootNodeId === item.nodeId);

                /**
                 * Branch Pills Display Logic:
                 *
                 * We show branch switcher pills whenever there are branches that fork from this message:
                 *
                 * 1. AT THE ROOT OF THE CURRENT BRANCH:
                 *    - You're viewing a branch and you're at its fork point
                 *    - Shows: [Current Branch] [Parent/Sibling Branches]
                 *    - Allows switching back to parent or between siblings
                 *
                 * 2. AT FORK POINTS ON PARENT BRANCH:
                 *    - You're on the parent branch viewing where a child branched
                 *    - Shows: [Current Branch] [Child Branches]
                 *    - Allows switching to explore the child branch
                 *
                 * 3. AT DIVERGENCE POINTS:
                 *    - Multiple branches start from the same message
                 *    - Shows all branches that diverge from this point
                 */
                let shouldShowPills = false;
                let alternateBranches: typeof branchesFromNode = [];

                if (isCurrentBranchRoot && currentBranch) {
                  // Scenario 1: At the root of the current branch
                  const siblings = branchesFromNode.filter(
                    (b) => b.id !== selectedBranchId
                  );

                  if (siblings.length > 0) {
                    // There are sibling branches - show all branches from this point
                    shouldShowPills = true;
                    alternateBranches = siblings;
                  } else {
                    // No siblings - this is a child branch, show parent to switch back
                    // Find the actual parent branch by matching rootNodeId to parent's tipNodeId
                    // (we forked from the parent's tip, so parent.tipNodeId == current.rootNodeId)
                    const parentBranch = graphDetailQuery.data?.branches.find(
                      (b) =>
                        b.id !== selectedBranchId &&
                        currentBranch.rootNodeId &&
                        b.tipNodeId === currentBranch.rootNodeId
                    );

                    // If no exact match, fall back to the main branch or oldest branch
                    const fallbackParent = !parentBranch
                      ? graphDetailQuery.data?.branches.find(
                          (b) =>
                            b.id !== selectedBranchId &&
                            (b.name.toLowerCase() === "main" || !b.rootNodeId)
                        )
                      : undefined;

                    const branchToShow = parentBranch || fallbackParent;
                    if (branchToShow) {
                      shouldShowPills = true;
                      alternateBranches = [branchToShow];
                    }
                  }
                } else if (branchesFromNode.length > 0) {
                  // Scenario 2 & 3: One or more branches fork from here
                  // Show all branches that start here (excluding current if it's not one of them)
                  shouldShowPills = true;
                  alternateBranches = branchesFromNode.filter(
                    (b) => b.id !== selectedBranchId
                  );
                }

                return (
                  <div
                    key={item.nodeId}
                    className={
                      shouldAnimate
                        ? "animate-in fade-in slide-in-from-bottom-3 duration-300"
                        : ""
                    }
                    style={
                      shouldAnimate
                        ? { animationDelay: `${index * 40}ms` }
                        : undefined
                    }
                  >
                    <MessageItem
                      item={item}
                      showBranchButton={!branchContext}
                      onStartBranch={onStartBranch}
                      branchPointContent={
                        shouldShowPills && alternateBranches.length > 0 ? (
                          <BranchPoint
                            alternateBranches={alternateBranches}
                            onSelectBranch={onSelectBranch}
                            graphId={selectedGraphId}
                          />
                        ) : undefined
                      }
                    />

                    {/* Inline Branch Composer - Show if this is the branch context node */}
                    {branchContext && branchContext.nodeId === item.nodeId && (
                      <div className="my-4 ml-6 animate-in fade-in slide-in-from-top-4 duration-500 ease-out">
                        <form onSubmit={onSubmitBranch}>
                          <div className="relative rounded-xl border-2 border-dashed border-primary/30 bg-card hover:border-primary/50 transition-all duration-300 hover:shadow-lg">
                            {/* Subtle glow effect */}
                            <div
                              className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 rounded-xl blur opacity-30 animate-pulse"
                              style={{ animationDuration: "3s" }}
                            />
                            <div className="relative rounded-xl bg-card">
                              <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-border/50">
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant="outline"
                                    className="text-xs font-medium bg-primary/10 text-primary border-primary/30 animate-in fade-in zoom-in-95 duration-300"
                                  >
                                    <GitBranch className="mr-1 h-3 w-3 animate-in spin-in-90 duration-500" />
                                    Creating new branch
                                  </Badge>
                                  {branchComposer.length > 0 && (
                                    <span className="text-xs text-muted-foreground animate-in fade-in slide-in-from-left-2 duration-200">
                                      {branchComposer.length} characters
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="submit"
                                    size="sm"
                                    disabled={
                                      !branchComposer.trim() || isStreaming
                                    }
                                    className="min-w-[100px] transition-all duration-200"
                                  >
                                    {isStreaming ? (
                                      <div className="flex items-center gap-2">
                                        <div className="relative w-4 h-4">
                                          <div className="absolute inset-0 border-2 border-primary-foreground/30 rounded-full" />
                                          <div className="absolute inset-0 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                                        </div>
                                        <span className="animate-pulse">
                                          Creating branch...
                                        </span>
                                      </div>
                                    ) : (
                                      <>
                                        <GitBranch className="mr-1.5 h-3.5 w-3.5" />
                                        Create Branch
                                        <span className="ml-1.5">→</span>
                                      </>
                                    )}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={onCancelBranch}
                                    disabled={isStreaming}
                                    className="h-8 px-2 hover:bg-destructive/10 hover:text-destructive transition-all duration-200 hover:scale-110 active:scale-95"
                                  >
                                    ✕
                                  </Button>
                                </div>
                              </div>
                              <div className="px-4 py-3 animate-in fade-in duration-300 delay-100">
                                <Textarea
                                  placeholder="Type your message to start the new branch... (Press Enter to send, Shift+Enter for new line)"
                                  value={branchComposer}
                                  onChange={(e) =>
                                    setBranchComposer(e.target.value)
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                      e.preventDefault();
                                      e.currentTarget.form?.requestSubmit();
                                    }
                                  }}
                                  rows={3}
                                  disabled={isStreaming}
                                  className="resize-none border-0 p-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent placeholder:text-muted-foreground/50 transition-all duration-200"
                                  autoFocus
                                />
                              </div>
                            </div>
                          </div>
                        </form>
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* Streaming assistant response */}
            {streamingAssistant && (
              <div className="rounded-xl border-2 border-purple-500/30 bg-card shadow-md animate-in fade-in slide-in-from-bottom-3 duration-300">
                {/* Block Header - Streaming State */}
                <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b border-border/50">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20"
                    >
                      <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse mr-1.5" />
                      🤖 Assistant Response
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      Generating...
                    </Badge>
                  </div>
                </div>

                {/* Streaming Content */}
                <div className="px-5 py-4">
                  <div className="inline">
                    <MarkdownContent content={streamingAssistant} />
                    <span className="inline-block w-0.5 h-5 bg-purple-500 animate-pulse ml-1" />
                  </div>
                </div>
              </div>
            )}

            {/* Composer - Context Block Style (Inline after messages) */}
            <form onSubmit={onSubmit}>
              <div className="rounded-xl border-2 border-dashed border-muted-foreground/20 bg-card hover:border-muted-foreground/30 transition-all duration-200 hover:shadow-sm">
                {/* Block Header - Draft State */}
                <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-border/50">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="text-xs font-medium bg-muted/50 text-muted-foreground border-muted-foreground/20"
                    >
                      <span className="mr-1">✏️</span>
                      Draft
                    </Badge>
                    {composer.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {composer.length} characters
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={
                        !composer.trim() || !selectedBranchId || isStreaming
                      }
                      className="min-w-[90px]"
                    >
                      {isStreaming ? (
                        <span className="animate-pulse">Sending...</span>
                      ) : (
                        <>
                          Send
                          <span className="ml-1.5">→</span>
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={
                        !composer.trim() || !selectedBranchId || isStreaming
                      }
                      onClick={async () => {
                        if (!selectedBranchId || !composer.trim()) return;
                        const text = composer.trim();
                        setComposer("");
                        await onBranchFromTip(text);
                      }}
                      className="min-w-[90px] border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20 hover:border-amber-500/70 text-amber-700 dark:text-amber-400 animate-subtle-pulse disabled:animate-none"
                    >
                      <GitBranch className="mr-1.5 h-3.5 w-3.5" />
                      Branch + Send
                    </Button>
                  </div>
                </div>

                {/* Content Area */}
                <div className="px-4 py-3">
                  <Textarea
                    placeholder="Type your message here..."
                    value={composer}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setComposer(e.target.value)
                    }
                    onKeyDown={async (e) => {
                      // Cmd/Ctrl + Shift + Enter: Branch from tip
                      if (
                        e.key === "Enter" &&
                        (e.metaKey || e.ctrlKey) &&
                        e.shiftKey
                      ) {
                        e.preventDefault();
                        if (
                          !selectedBranchId ||
                          !composer.trim() ||
                          isStreaming
                        )
                          return;

                        const text = composer.trim();
                        setComposer("");
                        await onBranchFromTip(text);
                        return;
                      }

                      // Cmd/Ctrl + Enter: Send to tip (explicit)
                      if (
                        e.key === "Enter" &&
                        (e.metaKey || e.ctrlKey) &&
                        !e.shiftKey
                      ) {
                        e.preventDefault();
                        e.currentTarget.form?.requestSubmit();
                        return;
                      }

                      // Enter alone: Send to tip (if not shift)
                      if (
                        e.key === "Enter" &&
                        !e.shiftKey &&
                        !e.metaKey &&
                        !e.ctrlKey
                      ) {
                        e.preventDefault();
                        e.currentTarget.form?.requestSubmit();
                        return;
                      }

                      // Shift + Enter: New line (default behavior, no preventDefault)
                    }}
                    rows={3}
                    disabled={!selectedBranchId || isStreaming}
                    className="resize-none border-0 p-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent placeholder:text-muted-foreground/50"
                  />
                </div>

                {/* Keyboard Shortcut Hints */}
                <div className="px-4 pb-3 pt-2 border-t border-border/50">
                  <div className="flex items-center gap-6 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <kbd className="px-2 py-1 bg-muted/50 border border-border/50 rounded font-mono text-xs font-semibold">
                        ⏎
                      </kbd>
                      <span>send</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <kbd className="px-2 py-1 bg-amber-500/10 border border-amber-500/30 rounded font-mono text-xs font-semibold text-amber-700 dark:text-amber-400">
                        {typeof navigator !== "undefined" &&
                        navigator.platform.toLowerCase().includes("mac")
                          ? "⌘"
                          : "Ctrl"}
                        ⇧⏎
                      </kbd>
                      <span>branch</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <kbd className="px-2 py-1 bg-muted/50 border border-border/50 rounded font-mono text-xs font-semibold">
                        ⇧⏎
                      </kbd>
                      <span>new line</span>
                    </span>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
