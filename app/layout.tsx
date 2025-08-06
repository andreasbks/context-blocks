import type { Metadata } from "next";
import { Geist } from "next/font/google";

import { ThemeProvider } from "next-themes";

import { QueryProvider } from "@/lib/providers/query-provider";

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
        <QueryProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
