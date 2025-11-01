"use client";

import { useMemo, useState } from "react";

import { UseQueryResult } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { z } from "zod";

import { DeleteGraphDialog } from "@/components/dashboard/delete-graph-dialog";
import { NewSessionDialog } from "@/components/dashboard/new-session-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  GraphsListResponse,
  StartGraphResponse,
} from "@/lib/api/schemas/responses";
import { useGraphMutations } from "@/lib/hooks/use-graph-mutations";

type GraphListItem = z.infer<typeof GraphsListResponse>["items"][number];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
  graphsQuery: UseQueryResult<
    { items: GraphListItem[]; nextCursor: string | null },
    Error
  >;
  selectedGraphId: string | null;
  onSelectGraph: (graphId: string) => void;
  onGraphCreated?: (data: z.infer<typeof StartGraphResponse>) => void;
  onGraphDeleted?: (graphId: string) => void;
}

const ExpandIcon = () => <span className="text-xl">→</span>;
const CloseIcon = () => <span className="text-xl">✕</span>;
const SearchIcon = () => <span className="text-sm">🔍</span>;
const PlusIcon = () => <span className="text-lg">+</span>;

export function Sidebar({
  isOpen,
  onClose,
  onOpen,
  graphsQuery,
  selectedGraphId,
  onSelectGraph,
  onGraphCreated,
  onGraphDeleted,
}: SidebarProps) {
  const [search, setSearch] = useState("");
  const [newSessionDialogOpen, setNewSessionDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [graphToDelete, setGraphToDelete] = useState<{
    id: string;
    title: string | null;
  } | null>(null);
  const [hoveredGraphId, setHoveredGraphId] = useState<string | null>(null);

  const { createGraph, deleteGraph, isCreating, isDeleting } =
    useGraphMutations();

  const filteredGraphs = useMemo(() => {
    const items = graphsQuery.data?.items ?? [];
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((g) =>
      (g.title ?? "untitled").toLowerCase().includes(q)
    );
  }, [graphsQuery.data, search]);

  const handleCreateGraph = (firstMessage: string) => {
    createGraph({
      title: "Untitled Session",
      firstMessage,
      onSuccess: (data) => {
        setNewSessionDialogOpen(false);
        if (onGraphCreated) {
          onGraphCreated(data);
        }
      },
    });
  };

  const handleDeleteClick = (e: React.MouseEvent, graph: GraphListItem) => {
    e.stopPropagation();
    setGraphToDelete({
      id: graph.id,
      title: graph.title ?? null,
    });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (graphToDelete) {
      deleteGraph({
        graphId: graphToDelete.id,
        onSuccess: () => {
          if (onGraphDeleted) {
            onGraphDeleted(graphToDelete.id);
          }
        },
      });
      setGraphToDelete(null);
    }
  };

  return (
    <>
      {/* Collapsed Sidebar - Thin Vertical Bar */}
      <aside
        className={`
          fixed left-0 top-16 h-[calc(100vh-4rem)] z-30
          bg-background/95 backdrop-blur-sm border-r border-border/50
          transition-all duration-300 ease-in-out
          ${isOpen ? "opacity-0 pointer-events-none" : "opacity-100"}
          w-12
        `}
      >
        <div className="flex flex-col h-full py-6 items-center">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={onOpen}
          >
            <ExpandIcon />
          </Button>
        </div>
      </aside>

      {/* Expanded Sidebar - Full Width */}
      <aside
        className={`
          fixed left-0 top-16 h-[calc(100vh-4rem)] z-30
          bg-background/95 backdrop-blur-sm border-r border-border/50
          transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          w-80
        `}
      >
        <div className="flex flex-col h-full p-6">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold tracking-tight">Sessions</h2>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={onClose}
            >
              <CloseIcon />
            </Button>
          </div>

          {/* Search Bar */}
          <div className="relative mb-4">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none opacity-50">
              <SearchIcon />
            </div>
            <Input
              placeholder="Search sessions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 bg-accent/20 border-border/50 focus-visible:ring-1 focus-visible:ring-primary"
            />
          </div>

          {/* New Session Button */}
          <Button
            className="w-full mb-4 font-semibold"
            size="lg"
            onClick={() => setNewSessionDialogOpen(true)}
            disabled={isCreating}
          >
            <PlusIcon />
            <span className="ml-2">New Session</span>
          </Button>

          {/* Sessions List */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {graphsQuery.isLoading ? (
              <div className="flex items-center justify-center h-20 text-sm text-muted-foreground">
                Loading sessions...
              </div>
            ) : filteredGraphs.length === 0 ? (
              <div className="flex items-center justify-center h-20 text-sm text-muted-foreground">
                No sessions found
              </div>
            ) : (
              filteredGraphs.map((g) => (
                <div
                  key={g.id}
                  className="relative"
                  onMouseEnter={() => setHoveredGraphId(g.id)}
                  onMouseLeave={() => setHoveredGraphId(null)}
                >
                  <button
                    onClick={() => onSelectGraph(g.id)}
                    className={`
                    w-full text-left px-4 py-3 rounded-lg
                    transition-all duration-200
                    ${
                      selectedGraphId === g.id
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "hover:bg-accent/50 text-foreground"
                    }
                  `}
                  >
                    <div className="font-medium truncate mb-1 pr-8">
                      {g.title ?? "Untitled Session"}
                    </div>
                    <div className="text-xs opacity-70">
                      {g.lastActivityAt
                        ? new Date(g.lastActivityAt).toLocaleDateString()
                        : "Recently"}
                    </div>
                  </button>
                  {hoveredGraphId === g.id && (
                    <button
                      onClick={(e) => handleDeleteClick(e, g)}
                      className={`
                        absolute right-2 top-1/2 -translate-y-1/2
                        p-2 rounded-md
                        transition-colors duration-200
                        ${
                          selectedGraphId === g.id
                            ? "hover:bg-primary-foreground/20 text-primary-foreground"
                            : "hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                        }
                      `}
                      aria-label="Delete session"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </aside>

      {/* New Session Dialog */}
      <NewSessionDialog
        open={newSessionDialogOpen}
        onOpenChange={setNewSessionDialogOpen}
        onSubmit={handleCreateGraph}
        isCreating={isCreating}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteGraphDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        graphTitle={graphToDelete?.title ?? null}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
      />
    </>
  );
}
