# ADR 0002: Fix Chronological Ordering in Linear Timeline

**Date**: 2025-10-04  
**Status**: Accepted  
**Deciders**: Engineering Team

## Context

Users reported that messages in the timeline view were sometimes appearing in the wrong
chronological order. Investigation revealed that the `/api/v1/branches/{branchId}/linear` endpoint's
recursive CTE lacked explicit ordering, leading to non-deterministic traversal order when fetching
conversation history.

### Technical Details

The backend uses a PostgreSQL recursive CTE to walk the graph from root to tip following "follows"
edges:

```sql
with recursive walk(id) as (
    select $1::text as id
    union all
    select e."childNodeId" from walk
    join "BlockEdge" e on e."parentNodeId" = walk.id
    where e."graphId" = $2 and e."relation" = 'follows' and e."deletedAt" is null
)
select id as "nodeId" from walk
```

**Problems identified**:

1. No `ORDER BY` clause in the recursive part
2. No `ORDER BY` in the final select
3. PostgreSQL doesn't guarantee order in recursive CTEs without explicit ordering
4. If a node has multiple "follows" edges (due to data inconsistencies), order becomes random

### The `ord` Field

The schema includes an `ord` field on `BlockEdge` intended for ordering, but:

- All edge creation operations set `ord: 0`
- The field isn't being actively maintained or incremented
- It exists for future use cases (e.g., ordering multiple children)

## Decision

Implement **Option 3: Add Sequence Number to Walk CTE** for guaranteed chronological ordering.

### Solution

Add explicit sequence tracking in the recursive CTE to maintain deterministic traversal order:

```sql
with recursive walk(id, seq) as (
    select $1::text as id, 0 as seq
    union all
    select e."childNodeId", walk.seq + 1
    from walk
    join "BlockEdge" e on e."parentNodeId" = walk.id
    where e."graphId" = $2 and e."relation" = 'follows' and e."deletedAt" is null
)
select id as "nodeId" from walk
order by seq
```

The sequence number explicitly tracks traversal depth, ensuring messages appear in root-to-tip
order.

## Alternatives Considered

### Option 1: Use `ord` Field

- **Rejected**: Would require updating all edge creation logic to properly maintain `ord` values
- **Complexity**: Higher change scope across multiple endpoints

### Option 2: Order by `createdAt`

- **Rejected**: Relies on timestamp precision
- **Risk**: Could fail if multiple edges created in same transaction
- **Semantic issue**: Order should be logical (graph structure), not temporal

### Option 4: Frontend Sorting

- **Rejected**: Doesn't fix root cause
- **Maintenance**: Adds complexity to frontend and doesn't prevent backend issues

## Consequences

### Positive

- ✅ Deterministic, guaranteed chronological ordering
- ✅ Explicit sequence tracking eliminates ambiguity
- ✅ Minimal code change (single file)
- ✅ Uses existing recursive CTE pattern
- ✅ No schema changes required

### Negative

- ⚠️ Slightly more complex SQL (negligible performance impact)
- ⚠️ The `ord` field remains unused (but preserved for future flexibility)

### Future Considerations

The `ord` field should be:

- **Kept**: For future features requiring explicit child ordering (e.g., multiple branches from one
  node)
- **Documented**: As reserved for scenarios where graph structure requires manual ordering
- **Not removed**: Low maintenance cost, high future flexibility value

## Implementation

- **Files changed**: `app/api/v1/branches/[branchId]/linear/route.ts`
- **Testing**: Verify timeline order after multiple message sends
- **Rollback**: Simple - revert to previous query structure

## References

- Issue: Messages appearing in wrong chronological order
- Related: Schema includes `ord` field with index at `[graphId, parentNodeId, relation, ord]`
- Future: May utilize `ord` for advanced DAG features (merge branches, parallel paths)
