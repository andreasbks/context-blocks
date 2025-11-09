"use client";

import { GitBranch } from "lucide-react";
import { z } from "zod";

import { MarkdownContent } from "@/components/markdown-content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LinearResponse } from "@/lib/api/schemas/responses";
import { ContextBlockSchema } from "@/lib/api/schemas/shared";

type TimelineItem = z.infer<typeof LinearResponse>["items"][number];
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

// Block type configuration - easily extensible for future types
const blockTypeConfig = {
  user: {
    label: "User Input",
    color: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
    borderColor: "border-blue-500/30",
    icon: "👤",
  },
  assistant: {
    label: "Assistant Response",
    color:
      "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20",
    borderColor: "border-purple-500/30",
    icon: "🤖",
  },
} as const;

interface MessageItemProps {
  item: TimelineItem;
  onStartBranch?: (nodeId: string, messageText: string) => void;
  showBranchButton?: boolean;
  branchPointContent?: React.ReactNode;
}

export function MessageItem({
  item,
  onStartBranch,
  showBranchButton = false,
  branchPointContent,
}: MessageItemProps) {
  const blockType = item.block.kind;
  const config = blockTypeConfig[blockType];

  return (
    <div
      className={`
        group/message rounded-xl border-2 transition-all duration-200
        bg-card hover:shadow-md relative
        ${config.borderColor}
      `}
    >
      {/* Block Header - Type & Metadata */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b border-border/50">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={`font-semibold ${config.color}`}>
            <span className="mr-1.5">{config.icon}</span>
            {config.label}
          </Badge>

          {item.block.model && (
            <Badge variant="secondary" className="text-xs">
              {item.block.model}
            </Badge>
          )}

          {item.block.public && (
            <Badge variant="secondary" className="text-xs">
              📚 Public
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Start Branch Button - Appears on hover with amber accent */}
          {showBranchButton && onStartBranch && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const messageText = getBlockText(item.block);
                onStartBranch(item.nodeId, messageText);
              }}
              className="opacity-60 group-hover/message:opacity-100 transition-all duration-300 ease-out h-7 px-2 text-xs border border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-700 dark:hover:text-amber-400 hover:border-amber-500/50 hover:scale-110 active:scale-95 hover:shadow-md"
            >
              <GitBranch className="mr-1.5 h-3.5 w-3.5 transition-transform group-hover/message:rotate-12" />
              <span className="font-medium">Branch from here</span>
            </Button>
          )}
          <div className="text-xs text-muted-foreground">
            {item.block.createdAt
              ? new Date(item.block.createdAt).toLocaleString()
              : "Just now"}
          </div>
        </div>
      </div>

      {/* Block Content */}
      <div className="px-5 py-4">
        <MarkdownContent content={getBlockText(item.block)} />
      </div>

      {/* References */}
      {item.references && item.references.length > 0 && (
        <div className="flex flex-wrap gap-2 px-5 pb-4 pt-3 border-t border-border/50">
          <span className="text-xs font-medium text-muted-foreground">
            📎 References:
          </span>
          {item.references.map((ref, idx) => (
            <span
              key={ref.nodeId}
              className="inline-flex items-center rounded-full bg-accent/50 border border-border px-3 py-1 text-xs font-medium text-foreground hover:bg-accent hover:border-primary hover:scale-105 transition-all duration-200 cursor-help animate-in fade-in zoom-in-95"
              style={{ animationDelay: `${idx * 50}ms` }}
              title={getBlockText(ref.block)}
            >
              {ref.block.kind === "user" ? "📄" : "🤖"} ref
            </span>
          ))}
        </div>
      )}

      {/* Branch Point - Below message */}
      {branchPointContent && (
        <div className="px-5 pb-4">{branchPointContent}</div>
      )}
    </div>
  );
}
