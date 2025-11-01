"use client";

import { useEffect, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { ChatArea } from "@/components/dashboard/chat-area";
import { Sidebar } from "@/components/dashboard/sidebar";
import {
  GraphDetailResponse,
  GraphsListResponse,
  LinearResponse,
  StartGraphResponse,
} from "@/lib/api/schemas/responses";
import { QUERY_KEYS } from "@/lib/constants/query-keys";
import { useChat } from "@/lib/hooks/use-chat";

// Derive types from Zod schemas
type GraphListItem = z.infer<typeof GraphsListResponse>["items"][number];
type GraphDetail = z.infer<typeof GraphDetailResponse>;
type TimelineItem = z.infer<typeof LinearResponse>["items"][number];
type StartGraphResult = z.infer<typeof StartGraphResponse>;

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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [creationStreamingAssistant, setCreationStreamingAssistant] =
    useState("");
  const [isCreationStreaming, setIsCreationStreaming] = useState(false);

  // Queries
  const graphsQuery = useQuery({
    queryKey: QUERY_KEYS.graphsList(),
    queryFn: async () =>
      fetchJson<{ items: GraphListItem[]; nextCursor: string | null }>(
        "/api/v1/graphs"
      ),
    staleTime: 30_000,
  });

  const graphDetailQuery = useQuery({
    enabled: Boolean(selectedGraphId),
    queryKey: selectedGraphId
      ? QUERY_KEYS.graphDetail(selectedGraphId)
      : ["graphs", "detail", "none"],
    queryFn: async () =>
      fetchJson<GraphDetail>(`/api/v1/graphs/${selectedGraphId}`),
    staleTime: 10_000,
  });

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

  // Chat hook
  const chat = useChat({
    branchId: selectedBranchId,
    graphId: selectedGraphId,
  });

  // Select the first branch when graph changes
  useEffect(() => {
    const branches = graphDetailQuery.data?.branches;
    const first = branches?.[0];
    if (first) {
      setSelectedBranchId(first.id);
    } else {
      setSelectedBranchId(null);
    }
  }, [graphDetailQuery.data?.branches, selectedGraphId]);

  // Auto-scroll when data changes
  useEffect(() => {
    if (chat.scrollRef.current) {
      chat.scrollRef.current.scrollTop = chat.scrollRef.current.scrollHeight;
    }
  }, [
    linearQuery.data,
    chat.streamingAssistant,
    creationStreamingAssistant,
    chat.scrollRef,
  ]);

  // Keyboard shortcut: Cmd/Ctrl + B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        setSidebarOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBranchId || !selectedGraphId) return;

    const text = chat.composer.trim();
    if (!text) return;

    const current = graphDetailQuery.data?.branches.find(
      (b) => b.id === selectedBranchId
    );
    const expectedVersion = current?.version;

    await chat.sendMessage(text, expectedVersion);
  };

  // Handle graph creation - auto-select the new graph
  const handleGraphCreated = (data: StartGraphResult) => {
    setSelectedGraphId(data.graph.id);
    setIsCreationStreaming(true);
    setCreationStreamingAssistant("");
  };

  // Handle streaming delta during graph creation
  const handleStreamDelta = (chunk: string) => {
    setCreationStreamingAssistant((prev) => (prev + chunk).slice(-8000));
  };

  // Handle streaming complete during graph creation
  const handleStreamComplete = () => {
    setIsCreationStreaming(false);
    setCreationStreamingAssistant("");
  };

  // Handle graph deletion - select another graph or clear selection
  const handleGraphDeleted = (deletedGraphId: string) => {
    if (selectedGraphId === deletedGraphId) {
      // If the deleted graph was selected, select the first available graph
      const graphs = graphsQuery.data?.items ?? [];
      const remainingGraphs = graphs.filter((g) => g.id !== deletedGraphId);

      if (remainingGraphs.length > 0) {
        setSelectedGraphId(remainingGraphs[0].id);
      } else {
        setSelectedGraphId(null);
      }
    }
  };

  return (
    <div className="relative flex h-[calc(100vh-4rem)] w-full overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onOpen={() => setSidebarOpen(true)}
        graphsQuery={graphsQuery}
        selectedGraphId={selectedGraphId}
        onSelectGraph={setSelectedGraphId}
        onGraphCreated={handleGraphCreated}
        onGraphDeleted={handleGraphDeleted}
        onStreamDelta={handleStreamDelta}
        onStreamComplete={handleStreamComplete}
      />

      {/* Main Content Area - Centered Chat */}
      <main
        className={`
          flex-1 transition-all duration-300 ease-in-out
          ${sidebarOpen ? "ml-80" : "ml-12"}
        `}
      >
        <div className="h-full flex flex-col max-w-4xl mx-auto px-4 md:px-8">
          {/* Chat Area */}
          <ChatArea
            selectedGraphId={selectedGraphId}
            selectedBranchId={selectedBranchId}
            onSelectBranch={setSelectedBranchId}
            graphDetailQuery={graphDetailQuery}
            linearQuery={linearQuery}
            composer={chat.composer}
            setComposer={chat.setComposer}
            streamingAssistant={
              chat.streamingAssistant || creationStreamingAssistant
            }
            isStreaming={chat.isStreaming || isCreationStreaming}
            scrollRef={chat.scrollRef}
            onSubmit={handleSubmit}
          />
        </div>
      </main>
    </div>
  );
}
