# Frontend MVP Plan (Context Blocks)

## 1) API readiness snapshot

- Present routes (match spec):
  - Graphs: POST `/api/v1/graphs/start`, GET `/api/v1/graphs`, GET `/api/v1/graphs/{graphId}`
  - Branch intents: POST `/api/v1/branches/{branchId}/{append|inject|replace-tip|jump}`
  - Streaming: POST `/api/v1/branches/{branchId}/generate/stream`, POST
    `/api/v1/branches/{branchId}/send/stream`
  - Reads: GET `/api/v1/branches/{branchId}/linear`, GET `/api/v1/nodes/{nodeId}/references`
  - Library: GET `/api/v1/blocks`, POST `/api/v1/blocks/ensure`
  - Deletion: DELETE `/api/v1/nodes/{nodeId}`
- Unified SSE contract implemented:
  - `item` → `{ role: "user"|"assistant", item: { nodeId, block } }`
  - `delta` → `{ text }`
  - `final` → `{ items: [...], newTip, version[, branch] }`
  - `error` → standard error envelope
- Idempotency + rate limits are wired; Clerk auth enforced.
- Missing for MVP: none critical. Optional later: generated OpenAPI JSON from Zod v4.

## 2) MVP user journeys

1. Graphs list (dashboard)

- View graphs ordered by `lastActivityAt`
- Create graph (title + first message) → navigate to chat view

2. Chat view (single branch timeline)

- Linear items from root→tip
- Composer to send user message (send/stream)
- Live deltas; final advances tip
- Item actions: Fork from here, Replace tip, Jump, Inject reference, Delete
- Branch switcher when multiple branches exist

3. Library

- List reusable blocks (public)
- Inject selected block as reference into the current tip
- Ensure library block (optional checksum)

## 3) App structure (Next.js App Router)

Pages

- `app/dashboard/page.tsx` — graphs list + start graph modal
- `app/chat/[branchId]/page.tsx` — chat view (timeline + composer + toolbar)

Core components

- `Timeline` (virtualized list)
- `TimelineItem` (renders block text + annotations + references)
- `Composer` (input + send)
- `BranchSwitcher`
- Dialogs: `ForkDialog`, `InjectDialog`, `ReplaceTipDialog`, `JumpDialog`, `DeleteConfirm`
- `StreamingIndicator`

Styling

- Tailwind; respect light/dark (next-themes). Use `next/font` already configured.

## 4) Data layer (TanStack Query)

Query keys

- Graphs: `['graphs', { cursor }]`
- Graph detail (branches): `['graph', graphId]`
- Branch linear: `['branchLinear', branchId, { cursor, include }]`
- Node references: `['nodeRefs', nodeId, { cursor }]`
- Blocks: `['blocks', { public, kind, q, cursor }]`

Mutations

- `startGraph(body)` → POST `/graphs/start`
- `append(body)` → POST `/branches/{id}/append`
- `replaceTip(body)` → POST `/branches/{id}/replace-tip`
- `jump(body)` → POST `/branches/{id}/jump`
- `inject(body)` → POST `/branches/{id}/inject`
- `deleteNode(nodeId, body?)` → DELETE `/nodes/{nodeId}`

Streaming helpers

- `sendStream({ branchId, body, onItem, onDelta, onFinal, onError, signal })`
- `generateStream({ branchId, body, onDelta, onFinal, onError, signal })`
- Always pass an `Idempotency-Key` (UUID) per attempt; abort on unmount.

State updates

- `item` (user): add persisted user item immediately; scroll to bottom
- `delta`: update in-flight assistant bubble content
- `final`: replace in-flight with committed assistant item; update tip/version; invalidate
  `branchLinear`
- `error`: toast + inline banner; if user item exists (send flow), offer regenerate

## 5) Screen flows

Graphs list

- GET `/graphs` paginate
- Start graph → POST `/graphs/start` → route to `/chat/{branchId}`

Chat view

- Initial load: GET `/branches/{branchId}/linear?limit=50`
- Infinite backscroll: use `cursorNodeId`
- Send turn: POST `/branches/{id}/send/stream` with
  `{ userMessage, expectedVersion, [forkFromNodeId,newBranchName] }`
- Generate: POST `/branches/{id}/generate/stream` with
  `{ expectedVersion, [forkFromNodeId,newBranchName] }`
- Replace tip: POST `/branches/{id}/replace-tip` → invalidate timeline
- Jump: POST `/branches/{id}/jump` → invalidate timeline
- Inject: pick from library → POST `/branches/{id}/inject` → invalidate timeline and node refs
- Delete: DELETE `/nodes/{nodeId}` → invalidate timeline

Library

- GET `/blocks?public=true&limit=50`
- Ensure block: POST `/blocks/ensure`

## 6) Error UX

- Map known codes: `CONFLICT_TIP_MOVED`, `RATE_LIMITED`, `VALIDATION_FAILED`, etc.
- Provide retry/refresh affordances; show `Retry-After` where relevant.

## 7) Performance & a11y

- Virtualize timeline; windowed rendering
- Keep SSE buffers and UI updates incremental; avoid re-render storms
- Keyboard shortcuts (submit, navigate items), aria labels

## 8) Type safety

- Import shared Zod types for envelopes: `ItemEnvelope`, `FinalEnvelope`, `DeltaPayload`,
  `ErrorEnvelope`
- Derive request body types from Zod (`z.infer`) for form inputs

## 9) Milestones & checklist

1. Scaffolding

- [ ] Route segments & navigation
- [ ] Query client/devtools setup

2. Graphs list

- [ ] List + pagination
- [ ] Start graph modal → route to chat

3. Chat view

- [ ] Timeline (virtualized) + item rendering
- [ ] SSE client helper (with idempotency + abort)
- [ ] send/stream integration (item/delta/final)
- [ ] generate/stream integration (delta/final)
- [ ] Toolbar flows: fork, replace tip, jump, inject, delete

4. Library

- [ ] List/paginate blocks
- [ ] Inject reference flow
- [ ] Ensure block flow (optional)

5. Error handling

- [ ] Global envelope mapping + toasts
- [ ] Conflict resolution UI for tip moved

6. Polish

- [ ] Loading skeletons
- [ ] Empty states
- [ ] Shareable deep links (branch URL)

## 10) Future (post-MVP)

- Merge UI & branch compare
- Better library search/tagging
- Presence/collaboration
- OpenAPI JSON endpoint (Zod v4 compatible generator) for client typings/docs

---

This plan aligns the frontend tightly with the current API and the unified SSE contract, minimizing
client complexity while keeping room for DAG-powered features later.
