/**
 * Skeleton loader for the sidebar session list
 */
export function GraphListSkeleton() {
  return (
    <div className="space-y-1.5 pr-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="w-full px-4 py-3 rounded-lg bg-accent/50 animate-pulse"
        >
          <div className="h-5 bg-muted-foreground/20 rounded w-3/4 mb-2" />
          <div className="h-3 bg-muted-foreground/10 rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton loader for individual timeline message blocks
 */
export function TimelineMessageSkeleton() {
  return (
    <div className="rounded-xl border bg-card shadow-sm animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b border-border/50">
        <div className="h-6 bg-muted-foreground/20 rounded w-32" />
        <div className="h-4 bg-muted-foreground/10 rounded w-24" />
      </div>
      {/* Content */}
      <div className="px-5 py-4 space-y-3">
        <div className="h-4 bg-muted-foreground/15 rounded w-full" />
        <div className="h-4 bg-muted-foreground/15 rounded w-5/6" />
        <div className="h-4 bg-muted-foreground/15 rounded w-4/6" />
      </div>
    </div>
  );
}

/**
 * Skeleton loader for the entire chat timeline
 */
export function ChatAreaSkeleton() {
  return (
    <div className="flex flex-col h-full">
      {/* Header Skeleton */}
      <div className="flex-shrink-0 bg-card/50">
        <div className="flex items-center justify-between px-3 py-3 max-w-4xl mx-auto">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-5 bg-muted-foreground/20 rounded w-48 animate-pulse" />
            <span className="text-sm text-muted-foreground">•</span>
            <div className="h-6 bg-muted-foreground/20 rounded w-24 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Timeline Skeleton */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-4">
          <div className="space-y-4">
            <TimelineMessageSkeleton />
            <TimelineMessageSkeleton />
            <TimelineMessageSkeleton />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton loader for loading session details
 */
export function SessionLoadingSkeleton() {
  return (
    <div className="flex flex-col h-full">
      {/* Header Skeleton */}
      <div className="flex-shrink-0 bg-card/50">
        <div className="flex items-center justify-between px-3 py-3 max-w-4xl mx-auto">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-5 bg-muted-foreground/20 rounded w-48 animate-pulse" />
            <span className="text-sm text-muted-foreground">•</span>
            <div className="h-6 bg-muted-foreground/20 rounded w-24 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Timeline Skeleton */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-4">
          <div className="space-y-4">
            <TimelineMessageSkeleton />
            <TimelineMessageSkeleton />
            <TimelineMessageSkeleton />
          </div>
        </div>
      </div>
    </div>
  );
}
