import { AuthButton } from "@/components/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import Link from "next/link";

export default function ChatLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen flex flex-col">
            <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
                <div className="w-full max-w-7xl flex justify-between items-center p-3 px-5 text-sm">
                    <div className="flex gap-5 items-center font-semibold">
                        <Link href="/chat">Context Blocks Chat</Link>
                    </div>
                    <div className="flex items-center gap-3">
                        <ThemeSwitcher />
                        <AuthButton />
                    </div>
                </div>
            </nav>
            {children}
        </div>
    );
}
