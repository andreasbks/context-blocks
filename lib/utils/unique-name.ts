import { prisma } from "@/lib/db";

/**
 * Ensures a graph title is unique for a given user by appending (2), (3), etc. if needed.
 * Returns the unique title that can be safely used.
 */
export async function ensureUniqueGraphTitle(
  userId: string,
  desiredTitle: string
): Promise<string> {
  // Check if the base title exists
  const existing = await prisma.graph.findFirst({
    where: {
      userId,
      title: desiredTitle,
    },
  });

  if (!existing) {
    return desiredTitle;
  }

  // Find the next available number
  let counter = 2;
  let candidateTitle = `${desiredTitle} (${counter})`;

  while (true) {
    const exists = await prisma.graph.findFirst({
      where: {
        userId,
        title: candidateTitle,
      },
    });

    if (!exists) {
      return candidateTitle;
    }

    counter++;
    candidateTitle = `${desiredTitle} (${counter})`;

    // Safety check to prevent infinite loops
    if (counter > 1000) {
      console.error("Failed to find unique graph title after 1000 attempts");
      return `${desiredTitle} (${Date.now()})`;
    }
  }
}

/**
 * Ensures a branch name is unique within a graph by appending (2), (3), etc. if needed.
 * Returns the unique name that can be safely used.
 */
export async function ensureUniqueBranchName(
  graphId: string,
  desiredName: string
): Promise<string> {
  // Check if the base name exists
  const existing = await prisma.branch.findUnique({
    where: {
      graphId_name: {
        graphId,
        name: desiredName,
      },
    },
  });

  if (!existing) {
    return desiredName;
  }

  // Find the next available number
  let counter = 2;
  let candidateName = `${desiredName} (${counter})`;

  while (true) {
    const exists = await prisma.branch.findUnique({
      where: {
        graphId_name: {
          graphId,
          name: candidateName,
        },
      },
    });

    if (!exists) {
      return candidateName;
    }

    counter++;
    candidateName = `${desiredName} (${counter})`;

    // Safety check to prevent infinite loops
    if (counter > 1000) {
      console.error("Failed to find unique branch name after 1000 attempts");
      return `${desiredName} (${Date.now()})`;
    }
  }
}
