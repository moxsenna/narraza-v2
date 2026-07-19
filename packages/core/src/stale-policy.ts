import type {
  StalePolicyInput,
  StalePolicyResult,
  ProposalStaleStatus,
} from './types.js';

/**
 * Proposal validity is dependency-based, not driven by global version alone.
 *
 * - dependency hash unchanged → proposal remains valid, even if unrelated
 *   project.currentCanonicalVersion bumps occurred
 * - relevant dependency changed → stale policy classifies:
 *   - needs_revalidation if the proposal may still be regenerated against
 *     current dependencies
 *   - stale if the proposal can no longer be safely applied
 */
export function evaluateStalePolicy(input: StalePolicyInput): StalePolicyResult {
  // Same dependency hash → always valid, regardless of version bumps
  if (input.currentDependencyHash === input.proposalDependencyHash) {
    return { status: 'valid', reason: 'dependency hash matches current' };
  }

  // Different hash — check dep revisions
  if (!input.depRevisionsChanged) {
    // Hash mismatch but no explicit revision changes (edge case: hash collision
    // or schema version bump). Still mark stale to be safe.
    return {
      status: 'stale',
      reason: 'dependency hash mismatch without tracked revision change',
    };
  }

  // Dep revisions changed — classify
  if (input.regenerable) {
    return {
      status: 'needs_revalidation',
      reason: 'dependency revisions changed; proposal is regenerable',
    };
  }

  return {
    status: 'stale',
    reason: 'dependency revisions changed; proposal is not regenerable',
  };
}
