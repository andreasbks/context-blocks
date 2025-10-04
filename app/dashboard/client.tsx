"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  GraphDetailResponse,
  GraphsListResponse,
  LinearResponse,
} from "@/lib/api/schemas/responses";
import { ContextBlockSchema } from "@/lib/api/schemas/shared";
import { QUERY_KEYS } from "@/lib/constants/query-keys";

// Derive types from Zod schemas for type safety and consistency with backend
type GraphListItem = z.infer<typeof GraphsListResponse>["items"][number];
type GraphDetail = z.infer<typeof GraphDetailResponse>;
type Branch = z.infer<typeof GraphDetailResponse>["branches"][number];
type TimelineItem = z.infer<typeof LinearResponse>["items"][number];
type LinearQueryData = z.infer<typeof LinearResponse>;
type ContextBlock = z.infer<typeof ContextBlockSchema>;

// Helper to safely extract text from block content
function getBlockText(block: ContextBlock): string {
  if (
    block.content &&
    typeof block.content === "object" &&
    "text" in block.content
  ) {
    return String(block.content.text);
  }
  return "";
}

async function fetchJson<T>(
  input: RequestInfo,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

export default function DashboardClient() {
  const [selectedGraphId, setSelectedGraphId] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [composer, setComposer] = useState("");
  const [streamingAssistant, setStreamingAssistant] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const qc = useQueryClient();

  const graphsQuery = useQuery({
    queryKey: QUERY_KEYS.graphsList(),
    queryFn: async () =>
      fetchJson<{ items: GraphListItem[]; nextCursor: string | null }>(
        "/api/v1/graphs"
      ),
    staleTime: 30_000,
  });

  const filteredGraphs = useMemo(() => {
    const items = graphsQuery.data?.items ?? [];
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((g) =>
      (g.title ?? "untitled").toLowerCase().includes(q)
    );
  }, [graphsQuery.data, search]);

  const graphDetailQuery = useQuery({
    enabled: Boolean(selectedGraphId),
    queryKey: selectedGraphId
      ? QUERY_KEYS.graphDetail(selectedGraphId)
      : ["graphs", "detail", "none"],
    queryFn: async () =>
      fetchJson<GraphDetail>(`/api/v1/graphs/${selectedGraphId}`),
    staleTime: 10_000,
  });

  // Select the first branch when graph changes
  // CRITICAL: Always reset to first branch when graph data changes
  // This ensures we don't carry over branchId from a different graph
  useEffect(() => {
    const first = graphDetailQuery.data?.branches?.[0];
    if (first) {
      setSelectedBranchId(first.id);
    } else {
      setSelectedBranchId(null);
    }
  }, [graphDetailQuery.data]);

  const linearQuery = useQuery({
    enabled: Boolean(selectedBranchId),
    queryKey: selectedBranchId
      ? QUERY_KEYS.branchLinear(selectedBranchId, true)
      : ["branches", "linear", "none"],
    queryFn: async () =>
      fetchJson<{ items: TimelineItem[]; nextCursor: string | null }>(
        `/api/v1/branches/${selectedBranchId}/linear?include=references`
      ),
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [linearQuery.data, streamingAssistant]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 h-[calc(100vh-8rem)]">
      {/* Left: Graphs list */}
      <Card className="md:col-span-2 p-3 flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <Input
            placeholder="Filter graphs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button
            variant="secondary"
            onClick={() => setSearch("")}
            disabled={!search}
          >
            Clear
          </Button>
        </div>
        <div className="space-y-1 flex-1 overflow-auto pr-1">
          {graphsQuery.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : filteredGraphs.length === 0 ? (
            <div className="text-sm text-muted-foreground">No graphs</div>
          ) : (
            filteredGraphs.map((g) => (
              <Button
                key={g.id}
                variant={selectedGraphId === g.id ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={() => setSelectedGraphId(g.id)}
              >
                <span className="truncate">{g.title ?? "Untitled"}</span>
              </Button>
            ))
          )}
        </div>
      </Card>

      {/* Middle: Chat timeline */}
      <Card className="md:col-span-3 p-3 flex flex-col">
        {selectedGraphId == null ? (
          <div className="text-sm text-muted-foreground">Select a graph</div>
        ) : graphDetailQuery.isLoading ? (
          <div className="text-sm text-muted-foreground">Loading graph…</div>
        ) : (
          <div className="flex flex-col h-full">
            {/* Branch selector dropdown - top right */}
            <div className="flex items-center justify-between mb-3 pb-2 border-b">
              <h2 className="text-sm font-medium text-muted-foreground">
                Conversation
              </h2>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    {graphDetailQuery.data?.branches.find(
                      (b) => b.id === selectedBranchId
                    )?.name ?? "Select branch"}
                    <span className="ml-2">▾</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>All Branches</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {graphDetailQuery.data?.branches.map((b) => (
                    <DropdownMenuItem
                      key={b.id}
                      onClick={() => setSelectedBranchId(b.id)}
                      className={
                        b.id === selectedBranchId ? "bg-accent font-medium" : ""
                      }
                    >
                      {b.name}
                      {b.id === selectedBranchId && (
                        <span className="ml-auto">✓</span>
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Timeline - takes available space */}
            <div
              ref={scrollRef}
              className="space-y-3 flex-1 overflow-auto pr-1"
            >
              {linearQuery.isLoading ? (
                <div className="text-sm text-muted-foreground">
                  Loading messages…
                </div>
              ) : (linearQuery.data?.items ?? []).length === 0 ? (
                <div className="text-sm text-muted-foreground">No messages</div>
              ) : (
                linearQuery.data!.items.map((item) => (
                  <MessageItem
                    key={item.nodeId}
                    item={item}
                    branches={graphDetailQuery.data?.branches ?? []}
                    currentBranchId={selectedBranchId ?? null}
                    onSelectBranch={(id) => setSelectedBranchId(id)}
                  />
                ))
              )}

              {/* Streaming assistant response - shown while generating */}
              {streamingAssistant && (
                <div className="rounded-md border p-3 bg-accent/30">
                  <Label className="text-xs mb-1 block text-muted-foreground">
                    Assistant
                  </Label>
                  <div className="whitespace-pre-wrap leading-relaxed">
                    {streamingAssistant}
                    <span className="animate-pulse ml-1">▍</span>
                  </div>
                </div>
              )}
            </div>

            {/* Composer - fixed at bottom */}
            <form
              className="border-t pt-3 mt-3 space-y-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!selectedBranchId || !selectedGraphId) return;

                const text = composer.trim();
                if (!text) return;

                const capturedBranchId = selectedBranchId;
                const capturedGraphId = selectedGraphId;

                const current = graphDetailQuery.data?.branches.find(
                  (b) => b.id === capturedBranchId
                );
                const expectedVersion = current?.version;

                // Generate optimistic IDs
                const optimisticUserNodeId = `optimistic-user-${Date.now()}`;
                const optimisticAssistantNodeId = `optimistic-assistant-${Date.now()}`;

                // Clear composer immediately for better UX
                setComposer("");
                setIsStreaming(true);
                setStreamingAssistant("");

                // Create optimistic user message
                const optimisticUserItem: TimelineItem = {
                  nodeId: optimisticUserNodeId,
                  block: {
                    id: optimisticUserNodeId,
                    kind: "user",
                    content: { text },
                    public: false,
                    createdAt: new Date().toISOString(),
                  },
                };

                // Add optimistic user message to cache immediately
                const queryKey = QUERY_KEYS.branchLinear(
                  capturedBranchId,
                  true
                );
                qc.setQueryData<LinearQueryData>(queryKey, (old) => {
                  if (!old?.items) return old;
                  return {
                    ...old,
                    items: [...old.items, optimisticUserItem],
                  };
                });

                try {
                  await sendStream({
                    branchId: capturedBranchId,
                    userText: text,
                    expectedVersion: expectedVersion ?? undefined,

                    onDelta: (chunk) => {
                      // Accumulate streaming assistant response
                      setStreamingAssistant((prev) =>
                        (prev + chunk).slice(-8000)
                      );
                    },

                    onFinal: (data) => {
                      // Stream complete - replace optimistic with real messages from backend
                      // The final event contains BOTH user and assistant messages
                      qc.setQueryData<LinearQueryData>(queryKey, (old) => {
                        if (!old?.items) return old;

                        // Remove optimistic user message and add real messages
                        const withoutOptimistic = old.items.filter(
                          (item) => item.nodeId !== optimisticUserNodeId
                        );

                        // Add all real messages from final event (user + assistant)
                        const realMessages = data.items.map(
                          (item) => item.item
                        );

                        return {
                          ...old,
                          items: [...withoutOptimistic, ...realMessages],
                        };
                      });

                      // Update graph detail with new version (use captured IDs)
                      if (data.version !== undefined) {
                        qc.setQueryData<GraphDetail>(
                          QUERY_KEYS.graphDetail(capturedGraphId),
                          (old) => {
                            if (!old?.branches) return old;
                            return {
                              ...old,
                              branches: old.branches.map((b) =>
                                b.id === capturedBranchId
                                  ? {
                                      ...b,
                                      version: data.version,
                                      tipNodeId: data.newTip,
                                    }
                                  : b
                              ),
                            };
                          }
                        );
                      }

                      setStreamingAssistant("");
                      setIsStreaming(false);

                      // CRITICAL: Use captured IDs to prevent cache contamination
                      // if user switched branches/graphs during message send
                      void qc.invalidateQueries({
                        queryKey: QUERY_KEYS.branchLinear(
                          capturedBranchId,
                          true
                        ),
                      });

                      // Also invalidate graphs list for lastActivityAt updates
                      void qc.invalidateQueries({
                        queryKey: QUERY_KEYS.graphsList(),
                      });
                    },

                    onError: (error) => {
                      console.error("Stream error:", error);
                      // Remove optimistic messages on error
                      qc.setQueryData<LinearQueryData>(queryKey, (old) => {
                        if (!old?.items) return old;
                        return {
                          ...old,
                          items: old.items.filter(
                            (item) =>
                              item.nodeId !== optimisticUserNodeId &&
                              item.nodeId !== optimisticAssistantNodeId
                          ),
                        };
                      });
                      setStreamingAssistant("");
                      setIsStreaming(false);
                      // TODO: Show error toast to user
                    },
                  });
                } catch (err) {
                  console.error("Send stream error:", err);
                  // Remove optimistic message on error
                  qc.setQueryData<LinearQueryData>(queryKey, (old) => {
                    if (!old?.items) return old;
                    return {
                      ...old,
                      items: old.items.filter(
                        (item) => item.nodeId !== optimisticUserNodeId
                      ),
                    };
                  });
                  setStreamingAssistant("");
                  setIsStreaming(false);
                  // TODO: Show error toast to user
                }
              }}
            >
              <Textarea
                placeholder="Type your message…"
                value={composer}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setComposer(e.target.value)
                }
                rows={3}
                disabled={!selectedBranchId || isStreaming}
              />
              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={
                    !composer.trim() || !selectedBranchId || isStreaming
                  }
                >
                  {isStreaming ? "Sending…" : "Send"}
                </Button>
              </div>
            </form>
          </div>
        )}
      </Card>
    </div>
  );
}

function MessageItem({
  item,
  branches,
  currentBranchId,
  onSelectBranch,
}: {
  item: TimelineItem;
  branches: Branch[];
  currentBranchId: string | null;
  onSelectBranch: (branchId: string) => void;
}) {
  const isUser = item.block.kind === "user";

  // Find sibling branches that fork from this node
  const siblingBranches = branches.filter(
    (b) => b.rootNodeId === item.nodeId && b.id !== currentBranchId
  );

  // Helper to get the first message preview of a branch
  const getBranchPreview = (branchId: string): string => {
    const branch = branches.find((b) => b.id === branchId);
    if (!branch || !branch.tipNodeId) return "";

    // Find the first item after this fork point in that branch
    // For now, we'll show a placeholder - you'd need to fetch the branch's linear items
    return "Click to switch to this branch";
  };

  return (
    <div className="rounded-md border p-3 bg-card">
      <Label className="text-xs mb-1 block text-muted-foreground">
        {isUser ? "User" : "Assistant"}
      </Label>
      <div className="whitespace-pre-wrap leading-relaxed">
        {getBlockText(item.block)}
      </div>

      {/* Sibling branches - shown as expandable cards */}
      {siblingBranches.length > 0 && (
        <div className="mt-3 space-y-2">
          <div className="text-xs text-muted-foreground font-medium">
            Other branches from here:
          </div>
          {siblingBranches.map((b) => (
            <button
              key={b.id}
              onClick={() => onSelectBranch(b.id)}
              className="w-full text-left p-2 rounded border border-dashed border-muted-foreground/30 hover:border-primary hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{b.name}</span>
                <span className="text-xs text-muted-foreground">Switch →</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                {getBranchPreview(b.id)}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* References */}
      {item.references && item.references.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3 pt-2 border-t">
          <span className="text-xs text-muted-foreground">References:</span>
          {item.references.map((ref) => (
            <span
              key={ref.nodeId}
              className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent cursor-help"
              title={getBlockText(ref.block)}
            >
              ref
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

async function sendStream({
  branchId,
  userText,
  expectedVersion,
  onDelta,
  onFinal,
  onError,
}: {
  branchId: string;
  userText: string;
  expectedVersion?: number;
  onDelta?: (chunk: string) => void;
  onFinal?: (data: {
    items: Array<{ role: "user" | "assistant"; item: TimelineItem }>;
    newTip?: string;
    version?: number;
  }) => void;
  onError?: (error: { code: string; message: string }) => void;
}) {
  const res = await fetch(`/api/v1/branches/${branchId}/send/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({
      userMessage: { text: userText },
      expectedVersion,
    }),
  });

  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    let idx;

    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const lines = chunk.split("\n");

      let event: string | null = null;
      let data = "";

      for (const line of lines) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }

      if (!event || !data) continue;

      try {
        const parsed = JSON.parse(data);

        switch (event) {
          case "delta":
            // Streaming assistant response chunk
            if (parsed.text && onDelta) onDelta(parsed.text);
            break;

          case "final":
            // Stream complete with all items
            if (onFinal) onFinal(parsed);
            break;

          case "error":
            // Error from backend
            if (onError) onError(parsed.error || parsed);
            throw new Error(parsed.error?.message || "Stream error");

          case "keepalive":
            // Heartbeat - ignore
            break;
        }
      } catch (parseError) {
        console.error("Failed to parse SSE event:", event, data, parseError);
      }
    }
  }
}
