import type { DisclosureEvent, DisclosureFoldResult } from './types.js';

/**
 * Fold disclosures into deterministic order:
 * - sort by sequence asc, then createdAt asc, then id asc
 *
 * Retraction target is the LAST disclosure in the folded sequence
 * if any exist, otherwise null.
 */
export function foldDisclosures(
  events: DisclosureEvent[],
): DisclosureFoldResult {
  const sorted = [...events].sort((a, b) => {
    if (a.sequence !== b.sequence) return a.sequence - b.sequence;
    // Tie-break by createdAt
    if (a.createdAt !== b.createdAt) return a.createdAt.localeCompare(b.createdAt);
    // Tie-break by id
    return a.id.localeCompare(b.id);
  });

  const retractionTarget =
    sorted.length > 0 ? sorted[sorted.length - 1]!.id : null;

  return {
    disclosures: sorted,
    retractionTarget,
  };
}
