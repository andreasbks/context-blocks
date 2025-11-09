<div align="center">

# 🌿 Context Blocks

**Rethinking AI chat from the ground up.**

Traditional chat is linear. Context Blocks is nonlinear, built around modular "blocks" you can
branch, navigate, and reuse.

**Think Git for conversations. Think Lego for ideas.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[Features](#-features) • [Roadmap](#️-roadmap) • [Architecture](#-architecture) •
[Quick Start](#-quick-start) • [API](#-api-overview) • [Contributing](#-contributing)

</div>

---

## 🎯 The Problem

Current AI chat interfaces trap you in a single timeline:

- ❌ Exploring "what if" destroys your current thread
- ❌ Context gets buried as conversations grow
- ❌ You can't compare alternatives side-by-side
- ❌ Starting over means losing everything

**Chat shouldn't force you to think in one direction.**

## 💡 The Solution

Context Blocks transforms conversations into a **modular, visual canvas** where every message is a
potential branch point.

```mermaid
graph LR
    A[AI: Here are some things you need to think about] --> B[User: Let's check out A]
    A --> C[User: Let's check out B]
    B --> D[AI: Sure here is A]
    B --> E[AI: *Another model* Sure here is A]
    C --> F[AI: Here is B]

    style A fill:#e1f5ff
    style B fill:#fff4e6
    style C fill:#fff4e6
    style D fill:#e1f5ff
    style E fill:#e1f5ff
    style F fill:#e1f5ff
```

## ✨ Features

### 🌿 **Branch Anywhere**

Fork from any message to explore alternatives without losing your place. Every conversation becomes
a tree of possibilities.

### 📦 **Blocks are Immutable**

Each message is a reusable building block. Reference them across conversations or build a personal
context library.

### 🎨 **Visual Navigation**

See your conversation as a graph. Jump between branches, compare approaches, and navigate
non-linearly.

### ⚡ **Real-time Streaming**

Stream AI responses with Server-Sent Events (SSE) for instant feedback, even on branches.

### 🔒 **Built for Scale**

- Optimistic concurrency control with version tracking
- Idempotency for reliable operations
- Rate limiting and quota management
- PostgreSQL-backed with Prisma ORM

### 🎨 **Prompt Management**

Integrated with [Langfuse](https://langfuse.com) for version-controlled prompt management. Update
system prompts without redeploying.

---

## 🗺️ Roadmap

### ✅ Current Features

- [x] **Individual Context Blocks** - Immutable message blocks with content versioning
- [x] **Graph Management** - Create, list, view, and delete conversation graphs
- [x] **Branching Conversations** - Fork from any message to explore alternatives
- [x] **Context Building** - Build context from branch conversation history
- [x] **Quota Management** - Track token usage with monthly limits per user
- [x] **Authentication & Authorization** - Secure user management with Clerk
- [x] **Real-time Streaming** - SSE-based streaming responses
- [x] **Visual Branch Navigation** - Tree view of conversation branches
- [x] **Optimistic Concurrency Control** - Version tracking prevents conflicts
- [x] **Rate Limiting** - Prevent API abuse with configurable limits

### 🚧 Planned Features

#### Near-term

- [ ] **Global Context Block Library** - Reuse blocks across different graphs
- [ ] **Legal & GDPR Compliance** templates and endpoints for launching as a service 
- [ ] **Traces and Evals** with Langfuse
- [ ] **Multi-modal Context Blocks** - Support images, files, and rich media
- [ ] **LLM Provider Selection** - Choose between OpenAI, Anthropic, and local models
- [ ] **Analytics & Logging** - Comprehensive observability with Langfuse traces
- [ ] **Full Test Suite** - Unit, integration, and E2E tests

#### Mid-term

- [ ] **Agentic Responses** - AI agents that can use tools and take actions
- [ ] **Summary Blocks** - Auto-generate summaries of long conversations
- [ ] **Semantic Branch Merging** - Intelligently merge parallel branches
- [ ] **Public Block Sharing** - Share context blocks with the community
- [ ] **Mobile UI Support** - Responsive design optimized for mobile devices

#### Long-term

- [ ] **Collaborative Graphs** - Multi-user real-time collaboration
- [ ] **Block Marketplace** - Discover and share community-created blocks
- [ ] **Advanced Search** - Semantic search across all your conversations
- [ ] **Export & Import** - Portable conversation formats
- [ ] **Self-hosting Guide** - Complete documentation for self-deployment

> 💡 **Want to contribute?** Check out our [contributing guidelines](#-contributing) and help shape
> the future of Context Blocks!

---

## 🏗️ Architecture

### Data Model

Context Blocks uses a **graph-based data model** where conversations are directed acyclic graphs
(DAGs):

```mermaid
erDiagram
    User ||--o{ Graph : owns
    User ||--o{ ContextBlock : creates
    Graph ||--o{ GraphNode : contains
    Graph ||--o{ Branch : has
    Graph ||--o{ BlockEdge : contains
    ContextBlock ||--o{ GraphNode : instantiated_as
    GraphNode ||--o{ BlockEdge : connects
    Branch }o--|| GraphNode : root
    Branch }o--|| GraphNode : tip

    User {
        string id
        string clerkUserId
        string email
    }

    Graph {
        string id
        string userId
        string title
        datetime lastActivityAt
    }

    ContextBlock {
        string id
        enum kind
        json content
        string model
        int tokenCount
        boolean public
    }

    GraphNode {
        string id
        string graphId
        string blockId
        datetime hiddenAt
    }

    BlockEdge {
        string id
        string graphId
        string parentNodeId
        string childNodeId
        enum relation
        datetime deletedAt
    }

    Branch {
        string id
        string graphId
        string rootNodeId
        string tipNodeId
        int version
    }
```

### Key Concepts

| Concept          | Description                                                             |
| ---------------- | ----------------------------------------------------------------------- |
| **Graph**        | Your conversation canvas.                                               |
| **ContextBlock** | Immutable content (user or assistant message).                          |
| **GraphNode**    | An instance of a block within a graph (enables reuse).                  |
| **BlockEdge**    | Typed connection between nodes connected to a branch.                   |
| **Branch**       | A pointer with `rootNodeId`, `tipNodeId`, and `version` for navigation. |

### Tech Stack

```
Frontend
├── Next.js 15 (App Router)
├── React 19
├── TanStack Query (state management)
├── Tailwind CSS + shadcn/ui
└── TypeScript

Backend (API Routes)
├── Next.js API Routes
├── Zod (validation)
├── Streaming SSE responses
└── Rate limiting + quota tracking

Database
├── Neon Postgres
├── Prisma ORM
└── Optimistic concurrency control

AI/Prompts
├── OpenAI API (streaming)
└── Langfuse (prompt management)

Auth
└── Clerk (@clerk/nextjs)

Dev Tools
├── ESLint + Prettier
├── Husky + lint-staged
├── Commitlint
└── TypeScript strict mode
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+** and **pnpm**
- **[Clerk](https://clerk.com)** account (free tier)
- **[Neon](https://neon.tech)** Postgres database (free tier)
- **OpenAI API key**
- **[Langfuse](https://langfuse.com)** account (optional, for prompt management)

### Installation

1. **Clone the repository:**

```bash
git clone https://github.com/YOUR_USERNAME/context-blocks.git
cd context-blocks
```

2. **Install dependencies:**

```bash
pnpm install
```

3. **Set up environment variables:**

Create `.env.local`:

```bash
# Clerk Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Neon Database (use pooled connection)
DATABASE_URL="postgresql://user:password@host/db?sslmode=require&pgbouncer=true&connect_timeout=15"

# OpenAI
OPENAI_API_KEY=sk-...

# Langfuse (Optional - for prompt management)
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_BASE_URL=https://cloud.langfuse.com

# Optional Configuration
# OPENAI_MODEL=gpt-4
# QUOTA_LIMIT=100000
# RATE_LIMIT_WRITE_PER_MINUTE=60
```

4. **Run database migrations:**

```bash
pnpm prisma migrate dev
```

5. **Set up Langfuse prompts (optional):**

```bash
pnpm setup:langfuse
```

6. **Start the development server:**

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) 🎉

### Production Build

```bash
pnpm build
pnpm start
```

---

## 🔌 API Overview

Context Blocks uses an **intent-driven API** where each user action maps to a single endpoint.

### Core Endpoints

| Endpoint                                | Method     | Description                    |
| --------------------------------------- | ---------- | ------------------------------ |
| `/api/v1/graphs/start`                  | POST       | Create graph + first message   |
| `/api/v1/graphs`                        | GET        | List all graphs                |
| `/api/v1/graphs/{id}`                   | GET/DELETE | Get or delete graph            |
| `/api/v1/branches/{id}/generate/stream` | POST       | AI generates response (SSE)    |
| `/api/v1/branches/{id}/send/stream`     | POST       | User sends + AI responds (SSE) |
| `/api/v1/branches/{id}/append`          | POST       | User appends message           |
| `/api/v1/branches/{id}/linear`          | GET        | Get linear history             |
| `/api/v1/branches/{id}/preview`         | GET        | Preview branch without content |
| `/api/v1/quota`                         | GET        | Check token usage quota        |

### Branching Support

Every mutating endpoint supports **in-call forking** via query parameters:

```typescript
{
  forkFromNodeId?: string;  // Create new branch from this node
  newBranchName?: string;   // Optional custom branch name
}
```

### SSE Streaming Format

Endpoints with `/stream` use Server-Sent Events:

```
event: delta
data: {"text": "Hello"}

event: delta
data: {"text": " world"}

event: final
data: {"items": [...], "newTip": "n_123", "version": 5}
```

### Idempotency

All write operations support idempotency via the `Idempotency-Key` header (cached 24h).

---

## 🧪 Development

### Quality Checks

```bash
# Run all checks
pnpm quality

# Individual checks
pnpm typecheck      # TypeScript
pnpm lint           # ESLint
pnpm format:check   # Prettier
```

### Database Operations

```bash
# Generate Prisma client
pnpm prisma generate

# Create migration
pnpm prisma migrate dev --name your_migration_name

# View database
pnpm prisma studio
```

### Git Hooks

Pre-commit hooks automatically:

- Format code with Prettier
- Fix ESLint issues
- Validate commit messages (Conventional Commits)

## 🎨 Prompt Management with Langfuse

Context Blocks integrates [Langfuse](https://langfuse.com) for centralized prompt management:

- 📝 Version control for system prompts
- 🏷️ Environment-based labels (production, staging, development)
- 🔄 5-minute cache with graceful fallback
- 🚀 Update prompts without redeploying

### Setup

1. Create Langfuse account at [cloud.langfuse.com](https://cloud.langfuse.com)
2. Add credentials to `.env.local`
3. Run setup script:

```bash
pnpm setup:langfuse
```

The script automatically creates your system prompt in Langfuse with both `production` and
`development` labels.

---

## 🤝 Contributing

Contributions are welcome! This project follows
[Conventional Commits](https://www.conventionalcommits.org/).

### Getting Started

1. Fork the repository
2. Create your feature branch: `git checkout -b feat/amazing-feature`
3. Commit your changes: `git commit -m 'feat: add amazing feature'`
4. Push to the branch: `git push origin feat/amazing-feature`
5. Open a Pull Request

### Commit Message Format

```
<type>: <description>

[optional body]
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`

### Code Quality

All PRs must pass:

- ✅ TypeScript type checking
- ✅ ESLint rules
- ✅ Prettier formatting
- ✅ Conventional commit format

## 🔐 Security

- All environment variables are gitignored
- Clerk handles authentication and user management
- API routes validate ownership before mutations
- Rate limiting prevents abuse
- Idempotency prevents duplicate operations

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

Built with:

- [Next.js](https://nextjs.org/) - React framework
- [Clerk](https://clerk.com/) - Authentication
- [Neon](https://neon.tech/) - Serverless Postgres
- [Prisma](https://www.prisma.io/) - ORM
- [OpenAI](https://openai.com/) - AI completions
- [Langfuse](https://langfuse.com/) - Prompt management
- [shadcn/ui](https://ui.shadcn.com/) - UI components
- [Tailwind CSS](https://tailwindcss.com/) - Styling

---

<div align="center">

**Ready to think nonlinearly?** 🌿

Built with ❤️

[⭐ Star this repo](https://github.com/YOUR_USERNAME/context-blocks) if you find it useful!

</div>
