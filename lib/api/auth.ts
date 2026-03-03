import { auth } from "@clerk/nextjs/server";

import { Errors } from "@/lib/api/errors";
import { prisma } from "@/lib/db";
import { getDemoUserFromCookie } from "@/lib/demo/session";
import { ensureCurrentUserExists } from "@/lib/users/ensure-user";

export async function requireOwner(): Promise<
  { owner: { id: string }; clerkUserId: string } | Response
> {
  // 1. Try Clerk auth (normal signed-in users)
  const { userId: clerkUserId } = await auth();
  if (clerkUserId) {
    await ensureCurrentUserExists();
    const user = await prisma.user.findUnique({ where: { clerkUserId } });
    if (!user) return Errors.forbidden();
    return { owner: { id: user.id }, clerkUserId };
  }

  // 2. Fall back to demo session cookie
  const demoUser = await getDemoUserFromCookie();
  if (demoUser) {
    return { owner: { id: demoUser.id }, clerkUserId: demoUser.clerkUserId };
  }

  return Errors.forbidden();
}
