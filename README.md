# Context Blocks

**Rethinking AI chat from the ground up.**

Traditional chat is linear. **Context Blocks** is nonlinear, built around modular "blocks" you can
move, branch, remix, and reuse.

Think Git for conversations. Think Lego for ideas.

## The Problem

Current AI chat interfaces trap you in a single timeline:

- Exploring "what if" destroys your current thread
- Context gets buried as conversations grow
- You can't reuse insights across chats
- Comparing alternatives means starting over

**Chat shouldn't force you to think in one direction.**

## The Solution

Context Blocks transforms conversations into a **modular, visual canvas** where every piece of
context is interactive.

### What is a Block?

A **Block** is any discrete unit of context:

- A single message
- A group of related messages
- An imported document, file, or chunk of text
- An LLM-generated summary or suggestion

**Blocks are modular and interactive—like Lego for ideas.**

## Why Blocks?

### 🌿 Branch Your Thinking

Swipe or drag any block to the left to fork a new conversation—explore "what if" without losing your
place.

### 📥 Ingest New Context Instantly

Drop in a block from another chat, your personal context library, or an external source. The LLM can
reason with it immediately.

### 🎨 Remix and Merge

Bring together blocks from different threads, merging insights or comparing alternatives. Remix
ideas with drag-and-drop.

### 🗺️ Organize Visually

Conversations become a tree or graph—where context is clear, navigable, and reusable.

## How It Works

1. **Chat normally** — every message becomes a block
2. **Branch anywhere** — swipe left on any block to explore alternative paths
3. **Import context** — drop in files, docs, or blocks from other chats
4. **Navigate visually** — see your conversation as a tree, jump between branches
5. **Reuse everything** — save blocks to your library, bring them into future conversations

## Tech Stack

Built with a modern, type-safe stack:

- **Frontend:** Next.js 15 (App Router) + React
- **Auth:** Clerk (`@clerk/nextjs`)
- **Database:** Neon Postgres + Prisma ORM
- **State Management:** TanStack Query
- **UI:** shadcn/ui, Radix UI, Tailwind CSS
- **AI:** OpenAI API with streaming support
- **Type Safety:** TypeScript + Zod validation

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm
- [Clerk](https://clerk.com) account (free tier available)
- [Neon](https://neon.tech) Postgres database (free tier available)
- OpenAI API key

### Installation

1. **Clone and install dependencies:**

```bash
git clone https://github.com/yourusername/context-blocks.git
cd context-blocks
pnpm install
```

2. **Set up environment variables:**

Create `.env.local` in the root directory:

```bash
# Clerk Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Neon Database (use pooled connection)
DATABASE_URL="postgresql://<user>:<password>@<neon-host>/<db>?sslmode=require&pgbouncer=true&connect_timeout=15"

# OpenAI
OPENAI_API_KEY=sk-...
```

3. **Run database migrations:**

```bash
pnpm prisma migrate dev
```

4. **Start the development server:**

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and sign up to start chatting!

### Build for Production

```bash
pnpm build
pnpm start
```

## Contributing

This project is in active development. Contributions, issues, and feature requests are welcome!

1. Fork the repo
2. Create your feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contact

Built with ❤️ by Andreas

**Ready to think nonlinearly?**
