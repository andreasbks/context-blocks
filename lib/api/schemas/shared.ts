import { z } from "zod";

import { BlockKindSchema, ErrorCodeSchema } from "./enums";

export const MessageContentSchema = z.object({
  text: z.string().min(1).max(8000),
  annotations: z
    .array(
      z.object({
        type: z.literal("reference"),
        nodeId: z.string().optional(),
        blockId: z.string().optional(),
        note: z.string().optional(),
      })
    )
    .max(32)
    .optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export const ErrorEnvelopeSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

// Resource objects (response shapes)
export const GraphSchema = z.object({
  id: z.string(),
  userId: z.string().optional(),
  title: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  lastActivityAt: z.string().optional(),
});

export const BranchSchema = z.object({
  id: z.string(),
  graphId: z.string(),
  name: z.string(),
  rootNodeId: z.string().nullable().optional(),
  tipNodeId: z.string().nullable().optional(),
  version: z.number().int().nonnegative().optional(),
  createdAt: z.string().optional(),
});

export const ContextBlockSchema = z.object({
  id: z.string(),
  userId: z.string().optional(),
  kind: BlockKindSchema,
  content: MessageContentSchema.or(z.unknown()),
  model: z.string().nullable().optional(),
  tokenCount: z.number().int().nonnegative().nullable().optional(),
  checksum: z.string().nullable().optional(),
  public: z.boolean(),
  createdAt: z.string().optional(),
});

export const GraphNodeSchema = z.object({
  id: z.string(),
  graphId: z.string(),
  blockId: z.string(),
  hiddenAt: z.string().nullable().optional(),
});

export const TimelineItemSchema = z.object({
  nodeId: z.string(),
  block: ContextBlockSchema,
  references: z
    .array(z.object({ nodeId: z.string(), block: ContextBlockSchema }))
    .optional(),
});

export function PaginatedSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({ items: z.array(item), nextCursor: z.string().nullable() });
}
