import Link from "next/link";

import { auth } from "@clerk/nextjs/server";

import { ensureCurrentUserExists } from "@/lib/users/ensure-user";

export default async function Home() {
  const { isAuthenticated } = await auth();
  if (isAuthenticated) {
    await ensureCurrentUserExists();
  }

  return (
    <div className="flex-1 flex flex-col justify-center items-center max-w-4xl p-5">
      <div className="text-center space-y-6">
        <h1 className="text-4xl lg:text-6xl font-bold tracking-tight">
          Context Blocks Chat
        </h1>
        <p className="text-xl lg:text-2xl text-muted-foreground max-w-2xl">
          Modular, branchable AI conversations. Branch, remix, and merge context
          blocks to explore ideas in parallel.
        </p>
        <div className="pt-8">
          <Link
            href={isAuthenticated ? "/dashboard" : "/auth/sign-up"}
            className="inline-flex items-center justify-center rounded-md bg-primary px-8 py-3 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            Get Started
          </Link>
        </div>
      </div>
    </div>
  );
}
