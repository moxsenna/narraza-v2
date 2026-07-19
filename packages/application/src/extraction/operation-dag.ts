// Operation DAG with deterministic topological sort.
//
// Sort order (tie-break):
//   1. Op type (prose_accept always LAST)
//   2. Entity type (alphabetical)
//   3. Target ID (alphabetical)
//   4. Operation ID (alphabetical — fallback)

import type { DAGNode, NormalizedOperationDraft } from './types.js';

/**
 * Build a DAG from normalized operations and produce a deterministic
 * topological sort that respects the prose_accept ordering constraint.
 */
export function buildOperationDAG(
  normalizedOps: NormalizedOperationDraft[],
): DAGNode[] {
  return normalizedOps.map((op) => ({
    operationId: op.operationId,
    tempRef: op.tempRef,
    dependencies: op.resolvedDependencies,
  }));
}

/**
 * Deterministic topological sort using Kahn's algorithm.
 *
 * Tie-breaking priority:
 *   prose_accept ops always sorted last
 *   then by opIntent category
 *   then by targetType
 *   then by targetId
 *   then by operationId
 */
export function deterministicTopoSort(
  nodes: DAGNode[],
  opIntentMap: Map<string, string>,
  targetTypeMap: Map<string, string>,
  targetIdMap: Map<string, string>,
): string[] {
  // Build adjacency and in-degree
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const node of nodes) {
    inDegree.set(node.operationId, 0);
    adjacency.set(node.operationId, []);
  }

  for (const node of nodes) {
    for (const dep of node.dependencies) {
      if (adjacency.has(dep)) {
        adjacency.get(dep)!.push(node.operationId);
        inDegree.set(node.operationId, (inDegree.get(node.operationId) ?? 0) + 1);
      }
    }
  }

  // Initialize queue with all nodes having in-degree 0
  const queue: string[] = [];
  for (const [opId, deg] of inDegree) {
    if (deg === 0) {
      queue.push(opId);
    }
  }

  const result: string[] = [];

  while (queue.length > 0) {
    // Sort queue deterministically
    sortOperationsDeterministically(queue, opIntentMap, targetTypeMap, targetIdMap);

    const current = queue.shift()!;
    result.push(current);

    for (const neighbor of adjacency.get(current) ?? []) {
      const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) {
        queue.push(neighbor);
      }
    }
  }

  // Check for cycles (result should have all nodes)
  if (result.length !== nodes.length) {
    throw new Error(
      `Cycle detected in operation DAG: ${result.length} of ${nodes.length} nodes sorted`,
    );
  }

  return result;
}

/**
 * Sort operations deterministically by priority:
 * prose_accept ALWAYS last, then by entity type, target ID, operation ID.
 */
function sortOperationsDeterministically(
  ops: string[],
  opIntentMap: Map<string, string>,
  targetTypeMap: Map<string, string>,
  targetIdMap: Map<string, string>,
): void {
  ops.sort((a, b) => {
    const aIntent = opIntentMap.get(a) ?? '';
    const bIntent = opIntentMap.get(b) ?? '';

    // prose_accept always last
    const aIsAccept = aIntent === 'prose_accept';
    const bIsAccept = bIntent === 'prose_accept';
    if (aIsAccept && !bIsAccept) return 1;
    if (!aIsAccept && bIsAccept) return -1;

    // By target type
    const aType = targetTypeMap.get(a) ?? '';
    const bType = targetTypeMap.get(b) ?? '';
    if (aType !== bType) return aType.localeCompare(bType);

    // By target ID
    const aId = targetIdMap.get(a) ?? '';
    const bId = targetIdMap.get(b) ?? '';
    if (aId !== bId) return aId.localeCompare(bId);

    // By operation ID (fallback)
    return a.localeCompare(b);
  });
}

/**
 * Assign sequence numbers to sorted operations.
 */
export function assignSequences(sortedOpIds: string[]): Map<string, number> {
  const sequences = new Map<string, number>();
  for (let i = 0; i < sortedOpIds.length; i++) {
    sequences.set(sortedOpIds[i]!, i + 1);
  }
  return sequences;
}
