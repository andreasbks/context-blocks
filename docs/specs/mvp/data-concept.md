# Concept

## Entities

- **User** — the owner of everything.
- **Graph** — your “repo” (a conversation canvas, internally a DAG).
  - Tracks `lastActivityAt` (denormalized; updated in the same TX as writes) for fast listing.
- **ContextBlock** — immutable content: either a `user` or `assistant` message.
  - `public: boolean` — whether this block can be reused from your personal library.
- **GraphNode** — an **instance** of a ContextBlock within a Graph (lets the same block appear
  multiple times).
- **BlockEdge** — typed connection **node → node** inside a Graph. MVP supports:
  - `follows` — the linear chronology (what the chat renders).
  - `references` — side citations a message points to (e.g., injected library blocks).
- **Branch** — a pointer into the graph: `{ rootNodeId, tipNodeId, version }`. The linear chat
  renders by walking `follows` from `root` to `tip`.

> IDs: All entity IDs are cuid() (Prisma default).

---

## Invariants (enforced on the server)

- **Edges are graph-scoped** : `edge.graphId == parent.graphId == child.graphId`.
- **Acyclic `follows`** : reject any `follows` insert that would create a cycle.
- **Tip reachability** : a branch’s `tip` must be reachable from its `root` via `follows`.
- **Blocks are immutable** : edits create a new block (and node).
- **Soft deletes** : hide nodes/edges; never hard-delete blocks.
- **Optimistic concurrency** : `Branch.version` is used for CAS when moving the tip
  (append/replace/jump/delete).
- **Duplicates allowed** : the same block may appear multiple times in one graph (multiple nodes).
- **Delete safety** :
- Deleting a **branch root** is forbidden (blocked with `CANNOT_DELETE_BRANCH_ROOT`).
- Deleting a **tip** retargets the branch tip to the node’s **incoming `follows` parent** (if any)
  and bumps `version`.
- By default, all `references` touching a deleted node are soft-deleted.

---

## Why logic lives **behind** the API

- To preserve invariants atomically (DAG checks, reachability, tip CAS, delete retargeting).
- To hide LLM provider keys + streaming details.
- To keep UI dead simple: **one gesture → one endpoint** (with optional fork params).

---

# 2) Intent-Driven API (MVP)

**Conventions**

- Base: `/api/v1`
- Auth: single-user, still gated by `userId` ownership on all resources.
- **Idempotency:** `Idempotency-Key` header on all mutating routes (cached for 24h).
- **Rate limits (MVP):** 60 writes/min; up to 8 concurrent SSE streams per user.
- **Forking:** Every intent supports optional in-call forking via `forkFromNodeId` (+
  `newBranchName`).

## Graph lifecycle

### POST `/api/v1/graphs/start`

Create a **graph** , its **main branch** , and the **first message** in a single call.

**Body**

```json
{
  "title": "New exploration",
  "firstMessage": { "author": "user", "content": { "text": "Let's begin" } },
  "branchName": "main"
}
```

**200**

```json
{
  "graph": { "id": "g_1", "title": "New exploration", "createdAt": "...", "lastActivityAt": "..." },
  "branch": {
    "id": "br_main",
    "rootNodeId": "n_1",
    "tipNodeId": "n_1",
    "version": 0,
    "createdAt": "..."
  },
  "items": [
    {
      "nodeId": "n_1",
      "block": { "id": "b_1", "kind": "user", "content": { "text": "Let's begin" } }
    }
  ]
}
```

### GET `/api/v1/graphs`

List graphs (id, title, createdAt, lastActivity).

---

## Linear chat intents (each supports optional forking)

### POST `/api/v1/branches/{branchId}/append`

Append at the **current tip** (persist only). Optionally **fork first** by passing `forkFromNodeId`.

**Body**

```json
{
  "author": "user", // or "assistant" if precomputed
  "content": { "text": "Idea A" },
  "model": null, // only when author === "assistant"
  "expectedVersion": 0, // CAS on target branch
  "forkFromNodeId": "n_anchor", // optional → fork first
  "newBranchName": "explore-a" // optional when forking
}
```

**200 (no fork)**

```json
{
  "item": {
    "nodeId": "n_2",
    "block": { "id": "b_2", "kind": "user", "content": { "text": "Idea A" } }
  },
  "newTip": "n_2",
  "version": 1
}
```

**200 (forked in-call)**

```json
{
  "branch": {
    "id": "br_new",
    "graphId": "g_1",
    "name": "explore-a",
    "rootNodeId": "n_anchor",
    "tipNodeId": "n_2",
    "version": 1
  },
  "item": {
    "nodeId": "n_2",
    "block": { "id": "b_2", "kind": "user", "content": { "text": "Idea A" } }
  }
}
```

**409 (tip moved)**

```json
{ "error": { "code": "CONFLICT_TIP_MOVED", "currentVersion": 1, "currentTip": "n_99" } }
```

---

### POST `/api/v1/branches/{branchId}/generate/stream` _(SSE)_

Generate **assistant-only** at the branch tip (or on a newly forked branch).

**Body**

```json
{
  "expectedVersion": 1,
  "forkFromNodeId": null, // or "n_anchor" to fork first
  "newBranchName": "explore-b",
  "generation": { "temperature": 0.3 }
}
```

**SSE**

```
event: delta
data: {"token":"Okay, let's..."}

event: final
data: {
  "assistantItem": { "nodeId":"n_asst","block": { "id":"b_asst","kind":"assistant","content":{"text":"…"},"model":"gpt-4o-mini" } },
  "newTip": "n_asst",
  "version": 2,
  "branch": { "id":"br_new","...":"..." }   // only if forked
}

```

---

### POST `/api/v1/branches/{branchId}/send/stream` _(SSE)_

Append **user** and then generate **assistant** in one gesture. Optionally **fork first** .

**Body**

```json
{
  "userMessage": { "text": "Try path A" },
  "expectedVersion": 1,
  "forkFromNodeId": "n_anchor", // optional
  "newBranchName": "explore-a",
  "generation": { "temperature": 0.2 }
}
```

**SSE**

```
event: userItem
data: { "nodeId":"n_user","block":{ "id":"b_user","kind":"user","content":{"text":"Try path A"} } }

event: delta
data: {"token":"Here's an approach..."}

event: final
data: {
  "assistantItem": { "nodeId":"n_asst","block":{ "id":"b_asst","kind":"assistant","content":{"text":"…"} } },
  "newTip":"n_asst",
  "version": 2,
  "branch": { "id":"br_new","...":"..." }  // only if forked
}

```

> Failure mid-stream: keep the userItem if already persisted and emit error; client may call
> :generate:stream to complete the turn.

---

### POST `/api/v1/branches/{branchId}/inject`

Inject a **library/user-owned block** as a reference from the current tip.

**Body**

```json
{ "blockId": "b_lib_7", "reuseExistingNode": true }
```

**200**

```json
{ "reference": { "nodeId": "n_ctx1", "block": { "id": "b_lib_7", "kind":"user", "content": {...}, "public": true } } }

```

> Policy: API allows any block the user owns; library UI lists public=true by default.

---

### POST `/api/v1/branches/{branchId}/replace-tip`

Edit/regenerate the **last** message, preserving history.

**Body**

```json
{ "newContent": { "text": "Updated idea" }, "expectedVersion": 1 }
```

**200**

```json
{
  "item": {
    "nodeId": "n_3",
    "block": { "id": "b_3", "kind": "user", "content": { "text": "Updated idea" } }
  },
  "newTip": "n_3",
  "version": 2
}
```

---

### POST `/api/v1/branches/{branchId}/jump`

Move the tip back to continue from a previous node.

**Body**

```json
{ "toNodeId": "n_5", "expectedVersion": 2 }
```

---

### DELETE `/api/v1/nodes/{nodeId}`

Soft-delete a node; safely retarget branch tips; remove touching `references` (default).

**Optional body**

```json
{
  "removeReferences": true,
  "expectedVersions": { "br_main": 2 } // optional CAS map for affected branches
}
```

**200**

```json
{
  "nodeId": "n_123",
  "hiddenAt": "2025-08-17T12:34:56Z",
  "affected": {
    "deletedEdges": 5,
    "retargetedTips": [
      { "branchId": "br_main", "oldTip": "n_123", "newTip": "n_parent", "version": 3 }
    ]
  }
}
```

**409 CANNOT_DELETE_BRANCH_ROOT**

```json
{
  "error": {
    "code": "CANNOT_DELETE_BRANCH_ROOT",
    "message": "Node is the root for one or more branches.",
    "details": { "branchIds": ["br_main"] }
  }
}
```

---

## Reads for the linear UI

### GET `/api/v1/branches/{branchId}/linear?cursorNodeId=&limit=50&include=references`

Returns items by traversing `follows` from root (or cursor), ordered by `ord`.

**200**

```json
{
  "items": [
    {
      "nodeId": "n_1",
      "block": { "id":"b_1","kind":"user","content":{"text":"Let's begin"} },
      "references": [
        { "nodeId":"n_ctx1","block":{ "id":"b_lib_7","kind":"user","content":{...} } }
      ]
    }
  ],
  "nextCursor": "n_51"
}

```

### GET `/api/v1/nodes/{nodeId}/references?limit=20&cursor=…`

---

## Library

### GET `/api/v1/blocks?public=true`

List your reusable blocks (user’s library).

### POST `/api/v1/blocks/ensure`

Upsert a block into your library by checksum (optional for MVP).

**Body**

```json
{ "kind": "user", "content": { "text": "..." }, "checksum": "sha256:...", "public": true }
```

---

## Error vocabulary

- `FORBIDDEN`, `NOT_FOUND`,
- `DAG_CYCLE` (follows would create a cycle),
- `INVALID_REACHABILITY` (jump target outside root path),
- `CONFLICT_TIP_MOVED` (optimistic CAS failed),
- `CANNOT_DELETE_BRANCH_ROOT`,
- `IDEMPOTENCY_REPLAY`, `RATE_LIMITED`.

---

# 3) Prisma schema (paste-ready)

```
// schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL") // Neon
}

generator client {
  provider = "prisma-client-js"
}

enum BlockKind {
  user
  assistant
}

enum RelationType {
  follows
  references
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  createdAt DateTime @default(now())

  graphs         Graph[]
  contextBlocks  ContextBlock[]
}

model Graph {
  id             String   @id @default(cuid())
  userId         String
  title          String?
  createdAt      DateTime @default(now())
  lastActivityAt DateTime @default(now())

  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  nodes      GraphNode[]
  edges      BlockEdge[]
  branches   Branch[]

  @@index([userId])
  @@index([lastActivityAt])
}

model ContextBlock {
  id          String     @id @default(cuid())
  userId      String
  kind        BlockKind
  content     Json
  model       String?
  tokenCount  Int?
  checksum    String?    @unique
  public      Boolean    @default(false)
  createdAt   DateTime   @default(now())

  user        User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  nodes       GraphNode[]
}

model GraphNode {
  id         String   @id @default(cuid())
  graphId    String
  blockId    String
  hiddenAt   DateTime?

  graph      Graph        @relation(fields: [graphId], references: [id], onDelete: Cascade)
  block      ContextBlock @relation(fields: [blockId], references: [id], onDelete: Cascade)

  parentEdges BlockEdge[] @relation("Parent")
  childEdges  BlockEdge[] @relation("Child")

  @@index([graphId, blockId])
}

model BlockEdge {
  id            String        @id @default(cuid())
  graphId       String
  parentNodeId  String
  childNodeId   String
  relation      RelationType
  ord           Int?
  createdAt     DateTime      @default(now())
  deletedAt     DateTime?

  graph         Graph     @relation(fields: [graphId], references: [id], onDelete: Cascade)
  parentNode    GraphNode @relation("Parent", fields: [parentNodeId], references: [id], onDelete: Cascade)
  childNode     GraphNode @relation("Child",  fields: [childNodeId],  references: [id], onDelete: Cascade)

  @@index([graphId, parentNodeId, relation, ord])
  @@index([graphId, childNodeId])
}

model Branch {
  id          String    @id @default(cuid())
  graphId     String
  name        String
  rootNodeId  String
  tipNodeId   String?
  version     Int       @default(0)
  createdAt   DateTime  @default(now())

  graph       Graph     @relation(fields: [graphId], references: [id], onDelete: Cascade)
  rootNode    GraphNode @relation(fields: [rootNodeId], references: [id], onDelete: Restrict)
  tipNode     GraphNode? @relation(fields: [tipNodeId], references: [id], onDelete: SetNull)

  @@index([graphId])
  @@unique([graphId, name])
}

```

> Notes
>
> • IDs are `cuid()` across the board.
>
> • `Graph.lastActivityAt` supports efficient listing.
>
> • Only `user`/`assistant` kinds; only `follows`/`references` edges.
>
> • Delete is implemented via `hiddenAt` (nodes) and `deletedAt` (edges).

---

## Server-side guards (Prisma + raw SQL)

### “Would this `follows` create a cycle?”

```sql
-- $1=graphId, $2=parentNodeId, $3=childNodeId
with recursive up(id) as (
  select $2
  union
  select e."parentNodeId"
  from "BlockEdge" e
  join up on up.id = e."childNodeId"
  where e."graphId" = $1 and e."relation" = 'follows' and e."deletedAt" is null
)
select exists(select 1 from up where id = $3) as "wouldCycle";

```

### “Is `toNodeId` reachable from branch root?”

```sql
-- $1=graphId, $2=rootNodeId, $3=toNodeId
with recursive walk(id) as (
  select $2
  union
  select e."childNodeId"
  from walk
  join "BlockEdge" e on e."parentNodeId" = walk.id
  where e."graphId" = $1 and e."relation"='follows' and e."deletedAt" is null
)
select exists(select 1 from walk where id = $3) as "reachable";

```

---

## How each intent maps to DB (transactions)

Using your Prisma client:

```tsx
import { prisma } from "@/lib/prisma";

// Append (user or assistant) with optional fork
export async function append({ branchId, author, content, model, expectedVersion, userId, forkFromNodeId, newBranchName }) {
  return prisma.$transaction(async (tx) => {
    const src = await tx.branch.findUniqueOrThrow({ where: { id: branchId }, include: { graph: true } });
    if (src.graph.userId !== userId) throw forbidden();

    // Optional fork
    const targetBranch = forkFromNodeId
      ? await tx.branch.create({
          data: {
            graphId: src.graphId,
            name: newBranchName ?? `fork-${forkFromNodeId.slice(-6)}`,
            rootNodeId: forkFromNodeId,
            tipNodeId: forkFromNodeId,
            version: 0
          }
        })
      : src;

    if (!forkFromNodeId && expectedVersion != null && expectedVersion !== src.version) {
      throw conflictTipMoved(src.tipNodeId, src.version);
    }

    const block = await tx.contextBlock.create({
      data: { userId, kind: author, content, model: model ?? null, public: false }
    });
    const node = await tx.graphNode.create({ data: { graphId: targetBranch.graphId, blockId: block.id } });

    // DAG guard (defensive; new node can't cycle but keep shared helper)
    const [{ wouldCycle }] = await tx.$queryRawUnsafe<{ wouldCycle: boolean }>(/* cycle SQL */, targetBranch.graphId, targetBranch.tipNodeId, node.id);
    if (wouldCycle) throw dagCycle();

    await tx.blockEdge.create({
      data: { graphId: targetBranch.graphId, parentNodeId: targetBranch.tipNodeId!, childNodeId: node.id, relation: "follows", ord: 0 }
    });

    const updated = await tx.branch.updateMany({
      where: { id: targetBranch.id, version: forkFromNodeId ? 0 : (expectedVersion ?? src.version) },
      data: { tipNodeId: node.id, version: { increment: 1 } }
    });
    if (updated.count === 0) throw conflictTipMoved(targetBranch.tipNodeId, (targetBranch.version ?? 0) + 1);

    await tx.graph.update({ where: { id: targetBranch.graphId }, data: { lastActivityAt: new Date() } });

    if (forkFromNodeId) {
      return { branch: { ...targetBranch, tipNodeId: node.id, version: 1 }, item: { nodeId: node.id, block } };
    }
    return { item: { nodeId: node.id, block }, newTip: node.id, version: (src.version + 1) };
  });
}

```

> generate:stream commits the assistant item on final with the same tip-advance/CAS +
> lastActivityAt.
>
> `send:stream` first persists the user item (emit `userItem`), then commits the assistant item on
> `final`.

---

## Why this fits your swipeable linear UI

- Main list shows **only `follows`** ; `references` render as inline chips/cards.
- **Fork-anything** UX: pass `forkFromNodeId` to any intent to work on a fresh branch without extra
  calls.
- **ReplaceTip** gives edit/regenerate while preserving provenance.
- **Delete Node** is safe and deterministic: no orphan tips, no broken branches.
- DAG under the hood keeps you future-ready for merges without changing existing data.
