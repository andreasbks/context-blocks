"use client";

import { useQuery } from "@tanstack/react-query";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface QuotaStatus {
  used: number;
  limit: number;
  remaining: number;
  resetDate: string;
}

async function fetchQuotaStatus(): Promise<QuotaStatus> {
  const res = await fetch("/api/v1/quota");
  if (!res.ok) throw new Error("Failed to fetch quota status");
  return res.json();
}

export function QuotaIndicator() {
  const { data: quota } = useQuery({
    queryKey: ["quota"],
    queryFn: fetchQuotaStatus,
    staleTime: 60000, // Consider data fresh for 1 minute
  });

  if (!quota) return null;

  const percentage = (quota.used / quota.limit) * 100;
  const resetDate = new Date(quota.resetDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  // Determine color based on usage - white/red scheme
  let barColorClass = "bg-foreground";
  let textColorClass = "text-foreground";
  if (percentage >= 90) {
    barColorClass = "bg-red-500 dark:bg-red-400";
    textColorClass = "text-red-500 dark:text-red-400";
  } else if (percentage >= 70) {
    barColorClass = "bg-orange-500 dark:bg-orange-400";
    textColorClass = "text-orange-500 dark:text-orange-400";
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-accent/50 hover:bg-accent hover:shadow-sm hover:border-primary/30 border border-transparent hover:scale-[1.02] transition-all duration-200 cursor-pointer">
            <div className="w-24 h-2 bg-muted/50 dark:bg-muted/30 rounded-full overflow-hidden">
              <div
                className={`h-full ${barColorClass} transition-all duration-300`}
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>
            <span className={`text-xs font-medium ${textColorClass}`}>
              {percentage.toFixed(0)}%
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <div className="font-semibold">Token Quota</div>
            <div className="text-xs opacity-90">
              {quota.used.toLocaleString()} / {quota.limit.toLocaleString()}{" "}
              tokens used
            </div>
            <div className="text-xs opacity-90">Resets on {resetDate}</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
