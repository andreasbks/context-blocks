import { z } from "zod";

export const BlockKindSchema = z.enum(["user", "assistant"]);
export type BlockKind = z.infer<typeof BlockKindSchema>;

export const RelationTypeSchema = z.enum(["follows", "references"]);
export type RelationType = z.infer<typeof RelationTypeSchema>;

export const ErrorCodeSchema = z.enum([
  "FORBIDDEN",
  "NOT_FOUND",
  "VALIDATION_FAILED",
  "DAG_CYCLE",
  "INVALID_REACHABILITY",
  "CONFLICT_TIP_MOVED",
  "CANNOT_DELETE_BRANCH_ROOT",
  "IDEMPOTENCY_REPLAY",
  "QUOTA_EXCEEDED",
  "RATE_LIMITED",
  "INTERNAL",
]);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;
