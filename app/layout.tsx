import type { Metadata } from "next";
import { Geist } from "next/font/google";

import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "next-themes";

import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "@/lib/providers/query-provider";

import Navbar from "../components/ui/navbar";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Context Blocks | Think in Branches, Not Lines",
  description:
    "Rethinking AI chat from the ground up. Context Blocks is modular and nonlinear—branch anywhere, explore what-ifs, and never lose context again. Think Git for conversations, Lego for ideas.",
  openGraph: {
    title: "Context Blocks | Think in Branches, Not Lines",
    description:
      "Rethinking AI chat from the ground up. Context Blocks is modular and nonlinear—branch anywhere, explore what-ifs, and never lose context again.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Context Blocks | Think in Branches, Not Lines",
    description:
      "Rethinking AI chat from the ground up. Branch anywhere, explore what-ifs, and never lose context again.",
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
              <Toaster />
            </ThemeProvider>
          </QueryProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
