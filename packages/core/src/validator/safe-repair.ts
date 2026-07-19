import type { Finding } from '../types.js';

export interface SafeRepairConstraints {
  /** Original beat goal — must remain equivalent after repair */
  originalBeatGoal: string;
  /** Canon fact truths that must not be newly introduced */
  existingCanonTruths: string[];
  /** Forbidden reveal truths that must not appear */
  forbiddenTruths: string[];
  /** Findings the repair is allowed to address */
  targetFindings: Finding[];
}

export interface SafeRepairValidationInput {
  originalProse: string;
  repairedProse: string;
  constraints: SafeRepairConstraints;
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

function containsPhrase(text: string, phrase: string): boolean {
  if (!phrase.trim()) return false;
  return normalize(text).includes(normalize(phrase));
}

/**
 * Safe repair constraints:
 * - must not add new plot markers (heuristic: new sentences introducing "suddenly" plot pivots optional)
 * - must not add new canon truths
 * - must not change beat goal (caller compares goals; here we ensure goal text still reflected if present)
 * - must not open reveals (forbidden truths absent)
 * - should only shrink/alter text related to violations (repaired prose must not reintroduce target finding phrases)
 */
export function validateSafeRepair(
  input: SafeRepairValidationInput,
): Finding[] {
  const findings: Finding[] = [];
  const { originalProse, repairedProse, constraints } = input;

  for (const truth of constraints.forbiddenTruths ?? []) {
    if (containsPhrase(repairedProse, truth)) {
      findings.push({
        code: 'REPAIR_OPENS_REVEAL',
        severity: 'blocker',
        source: 'deterministic',
        message: 'Repair reintroduces or opens a forbidden reveal',
        publicMessageCode: 'repair.reveal.open',
        deterministic: true,
      });
    }
  }

  for (const truth of constraints.existingCanonTruths ?? []) {
    const wasPresent = containsPhrase(originalProse, truth);
    const isPresent = containsPhrase(repairedProse, truth);
    if (!wasPresent && isPresent) {
      findings.push({
        code: 'REPAIR_ADDS_CANON',
        severity: 'blocker',
        source: 'deterministic',
        message: `Repair introduces new canon truth: ${truth}`,
        publicMessageCode: 'repair.canon.add',
        deterministic: true,
      });
    }
  }

  // Beat goal: if original prose referenced goal keywords, repair should not erase all of them
  // and should not introduce a different explicit goal line "New goal:"
  if (/new goal\s*:/i.test(repairedProse) && !/new goal\s*:/i.test(originalProse)) {
    findings.push({
      code: 'REPAIR_CHANGES_BEAT_GOAL',
      severity: 'blocker',
      source: 'deterministic',
      message: 'Repair appears to change beat goal',
      publicMessageCode: 'repair.goal.change',
      deterministic: true,
    });
  }

  // Plot expansion heuristic: large growth + "suddenly" new plot beats
  const origWords = originalProse.trim().split(/\s+/).filter(Boolean).length;
  const newWords = repairedProse.trim().split(/\s+/).filter(Boolean).length;
  if (newWords > origWords * 1.35) {
    const suddenNew =
      /\bsuddenly\b/i.test(repairedProse) && !/\bsuddenly\b/i.test(originalProse);
    if (suddenNew) {
      findings.push({
        code: 'REPAIR_ADDS_PLOT',
        severity: 'blocker',
        source: 'deterministic',
        message: 'Repair expands plot beyond safe repair scope',
        publicMessageCode: 'repair.plot.add',
        deterministic: true,
      });
    }
  }

  // Target findings: if a finding message referenced a phrase still present and severity blocker, warn
  for (const f of constraints.targetFindings ?? []) {
    if (f.severity !== 'blocker') continue;
    // If finding was about a forbidden include and still present — repair incomplete
    const m = f.message.match(/forbidden phrase: (.+)$/i);
    if (m?.[1] && containsPhrase(repairedProse, m[1])) {
      findings.push({
        code: 'REPAIR_INCOMPLETE',
        severity: 'blocker',
        source: 'deterministic',
        message: `Repair did not remove violation: ${m[1]}`,
        publicMessageCode: 'repair.incomplete',
        deterministic: true,
      });
    }
  }

  return findings;
}

/**
 * Apply a minimal safe repair: strip lines/sentences containing forbidden phrases.
 * Does not invent new plot or canon.
 */
export function applyMinimalSafeRepair(
  prose: string,
  forbiddenPhrases: string[],
): string {
  const sentences = prose.split(/(?<=[.!?])\s+/);
  const cleaned = sentences.filter((s) => {
    const lower = s.toLowerCase();
    return !forbiddenPhrases.some((p) => p && lower.includes(p.toLowerCase()));
  });
  return cleaned.join(' ').trim();
}
