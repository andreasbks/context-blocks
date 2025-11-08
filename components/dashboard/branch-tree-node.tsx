"use client";

import { useEffect, useState } from "react";

import { Check, GitBranch } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useBranchPreview } from "@/lib/hooks/use-branch-preview";
import { cn } from "@/lib/utils";
import type { BranchNode } from "@/lib/utils/branch-tree";
import { getBranchDisplayName } from "@/lib/utils/branch-tree";

interface BranchTreeNodeProps {
  node: BranchNode;
  onSelect: (branchId: string) => void;
  isLast?: boolean;
}

export function BranchTreeNode({
  node,
  onSelect,
  isLast = false,
}: BranchTreeNodeProps) {
  const displayName = getBranchDisplayName(node.branch);
  const hasChildren = node.children.length > 0;
  const [isHovered, setIsHovered] = useState(false);
  const [showPopover, setShowPopover] = useState(false);

  // Truncate long branch names
  const truncatedName =
    displayName.length > 35 ? `${displayName.slice(0, 35)}...` : displayName;

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
    branchId: node.branch.id,
    enabled: showPopover,
  });

  // Helper functions for preview content
  const getBlockText = (content: unknown): string => {
    // If content is already an object with a text property
    if (content && typeof content === "object" && "text" in content) {
      return String(content.text);
    }
    // If content is a string, try to parse it as JSON
    if (typeof content === "string") {
      try {
        const parsed = JSON.parse(content);
        if (parsed.text) return parsed.text;
        if (typeof parsed === "string") return parsed;
        return content;
      } catch {
        return content;
      }
    }
    return "";
  };

  const truncateText = (text: string, maxLength: number = 100): string => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + "...";
  };

  const getAuthorIcon = (kind: string): string => {
    return kind === "user" ? "👤" : "🤖";
  };

  return (
    <div className="relative">
      {/* Tree connector lines */}
      {node.depth > 0 && (
        <>
          {/* Vertical line from parent */}
          {!isLast && (
            <div
              className="absolute left-0 top-0 bottom-0 w-px bg-border"
              style={{
                marginLeft: `${(node.depth - 1) * 24 + 12}px`,
              }}
            />
          )}

          {/* Horizontal line to this node */}
          <div
            className="absolute top-5 left-0 h-px bg-border"
            style={{
              marginLeft: `${(node.depth - 1) * 24 + 12}px`,
              width: "12px",
            }}
          />
        </>
      )}

      {/* Branch node button with preview popover */}
      <Popover open={showPopover} onOpenChange={setShowPopover}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            onClick={() => onSelect(node.branch.id)}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={cn(
              "justify-start gap-2 h-auto py-2 px-3 mb-1 transition-all duration-200",
              "hover:bg-accent hover:shadow-sm",
              node.isActive &&
                "bg-primary/10 border border-primary hover:bg-primary/15",
              !node.isActive && "border border-transparent"
            )}
            style={{
              marginLeft: `${node.depth * 24}px`,
              width: `calc(100% - ${node.depth * 24}px)`,
            }}
          >
            {/* Branch icon */}
            <GitBranch
              className={cn(
                "h-4 w-4 flex-shrink-0",
                node.isActive ? "text-primary" : "text-muted-foreground"
              )}
            />

            {/* Branch name */}
            <span
              className={cn(
                "text-sm truncate flex-1 text-left",
                node.isActive ? "font-medium" : "font-normal"
              )}
            >
              {truncatedName}
            </span>

            {/* Active indicator */}
            {node.isActive && (
              <Check className="h-4 w-4 text-primary flex-shrink-0" />
            )}
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
              <span className="font-semibold text-sm">{displayName}</span>
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
                              ? "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800"
                              : "bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800"
                          }`}
                        >
                          <span className="mr-1">
                            {getAuthorIcon(item.block.kind)}
                          </span>
                          {isUser ? "You" : "Assistant"}
                        </Badge>
                      </div>
                      <p className="text-sm text-foreground/90 leading-relaxed">
                        {truncateText(getBlockText(item.block.content))}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4">
                No messages in this branch yet
              </p>
            )}

            {/* Footer with switch button */}
            <div className="mt-4 pt-3 border-t">
              <Button
                onClick={() => {
                  onSelect(node.branch.id);
                  setIsHovered(false);
                }}
                className="w-full"
                size="sm"
              >
                Switch to this branch
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Render children recursively */}
      {hasChildren && (
        <div className="relative">
          {/* Vertical line through children */}
          {!isLast && node.depth > 0 && (
            <div
              className="absolute left-0 top-0 bottom-0 w-px bg-border"
              style={{
                marginLeft: `${node.depth * 24 + 12}px`,
              }}
            />
          )}

          {node.children.map((child, idx) => (
            <BranchTreeNode
              key={child.branch.id}
              node={child}
              onSelect={onSelect}
              isLast={idx === node.children.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
