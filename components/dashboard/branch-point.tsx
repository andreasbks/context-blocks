"use client";

import { useEffect, useState } from "react";

import { GitBranch } from "lucide-react";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { GraphDetailResponse } from "@/lib/api/schemas/responses";
import { useBranchPreview } from "@/lib/hooks/use-branch-preview";

type Branch = z.infer<typeof GraphDetailResponse>["branches"][number];

// Helper to safely extract text from block content
function getBlockText(block: { content: unknown }): string {
  if (
    block.content &&
    typeof block.content === "object" &&
    "text" in block.content
  ) {
    return String(block.content.text);
  }
  return "";
}

// Helper to truncate text
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

// Helper to get author icon
function getAuthorIcon(kind: "user" | "assistant"): string {
  return kind === "user" ? "👤" : "🤖";
}

interface BranchPointProps {
  alternateBranches: Branch[];
  onSelectBranch: (branchId: string) => void;
  graphId: string;
}

function BranchPill({
  branch,
  onSelectBranch,
}: {
  branch: Branch;
  onSelectBranch: (branchId: string) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [showPopover, setShowPopover] = useState(false);

  // Debounce popover opening - only show after 500ms of hover
  useEffect(() => {
    if (isHovered) {
      const timer = setTimeout(() => {
        setShowPopover(true);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowPopover(false);
    }
  }, [isHovered]);

  const { preview, isLoading } = useBranchPreview({
    branchId: branch.id,
    enabled: showPopover,
  });

  return (
    <Popover open={showPopover} onOpenChange={setShowPopover}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="transition-all duration-200 hover:bg-accent hover:shadow-md border-muted-foreground/20 gap-1.5"
        >
          <GitBranch className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">{branch.name}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="left"
        align="start"
        className="w-80 p-0"
        sideOffset={8}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/50">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold text-sm">{branch.name}</span>
          </div>
          <Badge variant="secondary" className="text-xs">
            Preview
          </Badge>
        </div>

        {/* Content */}
        <div className="p-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-4">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-sm">Loading preview...</span>
            </div>
          ) : preview && preview.items.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground mb-3">
                First {preview.items.length} message
                {preview.items.length > 1 ? "s" : ""} in this branch:
              </p>
              {preview.items.map((item) => {
                const isUser = item.block.kind === "user";
                return (
                  <div
                    key={item.nodeId}
                    className="rounded-lg border bg-card p-3 space-y-1.5 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`text-xs font-medium ${
                          isUser
                            ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20"
                            : "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20"
                        }`}
                      >
                        <span className="mr-1">
                          {getAuthorIcon(item.block.kind)}
                        </span>
                        {isUser ? "User" : "Assistant"}
                      </Badge>
                    </div>
                    <p className="text-sm leading-relaxed text-foreground">
                      {truncateText(getBlockText(item.block), 120)}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground text-sm">
              No messages in this branch yet
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t bg-muted/30">
          <Button
            onClick={() => {
              onSelectBranch(branch.id);
              setIsHovered(false);
            }}
            className="w-full"
            size="sm"
          >
            Switch to this branch
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function BranchPoint({
  alternateBranches,
  onSelectBranch,
}: BranchPointProps) {
  // Only show if there are alternate branches to switch to
  if (alternateBranches.length === 0) return null;

  return (
    <div className="absolute right-0 top-2 flex items-start gap-2 pr-4 z-30">
      {alternateBranches.map((branch) => (
        <BranchPill
          key={branch.id}
          branch={branch}
          onSelectBranch={onSelectBranch}
        />
      ))}
    </div>
  );
}
