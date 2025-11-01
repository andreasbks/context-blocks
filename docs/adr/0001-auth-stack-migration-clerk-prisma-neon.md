## ADR 0001: Migrate auth/database stack to Clerk + Prisma + Neon

### Status

Confirmed

### Context

- The app currently uses Supabase for authentication (middleware-based session refresh, SSR client
  usage) and does not appear to use Supabase Database in the app code yet.
- Requirement: enforce “protected by default” routes with a small public allowlist and follow
  industry-standard primitives.
- We want a stack that is widely adopted, modular, and compliant with common enterprise expectations
  (OIDC/SAML, robust Postgres, strong ORM, clear separation of concerns).

### Options considered

- Keep Supabase (Auth + Postgres) and continue with RLS.
- Switch to Clerk (Auth) + Prisma (ORM) + Neon (Postgres).
- Auth0/Cognito + Prisma + Neon.

### Decision

Adopt Clerk for authentication, Prisma as the ORM, and Neon as the Postgres host.

### Rationale

- Clerk
  - Provides hosted user management, session handling, MFA, OAuth, SAML (enterprise), and
    OIDC—covering “industry standard” expectations.
  - Tight Next.js integration with first-class middleware and server components support.
- Prisma
  - Mature, popular TypeScript ORM with a strong migration story and type-safety.
  - Ecosystem alignment and clear patterns for schema evolution.
- Neon
  - Serverless Postgres, managed, with branching, pooling, and good developer ergonomics.
  - Standard Postgres semantics allow easy portability and tooling compatibility.

### Non-goals

- Implement complex domain authorization logic in middleware. Middleware remains minimal: session
  verification + redirects. Authorization stays in the application and/or database layer.
- Migrate hashed passwords between providers. We’ll prefer re-authentication or Clerk-supported
  migration workflows if needed.

### High-level architecture changes

- Replace Supabase auth with Clerk middleware and providers.
- Introduce Prisma for data access and migrations.
- Point Prisma `DATABASE_URL` to Neon.
- Continue to gate routes via middleware with a public allowlist.

### Migration plan

1. Dependencies

```bash
pnpm add @clerk/nextjs @clerk/themes @prisma/client
pnpm add -D prisma
```

2. Environment variables

- Add to `.env.local` (values from Clerk and Neon):

```bash
CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
DATABASE_URL="postgresql://<user>:<password>@<neon-host>/<db>?sslmode=require&pgbouncer=true&connect_timeout=15"
```

3. Initialize Prisma

```bash
npx prisma init
```

This creates `prisma/schema.prisma` and updates `.env` with `DATABASE_URL`.

4. Define initial schema For Clerk, you can keep a lightweight `User` record referencing the Clerk
   user id. Example:

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String   @id @default(cuid())
  clerkUserId  String   @unique
  email        String   @unique
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

5. Create Prisma client helper

```ts
// lib/db.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

6. Neon connectivity

- Use pooled connections (via Neon) with `pgbouncer=true` and `sslmode=require` in `DATABASE_URL`
  (as shown above) for serverless/edge-compatible patterns.
- Optional: Prisma Accelerate can also improve connection behavior in serverless environments.

7. Wire Clerk in Next.js

- Middleware (root-level `middleware.ts`):

```ts
import { authMiddleware } from "@clerk/nextjs";

export default authMiddleware({
  publicRoutes: [
    "/",
    "/auth/(.*)",
    // add other public paths here
  ],
});

export const config = {
  matcher: [
    // Match all request paths except next internals and static files (similar to current pattern)
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- App Router provider (root layout):

```tsx
// app/layout.tsx
import { ClerkProvider } from "@clerk/nextjs";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <ClerkProvider>{children}</ClerkProvider>;
}
```

- Server components auth usage:

```ts
import { auth, currentUser } from "@clerk/nextjs";

export default async function Page() {
  const { userId } = auth();
  const user = await currentUser();
  // Use userId / user to fetch domain data via prisma
}
```

8. Update pages/components

- Replace Supabase login/signup UI with Clerk `<SignIn />` / `<SignUp />` or custom flows using
  Clerk hooks.
- Replace Supabase-specific session checks with Clerk’s `auth()` or `currentUser()` in server
  components and `useAuth()` in client components.

9. Data migration (if applicable)

- If you used Supabase solely for auth (no app tables), there’s likely no DB migration. You’ll ask
  users to sign in via Clerk (email link or OAuth). Password migration is usually not portable
  without specialized workflows. Clerk supports certain import paths; otherwise a re-onboarding
  (email verification) is typical.
- If you have domain tables in Supabase Postgres, export them (CSV/SQL) and import into Neon; then
  point Prisma to Neon and create corresponding models. Use `prisma migrate dev` to align schema and
  validate constraints.

10. Remove Supabase

- Remove `lib/supabase/*`, Supabase env vars, and Supabase middleware once Clerk auth is in place
  and tested.

### Security considerations

- Clerk handles password storage, MFA, OAuth/OIDC/SAML, and session security. Verify session on the
  server via `auth()` in critical paths.
- No RLS when using Prisma + Neon by default; authorization is enforced in your app layer (or you
  can implement DB-side policies with Postgres if desired). Keep authorization checks close to data
  access.
- Store only minimal PII (e.g., `email`, `clerkUserId`) in your own DB. Treat Clerk as the source of
  truth for identity.

### Operational considerations

- Neon is serverless; pooled connections recommended. Monitor cold start latencies. Consider Prisma
  Accelerate for improved connection handling.
- Clerk has generous free tiers; pricing/limits should be reviewed for production.

### Developer experience

- Prisma provides best-in-class DX for TS. Type-safe queries, migrations, and codegen improve
  reliability.
- Clerk’s Next.js SDK simplifies middleware and auth in server components.

### Effort estimate (for this codebase)

- Baseline implementation: 0.5–1 day
  - Add deps, configure `.env`, set up Clerk provider + middleware, create initial Prisma schema,
    wire Neon connection, update login/signup, replace auth checks.
- Data migration (if any domain tables): +0.5–1 day depending on complexity.
- User migration from Supabase Auth: typically re-authenticate users via new provider (send login
  links). Full password migration only if supported/needed (complexity varies).

### Risks

- User re-onboarding friction if migrating providers (email verification/login again).
- Serverless DB connection limits if not using pooling or Accelerate.
- Middleware and route matchers need careful alignment to avoid blocking static assets.

### Rollback plan

- Keep a branch with Supabase auth intact.
- Feature-flag the auth provider during migration window if you need staged rollout.
- If issues occur, revert to Supabase branch and env config.

### Next steps

- Introduce dependencies and `.env` keys.
- Add Clerk middleware and provider; verify route allowlist behavior.
- Initialize Prisma, connect to Neon, run initial migration.
- Update login/signup and remove Supabase code after verification.
