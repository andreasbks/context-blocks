"use client";

import { UseQueryResult } from "@tanstack/react-query";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  GraphDetailResponse,
  LinearResponse,
} from "@/lib/api/schemas/responses";

import { MessageItem } from "./message-item";

type TimelineItem = z.infer<typeof LinearResponse>["items"][number];
type GraphDetail = z.infer<typeof GraphDetailResponse>;

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

  return (
    <div className="flex flex-col h-full py-6">
      {/* Header with Branch Selector */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {graphDetailQuery.data?.graph.title ?? "Untitled Session"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Branch-enabled AI conversation
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="min-w-[140px]">
              <span className="mr-2">🌿</span>
              {graphDetailQuery.data?.branches.find(
                (b) => b.id === selectedBranchId
              )?.name ?? "Select branch"}
              <span className="ml-auto">▾</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Switch Branch</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {graphDetailQuery.data?.branches.map((b) => (
              <DropdownMenuItem
                key={b.id}
                onClick={() => onSelectBranch(b.id)}
                className={
                  b.id === selectedBranchId ? "bg-accent font-semibold" : ""
                }
              >
                <span className="mr-2">🌿</span>
                {b.name}
                {b.id === selectedBranchId && (
                  <span className="ml-auto text-primary">✓</span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Timeline - Scrollable Chat Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-4 mb-6 pr-2"
      >
        {linearQuery.isLoading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground">
            Loading messages...
          </div>
        ) : (linearQuery.data?.items ?? []).length === 0 ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground">
            No messages yet. Start the conversation below.
          </div>
        ) : (
          linearQuery.data!.items.map((item) => (
            <MessageItem
              key={item.nodeId}
              item={item}
              branches={graphDetailQuery.data?.branches ?? []}
              currentBranchId={selectedBranchId ?? null}
              onSelectBranch={onSelectBranch}
            />
          ))
        )}

        {/* Streaming assistant response */}
        {streamingAssistant && (
          <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-accent/30 to-accent/10 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <Label className="text-xs font-medium text-muted-foreground">
                Assistant
              </Label>
            </div>
            <div className="whitespace-pre-wrap leading-relaxed text-foreground">
              {streamingAssistant}
              <span className="inline-block w-0.5 h-5 bg-primary animate-pulse ml-1" />
            </div>
          </div>
        )}
      </div>

      {/* Composer - Fixed at Bottom */}
      <form className="border-t pt-4 space-y-3" onSubmit={onSubmit}>
        <Textarea
          placeholder="Type your message... (Press Enter to send, Shift+Enter for new line)"
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
          className="resize-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        <div className="flex justify-between items-center">
          <div className="text-xs text-muted-foreground">
            {composer.length > 0 && `${composer.length} characters`}
          </div>
          <Button
            type="submit"
            size="lg"
            disabled={!composer.trim() || !selectedBranchId || isStreaming}
            className="min-w-[120px] font-semibold"
          >
            {isStreaming ? (
              <>
                <span className="animate-pulse">Sending</span>
                <span className="ml-2">...</span>
              </>
            ) : (
              <>
                Send
                <span className="ml-2">→</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
