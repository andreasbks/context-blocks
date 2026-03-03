import type { Metadata } from "next";

import DemoClient from "@/components/demo/demo-client";

export const metadata: Metadata = {
  title: "Try Context Blocks",
  description:
    "Try Context Blocks without signing up. Chat with the AI, branch conversations, and explore ideas -- full experience, no account required.",
};

export default function TryPage() {
  return (
    <div className="flex-1 w-full">
      <DemoClient />
    </div>
  );
}
