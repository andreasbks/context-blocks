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

  // Determine color based on usage
  let colorClass = "bg-green-500";
  let textColorClass = "text-green-600";
  if (percentage >= 90) {
    colorClass = "bg-red-500";
    textColorClass = "text-red-600";
  } else if (percentage >= 70) {
    colorClass = "bg-yellow-500";
    textColorClass = "text-yellow-600";
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 cursor-pointer">
            <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full ${colorClass} transition-all duration-300`}
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
