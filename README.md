# Context Blocks Chat

Modular, branchable AI chat platform built with Next.js, Clerk, Prisma, Neon, and shadcn/ui.

---

## Features

- **Branchable Context Blocks:** Fork and compare conversations like code.
- **Reusable Context:** Save and reuse context blocks across chats.
- **Modern UI:** Built with shadcn/ui, Radix UI, and Tailwind CSS.
- **Auth + DB:** Clerk for authentication; Prisma ORM with Neon Postgres.
- **DX:** Type-safe, modular, and ready for extension.

---

## Tech Stack

- **Frontend:** Next.js (App Router)
- **Auth:** Clerk (`@clerk/nextjs`)
- **Database/ORM:** Neon Postgres + Prisma
- **State:** TanStack Query
- **UI:** shadcn/ui, Radix UI, Tailwind CSS

---

## Project Structure

```plaintext
.
├── app/                 # Next.js App Router (pages, layouts)
├── components/          # UI components
│   ├── auth/            # Auth-related UI
│   └── ui/              # shadcn/ui wrappers
├── lib/
│   ├── constants/       # Query keys and constants
│   ├── generated/       # Generated code (e.g., Prisma client)
│   ├── hooks/           # Custom hooks
│   ├── providers/       # React providers (QueryProvider, etc.)
│   └── db.ts            # Prisma client helper
├── prisma/              # Prisma schema and migrations
├── docs/adr/            # Architecture decision records
├── middleware.ts        # Clerk middleware
├── README.md
└── ...
```

---

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm
- Clerk account (publishable + secret keys)
- Neon (or any Postgres) connection string

### Setup

1. Create `.env.local` with your credentials:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
# Use pooled connection for serverless (Neon)
DATABASE_URL="postgresql://<user>:<password>@<neon-host>/<db>?sslmode=require&pgbouncer=true&connect_timeout=15"
```

2. Install and generate client:

```bash
pnpm install
```

3. (Optional) Run migrations if you add/modify models:

```bash
pnpm prisma migrate dev
```

4. Start the dev server:

```bash
pnpm dev
```

### Build

```bash
pnpm build && pnpm start
```

---

## Auth + Middleware

- Public routes are allowlisted in `middleware.ts` (e.g., `/`, `/auth/...`).
- All other routes are protected via Clerk; unauthenticated users are redirected to sign in.

---

## Prisma

- Client is generated to `lib/generated/prisma` (see `prisma/schema.prisma`).
- Access the client via `lib/db.ts`.

---

## Notes

- This repository previously used Supabase for auth. It has been migrated to Clerk + Prisma + Neon.
- See `docs/adr/0001-auth-stack-migration-clerk-prisma-neon.md` for details.
