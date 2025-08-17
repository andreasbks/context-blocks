import { z } from "zod";

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

export const StartGraphBody = z.object({
  title: z.string().max(120).optional(),
  firstMessage: z.object({
    author: z.enum(["user", "assistant"]),
    content: MessageContentSchema,
    model: z.string().nullable().optional(),
  }),
  branchName: z.string().max(120).optional(),
});

export type StartGraphInput = z.infer<typeof StartGraphBody>;

export const AppendBody = z.object({
  author: z.enum(["user", "assistant"]),
  content: MessageContentSchema,
  model: z.string().nullable().optional(),
  expectedVersion: z.number().int().nonnegative().optional(),
  forkFromNodeId: z.string().optional(),
  newBranchName: z.string().max(120).optional(),
});

export type AppendInput = z.infer<typeof AppendBody>;

export const InjectBody = z.object({
  blockId: z.string(),
  reuseExistingNode: z.boolean().optional(),
});

export type InjectInput = z.infer<typeof InjectBody>;

export const ReplaceTipBody = z.object({
  newContent: MessageContentSchema,
  expectedVersion: z.number().int().nonnegative().optional(),
});

export type ReplaceTipInput = z.infer<typeof ReplaceTipBody>;
