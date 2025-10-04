"use client";

import { z } from "zod";

import { Label } from "@/components/ui/label";
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
  const isUser = item.block.kind === "user";

  // Find sibling branches that fork from this node
  const siblingBranches = branches.filter(
    (b) => b.rootNodeId === item.nodeId && b.id !== currentBranchId
  );

  return (
    <div
      className={`
        rounded-xl p-5 transition-all duration-200
        ${
          isUser
            ? "bg-primary/5 border-l-4 border-primary ml-8"
            : "bg-accent/30 border-l-4 border-accent mr-8"
        }
      `}
    >
      {/* Message Header */}
      <div className="flex items-center gap-2 mb-3">
        <div
          className={`
          w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
          ${
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-accent text-accent-foreground"
          }
        `}
        >
          {isUser ? "U" : "A"}
        </div>
        <Label className="text-sm font-semibold">
          {isUser ? "You" : "Assistant"}
        </Label>
      </div>

      {/* Message Content */}
      <div className="whitespace-pre-wrap leading-relaxed text-foreground pl-10">
        {getBlockText(item.block)}
      </div>

      {/* Sibling Branches - Fork Points */}
      {siblingBranches.length > 0 && (
        <div className="mt-4 pl-10 space-y-2">
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
        <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-border/30 pl-10">
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
