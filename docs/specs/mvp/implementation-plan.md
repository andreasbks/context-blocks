## MVP Backend Implementation Plan (Executable)

This is a concrete, end-to-end plan to implement the MVP data model and API as specified in
`docs/specs/mvp/data-concept.md` and `docs/specs/mvp/mvp-api-spec.md` on top of the current
Next.js + Clerk + Prisma + Neon stack.

### Stack baseline

- Next.js App Router (`app/api` route handlers)
- Clerk auth (middleware already protects `/api` routes)
- Prisma client at `lib/generated/prisma` with Neon Postgres
- TanStack Query on the client (not directly relevant to backend work)

---

## Milestones

1. Database schema upgrade (Graph, ContextBlock, GraphNode, BlockEdge, Branch, enums, Idempotency)
2. Core service layer and guards (transactions, invariants, reachability checks)
3. API routing and URL rewrites (colon-style RPC actions → clean filesystem paths)
4. Validation, error envelope, and idempotency middleware
5. Implement intent endpoints (with optional in-call forking): `graphs:start`, `branches:append`,
   `branches:generate:stream`, `branches:send:stream`, `inject`, `replaceTip`, `jump`,
   `nodes:delete`
6. Read endpoints: `GET /v1/graphs`, `GET /v1/graphs/{graphId}`,
   `GET /v1/branches/{branchId}:linear`, `GET /v1/nodes/{nodeId}:references`
7. Library endpoints: `GET /v1/blocks`, `POST /v1/blocks:ensure`
8. Observability and rate limits (basic), logging, and keepalive for SSE
9. Tests (unit for services + light integration for routes) and examples (curl)

---

## Detailed tasks (with file paths)

### 1) Prisma schema upgrade

- Edit `prisma/schema.prisma` to add:
  - Enums: `BlockKind { user, assistant }`, `RelationType { follows, references }`
  - Models: `Graph`, `ContextBlock`, `GraphNode`, `BlockEdge`, `Branch`
  - Idempotency model for request replay: `IdempotencyRequest` with unique
    `(userId, method, path, key)` and stored `status`, `headers`, `body` JSON (keep to ~256KB)
- Keep existing `User` model; link ownership via `userId` on `Graph` and `ContextBlock`.

Commands:

```bash
pnpm prisma migrate dev --name mvp_schema
pnpm prisma generate
```

### 2) Service layer (transactions + guards)

Create a lightweight domain/service layer to keep handlers thin:

- `lib/api/errors.ts` – error constructors that return the unified envelope + HTTP status codes.
- `lib/api/validation.ts` – Zod schemas for request bodies/query.
- `lib/api/idempotency.ts` – utilities to read/write idempotency cache in DB.
- `lib/api/guards.ts` – raw SQL helpers for cycle and reachability checks using `prisma.$queryRaw`
  (from spec).
- `lib/api/transactions.ts` – exported functions implementing intents using Prisma transactions:
  - `startGraph({ title, firstMessage, branchName, userId })`
  - `append({ branchId, author, content, model, expectedVersion, userId, forkFromNodeId, newBranchName })`
  - `generateStream({ branchId, expectedVersion, userId, generation, forkFromNodeId, newBranchName, onDelta, onFinal })`
  - `sendStream({ branchId, expectedVersion, userId, userMessage, generation, forkFromNodeId, newBranchName, onUserItem, onDelta, onFinal })`
  - `inject({ branchId, blockId, reuseExistingNode, userId })`
  - `replaceTip({ branchId, newContent, expectedVersion, userId })`
  - `jump({ branchId, toNodeId, expectedVersion, userId })`
  - Linear/read helpers: `listGraphs`, `getGraphWithBranches`, `getLinear`, `getReferences`,
    `listBlocks`, `ensureBlock`

Note: Prefer early guard clauses, CAS updates via `updateMany`, and only soft-deleting edges. All
handlers must map Clerk → internal user id: call `ensureCurrentUserExists()` and then resolve
`owner = prisma.user.findUnique({ where: { clerkUserId } })`; use `owner.id` for all DB writes and
filters (never the Clerk id).

### 3) Routing and rewrites

Implement clean filesystem paths and map the spec’s colon-style endpoints via rewrites in
`next.config.ts`:

- Add `async rewrites()` returning:
  - `/v1/graphs:start` → `/api/v1/graphs/start`
  - `/v1/graphs` → `/api/v1/graphs`
  - `/v1/graphs/:graphId` → `/api/v1/graphs/:graphId`
  - `/v1/branches/:branchId:append` → `/api/v1/branches/:branchId/append`
  - `/v1/branches/:branchId:generate:stream` → `/api/v1/branches/:branchId/generate/stream`
  - `/v1/branches/:branchId:send:stream` → `/api/v1/branches/:branchId/send/stream`
  - `/v1/branches/:branchId:inject` → `/api/v1/branches/:branchId/inject`
  - `/v1/branches/:branchId:replaceTip` → `/api/v1/branches/:branchId/replace-tip`
  - `/v1/nodes/:nodeId` (DELETE) → `/api/v1/nodes/:nodeId`
  - `/v1/branches/:branchId:jump` → `/api/v1/branches/:branchId/jump`
  - `/v1/branches/:branchId:linear` → `/api/v1/branches/:branchId/linear`
  - `/v1/nodes/:nodeId:references` → `/api/v1/nodes/:nodeId/references`
  - `/v1/blocks` → `/api/v1/blocks`
  - `/v1/blocks:ensure` → `/api/v1/blocks/ensure`

Create route handlers under `app/api/v1/...`:

- `app/api/v1/graphs/start/route.ts` (POST)
- `app/api/v1/graphs/route.ts` (GET list)
- `app/api/v1/graphs/[graphId]/route.ts` (GET show)
- `app/api/v1/branches/[branchId]/append/route.ts` (POST)
- `app/api/v1/branches/[branchId]/generate/stream/route.ts` (POST, SSE)
- `app/api/v1/branches/[branchId]/send/stream/route.ts` (POST, SSE)
- `app/api/v1/branches/[branchId]/inject/route.ts` (POST)
- `app/api/v1/branches/[branchId]/replace-tip/route.ts` (POST)
- `app/api/v1/nodes/[nodeId]/route.ts` (DELETE)
- `app/api/v1/branches/[branchId]/jump/route.ts` (POST)
- `app/api/v1/branches/[branchId]/linear/route.ts` (GET)
- `app/api/v1/nodes/[nodeId]/references/route.ts` (GET)
- `app/api/v1/blocks/route.ts` (GET)
- `app/api/v1/blocks/ensure/route.ts` (POST)

### 4) Validation, errors, idempotency

- Add `zod` for body/query validation.
- Standardize error responses per spec in `lib/api/errors.ts` and a helper
  `jsonError(code, message, details?)`.
- Implement idempotency:
  - Middleware-like utility called at the top of mutating handlers:
    - Read `Idempotency-Key` from header; if present, check DB for `(userId, method, path, key)`.
    - On hit: return stored HTTP response.
    - On miss: run handler logic; store response.
  - Cap stored body size; if exceeded, skip storing but still process.
  - Utilities accept the standard `Request` type (App Router), not `NextRequest`.

Install deps:

```bash
pnpm add zod
```

### 5) Intent endpoints (server logic)

- Follow the transaction flows directly from the spec, using guard queries from `data-concept.md`
  for cycles and reachability.
- Use CAS updates on `Branch.version` via `updateMany`.
- Set `public=false` by default for non-library blocks.
- Preserve `ord` on `replaceTip`.
- For `inject`, optionally reuse an existing node when `reuseExistingNode=true`.

### 6) Streaming endpoints (SSE)

- `generate:stream` – assistant-only generation; on `final`, commit assistant item, add `follows`,
  CAS tip/version; emit `{ assistantItem, newTip, version[, branch] }`.
- `send:stream` – first persist user item and emit `userItem`, then stream assistant; on `final`,
  commit assistant item and advance tip.
- Both support optional forking; responses include `branch` when forked.
- Send `keepalive` every 15s; errors use the envelope and close the stream.
- Provider: OpenAI behind a small provider interface; cache the `final` payload for idempotency
  replays.

### 7) Read endpoints

- `GET /v1/graphs` – list by `createdAt` desc with denormalized `lastActivityAt`.
- `GET /v1/graphs/{graphId}` – minimal graph and branch list.
- `GET /v1/branches/{branchId}:linear` – walk `follows` from root or `cursorNodeId`, filter out
  hidden/deleted, return `{ items, nextCursor }`.
- `GET /v1/nodes/{nodeId}:references` – list `references` edges from the node with pagination.

### 8) Library endpoints

- `GET /v1/blocks` – default `public=true` to act as library; support pagination and simple filters.
- `POST /v1/blocks:ensure` – upsert by checksum; if missing `checksum`, fallback to create (MVP
  acceptable).

### 9) Observability and rate limiting

- Add lightweight logging around transactions and SSE lifecycle (console for MVP).
- Rate limit: simple in-memory limiter keyed by `(userId, route)`; document that serverless
  multi-instance requires Redis (future). Enforce 60 writes/min/user and up to 8 concurrent SSE
  streams/user; return `429` with `Retry-After`.

### 10) Testing and examples

- Unit tests for `lib/api/transactions.ts` using Prisma test DB (Neon branch or local) and Node’s
  test runner or Vitest.
- Integration smoke tests for route handlers (Next.js request/response with `fetch` in dev server or
  `supertest` via Node adapter).
- Add `docs/specs/mvp/examples.http` with curl snippets for each endpoint, including idempotency
  headers and expected responses.

---

## Acceptance criteria (per endpoint)

- All endpoints conform to request/response shapes in `mvp-api-spec.md`.
- Ownership enforced: every access is gated by Clerk `userId`.
- Idempotency honored for all mutating endpoints (persisted in Postgres table).
- CAS conflicts return `409 CONFLICT_TIP_MOVED` with `currentVersion` and `currentTip`.
- DAG invariants enforced; reachability guards implemented.
- Soft-deletes respected in reads (`hiddenAt` / `deletedAt`).
- SSE endpoints (`generate:stream`, `send:stream`) emit required events and keepalive every 15s;
  `final` payload is cached for idempotency replays. Initial provider: OpenAI via a provider
  interface.
- Every handler maps Clerk `userId` to the internal `User.id` and uses it consistently for ownership
  checks and writes.

---

## Work breakdown checklist

- [ ] Update Prisma schema with models/enums + `IdempotencyRequest`
- [ ] Migrate and regenerate client
- [ ] Add `lib/api/{errors,validation,idempotency,guards,transactions}.ts`
- [ ] Add Next.js `rewrites()` in `next.config.ts`
- [ ] Implement routes under `app/api/v1/...`
- [ ] Add SSE helper and implement `append/stream`
- [ ] Add simple rate limit (MVP) and request size guards
- [ ] Add tests and cURL examples

---

## Commands reference

```bash
# Install deps
pnpm add zod

# Prisma
pnpm prisma migrate dev --name mvp_schema
pnpm prisma generate

# Dev
pnpm dev

# Quality gates
pnpm quality
```

---

## Risks and mitigations

- SSE on serverless: verify runtime supports streaming; if not, gate behind non-stream append.
- Idempotency storage size: cap response body and headers; only store success responses.
- Race conditions: ensure transactions are the single writer; CAS updates always used for tip moves.
- Pagination consistency: use forward-only cursors and clear ordering by `createdAt`/`id`.

---

## Decisions applied (from user)

- `:inject` accepts any block owned by the user; UI defaults to listing `public=true`.
- Idempotency persisted in Postgres table with TTL cleanup.
- In-memory rate limiting (per instance) with `Retry-After` and SSE concurrency cap; document Redis
  upgrade path.
- SSE provider: OpenAI (e.g., gpt-4o-mini) behind a provider interface.
- `lastActivityAt` denormalized and updated in write transactions.
- `MessageContent` schema reserves `text` (<= 8000 chars), optional `annotations`, optional `meta`.

These are reflected in endpoint behavior and DB/service design above.

---

## Implementation notes and pitfalls (from initial integration)

- User identity: Clerk’s `userId` is not the same as Prisma `User.id`. Always call
  `ensureCurrentUserExists()` and query `User` by `clerkUserId` to obtain the internal cuid. Use the
  internal id for `Graph.userId`, `ContextBlock.userId`, and all queries.
- Prisma JSON typing: when writing `ContextBlock.content`, cast to `Prisma.InputJsonValue` to
  satisfy strict typings.
- Idempotency helpers should work with the standard `Request` type (App Router). Avoid `NextRequest`
  in shared libs to prevent type/lint issues.
- Idempotency replay: return the stored body as-is to avoid narrowing `Prisma.JsonValue` unions by
  property access.
- Denormalized activity: update `Graph.lastActivityAt` inside the same write transaction; order
  graph lists by `lastActivityAt desc`.
- Local auth and cookies: prefer `http://localhost:3000` (not `127.0.0.1`) so Clerk’s `__session`
  cookie is sent.
