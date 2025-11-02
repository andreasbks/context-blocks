"use client";

import { UseQueryResult } from "@tanstack/react-query";
import { GitBranch } from "lucide-react";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  GraphDetailResponse,
  LinearResponse,
} from "@/lib/api/schemas/responses";

import { BranchPoint } from "./branch-point";
import { MessageItem } from "./message-item";

type TimelineItem = z.infer<typeof LinearResponse>["items"][number];
type GraphDetail = z.infer<typeof GraphDetailResponse>;

// Helper to safely extract text from block content
function getBlockText(block: TimelineItem["block"]): string {
  if (
    block.content &&
    typeof block.content === "object" &&
    "text" in block.content
  ) {
    return String(block.content.text);
  }
  return "";
}

interface ForkContext {
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
  forkContext: ForkContext | null;
  onStartFork: (nodeId: string, messageText: string) => void;
  onCancelFork: () => void;
  forkComposer: string;
  setForkComposer: (value: string) => void;
  onSubmitFork: (e: React.FormEvent) => void;
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
  forkContext,
  onStartFork,
  onCancelFork,
  forkComposer,
  setForkComposer,
  onSubmitFork,
}: ChatAreaProps) {
  if (selectedGraphId == null) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-5xl mb-4">💭</div>
          <h3 className="text-2xl font-bold tracking-tight">
            Welcome to Context Blocks
          </h3>
          <p className="text-muted-foreground max-w-md">
            Select a session from the sidebar or create a new one to start
            branching conversations
          </p>
        </div>
      </div>
    );
  }

  if (graphDetailQuery.isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-muted-foreground">Loading session...</div>
      </div>
    );
  }

  const currentBranchName = graphDetailQuery.data?.branches.find(
    (b) => b.id === selectedBranchId
  )?.name;

  return (
    <div className="flex flex-col h-full">
      {/* Compact Header - Fixed, Not Scrollable */}
      <div className="flex-shrink-0 border-b bg-card/50">
        <div className="flex items-center justify-between px-3 py-3 max-w-4xl mx-auto">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-sm font-medium truncate">
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
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-4 pr-2">
          <div className="space-y-4">
            {linearQuery.isLoading ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground">
                Loading messages...
              </div>
            ) : (linearQuery.data?.items ?? []).length === 0 ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground">
                No messages yet. Start the conversation below.
              </div>
            ) : (
              linearQuery.data!.items.map((item) => {
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
                    const parentBranch = graphDetailQuery.data?.branches[0];
                    if (parentBranch && parentBranch.id !== selectedBranchId) {
                      shouldShowPills = true;
                      alternateBranches = [parentBranch];
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
                    className="group/message-wrapper relative"
                  >
                    {/* Branch Pills - Positioned outside the message flow */}
                    {shouldShowPills && alternateBranches.length > 0 && (
                      <BranchPoint
                        alternateBranches={alternateBranches}
                        onSelectBranch={onSelectBranch}
                        graphId={selectedGraphId}
                      />
                    )}

                    <MessageItem item={item} />

                    {/* Inter-Message Branch Button - Appears on hover between messages */}
                    {!forkContext && (
                      <div className="relative h-0 flex items-center justify-center">
                        <div className="absolute inset-x-0 top-2 opacity-0 group-hover/message-wrapper:opacity-100 transition-all duration-200 flex items-center justify-center z-10">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const messageText = getBlockText(item.block);
                              onStartFork(item.nodeId, messageText);
                            }}
                            className="bg-background/95 backdrop-blur-sm shadow-lg border-primary/50 hover:border-primary hover:bg-primary/10 animate-in fade-in slide-in-from-top-1 duration-200"
                          >
                            <GitBranch className="mr-2 h-4 w-4" />
                            Start new branch here
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Inline Fork Composer - Show if this is the fork context node */}
                    {forkContext && forkContext.nodeId === item.nodeId && (
                      <div className="my-4 ml-6 animate-in slide-in-from-top-2 duration-300">
                        {/* Duplicated message with visual indication */}
                        <div className="relative mb-3 pl-6 border-l-2 border-primary/30">
                          <div className="rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 px-4 py-3">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge
                                variant="outline"
                                className="text-xs border-primary/50 text-primary"
                              >
                                Forking from here
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                New branch: {forkContext.branchName}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {forkContext.messageText}
                            </p>
                          </div>
                        </div>

                        {/* Fork Composer */}
                        <form onSubmit={onSubmitFork} className="space-y-3">
                          <Textarea
                            placeholder="Enter your message for the new branch..."
                            value={forkComposer}
                            onChange={(e) => setForkComposer(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                e.currentTarget.form?.requestSubmit();
                              }
                            }}
                            rows={3}
                            disabled={isStreaming}
                            className="resize-none focus-visible:ring-2 focus-visible:ring-primary"
                            autoFocus
                          />
                          <div className="flex justify-end items-center gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={onCancelFork}
                              disabled={isStreaming}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="submit"
                              size="sm"
                              disabled={!forkComposer.trim() || isStreaming}
                              className="min-w-[100px]"
                            >
                              {isStreaming ? (
                                <>
                                  <span className="animate-pulse">Sending</span>
                                </>
                              ) : (
                                <>Start Branch</>
                              )}
                            </Button>
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
              <div className="rounded-xl border-2 border-purple-500/30 bg-card shadow-md">
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
                <div className="px-5 py-4 whitespace-pre-wrap leading-relaxed text-foreground">
                  {streamingAssistant}
                  <span className="inline-block w-0.5 h-5 bg-purple-500 animate-pulse ml-1" />
                </div>
              </div>
            )}

            {/* Composer - Context Block Style (Inline after messages) */}
            <form onSubmit={onSubmit}>
              <div className="rounded-xl border-2 border-dashed border-muted-foreground/20 bg-card hover:border-muted-foreground/30 transition-colors">
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
                  <Button
                    type="submit"
                    size="sm"
                    disabled={
                      !composer.trim() || !selectedBranchId || isStreaming
                    }
                    className="min-w-[100px]"
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
                </div>

                {/* Content Area */}
                <div className="px-4 py-3">
                  <Textarea
                    placeholder="Type your message here... (Press Enter to send, Shift+Enter for new line)"
                    value={composer}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setComposer(e.target.value)
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        e.currentTarget.form?.requestSubmit();
                      }
                    }}
                    rows={3}
                    disabled={!selectedBranchId || isStreaming}
                    className="resize-none border-0 p-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent placeholder:text-muted-foreground/50"
                  />
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
