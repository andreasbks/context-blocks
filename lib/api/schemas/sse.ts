import { z } from "zod";

import { BranchSchema, ContextBlockSchema } from "./shared";

export const SSEKeepaliveSchema = z.object({});

export const SSEItemSchema = z.object({
  role: z.enum(["user", "assistant"]),
  item: z.object({ nodeId: z.string(), block: ContextBlockSchema }),
});

export const SSEDeltaSchema = z.object({ text: z.string() });

export const SSEFinalSchema = z.object({
  items: z.array(SSEItemSchema),
  newTip: z.string().optional(),
  version: z.number().int().optional(),
  branch: BranchSchema.pick({
    id: true,
    graphId: true,
    name: true,
    rootNodeId: true,
    tipNodeId: true,
    version: true,
  }).optional(),
});
