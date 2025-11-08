"use client";

import Link from "next/link";

import { useAuth } from "@clerk/nextjs";

import { AuthButton } from "../auth/auth-button";
import { ThemeSwitcher } from "../theme-switcher";
import { QuotaIndicator } from "../workspace/quota-indicator";

export default function Navbar() {
  const { isSignedIn } = useAuth();

  return (
    <nav className="w-full border-b border-border/50 bg-background/95 backdrop-blur-sm h-16 fixed top-0 z-40">
      <div className="w-full h-full flex justify-between items-center px-6 text-sm">
        <div className="flex gap-5 items-center">
          <Link
            href={"/"}
            className="text-lg font-bold tracking-tight hover:text-primary transition-colors"
          >
            💭 Context Blocks
          </Link>
        </div>
        <div className="flex items-center gap-4">
          {isSignedIn && <QuotaIndicator />}
          <ThemeSwitcher />
          <AuthButton />
        </div>
      </div>
    </nav>
  );
}
