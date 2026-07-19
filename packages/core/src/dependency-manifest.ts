import crypto from 'node:crypto';
import type { DependencyEntry, DependencyManifest } from './types.js';
import { DEPENDENCY_SCHEMA_VERSION } from './types.js';

/**
 * Compute a canonical serialization of dependency entries,
 * then SHA-256 hash with schema version prefix.
 *
 * Entries are sorted by (entityType, entityId) for deterministic output.
 * Duplicate (entityType, entityId) throws.
 */
export function buildDependencyManifest(
  entries: DependencyEntry[],
): DependencyManifest {
  // Validate no duplicates
  const seen = new Set<string>();
  for (const entry of entries) {
    const key = `${entry.entityType}:${entry.entityId}`;
    if (seen.has(key)) {
      throw new Error(
        `Duplicate dependency entry: ${entry.entityType} ${entry.entityId}`,
      );
    }
    seen.add(key);
  }

  // Sort deterministically by (entityType, entityId)
  const sorted = [...entries].sort((a, b) => {
    const typeCmp = a.entityType.localeCompare(b.entityType);
    if (typeCmp !== 0) return typeCmp;
    return a.entityId.localeCompare(b.entityId);
  });

  // Build canonical JSON: deterministic key order, no whitespace
  const canonical = JSON.stringify(
    sorted.map((e) => ({
      entityType: e.entityType,
      entityId: e.entityId,
      revision: e.revision,
    })),
  );

  const hash = crypto
    .createHash('sha256')
    .update(`${DEPENDENCY_SCHEMA_VERSION}:${canonical}`)
    .digest('hex');

  return {
    schemaVersion: DEPENDENCY_SCHEMA_VERSION,
    entries: sorted,
    hash,
  };
}

/**
 * Compare two dependency manifests. Returns true if hashes match.
 */
export function dependencyHashesEqual(a: DependencyManifest, b: DependencyManifest): boolean {
  return a.hash === b.hash;
}

/**
 * Re-hash an existing manifest (useful for validation).
 */
export function rehashDependencyManifest(manifest: DependencyManifest): string {
  return buildDependencyManifest(manifest.entries).hash;
}
