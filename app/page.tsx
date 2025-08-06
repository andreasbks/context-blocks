import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthButton } from "@/components/auth/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  // If user is authenticated, redirect to dashboard
  if (!error && data?.claims) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen flex flex-col items-center">
      <div className="flex-1 w-full flex flex-col items-center">
        <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
          <div className="w-full max-w-5xl flex justify-between items-center p-3 px-5 text-sm">
            <div className="flex gap-5 items-center font-semibold">
              <Link href={"/"}>Context Blocks Chat</Link>
            </div>
            <div className="flex items-center gap-3">
              <ThemeSwitcher />
              <AuthButton />
            </div>
          </div>
        </nav>
        <div className="flex-1 flex flex-col justify-center items-center max-w-4xl p-5">
          <div className="text-center space-y-6">
            <h1 className="text-4xl lg:text-6xl font-bold tracking-tight">
              Context Blocks Chat
            </h1>
            <p className="text-xl lg:text-2xl text-muted-foreground max-w-2xl">
              Modular, branchable AI conversations. Branch, remix, and merge
              context blocks to explore ideas in parallel.
            </p>
            <div className="pt-8">
              <Link
                href="/auth/sign-up"
                className="inline-flex items-center justify-center rounded-md bg-primary px-8 py-3 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
