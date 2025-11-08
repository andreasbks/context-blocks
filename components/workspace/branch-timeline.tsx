"use client";

import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { GraphDetailResponse } from "@/lib/api/schemas/responses";

type Branch = z.infer<typeof GraphDetailResponse>["branches"][number];

export interface Checkpoint {
  nodeId: string;
  messageExcerpt: string;
  branches: Branch[];
  isCurrentBranch: boolean;
}

interface BranchTimelineProps {
  checkpoints: Checkpoint[];
  currentBranchId: string | null;
  onSelectBranch: (branchId: string) => void;
}

export function BranchTimeline({
  checkpoints,
  currentBranchId,
  onSelectBranch,
}: BranchTimelineProps) {
  if (checkpoints.length === 0) {
    return null;
  }

  return (
    <Card className="hidden xl:flex fixed right-4 top-20 bottom-4 w-80 z-10 animate-in slide-in-from-right duration-300 flex-col">
      <CardHeader className="bg-gradient-to-r from-accent/30 to-accent/10 space-y-0">
        <div className="flex items-center gap-2">
          <span className="text-2xl animate-pulse">🌿</span>
          <div className="flex flex-col space-y-1">
            <CardTitle className="text-sm">Branch Checkpoints</CardTitle>
            <CardDescription className="text-xs">
              {checkpoints.length}{" "}
              {checkpoints.length === 1 ? "point" : "points"} along this path
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <Separator />

      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-3">
            {checkpoints.map((checkpoint, index) => (
              <div
                key={checkpoint.nodeId}
                className="relative animate-in fade-in slide-in-from-right duration-300"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Connector Line */}
                {index < checkpoints.length - 1 && (
                  <div className="absolute left-5 top-full w-0.5 h-3 bg-gradient-to-b from-border via-border/50 to-transparent" />
                )}

                {/* Checkpoint Card */}
                <Card
                  className={`
                    relative transition-all duration-200
                    ${
                      checkpoint.isCurrentBranch
                        ? "border-primary bg-primary/5 shadow-md scale-105"
                        : "border-border/50 bg-card/50 hover:border-border hover:shadow-md hover:scale-[1.02]"
                    }
                  `}
                >
                  {/* Checkpoint Indicator */}
                  <div
                    className={`
                    absolute -left-2 top-4 w-4 h-4 rounded-full border-2 border-background shadow-sm transition-all duration-200
                    ${checkpoint.isCurrentBranch ? "bg-primary ring-2 ring-primary/20 scale-110" : "bg-border"}
                  `}
                  />

                  {/* Card Content */}
                  <CardContent className="pl-6 pr-4 py-3">
                    {/* Message Excerpt */}
                    <div className="mb-2">
                      <p className="text-xs text-muted-foreground line-clamp-2 italic leading-relaxed">
                        &ldquo;{checkpoint.messageExcerpt}&rdquo;
                      </p>
                    </div>

                    {/* Branches */}
                    <div className="space-y-1.5">
                      {checkpoint.branches.map((branch) => {
                        const isCurrent = branch.id === currentBranchId;
                        return (
                          <button
                            key={branch.id}
                            onClick={() => onSelectBranch(branch.id)}
                            disabled={isCurrent}
                            className={`
                              w-full flex items-center justify-between px-3 py-2 rounded-md
                              text-left transition-all duration-200 group/branch
                              ${
                                isCurrent
                                  ? "bg-primary text-primary-foreground font-semibold cursor-default shadow-sm"
                                  : "bg-accent/50 hover:bg-accent hover:shadow-sm hover:border-primary/30 border border-transparent hover:scale-[1.02]"
                              }
                            `}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className="text-xs">🌿</span>
                              <span className="text-xs font-medium truncate">
                                {branch.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 h-4"
                              >
                                v{branch.version}
                              </Badge>
                              {isCurrent && <span className="text-xs">✓</span>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>

      <Separator />

      {/* Footer Hint */}
      <div className="px-4 py-3 bg-gradient-to-r from-accent/20 to-accent/10">
        <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
          💡 Hover over messages to create new branches
        </p>
      </div>
    </Card>
  );
}
