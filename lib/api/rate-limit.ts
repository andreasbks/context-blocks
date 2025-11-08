import { Errors } from "@/lib/api/errors";

type TimestampMs = number;

type GlobalRateMaps = {
  writeBuckets: Map<string, TimestampMs[]>; // key = `${userId}:${route}`
  readBuckets: Map<string, TimestampMs[]>; // key = `${userId}:${route}`
  sseCounts: Map<string, number>; // key = userId
};

const globalMaps = globalThis as unknown as { __rateMaps?: GlobalRateMaps };
if (!globalMaps.__rateMaps) {
  globalMaps.__rateMaps = {
    writeBuckets: new Map(),
    readBuckets: new Map(),
    sseCounts: new Map(),
  };
}

const maps = globalMaps.__rateMaps!;

export function checkWriteRateLimit(
  userId: string,
  routeKey: string,
  maxPerMinute = 60
): Response | null {
  const key = `${userId}:${routeKey}`;
  const now = Date.now();
  const windowMs = 60_000;
  const list = maps.writeBuckets.get(key) ?? [];
  // prune
  const pruned = list.filter((t) => now - t < windowMs);
  if (pruned.length >= maxPerMinute) {
    const oldest = pruned[0];
    const retryAfter = Math.max(
      1,
      Math.ceil((windowMs - (now - oldest)) / 1000)
    );
    maps.writeBuckets.set(key, pruned);
    return Errors.rateLimited(retryAfter);
  }
  pruned.push(now);
  maps.writeBuckets.set(key, pruned);
  return null;
}

export function checkReadRateLimit(
  userId: string,
  routeKey: string,
  maxPerMinute = 300
): Response | null {
  // Defensive initialization for hot-reload scenarios
  if (!maps.readBuckets) {
    maps.readBuckets = new Map();
  }

  const key = `${userId}:${routeKey}`;
  const now = Date.now();
  const windowMs = 60_000;
  const list = maps.readBuckets.get(key) ?? [];
  // prune
  const pruned = list.filter((t) => now - t < windowMs);
  if (pruned.length >= maxPerMinute) {
    const oldest = pruned[0];
    const retryAfter = Math.max(
      1,
      Math.ceil((windowMs - (now - oldest)) / 1000)
    );
    maps.readBuckets.set(key, pruned);
    return Errors.rateLimited(retryAfter);
  }
  pruned.push(now);
  maps.readBuckets.set(key, pruned);
  return null;
}

export function acquireSSESlot(
  userId: string,
  _routeKey: string,
  maxConcurrent = 8
): { release: () => void; current: number } | Response {
  const current = maps.sseCounts.get(userId) ?? 0;
  if (current >= maxConcurrent) {
    return Errors.rateLimited(15); // suggest short retry for SSE
  }
  maps.sseCounts.set(userId, current + 1);
  let released = false;
  return {
    release: () => {
      if (released) return;
      released = true;
      const cur = maps.sseCounts.get(userId) ?? 1;
      maps.sseCounts.set(userId, Math.max(0, cur - 1));
    },
    current: current + 1,
  };
}
