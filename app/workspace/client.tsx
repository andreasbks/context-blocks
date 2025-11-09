"use client";

import { useEffect, useState } from "react";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";

import { BranchTreeSidebar } from "@/components/workspace/branch-tree-sidebar";
import { ChatArea } from "@/components/workspace/chat-area";
import { Sidebar } from "@/components/workspace/sidebar";
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

interface BranchContext {
  nodeId: string;
  branchName: string;
  messageText: string;
}

export default function WorkspaceClient() {
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
  const [branchContext, setBranchContext] = useState<BranchContext | null>(
    null
  );
  const [branchComposer, setBranchComposer] = useState("");
  const [manuallySelectedBranch, setManuallySelectedBranch] = useState(false);
  const [autoShowNewSession, setAutoShowNewSession] = useState(false);

  const qc = useQueryClient();

  // Queries
  const graphsQuery = useQuery({
    queryKey: QUERY_KEYS.graphsList(),
    queryFn: async () =>
      fetchJson<{ items: GraphListItem[]; nextCursor: string | null }>(
        "/api/v1/graphs"
      ),
    staleTime: 30_000,
    // Poll every 2 seconds if any graph has "Generating name..."
    refetchInterval: (query) => {
      const data = query.state.data;
      const hasGeneratingNames = data?.items?.some(
        (g) => g.title === "Generating name..."
      );
      return hasGeneratingNames ? 2000 : false;
    },
  });

  const graphDetailQuery = useQuery({
    enabled: Boolean(selectedGraphId),
    queryKey: selectedGraphId
      ? QUERY_KEYS.graphDetail(selectedGraphId)
      : ["graphs", "detail", "none"],
    queryFn: async () =>
      fetchJson<GraphDetail>(`/api/v1/graphs/${selectedGraphId}`),
    staleTime: 10_000,
    // Poll every 2 seconds if graph title or any branch has "Generating name..."
    refetchInterval: (query) => {
      const data = query.state.data;
      const hasGeneratingGraphName =
        data?.graph?.title === "Generating name...";
      const hasGeneratingBranchNames = data?.branches?.some(
        (b) => b.name === "Generating name..."
      );
      return hasGeneratingGraphName || hasGeneratingBranchNames ? 2000 : false;
    },
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

  // Auto-show new session dialog for first-time users
  useEffect(() => {
    const hasSeenEmptyState = localStorage.getItem("hasSeenEmptyState");
    const graphs = graphsQuery.data?.items ?? [];

    if (!hasSeenEmptyState && !graphsQuery.isLoading && graphs.length === 0) {
      setAutoShowNewSession(true);
      localStorage.setItem("hasSeenEmptyState", "true");
    }
  }, [graphsQuery.data, graphsQuery.isLoading]);

  // Reset manual selection flag when graph changes
  useEffect(() => {
    setManuallySelectedBranch(false);
  }, [selectedGraphId]);

  // Prefetch first branch's linear data when graph details load
  useEffect(() => {
    const branches = graphDetailQuery.data?.branches;
    const firstBranch = branches?.[0];

    if (firstBranch && !selectedBranchId) {
      // Prefetch the linear query for the first branch
      void qc.prefetchQuery({
        queryKey: QUERY_KEYS.branchLinear(firstBranch.id, true),
        queryFn: async () =>
          fetchJson<{ items: TimelineItem[]; nextCursor: string | null }>(
            `/api/v1/branches/${firstBranch.id}/linear?include=references`
          ),
      });
    }
  }, [graphDetailQuery.data?.branches, selectedBranchId, qc]);

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

  const isStreaming = chat.isStreaming || isCreationStreaming;
  const streamingContent =
    chat.streamingAssistant || creationStreamingAssistant;

  // Auto-scroll during generation based on current position
  useEffect(() => {
    if (!isStreaming) return;

    const scrollElement = chat.scrollRef.current;
    if (!scrollElement) return;

    // Check current position - if user is near bottom, scroll
    const distanceFromBottom =
      scrollElement.scrollHeight -
      scrollElement.scrollTop -
      scrollElement.clientHeight;

    // If user is near bottom (within 150px), keep scrolling
    // If they're not, don't scroll (they can scroll back down to re-enable)
    if (distanceFromBottom < 150) {
      // eslint-disable-next-line react-hooks/immutability
      scrollElement.scrollTop = scrollElement.scrollHeight;
    }
  }, [isStreaming, streamingContent, linearQuery.data, chat.scrollRef]);

  // Auto-scroll to bottom when switching branches
  useEffect(() => {
    // After branch switch and data is loaded, scroll to bottom
    if (selectedBranchId && !linearQuery.isLoading && linearQuery.data) {
      const scrollElement = chat.scrollRef.current;
      if (scrollElement) {
        // eslint-disable-next-line react-hooks/immutability
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [
    selectedBranchId,
    linearQuery.isLoading,
    linearQuery.data,
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

  // Handle start branch - create branch context (name will be auto-generated by backend)
  const handleStartBranch = (nodeId: string, messageText: string) => {
    setBranchContext({
      nodeId,
      branchName: "Generating name...",
      messageText,
    });
    setBranchComposer("");
  };

  // Handle cancel branch
  const handleCancelBranch = () => {
    setBranchContext(null);
    setBranchComposer("");
  };

  // Handle submit branch - create branch with user message, then trigger generation
  const handleSubmitBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchContext || !selectedBranchId || !selectedGraphId) return;

    const text = branchComposer.trim();
    if (!text) return;

    const current = graphDetailQuery.data?.branches.find(
      (b) => b.id === selectedBranchId
    );
    const expectedVersion = current?.version;

    // Step 1: Create branch and append user message (no assistant yet)
    const result = await chat.appendBranch(text, expectedVersion, {
      branchFromNodeId: branchContext.nodeId,
      newBranchName: branchContext.branchName,
    });

    // Clear branch context after successful submission
    setBranchContext(null);
    setBranchComposer("");

    // Step 2: Switch to the new branch and prepare for generation
    if (result?.newBranchId) {
      // Show success toast
      toast.success("Branch created successfully!", {
        description: "Generating AI response...",
        duration: 3000,
      });

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

  // Handle branch from tip - directly create branch and send message with generation
  const handleBranchFromTip = async (text: string) => {
    if (!selectedBranchId || !selectedGraphId || !text.trim()) return;

    const current = graphDetailQuery.data?.branches.find(
      (b) => b.id === selectedBranchId
    );
    const expectedVersion = current?.version;

    // Find the tip node of the current branch
    if (!current?.tipNodeId) return;

    // Step 1: Create branch and append user message
    const result = await chat.appendBranch(text, expectedVersion, {
      branchFromNodeId: current.tipNodeId,
      newBranchName: "Generating name...",
    });

    // Step 2: Switch to the new branch and prepare for generation
    if (result?.newBranchId) {
      // Show success toast
      toast.success("Branch created successfully!", {
        description: "Generating AI response...",
        duration: 3000,
      });

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
        autoShowNewSession={autoShowNewSession}
        onNewSessionShown={() => setAutoShowNewSession(false)}
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
            onBranchFromTip={handleBranchFromTip}
            branchContext={branchContext}
            onStartBranch={handleStartBranch}
            onCancelBranch={handleCancelBranch}
            branchComposer={branchComposer}
            setBranchComposer={setBranchComposer}
            onSubmitBranch={handleSubmitBranch}
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
