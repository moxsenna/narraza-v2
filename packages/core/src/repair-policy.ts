import type { RepairState, RepairDecision, RepairStopReason } from './types.js';
import type { Finding } from './types.js';

/**
 * Repair loop stop conditions (OR):
 * - all_blocking_resolved
 * - attempt_limit
 * - no_progress
 * - same_findings_repeated
 * - regression
 *
 * Returns shouldStop=true when ANY stop condition is met.
 */
export function evaluateRepairPolicy(
  state: RepairState,
  currentFindings: Finding[],
): RepairDecision {
  // Check blocking resolved first
  if (allBlockingResolved(currentFindings)) {
    return { shouldStop: true, reason: 'all_blocking_resolved' };
  }

  // Check attempt limit
  if (state.attempts >= state.maxAttempts) {
    return { shouldStop: true, reason: 'attempt_limit' };
  }

  // Check regression before no_progress: more blockers than initial
  if (state.findingsHistory.length > 0) {
    const initialBlockers = countBlockers(state.findingsHistory[0]!);
    const currentBlockers = countBlockers(currentFindings);
    if (currentBlockers > initialBlockers) {
      return { shouldStop: true, reason: 'regression' };
    }
  }

  // Check same_findings_repeated before no_progress: identical finding codes
  // in last 2+ attempts AND current attempt
  if (state.findingsHistory.length >= 2) {
    const recentCodes = state.findingsHistory
      .slice(-2)
      .map((findings) =>
        findings
          .filter((f) => f.severity === 'blocker')
          .map((f) => f.code)
          .sort()
          .join(','),
      );
    const currentCodes = currentFindings
      .filter((f) => f.severity === 'blocker')
      .map((f) => f.code)
      .sort()
      .join(',');

    if (
      recentCodes[0] === currentCodes &&
      recentCodes[1] === currentCodes
    ) {
      return { shouldStop: true, reason: 'same_findings_repeated' };
    }
  }

  // Check no progress: current findings have same or more blocking count
  // compared to last attempt
  if (state.findingsHistory.length > 0) {
    const lastFindings = state.findingsHistory[state.findingsHistory.length - 1]!;
    const lastBlockers = countBlockers(lastFindings);
    const currentBlockers = countBlockers(currentFindings);

    if (currentBlockers >= lastBlockers && currentBlockers > 0) {
      return { shouldStop: true, reason: 'no_progress' };
    }
  }

  return { shouldStop: false, reason: null };
}

function allBlockingResolved(findings: Finding[]): boolean {
  return findings.every((f) => f.severity !== 'blocker');
}

function countBlockers(findings: Finding[]): number {
  return findings.filter((f) => f.severity === 'blocker').length;
}
