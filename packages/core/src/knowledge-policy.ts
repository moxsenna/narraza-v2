import type { Belief, BeliefTransition, BeliefTransitionResult } from './types.js';

/**
 * Belief transition policy:
 * - Belief downgrade (lower confidence) must have an allowed reason.
 * - Belief upgrade (higher confidence) must have an allowed reason.
 * - Transitions check that the new confidence value differs and the
 *   reason is in the source belief's allowedTransitionReasons.
 */
export function validateBeliefTransition(
  transition: BeliefTransition,
): BeliefTransitionResult {
  const violations: string[] = [];

  if (!transition.from.allowedTransitionReasons.includes(transition.reason)) {
    violations.push(
      `Transition reason '${transition.reason}' not allowed. Allowed: ${transition.from.allowedTransitionReasons.join(', ')}`,
    );
  }

  // Downgrade always requires explicit allowed reason (double-check)
  if (transition.to.confidence < transition.from.confidence) {
    if (!transition.from.allowedTransitionReasons.includes(transition.reason)) {
      violations.push(
        `Belief downgrade requires an allowed transition reason. '${transition.reason}' is not permitted.`,
      );
    }
  }

  // Upgrade also requires allowed reason
  if (transition.to.confidence > transition.from.confidence) {
    if (!transition.from.allowedTransitionReasons.includes(transition.reason)) {
      violations.push(
        `Belief upgrade requires an allowed transition reason. '${transition.reason}' is not permitted.`,
      );
    }
  }

  return {
    accepted: violations.length === 0,
    reason: violations.length === 0 ? transition.reason : null,
    violations,
  };
}
