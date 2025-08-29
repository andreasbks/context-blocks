import { auth } from "@clerk/nextjs/server";

import { Errors } from "@/lib/api/errors";
import { prisma } from "@/lib/db";
import { ensureCurrentUserExists } from "@/lib/users/ensure-user";

export async function requireOwner(): Promise<
  { owner: { id: string }; clerkUserId: string } | Response
> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return Errors.forbidden();

  await ensureCurrentUserExists();
  const user = await prisma.user.findUnique({ where: { clerkUserId } });
  if (!user) return Errors.forbidden();

  return { owner: { id: user.id }, clerkUserId };
}
