"use client";

import { ChevronLeft, ChevronRight, GitBranch } from "lucide-react";

import { BranchTreeNode } from "@/components/dashboard/branch-tree-node";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Branch } from "@/lib/utils/branch-tree";
import { buildBranchTree } from "@/lib/utils/branch-tree";

interface BranchTreeSidebarProps {
  branches: Branch[];
  activeBranchId: string | null;
  isOpen: boolean;
  onToggle: () => void;
  onSelectBranch: (branchId: string) => void;
}

export function BranchTreeSidebar({
  branches,
  activeBranchId,
  isOpen,
  onToggle,
  onSelectBranch,
}: BranchTreeSidebarProps) {
  // Build the tree structure
  const tree = buildBranchTree(branches, activeBranchId);

  // Empty state
  const isEmpty = branches.length === 0;

  return (
    <div
      className={cn(
        "fixed right-0 top-16 h-[calc(100vh-4rem)] bg-background border-l transition-all duration-300 ease-in-out z-30",
        "flex flex-col",
        isOpen ? "w-80" : "w-12"
      )}
    >
      {/* Collapse/Expand Toggle Button */}
      <div className="flex items-center justify-between p-2 border-b bg-card/50">
        {isOpen && (
          <div className="flex items-center gap-2 ml-2">
            <GitBranch className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Branch Tree</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="h-8 w-8 flex-shrink-0"
          aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          {isOpen ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Sidebar Content */}
      {isOpen && (
        <div className="flex-1 overflow-y-auto p-4">
          {isEmpty ? (
            // Empty state
            <Card className="border-dashed">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <GitBranch className="h-4 w-4" />
                  No Branches Yet
                </CardTitle>
                <CardDescription className="text-xs">
                  Start a conversation to create your first branch.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            // Branch tree
            <div className="space-y-1">
              <div className="mb-4 px-1">
                <p className="text-xs text-muted-foreground">
                  {branches.length}{" "}
                  {branches.length === 1 ? "branch" : "branches"}
                </p>
              </div>

              {tree.map((node, idx) => (
                <BranchTreeNode
                  key={node.branch.id}
                  node={node}
                  onSelect={onSelectBranch}
                  isLast={idx === tree.length - 1}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Collapsed state hint */}
      {!isOpen && (
        <div className="flex-1 flex items-start justify-center pt-20">
          <GitBranch className="h-5 w-5 text-muted-foreground rotate-90" />
        </div>
      )}

      {/* Bottom section with keyboard shortcut hint */}
      {isOpen && !isEmpty && (
        <div className="border-t p-3 bg-muted/30">
          <p className="text-xs text-muted-foreground text-center">
            <kbd className="px-1.5 py-0.5 text-xs font-semibold bg-background border rounded">
              {typeof navigator !== "undefined" &&
              navigator.platform.toLowerCase().includes("mac")
                ? "⌘"
                : "Ctrl"}
            </kbd>{" "}
            +{" "}
            <kbd className="px-1.5 py-0.5 text-xs font-semibold bg-background border rounded">
              T
            </kbd>{" "}
            to toggle
          </p>
        </div>
      )}
    </div>
  );
}
