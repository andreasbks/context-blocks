import { z } from "zod";

import {
  BranchSchema,
  ContextBlockSchema,
  GraphSchema,
  PaginatedSchema,
  TimelineItemSchema,
} from "./shared";

export const StartGraphResponse = z.object({
  graph: GraphSchema.pick({
    id: true,
    title: true,
    createdAt: true,
    lastActivityAt: true,
  }).partial({ lastActivityAt: true }),
  branch: BranchSchema.pick({
    id: true,
    graphId: true,
    name: true,
    rootNodeId: true,
    tipNodeId: true,
    version: true,
    createdAt: true,
  }),
  items: z.array(TimelineItemSchema.pick({ nodeId: true, block: true })),
});

export const AppendResponse = z.object({
  item: TimelineItemSchema.pick({ nodeId: true, block: true }),
  newTip: z.string(),
  version: z.number().int(),
});

export const AppendForkResponse = z.object({
  branch: BranchSchema.pick({
    id: true,
    graphId: true,
    name: true,
    rootNodeId: true,
    tipNodeId: true,
    version: true,
  }),
  item: TimelineItemSchema.pick({ nodeId: true, block: true }),
});

export const InjectResponse = z.object({
  reference: z.object({ nodeId: z.string(), block: ContextBlockSchema }),
});

export const ReplaceTipResponse = AppendResponse;

export const JumpResponse = z.object({
  branch: BranchSchema.pick({ id: true, tipNodeId: true, version: true }),
});

export const DeleteNodeResponse = z.object({
  nodeId: z.string(),
  hiddenAt: z.string(),
  affected: z.object({
    deletedEdges: z.number().int().nonnegative(),
    retargetedTips: z.array(
      z.object({
        branchId: z.string(),
        oldTip: z.string(),
        newTip: z.string().nullable(),
        version: z.number().int(),
      })
    ),
  }),
});

export const GraphsListResponse = PaginatedSchema(
  GraphSchema.pick({
    id: true,
    title: true,
    createdAt: true,
    lastActivityAt: true,
  })
);

export const GraphDetailResponse = z.object({
  graph: GraphSchema.pick({
    id: true,
    title: true,
    createdAt: true,
    lastActivityAt: true,
  }),
  branches: z.array(
    BranchSchema.pick({
      id: true,
      name: true,
      rootNodeId: true,
      tipNodeId: true,
      version: true,
    })
  ),
});

export const BlocksListResponse = PaginatedSchema(
  z.object({
    id: z.string(),
    kind: z.enum(["user", "assistant"]),
    content: z.unknown(),
    public: z.boolean(),
    createdAt: z.string(),
    checksum: z.string().nullable().optional(),
    model: z.string().nullable().optional(),
  })
);

export const LinearResponse = z.object({
  items: z.array(
    z.object({
      nodeId: z.string(),
      block: ContextBlockSchema,
      references: z
        .array(z.object({ nodeId: z.string(), block: ContextBlockSchema }))
        .optional(),
    })
  ),
  nextCursor: z.string().nullable(),
});

export const NodeRefsResponse = z.object({
  items: z.array(z.object({ nodeId: z.string(), block: ContextBlockSchema })),
  nextCursor: z.string().nullable(),
});

export const EnsureBlockResponse = z.object({
  block: ContextBlockSchema,
});
