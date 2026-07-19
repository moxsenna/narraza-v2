import type {
  FoundationReadinessInput,
  ReadinessCheckResult,
  ReadinessStatus,
} from './types.js';

function nonEmpty(value: string | undefined | null): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function countCanonFacts(input: FoundationReadinessInput): number {
  if (Array.isArray(input.canonFacts)) {
    return input.canonFacts.filter((f) => nonEmpty(f)).length;
  }
  return 0;
}

/**
 * Foundation lock readiness — score + structured findings.
 *
 * Status:
 * - not_ready: missing any blocking required field
 * - risky: required present but important recommended missing
 * - ready: required + recommended checklist satisfied
 *
 * `ready` boolean remains for backward compatibility (= status === 'ready').
 */
export function checkFoundationReadiness(
  input: FoundationReadinessInput,
): ReadinessCheckResult {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];

  // ---- Blocking (required for ready/risky floor) ----
  if (!nonEmpty(input.title)) blocking.push('title is required');
  if (!nonEmpty(input.premise)) blocking.push('premise is required');
  if (!nonEmpty(input.genre)) blocking.push('genre is required');
  if (!nonEmpty(input.targetAudience)) blocking.push('targetAudience is required');
  if (!nonEmpty(input.emotionalPromise)) blocking.push('emotionalPromise is required');
  if (!nonEmpty(input.protagonist)) blocking.push('protagonist is required');
  if (!nonEmpty(input.mainConflict)) blocking.push('mainConflict is required');

  const canonCount = countCanonFacts(input);
  if (canonCount < 3) {
    blocking.push(`at least 3 canon facts required (have ${canonCount})`);
  }

  if (
    input.targetChapterCount == null ||
    !Number.isFinite(input.targetChapterCount) ||
    input.targetChapterCount < 1
  ) {
    blocking.push('targetChapterCount is required (≥1)');
  }

  if (!nonEmpty(input.endingDirection)) blocking.push('endingDirection is required');

  // ---- Warnings / recommendations ----
  if (!nonEmpty(input.pov)) warnings.push('pov is recommended');
  if (!nonEmpty(input.tone)) warnings.push('tone is recommended');
  if (!nonEmpty(input.characterNamingRules)) {
    warnings.push('characterNamingRules is recommended');
  }

  if (input.hasTwist) {
    if (!nonEmpty(input.primarySecret)) {
      blocking.push('primarySecret is required when hasTwist');
    }
    if (
      input.secretRevealChapter == null ||
      !Number.isFinite(input.secretRevealChapter) ||
      input.secretRevealChapter < 1
    ) {
      blocking.push('secretRevealChapter is required when hasTwist');
    }
  } else if (!nonEmpty(input.primarySecret)) {
    recommendations.push('document primarySecret if a major twist is planned');
  }

  if (canonCount >= 3 && canonCount < 5) {
    recommendations.push('add more canon facts for denser continuity');
  }

  // Score: start 100, subtract per issue
  let score = 100;
  score -= blocking.length * 12;
  score -= warnings.length * 4;
  score -= recommendations.length * 2;
  if (score < 0) score = 0;
  if (score > 100) score = 100;

  let status: ReadinessStatus;
  if (blocking.length > 0) {
    status = 'not_ready';
  } else if (warnings.length > 0) {
    status = 'risky';
  } else {
    status = 'ready';
  }

  // Backward-compatible reasons list
  const reasons = [...blocking, ...warnings];

  return {
    ready: status === 'ready',
    status,
    score,
    blocking,
    warnings,
    recommendations,
    reasons,
  };
}
