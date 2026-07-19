// Temp-ref-resolver: resolves tempRef → operationId within a single GeneratedCandidate scope.
// Rejects cross-candidate references, cyclic dependencies, and unresolved refs.

import type { ModelSuggestionDraft, TempRefScope, ExtractionError } from './types.js';
import { randomUUID } from 'node:crypto';

/**
 * Allocate operationIds for a list of model suggestions and resolve tempRefs.
 *
 * Rules:
 * - All tempRefs must be resolved within the same candidate
 * - Cross-candidate refs are rejected
 * - Cyclic dependencies are rejected
 * - Every referenced tempRef must exist in the suggestion list
 */
export function resolveTempRefs(
  suggestions: ModelSuggestionDraft[],
  candidateId: string,
): { scope: TempRefScope; errors: ExtractionError[] } {
  const errors: ExtractionError[] = [];
  const resolved = new Map<string, string>();
  const dependencies = new Map<string, string[]>();

  // Allocate IDs first
  // prose_accept ops always get allocated last (they get the final spot)
  const proseAcceptOps: ModelSuggestionDraft[] = [];
  const regularOps: ModelSuggestionDraft[] = [];

  for (const s of suggestions) {
    if (s.opIntent === 'prose_accept') {
      proseAcceptOps.push(s);
    } else {
      regularOps.push(s);
    }
  }

  const ordered = [...regularOps, ...proseAcceptOps];

  for (const s of ordered) {
    const opId = `op_${randomUUID().replace(/-/g, '')}`;
    resolved.set(s.tempRef, opId);
    dependencies.set(s.tempRef, []);
  }

  // Now resolve dependencies from payload
  for (const s of ordered) {
    const deps = extractDependencyRefs(s.payload);
    const resolvedDeps: string[] = [];

    for (const dep of deps) {
      if (!resolved.has(dep)) {
        errors.push({
          code: 'UNRESOLVED_TEMPREF',
          message: `tempRef '${dep}' referenced by '${s.tempRef}' does not exist in candidate scope`,
          tempRef: s.tempRef,
        });
        continue;
      }
      resolvedDeps.push(resolved.get(dep)!);
    }

    dependencies.set(s.tempRef, resolvedDeps);
  }

  // Check for cyclic dependencies
  const cycleErrors = detectCycles(resolved, dependencies);
  errors.push(...cycleErrors);

  // Verify all tempRefs are within this scope (reject cross-candidate)
  // This is already handled by the resolution above — if a ref isn't in `resolved`,
  // it's considered cross-candidate/unresolved.

  return {
    scope: {
      candidateId,
      resolved,
      dependencies,
    },
    errors,
  };
}

/**
 * Extract tempRef dependencies from a payload object.
 *
 * Only looks at values from keys explicitly named `dependsOn`, `references`,
 * `ref`, or `depends_on`. These are the canonical keys for cross-referencing
 * other suggestions within a single GeneratedCandidate scope.
 *
 * Does NOT scan nested objects recursively, as that risks false positives
 * (e.g., prose text, fact content, or payload data that happens to match
 * a ref-like pattern).
 */
function extractDependencyRefs(payload: Record<string, unknown>): string[] {
  const refs: string[] = [];
  const dependencyKeys = new Set(['dependsOn', 'references', 'ref', 'depends_on']);

  for (const [key, value] of Object.entries(payload)) {
    if (dependencyKeys.has(key)) {
      if (typeof value === 'string') {
        refs.push(value);
      } else if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string') {
            refs.push(item);
          }
        }
      }
    }
  }

  return [...new Set(refs)];
}

/**
 * Detect cycles in dependency graph using DFS.
 */
function detectCycles(
  resolved: Map<string, string>,
  dependencies: Map<string, string[]>,
): ExtractionError[] {
  const errors: ExtractionError[] = [];
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();

  for (const tempRef of resolved.keys()) {
    color.set(tempRef, WHITE);
  }

  function dfs(tempRef: string, path: string[]): void {
    color.set(tempRef, GRAY);
    path.push(tempRef);

    const deps = dependencies.get(tempRef) ?? [];
    for (const depOpId of deps) {
      // Find the tempRef for this opId
      let depTempRef: string | undefined;
      for (const [tr, oid] of resolved) {
        if (oid === depOpId) {
          depTempRef = tr;
          break;
        }
      }
      if (!depTempRef) continue;

      const depColor = color.get(depTempRef);
      if (depColor === GRAY) {
        const cycleStart = path.indexOf(depTempRef);
        const cyclePath = path.slice(cycleStart);
        errors.push({
          code: 'CYCLIC_DEPENDENCY',
          message: `Cyclic dependency detected: ${cyclePath.join(' -> ')} -> ${depTempRef}`,
          tempRef,
        });
      } else if (depColor === WHITE) {
        dfs(depTempRef, path);
      }
    }

    path.pop();
    color.set(tempRef, BLACK);
  }

  for (const tempRef of resolved.keys()) {
    if (color.get(tempRef) === WHITE) {
      dfs(tempRef, []);
    }
  }

  return errors;
}
