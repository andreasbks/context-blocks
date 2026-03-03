import { cookies } from "next/headers";

import { randomUUID } from "crypto";

import { prisma } from "@/lib/db";

export const DEMO_SESSION_COOKIE = "demo-session";
export const DEMO_MAX_AGE_SECONDS = 86_400; // 24 hours

export function isDemoUser(clerkUserId: string): boolean {
  return clerkUserId.startsWith("demo_");
}

export async function createDemoUser() {
  const uuid = randomUUID();
  const clerkUserId = `demo_${uuid}`;
  const email = `demo_${uuid}@demo.local`;

  const user = await prisma.user.create({
    data: {
      clerkUserId,
      email,
      firstName: "Demo",
      lastName: "User",
    },
  });

  return user;
}

/**
 * Read the demo-session cookie and return the demo user if valid.
 * Returns null if the cookie is missing, the user doesn't exist, or
 * the user is not a demo user.
 */
export async function getDemoUserFromCookie(): Promise<{
  id: string;
  clerkUserId: string;
} | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(DEMO_SESSION_COOKIE);
  if (!sessionCookie?.value) return null;

  const user = await prisma.user.findUnique({
    where: { id: sessionCookie.value },
    select: { id: true, clerkUserId: true, createdAt: true },
  });

  if (!user || !isDemoUser(user.clerkUserId)) return null;

  // Check if the demo session has expired (24h TTL)
  const ageMs = Date.now() - user.createdAt.getTime();
  if (ageMs > DEMO_MAX_AGE_SECONDS * 1000) return null;

  return { id: user.id, clerkUserId: user.clerkUserId };
}
