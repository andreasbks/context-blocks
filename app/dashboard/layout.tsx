import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthButton } from "@/components/auth/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side auth check
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/auth/login");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
        <div className="w-full max-w-7xl flex justify-between items-center p-3 px-5 text-sm">
          <div className="flex gap-5 items-center font-semibold">
            <Link href="/dashboard">Context Blocks Chat</Link>
          </div>
          <div className="flex items-center gap-3">
            <ThemeSwitcher />
            <AuthButton />
          </div>
        </div>
      </nav>
      <main className="flex-1">{children}</main>
    </div>
  );
}
