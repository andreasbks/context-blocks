"use client";

import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { GraphDetailResponse } from "@/lib/api/schemas/responses";

type Branch = z.infer<typeof GraphDetailResponse>["branches"][number];

interface BranchPointProps {
  alternateBranches: Branch[];
  onSelectBranch: (branchId: string) => void;
  previewText?: Record<string, string>; // Map of branchId -> preview text
}

export function BranchPoint({
  alternateBranches,
  onSelectBranch,
  previewText = {},
}: BranchPointProps) {
  // Only show if there are alternate branches to switch to
  if (alternateBranches.length === 0) return null;

  return (
    <div className="relative py-3">
      {/* Optional: Subtle vertical connector line */}
      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border/30 -translate-x-1/2" />

      {/* Branch Pills - Horizontal Layout */}
      <div className="relative z-10 flex items-center justify-center gap-2 flex-wrap">
        <TooltipProvider>
          {alternateBranches.map((branch) => {
            const preview = previewText[branch.id];

            return (
              <Tooltip key={branch.id} delayDuration={300}>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSelectBranch(branch.id)}
                    className="transition-all duration-200 hover:bg-accent"
                  >
                    {branch.name}
                  </Button>
                </TooltipTrigger>
                {preview && (
                  <TooltipContent
                    side="bottom"
                    className="max-w-xs text-sm"
                    sideOffset={8}
                  >
                    <p className="line-clamp-3">{preview}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })}
        </TooltipProvider>
      </div>
    </div>
  );
}
