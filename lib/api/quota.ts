import { prisma } from "@/lib/db";

const QUOTA_LIMIT = 1000; // 10,000 output tokens per 30 days
const QUOTA_WINDOW_DAYS = 30;

export interface QuotaStatus {
  used: number;
  limit: number;
  remaining: number;
  resetDate: string; // ISO date string when the oldest usage will expire
}

/**
 * Check the current quota status for a user
 * Calculates usage over a rolling 30-day window
 */
export async function checkQuota(userId: string): Promise<QuotaStatus> {
  // Calculate the date 30 days ago
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - QUOTA_WINDOW_DAYS);

  // Get the sum of tokens used in the last 30 days
  const result = await prisma.$queryRaw<
    Array<{ total: bigint | null }>
  >`SELECT COALESCE(SUM(tokens), 0)::bigint AS total
    FROM "TokenUsage"
    WHERE "userId" = ${userId}
      AND "createdAt" >= ${thirtyDaysAgo}`;

  const used = Number(result[0]?.total ?? 0);
  const remaining = Math.max(0, QUOTA_LIMIT - used);

  // Get the oldest usage record to determine when quota will reset
  const oldestUsage = await prisma.tokenUsage.findFirst({
    where: {
      userId,
      createdAt: {
        gte: thirtyDaysAgo,
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  // Reset date is 30 days after the oldest usage, or 30 days from now if no usage
  const resetDate = oldestUsage
    ? new Date(
        oldestUsage.createdAt.getTime() +
          QUOTA_WINDOW_DAYS * 24 * 60 * 60 * 1000
      )
    : new Date(Date.now() + QUOTA_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  return {
    used,
    limit: QUOTA_LIMIT,
    remaining,
    resetDate: resetDate.toISOString(),
  };
}

/**
 * Record token usage for a user
 * Should be called after a successful OpenAI API response
 */
export async function recordTokenUsage(
  userId: string,
  tokens: number
): Promise<void> {
  if (tokens <= 0) return; // Don't record zero or negative usage

  await prisma.tokenUsage.create({
    data: {
      userId,
      tokens,
    },
  });
}
