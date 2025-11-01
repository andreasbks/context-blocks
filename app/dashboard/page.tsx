import { currentUser } from "@clerk/nextjs/server";

import { ensureCurrentUserExists } from "@/lib/users/ensure-user";

import DashboardClient from "./client";

export default async function DashboardPage() {
  const user = await currentUser();
  if (user) {
    await ensureCurrentUserExists();
  }

  return (
    <div className="flex-1 w-full">
      <DashboardClient />
    </div>
  );
}
