import type { Metadata } from "next";

import DemoClient from "@/components/demo/demo-client";

export const metadata: Metadata = {
  title: "Try Context Blocks",
  description:
    "Try Context Blocks without signing up. Chat with the AI in a stateless demo to see branching conversations in action.",
};

export default function TryPage() {
  return <DemoClient />;
}
