# API Overview

- **Style:** JSON REST + **SSE** for streaming
- **Base URL:** `/api/v1`
- **Auth:** single-user MVP; every resource carries `userId`. Use bearer token or session cookie.
- **Media types:**
  - Request: `Content-Type: application/json`
  - Response: `Content-Type: application/json` (SSE uses `text/event-stream`)
- **Idempotency:** all **mutating** endpoints accept `Idempotency-Key` (opaque ≤200 chars). Cache
  24h.
- **Timestamps:** ISO-8601 UTC strings
- **IDs:** all IDs are `cuid()` (Prisma default)
- **Numbers:** integers unless noted
- **Rate limits (MVP):** 60 writes/min/user; up to **8** concurrent SSE streams/user → `429` with
  `Retry-After`

---

## Domain Concepts (recap)

- **Graph** — a user’s conversation “repo” (internally a DAG)
- **ContextBlock** — immutable content (`kind ∈ {user, assistant}`, `public: boolean`)
- **GraphNode** — an _instance_ of a ContextBlock within a Graph
- **BlockEdge** — relation between nodes (MVP: `follows`, `references`)
- **Branch** — a lens: `{ rootNodeId, tipNodeId, version }`. Linear chat is the walk of `follows`
  from `root`.

---

## Common Schemas

### Enums

```json
["user", "assistant"] // BlockKind
```

```json
["follows", "references"] // RelationType
```

### MessageContent (MVP)

```json
{
  "text": "string (required, non-empty, max 8000 chars)",
  "annotations": [
    { "type": "reference", "nodeId": "optional", "blockId": "optional", "note": "optional" }
  ],
  "meta": { "freeform": "small, optional" }
}
```

### Error Envelope

```json
{
  "error": {
    "code": "STRING_CODE",
    "message": "Human-readable message",
    "details": { "optional": "object with extra context" }
  }
}
```

**Error codes**

- `FORBIDDEN` – resource not owned by user
- `NOT_FOUND` – missing/hidden resource
- `VALIDATION_FAILED` – body/query invalid
- `DAG_CYCLE` – `follows` would create a cycle
- `INVALID_REACHABILITY` – jump target not on root path
- `CONFLICT_TIP_MOVED` – optimistic CAS failed
- `CANNOT_DELETE_BRANCH_ROOT` – attempted to delete a branch root node
- `IDEMPOTENCY_REPLAY` – duplicate idempotency key (replayed response)
- `RATE_LIMITED` – too many requests/streams
- `INTERNAL` – server fault

### Resource Objects (shape)

```json
// Graph
{ "id":"g_123","userId":"u_1","title":"New exploration","createdAt":"...","lastActivityAt":"..." }

// Branch
{ "id":"br_1","graphId":"g_123","name":"main","rootNodeId":"n_1","tipNodeId":"n_42","version":7,"createdAt":"..." }

// ContextBlock
{ "id":"b_1","userId":"u_1","kind":"user","content":{"text":"hello"},"model":null,"tokenCount":2,"checksum":"sha256:...","public":false,"createdAt":"..." }

// GraphNode
{ "id":"n_1","graphId":"g_123","blockId":"b_1","hiddenAt":null }

// BlockEdge
{ "id":"e_1","graphId":"g_123","parentNodeId":"n_1","childNodeId":"n_2","relation":"follows","ord":0,"createdAt":"...","deletedAt":null }

// TimelineItem
{ "nodeId":"n_2","block":{ /* ContextBlock */ }, "references":[ { "nodeId":"n_ctx1","block":{ /* ContextBlock */ } } ] }

```

---

## Conventions & Headers

- `Authorization: Bearer <token>` (or session cookie)
- `Idempotency-Key: <opaque>` for all writes
- SSE: `Accept: text/event-stream`; server sends `event: keepalive` every 15s

---

# Endpoints

## Graphs

### POST `/api/v1/graphs/start`

Create a graph, its main branch, and the first message atomically.

**Request**

```json
{
  "title": "Writing plan",
  "firstMessage": { "author": "user", "content": { "text": "Let's begin" } },
  "branchName": "main" // optional; default "main"
}
```

**200 OK**

```json
{
  "graph": { "id": "g_1", "title": "Writing plan", "createdAt": "..." },
  "branch": {
    "id": "br_1",
    "graphId": "g_1",
    "name": "main",
    "rootNodeId": "n_1",
    "tipNodeId": "n_1",
    "version": 0,
    "createdAt": "..."
  },
  "items": [
    {
      "nodeId": "n_1",
      "block": {
        "id": "b_1",
        "kind": "user",
        "content": { "text": "Let's begin" },
        "public": false,
        "createdAt": "..."
      }
    }
  ]
}
```

**Validation**

- `author ∈ {"user","assistant"}`
- `content.text` required, 1..8000
- Title ≤120 chars

---

### GET `/api/v1/graphs`

List graphs for current user.

**Query**

- `limit` (default 20, max 100)
- `cursor` (opaque `graph.id`)

**200**

```json
{
  "items": [{ "id": "g_1", "title": "Writing plan", "createdAt": "...", "lastActivityAt": "..." }],
  "nextCursor": null
}
```

---

### GET `/api/v1/graphs/{graphId}`

Fetch one graph + its branches (minimal).

**200**

```json
{
  "graph": { "id": "g_1", "title": "Writing plan", "createdAt": "...", "lastActivityAt": "..." },
  "branches": [
    { "id": "br_1", "name": "main", "rootNodeId": "n_1", "tipNodeId": "n_7", "version": 5 }
  ]
}
```

---

## Branch — Intents (each supports optional forking)

> All 3 intents accept optional forking via:
>
> `forkFromNodeId: string` and `newBranchName?: string`.
>
> If present, the server first creates a **new branch**
> `{root=forkFromNodeId, tip=forkFromNodeId, version=0}` and then performs the intent **on that new
> branch**. Responses include a `branch` object when forking occurred.

### 1) POST `/api/v1/branches/{branchId}/append`

Persist a message (no generation).

**Request**

```json
{
  "author": "user", // or "assistant" if precomputed
  "content": { "text": "Instruction block" },
  "model": null, // if author === "assistant"
  "expectedVersion": 3, // CAS on target branch
  "forkFromNodeId": "n_anchor", // optional: fork first
  "newBranchName": "explore-A" // optional when forking
}
```

**200 (no fork)**

```json
{
  "item": {
    "nodeId": "n_2",
    "block": {
      /* ContextBlock */
    }
  },
  "newTip": "n_2",
  "version": 4
}
```

**200 (forked)**

```json
{
  "branch": {
    "id": "br_new",
    "graphId": "g_1",
    "name": "explore-A",
    "rootNodeId": "n_anchor",
    "tipNodeId": "n_new",
    "version": 1
  },
  "item": {
    "nodeId": "n_new",
    "block": {
      /* ContextBlock */
    }
  }
}
```

**Server TX**

- (optional) create branch
- create **ContextBlock** (`public=false`) → **GraphNode**
- insert `BlockEdge(follows, parent=tip, child=new, ord=next)`
- update branch `tip=new`, `version++` (CAS if `expectedVersion`)
- touch `Graph.lastActivityAt`

---

### 2) POST `/api/v1/branches/{branchId}/generate/stream` (SSE)

Generate **assistant-only** at the current tip (or at a newly forked branch).

**Request**

```json
{
  "expectedVersion": 8,
  "forkFromNodeId": null, // or a node ID to fork first
  "newBranchName": "explore-A",
  "generation": { "temperature": 0.3 } // provider knobs
}
```

**SSE**

```
event: delta
data: {"token":"Okay, let's..."}

event: final
data: {
  "assistantItem": { "nodeId":"n_asst","block":{ "id":"b_asst","kind":"assistant","content":{"text":"…"},"model":"gpt-4o-mini" } },
  "newTip": "n_asst",
  "version": 9,
  "branch": { "id":"br_new", "...": "..." }          // only when forked
}

```

**Server TX (on `final`)**

- (optional) create branch
- create assistant **ContextBlock** → **GraphNode**
- insert `follows` edge, advance tip (CAS), touch graph

---

### 3) POST `/api/v1/branches/{branchId}/send/stream` (SSE)

Append **user** and then generate **assistant** in one gesture.

**Request**

```json
{
  "userMessage": { "text": "Try path A" },
  "expectedVersion": 7,
  "forkFromNodeId": "n_anchor", // optional
  "newBranchName": "explore-A",
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
  "version": 9,
  "branch": { "id":"br_new", "...":"..." }           // only when forked
}

```

**Server TX**

- (optional) create branch
- **append user** (emit `userItem`)
- stream assistant; on `final`: **append assistant**, advance tip (CAS), touch graph

**Failure mid-stream**

- If user item committed and generation fails: keep user item, emit `error`, client may call
  `generate:stream` to complete.

---

### POST `/api/v1/branches/{branchId}/inject`

Create (or reuse) a node for a user-owned block and add a `references` edge from the current tip.

**Request**

```json
{ "blockId": "b_lib_7", "reuseExistingNode": true }
```

**200**

```json
{ "reference": { "nodeId":"n_ctx1","block":{ "id":"b_lib_7","kind":"user","content":{...},"public":true } } }

```

**Policy (MVP):** any user-owned block is allowed (library UI lists `public=true` by default).

---

### POST `/api/v1/branches/{branchId}/replace-tip`

Replace last message while preserving history.

**Request**

```json
{ "newContent": { "text": "Updated text" }, "expectedVersion": 4 }
```

**200**

```json
{
  "item": {
    "nodeId": "n_3",
    "block": { "id": "b_3", "kind": "user", "content": { "text": "Updated text" } }
  },
  "newTip": "n_3",
  "version": 5
}
```

**Server TX**

- find incoming `follows` to tip (parent → tip); soft-delete that edge
- create new block/node; insert `follows parent→new` with same `ord`
- CAS tip/version

---

### POST `/api/v1/branches/{branchId}/jump`

Move tip to a previous node on the branch path.

**Request**

```json
{ "toNodeId": "n_5", "expectedVersion": 5 }
```

**200**

```json
{ "branch": { "id": "br_1", "tipNodeId": "n_5", "version": 6 } }
```

**Server TX**

- verify `toNodeId` reachable from `rootNodeId` via `follows`
- CAS tip/version

---

## Node Deletion

### DELETE `/api/v1/nodes/{nodeId}`

**Semantics (MVP):**

Soft-delete the node (`hiddenAt=now()`), soft-delete **all** `references` touching it (default), and
**retarget** any branch whose **tip** equals this node to the node’s **incoming `follows` parent**
(if present). Deleting a **branch root** is **blocked**.

**Optional body**

```json
{
  "removeReferences": true, // default true
  "expectedVersions": { "br_main": 7 } // CAS for branches whose tip may move
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
      { "branchId": "br_main", "oldTip": "n_123", "newTip": "n_parent", "version": 8 }
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
    "details": { "branchIds": ["br_main", "br_explore"] }
  }
}
```

**Notes**

- If `expectedVersions[branchId]` is provided and mismatches when moving a tip, respond
  `409 CONFLICT_TIP_MOVED` with current version/tip.
- We do **not** change roots in MVP. Client must re-root/delete branch first if needed.
- We do **not** remove `follows` edges; hidden nodes are skipped by reads.

---

## Reads

### GET `/api/v1/branches/{branchId}/linear`

Walk `follows` from root (or `cursorNodeId`) and return timeline items.

**Query**

- `limit` (default 50, max 200)
- `cursorNodeId` (optional; inclusive)
- `include=references` (optional)
- `direction=forward|backward` (future; default `forward`)

**200**

```json
{
  "items": [
    {
      "nodeId":"n_1",
      "block": { "id":"b_1","kind":"user","content":{"text":"Let's begin"} },
      "references": [ { "nodeId":"n_ctx1","block":{ "id":"b_lib_7","kind":"user","content":{...} } } ]
    }
  ],
  "nextCursor":"n_51"
}

```

**Notes**

- Exclude nodes with `hiddenAt` and edges with `deletedAt`.
- `ord` orders children. If multiple `follows` from a parent exist, follow `ord`.

---

### GET `/api/v1/nodes/{nodeId}/references`

List `references` children for a node.

**Query**

- `limit` (default 20, max 100)
- `cursor`

**200**

```json
{ "items":[ { "nodeId":"n_ctx1","block":{ "id":"b_lib_7","kind":"user","content":{...} } } ], "nextCursor": null }

```

---

## Library

### GET `/api/v1/blocks`

List user’s blocks.

**Query**

- `public=true|false` (default `true`)
- `kind=user|assistant` (optional)
- `q` (optional text search)
- `limit`, `cursor`

**200**

```json
{ "items":[ { "id":"b_lib_7","kind":"user","public":true,"content":{...},"createdAt":"..." } ], "nextCursor": null }

```

---

### POST `/api/v1/blocks/ensure`

Idempotent add to library (upsert by checksum).

**Request**

```json
{ "kind": "user", "content": { "text": "Guidelines" }, "checksum": "sha256:...", "public": true }
```

**200**

```json
{ "block": { "id": "b_lib_7", "kind": "user", "public": true, "checksum": "sha256:..." } }
```

---

# Validation & Invariants

### Shared

- Every path ID must resolve to a user-owned resource.
- Request body ≤ **256 KB** (non-stream).
- `content.text`: 1..8000 chars.
- References per node capped at **32**.

### Append

- `author` required; `model` only when `author="assistant"`.
- Add `follows tip→new`; guard against cycles (should be impossible with new node).
- CAS against `expectedVersion` if provided; else proceed (single-user).

### Generate / Send

- On `final`, commit assistant node, add `follows`, CAS tip/version, touch graph.
- If stream fails after user item in `send:stream`, keep the user item.

### Inject

- `blockId` must be owned by user; `public` **not** required by API (UI defaults to public).
- If `reuseExistingNode=true`, reuse a visible node with same `blockId` in the graph.

### ReplaceTip

- Tip cannot be root without a parent (handle as error or “replace root” policy).
- Preserve `ord` of replaced edge.
- CAS tip/version.

### Jump

- Validate reachability (root →\* toNodeId) by recursive CTE.
- CAS tip/version.

### Delete Node

- Forbid deleting any node that is `rootNodeId` for a branch.
- If node is a **tip**, move branch tip to the node’s **incoming `follows` parent** (MVP assumes ≤1
  parent).
- Soft-delete `references` touching the node (`removeReferences=true` default).
- Keep `follows` edges; linear reads skip hidden nodes.

---

# Streaming Contracts (SSE)

### `/api/v1/branches/{id}/generate/stream`

- **Events:** `delta` (token), `final` (assistantItem, newTip, version[, branch]), `error`,
  `keepalive`

### `/api/v1/branches/{id}/send/stream`

- **Events:** `userItem` (persisted user message), `delta` (token), `final` (assistantItem, newTip,
  version[, branch]), `error`, `keepalive`

**Headers:** `Accept: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`

**Reconnects:** if no `final`, clients should retry with the same `Idempotency-Key`.

---

# Pagination

- Every list returns `{ items, nextCursor }`
- Use forward-only cursors (`cursor=<lastSeenId>`)
- For `:linear`, cursor is the **last returned `nodeId`**

---

# Idempotency

- First successful response is cached by `(userId, method, path, key)` for 24h.
- Replays return cached status + body.
- Concurrent request with same key → either wait or respond `202 Accepted`.
- Persist in Postgres; prune with daily job.
- For streams, cache the **final** payload.

---

# Status Codes

- `200 OK` – successful read/intent completion
- `201 Created` – (optional) if you prefer for create routes
- `202 Accepted` – in-flight idempotency collision (optional)
- `400 Bad Request` – validation errors (`DAG_CYCLE`, `INVALID_REACHABILITY`)
- `401 Unauthorized` / `403 Forbidden` – auth/authz
- `404 Not Found`
- `409 Conflict` – `CONFLICT_TIP_MOVED`, duplicate names, `CANNOT_DELETE_BRANCH_ROOT`
- `413 Payload Too Large`
- `429 Too Many Requests`
- `5xx` – server faults

---

# Example Flows

### Start → Send turn → Inject → Replace → Generate

1. **Start**

   `POST /api/v1/graphs/start` → `{ graph, branch, items:[root] }`

2. **Send**

   `POST /api/v1/branches/{br}/send/stream` → `userItem` … `final{assistantItem,newTip,version}`

3. **Inject**

   `POST /api/v1/branches/{br}/inject` `{ blockId:"b_lib_7" }` → `{ reference }`

4. **ReplaceTip**

   `POST /api/v1/branches/{br}/replace-tip` `{ newContent:{text:"Edited"}, expectedVersion }`

5. **Generate** (assistant-only)

   `POST /api/v1/branches/{br}/generate/stream` → `delta` … `final{assistantItem,...}`

### Fork + instruction, then generate

1. **Append w/ fork**

   `POST /api/v1/branches/{br}/append`
   `{ forkFromNodeId:"n_anchor", newBranchName:"explore-A", author:"user", content:{text:"Use 3 steps"} }`

   → `{ branch, item }`

2. **Generate on new branch**

   `POST /api/v1/branches/{branch.id}/generate/stream`

### Delete last node (tip moves back)

- `DELETE /api/v1/nodes/{n_tip}` `{ "expectedVersions": { "br_main": 7 } }` →
  `{ retargetedTips:[{branchId:"br_main", oldTip:"n_tip", newTip:"n_parent", version:8}] }`
