import type { FoundationReadinessInput, ReadinessCheckResult } from './types.js';

/**
 * Foundation lock readiness check.
 *
 * Required fields must be non-empty for foundation to be ready for lock:
 * - premise
 * - title
 *
 * Returns ready=true only if all required fields are present and non-empty.
 */
export function checkFoundationReadiness(
  input: FoundationReadinessInput,
): ReadinessCheckResult {
  const reasons: string[] = [];

  if (!input.premise || input.premise.trim().length === 0) {
    reasons.push('premise is required');
  }

  if (!input.title || input.title.trim().length === 0) {
    reasons.push('title is required');
  }

  if (!input.genre || input.genre.trim().length === 0) {
    reasons.push('genre is recommended');
  }

  if (!input.targetAudience || input.targetAudience.trim().length === 0) {
    reasons.push('targetAudience is recommended');
  }

  // Required reasons indicate not ready
  const hasRequiredReasons = reasons.some(
    (r) => r.includes('required'),
  );

  return {
    ready: !hasRequiredReasons,
    reasons: reasons.length > 0 ? reasons : [],
  };
}
