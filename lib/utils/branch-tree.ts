// Use a flexible branch type that works with various API responses
export type Branch = {
  id: string;
  graphId?: string;
  name: string;
  rootNodeId?: string | null;
  tipNodeId?: string | null;
  version?: number;
  createdAt?: string;
};

export interface BranchNode {
  branch: Branch;
  children: BranchNode[];
  depth: number;
  isActive: boolean;
  isInActivePath: boolean;
}

/**
 * Builds a hierarchical tree structure from a flat array of branches.
 * The tree is organized by parent-child relationships based on rootNodeId.
 *
 * @param branches - Flat array of branches from the API
 * @param activeBranchId - ID of the currently active branch
 * @returns Array of root-level branch nodes with nested children
 */
export function buildBranchTree(
  branches: Branch[],
  activeBranchId: string | null
): BranchNode[] {
  if (!branches.length) return [];

  // Create a map for quick lookup
  const branchMap = new Map<string, Branch>();
  branches.forEach((branch) => branchMap.set(branch.id, branch));

  // Find the active path (from root to active branch)
  const activePath = new Set<string>();
  if (activeBranchId) {
    activePath.add(activeBranchId);
    // We'll mark the path after building the tree
  }

  // Group branches by their parent (rootNodeId)
  const branchesByParent = new Map<string | null, Branch[]>();

  branches.forEach((branch) => {
    // Find parent branch: a branch whose tipNodeId or any node matches this branch's rootNodeId
    const parentKey = findParentKey(branch, branches);

    if (!branchesByParent.has(parentKey)) {
      branchesByParent.set(parentKey, []);
    }
    branchesByParent.get(parentKey)!.push(branch);
  });

  // Build tree recursively starting from root branches
  const buildNode = (
    branch: Branch,
    depth: number,
    isInActivePath: boolean
  ): BranchNode => {
    const childBranches = branchesByParent.get(branch.id) || [];
    const children = childBranches.map((child) =>
      buildNode(child, depth + 1, isInActivePath || activePath.has(child.id))
    );

    return {
      branch,
      children,
      depth,
      isActive: branch.id === activeBranchId,
      isInActivePath: isInActivePath || branch.id === activeBranchId,
    };
  };

  // Root branches are those with no parent or with rootNodeId = null
  const rootBranches = branchesByParent.get(null) || [];

  // If no explicit root, find the oldest branch (usually "main")
  if (rootBranches.length === 0 && branches.length > 0) {
    const oldestBranch = branches.reduce((oldest, branch) => {
      if (!branch.createdAt) return oldest;
      if (!oldest.createdAt) return branch;
      return new Date(branch.createdAt) < new Date(oldest.createdAt)
        ? branch
        : oldest;
    });
    rootBranches.push(oldestBranch);
  }

  return rootBranches.map((branch) =>
    buildNode(branch, 0, activePath.has(branch.id))
  );
}

/**
 * Finds the parent branch key for a given branch.
 * A branch's parent is determined by matching rootNodeId to another branch's nodes.
 *
 * @param branch - The branch to find a parent for
 * @param allBranches - All available branches
 * @returns The parent branch ID or null if this is a root branch
 */
function findParentKey(branch: Branch, allBranches: Branch[]): string | null {
  if (!branch.rootNodeId) {
    return null;
  }

  // Find a branch that contains this rootNodeId
  // In our data model, if branch B forks from branch A at nodeId X,
  // then branch B's rootNodeId = X, and X belongs to branch A
  // We need to check which branch "owns" this nodeId

  // For now, we'll use a heuristic: look for branches with similar creation times
  // or whose rootNodeId matches the tipNodeId of another branch
  for (const potentialParent of allBranches) {
    if (potentialParent.id === branch.id) continue;

    // If this branch's rootNodeId equals another branch's tipNodeId,
    // that branch is likely the parent (though not always, since tips change)
    if (potentialParent.tipNodeId === branch.rootNodeId) {
      return potentialParent.id;
    }
  }

  // If we can't find a direct match, check if there's a "main" branch
  // Branches without a clear parent likely fork from main
  const mainBranch = allBranches.find(
    (b) => b.name.toLowerCase() === "main" || !b.rootNodeId
  );

  if (mainBranch && mainBranch.id !== branch.id) {
    return mainBranch.id;
  }

  return null;
}

/**
 * Flattens a tree structure into a linear array for rendering.
 * Useful for non-recursive rendering with proper depth tracking.
 *
 * @param nodes - Array of root branch nodes
 * @returns Flattened array of branch nodes
 */
export function flattenBranchTree(nodes: BranchNode[]): BranchNode[] {
  const result: BranchNode[] = [];

  const flatten = (node: BranchNode) => {
    result.push(node);
    node.children.forEach(flatten);
  };

  nodes.forEach(flatten);
  return result;
}

/**
 * Gets a human-readable branch name with fallback.
 *
 * @param branch - The branch object
 * @returns Formatted branch name
 */
export function getBranchDisplayName(branch: Branch): string {
  return branch.name || "Unnamed Branch";
}
