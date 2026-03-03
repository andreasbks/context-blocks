#!/usr/bin/env tsx
/**
 * Demo User Cleanup Script
 *
 * Deletes demo users older than 24 hours and their associated data.
 * Cascade deletes handle graphs, nodes, blocks, edges, and branches.
 *
 * Run with: pnpm tsx scripts/cleanup-demo-users.ts
 *
 * For production, schedule this as a cron job (e.g., every hour).
 */
import { PrismaClient } from "../lib/generated/prisma";

const prisma = new PrismaClient({ log: ["error", "warn"] });

const DEMO_TTL_HOURS = 24;

async function main() {
  const cutoff = new Date(Date.now() - DEMO_TTL_HOURS * 60 * 60 * 1000);

  console.log(
    `[cleanup] Finding demo users created before ${cutoff.toISOString()}...`
  );

  const expiredUsers = await prisma.user.findMany({
    where: {
      clerkUserId: { startsWith: "demo_" },
      createdAt: { lt: cutoff },
    },
    select: { id: true, clerkUserId: true, createdAt: true },
  });

  if (expiredUsers.length === 0) {
    console.log("[cleanup] No expired demo users found.");
    return;
  }

  console.log(`[cleanup] Found ${expiredUsers.length} expired demo user(s).`);

  const userIds = expiredUsers.map((u) => u.id);

  // Clean up TokenUsage and IdempotencyRequest (no cascade from User)
  const [tokenResult, idempotencyResult] = await Promise.all([
    prisma.tokenUsage.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.idempotencyRequest.deleteMany({
      where: { userId: { in: userIds } },
    }),
  ]);

  console.log(
    `[cleanup] Deleted ${tokenResult.count} token usage records, ${idempotencyResult.count} idempotency records.`
  );

  // Delete the users (cascades to graphs, nodes, blocks, edges, branches)
  const deleteResult = await prisma.user.deleteMany({
    where: { id: { in: userIds } },
  });

  console.log(
    `[cleanup] Deleted ${deleteResult.count} demo user(s) and all associated data.`
  );
}

main()
  .catch((err) => {
    console.error("[cleanup] Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
