"use client";

import { z } from "zod";

import { GraphDetailResponse } from "@/lib/api/schemas/responses";

type Branch = z.infer<typeof GraphDetailResponse>["branches"][number];

interface BranchPointProps {
  alternateBranches: Branch[];
  onSelectBranch: (branchId: string) => void;
}

export function BranchPoint({
  alternateBranches,
  onSelectBranch,
}: BranchPointProps) {
  if (alternateBranches.length === 0) return null;

  return (
    <div className="relative py-4">
      {/* Vertical connector line */}
      <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-border via-border/50 to-border -translate-x-1/2" />

      {/* Branch point indicator */}
      <div className="relative z-10 flex flex-col items-center gap-3">
        {/* Fork icon/indicator */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-background border-2 border-border shadow-sm">
          <span className="text-lg">🌿</span>
          <span className="text-sm font-semibold text-muted-foreground">
            {alternateBranches.length === 1
              ? "1 alternate branch"
              : `${alternateBranches.length} alternate branches`}
          </span>
        </div>

        {/* Branch options */}
        <div className="flex flex-col gap-2 w-full max-w-md">
          {alternateBranches.map((branch, index) => (
            <button
              key={branch.id}
              onClick={() => onSelectBranch(branch.id)}
              className="group relative flex items-center justify-between px-4 py-3 rounded-lg bg-background/80 backdrop-blur-sm border-2 border-dashed border-border/60 hover:border-primary hover:bg-primary/5 transition-all duration-200 shadow-sm hover:shadow-md"
            >
              {/* Branch indicator line */}
              <div className="absolute left-0 top-1/2 -translate-x-full w-8 h-0.5 bg-gradient-to-r from-transparent to-border group-hover:to-primary transition-colors" />

              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-accent text-xs font-bold">
                  {index + 1}
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-sm font-semibold group-hover:text-primary transition-colors">
                    {branch.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Version {branch.version}
                  </span>
                </div>
              </div>

              <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors">
                Switch →
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
