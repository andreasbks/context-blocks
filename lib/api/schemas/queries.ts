import { z } from "zod";

export const PaginationQuery = z.object({
  limit: z.number().int().positive().max(100).default(20),
  cursor: z.string().optional(),
});

export const GraphsListQuery = PaginationQuery.extend({});

export const BlocksListQuery = PaginationQuery.extend({
  public: z.boolean().default(true),
  kind: z.enum(["user", "assistant"]).optional(),
  q: z.string().min(1).max(256).optional(),
});

export const LinearQuery = z.object({
  limit: z.number().int().positive().max(200).default(50),
  cursorNodeId: z.string().optional(),
  include: z.string().optional(), // e.g., "references"
});

export const NodeRefsQuery = PaginationQuery;

export const BranchIdParam = z.object({ branchId: z.string() });
export const GraphIdParam = z.object({ graphId: z.string() });
export const NodeIdParam = z.object({ nodeId: z.string() });
