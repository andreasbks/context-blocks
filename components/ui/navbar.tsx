import Link from "next/link";

import { AuthButton } from "../auth/auth-button";
import { ThemeSwitcher } from "../theme-switcher";

export default function Navbar() {
  return (
    <nav className="w-full flex justify-center border-b border-border/50 bg-background/95 backdrop-blur-sm h-16 fixed top-0 z-40">
      <div className="w-full max-w-7xl flex justify-between items-center px-6 text-sm">
        <div className="flex gap-5 items-center">
          <Link
            href={"/"}
            className="text-lg font-bold tracking-tight hover:text-primary transition-colors"
          >
            💭 Context Blocks
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <ThemeSwitcher />
          <AuthButton />
        </div>
      </div>
    </nav>
  );
}
