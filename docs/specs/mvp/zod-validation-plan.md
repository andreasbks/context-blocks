### Zod Validation Plan – Requests, Responses, and SSE Events

This document proposes a concrete plan to add complete Zod-based type validation for the backend
(API handlers and SSE) and to generate safe types for the frontend (request/response/event
contracts). It aligns with `docs/specs/mvp/mvp-api-spec.md` and the current route implementations.

---

## Objectives

- Ensure every API request body and query param is validated with Zod.
- Ensure every API response (JSON) conforms to a Zod schema that mirrors the spec.
- Ensure every SSE event payload (`item`, `delta`, `final`, `error`, `keepalive`) conforms to Zod
  schemas.
- Generate TypeScript types from schemas for end-to-end type safety in frontend and backend.
- Provide shared helper utilities for parse/validate patterns and error envelopes.

---

## Scope (Endpoints & Streams)

- Graphs
  - POST `/api/v1/graphs/start` (JSON)
  - GET `/api/v1/graphs` (query: pagination)
  - GET `/api/v1/graphs/{graphId}` (path param)
- Branch intents
  - POST `/api/v1/branches/{branchId}/append` (JSON)
  - POST `/api/v1/branches/{branchId}/generate/stream` (SSE)
  - POST `/api/v1/branches/{branchId}/send/stream` (SSE)
  - POST `/api/v1/branches/{branchId}/inject` (JSON)
  - POST `/api/v1/branches/{branchId}/replace-tip` (JSON)
  - POST `/api/v1/branches/{branchId}/jump` (JSON)
- Node deletion
  - DELETE `/api/v1/nodes/{nodeId}` (JSON body optional)
- Reads
  - GET `/api/v1/branches/{branchId}/linear` (query)
  - GET `/api/v1/nodes/{nodeId}/references` (query)
- Library
  - GET `/api/v1/blocks` (query)
  - POST `/api/v1/blocks/ensure` (JSON)

---

## Shared Schemas (Backend-first, exported for FE)

split into dedicated files under `lib/api/schemas/`

- Enums: `BlockKindSchema = z.enum(["user", "assistant"])`,
  `RelationTypeSchema = z.enum(["follows", "references"])`.
- `MessageContentSchema` (already present): keep limits per spec (text 1..8000, annotations max 32).
- Error envelope:
  - `ErrorCodeSchema = z.enum(["FORBIDDEN","NOT_FOUND","VALIDATION_FAILED","DAG_CYCLE","INVALID_REACHABILITY","CONFLICT_TIP_MOVED","CANNOT_DELETE_BRANCH_ROOT","IDEMPOTENCY_REPLAY","RATE_LIMITED","INTERNAL"])`.
  - `ErrorEnvelopeSchema = z.object({ error: z.object({ code: ErrorCodeSchema, message: z.string(), details: z.unknown().optional() }) })`.
- Resource shapes (server → client): `GraphSchema`, `BranchSchema`, `ContextBlockSchema`,
  `GraphNodeSchema`, `BlockEdgeSchema`, `TimelineItemSchema` with minimal fields per spec.
- Pagination envelope: `PaginatedSchema(itemsSchema)` helper → `{ items, nextCursor }`.

Notes:

- Keep server-internal fields out of response schemas; only define what API returns.
- Prefer narrow types over wide `unknown` where feasible (e.g., `model` can be
  `z.string().nullable()` as implemented).

---

## Request Validation Coverage

Already present (keep):

- `StartGraphBody`, `AppendBody`, `InjectBody`, `ReplaceTipBody`, `GenerateStreamBody`,
  `SendStreamBody`, `JumpBody`, `DeleteNodeBody`, `EnsureBlockBody`.

To add:

- Query param schemas
  - `PaginationQuery = z.object({ limit: z.number().int().positive().max(100).default(20), cursor: z.string().optional() })`.
  - `GraphsListQuery` extends `PaginationQuery` with `limit.max(100)`.
  - `BlocksListQuery = PaginationQuery.extend({ public: z.boolean().default(true), kind: z.enum(["user","assistant"]).optional(), q: z.string().min(1).max(256).optional() })`.
  - `LinearQuery = z.object({ limit: z.number().int().positive().max(200).default(50), cursorNodeId: z.string().optional(), include: z.enum(["references"]).array().optional() })`.
  - `NodeRefsQuery = PaginationQuery`.
- Path params schemas
  - `BranchIdParam = z.object({ branchId: z.string() })`,
    `GraphIdParam = z.object({ graphId: z.string() })`,
    `NodeIdParam = z.object({ nodeId: z.string() })`.

Implementation pattern per handler:

- Use a common `parseJson<T>(req, schema)` helper that returns `{ ok, data } | Response` using
  `Errors.validation` on failure.
- For query params and path params, use dedicated parsers: `parseQuery(urlSearchParams, schema)`,
  `parseParams(paramsPromise, schema)`.

---

## Response Validation Coverage

Define response schemas per endpoint and validate before returning. Examples:

- Start graph:
  `StartGraphResponse = z.object({ graph: GraphSchema.pick({ id:true, title:true, createdAt:true, lastActivityAt:true }), branch: BranchSchema.pick({ id:true, graphId:true, name:true, rootNodeId:true, tipNodeId:true, version:true, createdAt:true }), items: z.array(TimelineItemSchema.pick({ nodeId:true, block:true })) })`.
- Append (no fork):
  `AppendResponse = z.object({ item: TimelineItemSchema.pick({ nodeId:true, block:true }), newTip: z.string(), version: z.number().int() })`.
- Append (forked):
  `AppendForkResponse = z.object({ branch: BranchSchema.pick({ id:true, graphId:true, name:true, rootNodeId:true, tipNodeId:true, version:true }), item: TimelineItemSchema.pick({ nodeId:true, block:true }) })`.
- Inject: `{ reference: z.object({ nodeId: z.string(), block: ContextBlockSchema }) }`.
- ReplaceTip: same shape as Append (no fork).
- Jump: `{ branch: BranchSchema.pick({ id:true, tipNodeId:true, version:true }) }`.
- Delete node: `DeleteNodeResponse` per spec with `affected.deletedEdges` and `retargetedTips`.
- Graphs list:
  `PaginatedSchema(GraphSchema.pick({ id:true, title:true, createdAt:true, lastActivityAt:true }))`.
- Graph detail:
  `{ graph: GraphSchema.pick(...), branches: z.array(BranchSchema.pick({ id:true, name:true, rootNodeId:true, tipNodeId:true, version:true })) }`.
- Blocks list:
  `PaginatedSchema(z.object({ id:z.string(), kind:BlockKindSchema, content:z.unknown(), public:z.boolean(), createdAt:z.string(), checksum:z.string().nullable().optional(), model: z.string().nullable().optional() }))`.

Pattern:

- Call `schema.parse(...)` on the object composed from DB results just before sending.
- In development, always parse; in production, optionally guard by env flag if needed.

---

## SSE Event Validation

Shared event schemas:

- `SSEKeepalive = z.object({})`.
- `SSEItem = z.object({ role: z.enum(["user","assistant"]), item: z.object({ nodeId: z.string(), block: ContextBlockSchema }) })`.
- `SSEDelta = z.object({ text: z.string() })`.
- `SSEFinal = z.object({ items: z.array(SSEItem), newTip: z.string().optional(), version: z.number().int().optional(), branch: z.object({ id:z.string() }).passthrough().optional() })`.
- `SSEError = ErrorEnvelopeSchema`.

Implementation:

- Before writing any SSE payload, call the relevant schema’s `parse(payload)`.
- Wrap `writeEventSafe` with a `writeEvent(schema, name, payload)` helper that validates then
  writes.

---

## Utilities and Conventions

- Add `lib/api/validators.ts` with helpers:
  - `parseJson(req, schema)` – returns `{ ok:true, data } | Response`.
  - `parseParams(paramsPromise, schema)` – validates dynamic route params.
  - `parseQuery(url, schema)` – parses/normalizes query string values to numbers/booleans and
    validates.
  - `validateAndSend(resBody, schema)` – validates and returns `Response` with JSON headers
    (dev-time enforcement).
  - `writeSSE(schema, eventName, payload, sse)` – validates and writes SSE.

Environment flag:

- `VALIDATE_RESPONSES=strict|dev|off` to control server-side response validation cost.

---

## Frontend Type Safety

- Export all Zod schemas via an index barrel `lib/api/schemas/index.ts`.
- Frontend imports types with `z.infer<typeof Schema>` for requests/responses/SSE events.

---

## Step-by-Step Implementation Plan

1. Schemas

- Add enums, resource, pagination, error, SSE schemas to `lib/api/validation.ts` (or split into
  `lib/api/schemas/*`).

2. Helpers

- Add `lib/api/validators.ts` with `parseJson`, `parseParams`, `parseQuery`, `validateAndSend`,
  `writeSSE`.

3. Requests (already mostly done)

- Keep using existing body schemas per route.
- Add param/query validation to all GET/DELETE routes and any path-param POST routes.

4. Responses

- Implement per-route response schemas.
- Validate composed response bodies with `validateAndSend` before returning.

5. SSE

- Use `writeSSE` in `generate/stream` and `send/stream` for `item`, `delta`, `final`, `error`,
  `keepalive`.

6. Frontend

- Export schemas; replace ad-hoc types with `z.infer` types.

---

## Mapping Gaps → Actions

- Query param validation missing in GET routes → add `parseQuery` + schemas.
- Path param validation missing → add `parseParams` for `{branchId}`, `{graphId}`, `{nodeId}`.
- Response validation missing globally → add per-route response schemas + `validateAndSend`.
- SSE payloads not validated → adopt `writeSSE` wrapper with event schemas.

---

## Non-Goals (MVP)

- Server-side strict validation of every internal DB shape (we validate the API contract
  boundaries).
- Exhaustive `model` enum; keep as `string | null` until model catalog stabilizes.
