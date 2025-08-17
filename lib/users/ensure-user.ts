import { currentUser } from "@clerk/nextjs/server";

import { prisma } from "@/lib/db";

export async function ensureCurrentUserExists() {
  const user = await currentUser();
  if (!user) return false;

  const email =
    user.primaryEmailAddress?.emailAddress ||
    user.emailAddresses?.[0]?.emailAddress ||
    "";

  await prisma.user.upsert({
    where: { clerkUserId: user.id },
    update: { email },
    create: {
      clerkUserId: user.id,
      email,
    },
  });

  return true;
}
