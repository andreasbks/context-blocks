"use client";

import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import {
  GraphDetailResponse,
  LinearResponse,
} from "@/lib/api/schemas/responses";
import { ContextBlockSchema } from "@/lib/api/schemas/shared";

type TimelineItem = z.infer<typeof LinearResponse>["items"][number];
type Branch = z.infer<typeof GraphDetailResponse>["branches"][number];
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
  branches: Branch[];
  currentBranchId: string | null;
  onSelectBranch: (branchId: string) => void;
}

export function MessageItem({
  item,
  branches,
  currentBranchId,
  onSelectBranch,
}: MessageItemProps) {
  const blockType = item.block.kind;
  const config = blockTypeConfig[blockType];

  // Find sibling branches that fork from this node
  const siblingBranches = branches.filter(
    (b) => b.rootNodeId === item.nodeId && b.id !== currentBranchId
  );

  return (
    <div
      className={`
        rounded-xl border-2 transition-all duration-200
        bg-card hover:shadow-md
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

        <div className="text-xs text-muted-foreground">
          {item.block.createdAt
            ? new Date(item.block.createdAt).toLocaleString()
            : "Just now"}
        </div>
      </div>

      {/* Block Content */}
      <div className="px-5 py-4 whitespace-pre-wrap leading-relaxed text-foreground">
        {getBlockText(item.block)}
      </div>

      {/* Sibling Branches - Fork Points */}
      {siblingBranches.length > 0 && (
        <div className="px-5 pb-4 space-y-2 border-t border-border/50 pt-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-2">
            <span className="text-base">🌿</span>
            <span>Alternate branches from this point:</span>
          </div>
          {siblingBranches.map((b) => (
            <button
              key={b.id}
              onClick={() => onSelectBranch(b.id)}
              className="w-full text-left px-4 py-3 rounded-lg border-2 border-dashed border-border/50 hover:border-primary hover:bg-primary/5 transition-all duration-200 group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">🌿</span>
                  <span className="text-sm font-semibold group-hover:text-primary transition-colors">
                    {b.name}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors">
                  Switch →
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-1 pl-6">
                Explore alternate timeline
              </div>
            </button>
          ))}
        </div>
      )}

      {/* References */}
      {item.references && item.references.length > 0 && (
        <div className="flex flex-wrap gap-2 px-5 pb-4 pt-3 border-t border-border/50">
          <span className="text-xs font-medium text-muted-foreground">
            📎 References:
          </span>
          {item.references.map((ref) => (
            <span
              key={ref.nodeId}
              className="inline-flex items-center rounded-full bg-accent/50 border border-border px-3 py-1 text-xs font-medium text-foreground hover:bg-accent hover:border-primary transition-all duration-200 cursor-help"
              title={getBlockText(ref.block)}
            >
              {ref.block.kind === "user" ? "📄" : "🤖"} ref
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
