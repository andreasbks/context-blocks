import type { Metadata } from "next";
import { Geist } from "next/font/google";

import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "next-themes";

import { QueryProvider } from "@/lib/providers/query-provider";

import Navbar from "../components/ui/navbar";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Context Blocks Chat",
  description:
    "Modular, branchable AI chat platform. Branch, remix, and merge conversations to explore ideas in parallel.",
  openGraph: {
    title: "Context Blocks Chat",
    description:
      "Modular, branchable AI chat platform. Branch, remix, and merge conversations to explore ideas in parallel.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Context Blocks Chat",
    description:
      "Modular, branchable AI chat platform. Branch, remix, and merge conversations to explore ideas in parallel.",
  },
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.className} antialiased`}>
        <ClerkProvider
          publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
        >
          <QueryProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <div className="min-h-screen flex flex-col">
                <Navbar />
                <main className="flex-1 w-full pt-16">{children}</main>
              </div>
            </ThemeProvider>
          </QueryProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
