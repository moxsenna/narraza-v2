import type { Finding } from '../types.js';

export interface BeatContract {
  beatGoal: string;
  mustInclude: string[];
  mustNotInclude: string[];
  expectedEndState: string;
  stopCondition: string;
  /** Soft word budget; prose exceeding 150% is a warning, under 25% is warning */
  wordBudget?: number;
}

export interface BeatContractValidationInput {
  proseContent: string;
  contract: BeatContract;
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

function wordCount(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

/**
 * Deterministic Beat Contract compliance.
 * Blockers: empty goal/end/stop; missing mustInclude; present mustNotInclude.
 */
export function validateBeatContract(
  input: BeatContractValidationInput,
): Finding[] {
  const findings: Finding[] = [];
  const prose = input.proseContent;
  const proseNorm = normalize(prose);
  const c = input.contract;

  if (!c.beatGoal?.trim()) {
    findings.push({
      code: 'BEAT_GOAL_MISSING',
      severity: 'blocker',
      source: 'deterministic',
      message: 'Beat goal is missing from contract',
      publicMessageCode: 'beat.goal.missing',
      deterministic: true,
    });
  }

  if (!c.expectedEndState?.trim()) {
    findings.push({
      code: 'BEAT_END_STATE_MISSING',
      severity: 'blocker',
      source: 'deterministic',
      message: 'Expected end state is missing from contract',
      publicMessageCode: 'beat.end.missing',
      deterministic: true,
    });
  }

  if (!c.stopCondition?.trim()) {
    findings.push({
      code: 'BEAT_STOP_MISSING',
      severity: 'blocker',
      source: 'deterministic',
      message: 'Stop condition is missing from contract',
      publicMessageCode: 'beat.stop.missing',
      deterministic: true,
    });
  }

  for (const item of c.mustInclude ?? []) {
    if (!item?.trim()) continue;
    if (!proseNorm.includes(normalize(item))) {
      findings.push({
        code: 'BEAT_MUST_INCLUDE_MISSING',
        severity: 'blocker',
        source: 'deterministic',
        message: `Prose missing required include: ${item}`,
        publicMessageCode: 'beat.must_include.missing',
        deterministic: true,
      });
    }
  }

  for (const item of c.mustNotInclude ?? []) {
    if (!item?.trim()) continue;
    if (proseNorm.includes(normalize(item))) {
      findings.push({
        code: 'BEAT_MUST_NOT_INCLUDE',
        severity: 'blocker',
        source: 'deterministic',
        message: `Prose contains forbidden phrase: ${item}`,
        publicMessageCode: 'beat.must_not_include.present',
        deterministic: true,
      });
    }
  }

  if (c.wordBudget != null && c.wordBudget > 0) {
    const words = wordCount(prose);
    if (words > c.wordBudget * 1.5) {
      findings.push({
        code: 'BEAT_WORD_BUDGET_OVER',
        severity: 'warning',
        source: 'deterministic',
        message: `Word count ${words} exceeds 150% of budget ${c.wordBudget}`,
        publicMessageCode: 'beat.word_budget.over',
        deterministic: true,
      });
    } else if (words > 0 && words < c.wordBudget * 0.25) {
      findings.push({
        code: 'BEAT_WORD_BUDGET_UNDER',
        severity: 'warning',
        source: 'deterministic',
        message: `Word count ${words} is under 25% of budget ${c.wordBudget}`,
        publicMessageCode: 'beat.word_budget.under',
        deterministic: true,
      });
    }
  }

  return findings;
}
