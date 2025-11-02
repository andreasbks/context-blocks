import Link from "next/link";

import { auth } from "@clerk/nextjs/server";
import {
  ArrowRight,
  ArrowUpRight,
  Boxes,
  GitBranch,
  Sparkles,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ensureCurrentUserExists } from "@/lib/users/ensure-user";

export default async function Home() {
  const { isAuthenticated } = await auth();
  if (isAuthenticated) {
    await ensureCurrentUserExists();
  }

  return (
    <div className="w-full">
      {/* Hero Section */}
      <section className="relative w-full px-6 py-20 md:py-32 flex flex-col items-center">
        <div className="absolute inset-0 -z-10 h-full w-full bg-white dark:bg-neutral-950 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]">
          <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-primary opacity-20 blur-[100px]" />
        </div>

        <div className="max-w-5xl mx-auto text-center space-y-8">
          <Badge
            variant="secondary"
            className="text-sm px-4 py-1.5 font-medium"
          >
            Rethinking AI chat from the ground up
          </Badge>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-neutral-900 to-neutral-600 dark:from-neutral-50 dark:to-neutral-400">
            Think in branches,
            <br />
            not lines
          </h1>

          <p className="text-xl md:text-2xl text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Traditional chat is linear. Context Blocks is modular: Branch
            anywhere, explore what-ifs, and never lose context again.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
            <Link
              href={isAuthenticated ? "/dashboard" : "/auth/sign-up"}
              className="group"
            >
              <Button size="lg" className="text-base px-8 h-12">
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>

          <p className="text-sm text-muted-foreground">
            Think Git for conversations. Think Lego for ideas.
          </p>
        </div>
      </section>

      {/* The Problem */}
      <section className="w-full px-6 py-20 bg-neutral-50 dark:bg-neutral-900/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">The Problem</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Current AI chat interfaces trap you in a single timeline
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                title: "Exploring what-if destroys your thread",
                description:
                  "Want to try a different approach? You'll lose your current conversation.",
              },
              {
                title: "Context gets buried as conversations grow",
                description:
                  "Important information disappears into an endless scroll.",
              },
              {
                title: "You can't reuse insights across chats",
                description:
                  "Every conversation starts from scratch. No building on past work.",
              },
              {
                title: "Comparing alternatives means starting over",
                description:
                  "Testing multiple approaches requires juggling separate chats.",
              },
            ].map((problem, i) => (
              <Card
                key={i}
                className="p-6 border-2 hover:border-primary/50 transition-colors"
              >
                <h3 className="font-semibold text-lg mb-2">{problem.title}</h3>
                <p className="text-muted-foreground">{problem.description}</p>
              </Card>
            ))}
          </div>

          <div className="text-center mt-12">
            <p className="text-2xl font-semibold">
              Chat shouldn&apos;t force you to think in one direction.
            </p>
          </div>
        </div>
      </section>

      {/* The Solution */}
      <section className="w-full px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              The Solution
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              A modular, visual canvas where every piece of context is
              interactive
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: GitBranch,
                title: "Branch Your Thinking",
                description:
                  "Fork any message to explore what-if scenarios without losing your place. Every branch is a parallel universe.",
                color: "text-blue-600 dark:text-blue-400",
              },
              {
                icon: Boxes,
                title: "Modular Blocks",
                description:
                  "Messages, documents, summaries: Everything is a reusable block. Drag, drop, and remix like Lego.",
                color: "text-purple-600 dark:text-purple-400",
              },
              {
                icon: Sparkles,
                title: "Visual Organization",
                description:
                  "See your conversations as a tree. Navigate branches visually. Context is always clear.",
                color: "text-amber-600 dark:text-amber-400",
              },
            ].map((feature, i) => (
              <Card
                key={i}
                className="p-8 text-center hover:shadow-lg transition-shadow"
              >
                <div
                  className={`inline-flex p-3 rounded-lg bg-neutral-100 dark:bg-neutral-800 mb-4 ${feature.color}`}
                >
                  <feature.icon className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="w-full px-6 py-20 bg-neutral-50 dark:bg-neutral-900/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              How It Works
            </h2>
            <p className="text-xl text-muted-foreground">
              Simple to start, powerful to master
            </p>
          </div>

          <div className="space-y-8">
            {[
              {
                step: "01",
                title: "Chat Normally",
                description:
                  "Start a conversation just like any other AI chat. Every message becomes a block.",
              },
              {
                step: "02",
                title: "Branch Anywhere",
                description:
                  "See an interesting message? Fork it to explore alternative paths. Your original thread stays intact.",
              },
              {
                step: "03",
                title: "Navigate Visually",
                description:
                  "View your conversation as a branching tree. Jump between branches. See the big picture.",
              },
              {
                step: "04",
                title: "Reuse Everything (Coming Soon)",
                description:
                  "Save blocks to your library. Import them into future conversations. Build on past insights.",
              },
            ].map((item, i) => (
              <div
                key={i}
                className="flex flex-col md:flex-row gap-6 items-start"
              >
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl">
                    {item.step}
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-semibold mb-2">{item.title}</h3>
                  <p className="text-lg text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Key Benefits */}
      <section className="w-full px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Why Developers Love It
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {[
              {
                icon: Zap,
                title: "Type-Safe & Modern",
                description:
                  "Built with Next.js 15, TypeScript, Prisma, and Zod. Full type safety from DB to UI.",
              },
              {
                icon: GitBranch,
                title: "Git-Like Workflow",
                description:
                  "Familiar branching model allows for intuitive usage and safe exploration with full control over context.",
              },
              {
                icon: Boxes,
                title: "Composable Architecture",
                description:
                  "DAG-based data model. Blocks are immutable. Edges define relationships. Pure and predictable.",
              },
              {
                icon: ArrowUpRight,
                title: "Production Ready",
                description:
                  "Rate limiting, idempotency keys, optimistic concurrency, streaming SSE. Built for scale.",
              },
            ].map((benefit, i) => (
              <Card
                key={i}
                className="p-6 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 p-2 bg-primary/10 rounded-lg">
                    <benefit.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2">
                      {benefit.title}
                    </h3>
                    <p className="text-muted-foreground">
                      {benefit.description}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="w-full px-6 py-20 bg-neutral-50 dark:bg-neutral-900/50">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-4xl md:text-6xl font-bold">
            Ready to think nonlinearly?
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Join developers exploring ideas in ways chat was never meant to
            support.
          </p>
          <div className="pt-4">
            <Link
              href={isAuthenticated ? "/dashboard" : "/auth/sign-up"}
              className="group"
            >
              <Button size="lg" className="text-base px-8 h-12">
                Start Building Today
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">
            Free to start. No credit card required.
          </p>
        </div>
      </section>
    </div>
  );
}
