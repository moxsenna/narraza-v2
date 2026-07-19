import type { Finding, ForbiddenConcept } from '../types.js';

export interface RevealValidationInput {
  proseContent: string;
  /** Truths that must not appear in prose for this chapter */
  forbiddenConcepts: ForbiddenConcept[];
  /** Optional explicit phrases that are too on-the-nose for breadcrumbs */
  overExplicitBreadcrumbs?: string[];
  /** Future event phrases that must not be accelerated into this chapter */
  futureEventPhrases?: string[];
}

function containsPhrase(prose: string, phrase: string): boolean {
  if (!phrase.trim()) return false;
  return prose.toLowerCase().includes(phrase.toLowerCase());
}

/**
 * Spoiler / forbidden-reveal validator.
 * Blocker when forbidden truth or future event appears in prose.
 */
export function validateRevealLeak(input: RevealValidationInput): Finding[] {
  const findings: Finding[] = [];
  const prose = input.proseContent;

  for (const fc of input.forbiddenConcepts ?? []) {
    if (containsPhrase(prose, fc.truth)) {
      findings.push({
        code: 'REVEAL_FORBIDDEN_TRUTH',
        severity: 'blocker',
        source: 'deterministic',
        message: `Prose contains forbidden reveal for fact ${fc.factId}`,
        publicMessageCode: 'reveal.forbidden',
        deterministic: true,
      });
    }
  }

  for (const phrase of input.overExplicitBreadcrumbs ?? []) {
    if (containsPhrase(prose, phrase)) {
      findings.push({
        code: 'REVEAL_BREADCRUMB_TOO_EXPLICIT',
        severity: 'warning',
        source: 'deterministic',
        message: `Breadcrumb too explicit: ${phrase}`,
        publicMessageCode: 'reveal.breadcrumb.explicit',
        deterministic: true,
      });
    }
  }

  for (const phrase of input.futureEventPhrases ?? []) {
    if (containsPhrase(prose, phrase)) {
      findings.push({
        code: 'REVEAL_FUTURE_EVENT_EARLY',
        severity: 'blocker',
        source: 'deterministic',
        message: `Future event appears too early: ${phrase}`,
        publicMessageCode: 'reveal.future.early',
        deterministic: true,
      });
    }
  }

  return findings;
}
