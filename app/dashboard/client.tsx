"use client";

import { useEffect, useState } from "react";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { BranchTreeSidebar } from "@/components/dashboard/branch-tree-sidebar";
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
import { useGenerateStream } from "@/lib/hooks/use-generate-stream";

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

interface ForkContext {
  nodeId: string;
  branchName: string;
  messageText: string;
}

export default function DashboardClient() {
  const [selectedGraphId, setSelectedGraphId] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [branchTreeOpen, setBranchTreeOpen] = useState(true);
  const [branchTreeWidth, setBranchTreeWidth] = useState(320);
  const [creationStreamingAssistant, setCreationStreamingAssistant] =
    useState("");
  const [isCreationStreaming, setIsCreationStreaming] = useState(false);
  const [pendingGenerate, setPendingGenerate] = useState<{
    graphId: string;
    branchId: string;
    version?: number;
  } | null>(null);
  const [forkContext, setForkContext] = useState<ForkContext | null>(null);
  const [forkComposer, setForkComposer] = useState("");
  const [manuallySelectedBranch, setManuallySelectedBranch] = useState(false);

  const qc = useQueryClient();

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

  // Generate stream hook
  const { generateStream } = useGenerateStream();

  // Handle streaming delta during graph creation
  const handleStreamDelta = (chunk: string) => {
    setCreationStreamingAssistant((prev) => (prev + chunk).slice(-8000));
  };

  // Handle streaming complete during graph creation
  const handleStreamComplete = () => {
    setIsCreationStreaming(false);
    setCreationStreamingAssistant("");
  };

  // Reset manual selection flag when graph changes
  useEffect(() => {
    setManuallySelectedBranch(false);
  }, [selectedGraphId]);

  // Select the first branch when graph changes (but only if not manually selected)
  useEffect(() => {
    if (manuallySelectedBranch) return; // Skip if user manually selected a branch

    const branches = graphDetailQuery.data?.branches;
    const first = branches?.[0];
    if (first) {
      setSelectedBranchId(first.id);
    } else {
      setSelectedBranchId(null);
    }
  }, [
    graphDetailQuery.data?.branches,
    selectedGraphId,
    manuallySelectedBranch,
  ]);

  // Trigger generate stream after new session UI is rendered
  useEffect(() => {
    if (!pendingGenerate) return;
    if (!selectedBranchId) return;
    if (selectedBranchId !== pendingGenerate.branchId) return;

    // Wait for the linearQuery to be ready with the data
    if (linearQuery.isLoading) return;
    if (!linearQuery.data) return;

    // Clear pending so we don't trigger again
    const generateData = pendingGenerate;
    setPendingGenerate(null);

    // Now the UI is fully rendered, trigger the generate stream
    void generateStream({
      branchId: generateData.branchId,
      graphId: generateData.graphId,
      expectedVersion: generateData.version,
      onStreamDelta: handleStreamDelta,
      onStreamComplete: handleStreamComplete,
    });
  }, [
    pendingGenerate,
    selectedBranchId,
    linearQuery.isLoading,
    linearQuery.data,
    generateStream,
  ]);

  // Auto-scroll when data changes
  useEffect(() => {
    const scrollElement = chat.scrollRef.current;
    if (scrollElement) {
      // eslint-disable-next-line react-hooks/immutability
      scrollElement.scrollTop = scrollElement.scrollHeight;
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
      // Cmd/Ctrl + T to toggle branch tree
      if ((e.metaKey || e.ctrlKey) && e.key === "t") {
        e.preventDefault();
        setBranchTreeOpen((prev) => !prev);
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

    // Mark as manually selected to prevent auto-switch after sending
    setManuallySelectedBranch(true);

    await chat.sendMessage(text, expectedVersion);
  };

  // Handle graph creation - auto-select the new graph and prepare to generate
  const handleGraphCreated = (data: StartGraphResult) => {
    setSelectedGraphId(data.graph.id);
    setIsCreationStreaming(true);
    setCreationStreamingAssistant("");
    // Store the data needed to trigger generate after UI renders
    setPendingGenerate({
      graphId: data.graph.id,
      branchId: data.branch.id,
      version: data.branch.version,
    });
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

  // Handle start fork - create fork context with unique sequential naming
  const handleStartFork = (nodeId: string, messageText: string) => {
    const existingBranches = graphDetailQuery.data?.branches ?? [];

    // Find the next available branch number by looking at existing branch names
    const branchNumbers = existingBranches
      .map((b) => {
        const match = b.name.match(/^Branch #(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((n) => n > 0);

    const nextBranchNumber =
      branchNumbers.length > 0 ? Math.max(...branchNumbers) + 1 : 1;

    // Create descriptive branch name with sequential number and message context
    const branchName =
      messageText.length > 0
        ? `Branch #${nextBranchNumber}: ${messageText.slice(0, 30)}${messageText.length > 30 ? "..." : ""}`
        : `Branch #${nextBranchNumber}`;

    setForkContext({
      nodeId,
      branchName,
      messageText,
    });
    setForkComposer("");
  };

  // Handle cancel fork
  const handleCancelFork = () => {
    setForkContext(null);
    setForkComposer("");
  };

  // Handle submit fork - create branch with user message, then trigger generation
  const handleSubmitFork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forkContext || !selectedBranchId || !selectedGraphId) return;

    const text = forkComposer.trim();
    if (!text) return;

    const current = graphDetailQuery.data?.branches.find(
      (b) => b.id === selectedBranchId
    );
    const expectedVersion = current?.version;

    // Step 1: Create branch and append user message (no assistant yet)
    const result = await chat.appendFork(text, expectedVersion, {
      forkFromNodeId: forkContext.nodeId,
      newBranchName: forkContext.branchName,
    });

    // Clear fork context after successful submission
    setForkContext(null);
    setForkComposer("");

    // Step 2: Switch to the new branch and prepare for generation
    if (result?.newBranchId) {
      // Invalidate graph detail to pick up the new branch
      void qc.invalidateQueries({
        queryKey: QUERY_KEYS.graphDetail(selectedGraphId),
      });

      setManuallySelectedBranch(true);
      setSelectedBranchId(result.newBranchId);

      // Step 3: Set up streaming state and store pending generate
      setIsCreationStreaming(true);
      setCreationStreamingAssistant("");

      setPendingGenerate({
        graphId: selectedGraphId,
        branchId: result.newBranchId,
        version: result.version,
      });
    }
  };

  return (
    <div className="relative flex h-[calc(100vh-4rem)] w-full overflow-hidden">
      {/* Left Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onOpen={() => setSidebarOpen(true)}
        graphsQuery={graphsQuery}
        selectedGraphId={selectedGraphId}
        onSelectGraph={setSelectedGraphId}
        onGraphCreated={handleGraphCreated}
        onGraphDeleted={handleGraphDeleted}
      />

      {/* Main Content Area - Centered Chat */}
      <main
        className="flex-1 transition-all duration-300 ease-in-out"
        style={{
          marginLeft: sidebarOpen ? "320px" : "48px",
          marginRight: branchTreeOpen ? `${branchTreeWidth}px` : "48px",
        }}
      >
        <div className="h-full flex flex-col">
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
            forkContext={forkContext}
            onStartFork={handleStartFork}
            onCancelFork={handleCancelFork}
            forkComposer={forkComposer}
            setForkComposer={setForkComposer}
            onSubmitFork={handleSubmitFork}
          />
        </div>
      </main>

      {/* Right Branch Tree Sidebar */}
      <BranchTreeSidebar
        branches={graphDetailQuery.data?.branches ?? []}
        activeBranchId={selectedBranchId}
        isOpen={branchTreeOpen}
        onToggle={() => setBranchTreeOpen((prev) => !prev)}
        onSelectBranch={setSelectedBranchId}
        width={branchTreeWidth}
        onWidthChange={setBranchTreeWidth}
      />
    </div>
  );
}
