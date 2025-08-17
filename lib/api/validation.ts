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
