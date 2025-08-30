"use client";

import { useEffect, useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QUERY_KEYS } from "@/lib/constants/query-keys";

type GraphListItem = {
  id: string;
  title: string | null;
  createdAt: string;
  lastActivityAt: string | null;
};

type Branch = {
  id: string;
  name: string;
  rootNodeId: string;
  tipNodeId: string | null;
  version: number;
};

type GraphDetail = {
  graph: GraphListItem;
  branches: Branch[];
};

type ContextBlock = {
  id: string;
  kind: "user" | "assistant";
  content: { text: string };
  public?: boolean;
  createdAt?: string;
  model?: string | null;
};

type TimelineItem = {
  nodeId: string;
  block: ContextBlock;
  references?: Array<{ nodeId: string; block: ContextBlock }>;
};

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
  useEffect(() => {
    const first = graphDetailQuery.data?.branches?.[0];
    if (first) setSelectedBranchId((prev) => (prev ? prev : first.id));
    else setSelectedBranchId(null);
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
      {/* Left: Graphs list */}
      <Card className="md:col-span-2 p-3">
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
        <div className="space-y-1 max-h-[60vh] overflow-auto pr-1">
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
      <Card className="md:col-span-3 p-3">
        {selectedGraphId == null ? (
          <div className="text-sm text-muted-foreground">Select a graph</div>
        ) : graphDetailQuery.isLoading ? (
          <div className="text-sm text-muted-foreground">Loading graph…</div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Branch selector chips */}
            <div className="flex flex-wrap gap-2">
              {graphDetailQuery.data?.branches.map((b) => (
                <Button
                  key={b.id}
                  size="sm"
                  variant={b.id === selectedBranchId ? "default" : "secondary"}
                  onClick={() => setSelectedBranchId(b.id)}
                >
                  {b.name}
                </Button>
              ))}
            </div>

            {/* Timeline */}
            <div className="space-y-2 max-h-[65vh] overflow-auto pr-1">
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
            </div>
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
  return (
    <div className="rounded-md border p-3">
      <Label className="text-xs mb-1 block text-muted-foreground">
        {isUser ? "User" : "Assistant"}
      </Label>
      <div className="whitespace-pre-wrap leading-relaxed">
        {item.block.content?.text}
      </div>
      {/* Branch chips at branch roots present in this timeline node */}
      <div className="flex flex-wrap gap-2 mt-2">
        {branches
          .filter(
            (b) => b.rootNodeId === item.nodeId && b.id !== currentBranchId
          )
          .map((b) => (
            <Button
              key={b.id}
              size="sm"
              variant="outline"
              onClick={() => onSelectBranch(b.id)}
            >
              {b.name}
            </Button>
          ))}
      </div>
      {item.references && item.references.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {item.references.map((ref) => (
            <span
              key={ref.nodeId}
              className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs text-muted-foreground"
              title={ref.block.content?.text}
            >
              ref
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
