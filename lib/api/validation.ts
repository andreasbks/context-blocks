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

export const GenerateStreamBody = z.object({
  expectedVersion: z.number().int().nonnegative().optional(),
  forkFromNodeId: z.string().nullable().optional(),
  newBranchName: z.string().max(120).optional(),
  generation: z.record(z.string(), z.unknown()).optional(),
});

export type GenerateStreamInput = z.infer<typeof GenerateStreamBody>;

export const SendStreamBody = z.object({
  userMessage: MessageContentSchema,
  expectedVersion: z.number().int().nonnegative().optional(),
  forkFromNodeId: z.string().nullable().optional(),
  newBranchName: z.string().max(120).optional(),
  generation: z.record(z.string(), z.unknown()).optional(),
});

export type SendStreamInput = z.infer<typeof SendStreamBody>;

export const JumpBody = z.object({
  toNodeId: z.string(),
  expectedVersion: z.number().int().nonnegative().optional(),
});

export type JumpInput = z.infer<typeof JumpBody>;

export const DeleteNodeBody = z.object({
  removeReferences: z.boolean().optional(),
  expectedVersions: z
    .record(z.string(), z.number().int().nonnegative())
    .optional(),
});

export type DeleteNodeInput = z.infer<typeof DeleteNodeBody>;

export const EnsureBlockBody = z.object({
  kind: z.enum(["user", "assistant"]),
  content: MessageContentSchema,
  checksum: z.string().max(256).optional(),
  public: z.boolean().optional(),
  model: z.string().nullable().optional(),
});

export type EnsureBlockInput = z.infer<typeof EnsureBlockBody>;
