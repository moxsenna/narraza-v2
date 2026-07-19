// reveal-policy.ts — classify facts for writer packets (allowlist).
// Restricted / future-scheduled truths never become writer-safe.

import type {
  ForbiddenConcept,
  RestrictedFact,
  RevealPolicyResult,
  WriterSafeFact,
} from './types.js';

/** Fact as stored in canon before reveal classification. */
export interface RevealPolicyFact {
  id: string;
  truth: string;
  /** Public surface text safe for writers when fact is revealed. */
  surface?: string;
  factKey: string;
  category: string;
  /**
   * When the fact may enter writer context.
   * - revealed: already public to writer
   * - scheduled: locked until scheduledChapter (inclusive)
   * - hidden: never writer-safe until status changes
   */
  revealStatus: 'revealed' | 'scheduled' | 'hidden';
  /** Chapter number at which a scheduled fact becomes writer-safe. */
  scheduledChapter?: number;
  /** Optional breadcrumb surface allowed before full reveal. */
  breadcrumbSurface?: string;
  /** If true, breadcrumb only — never full truth before schedule. */
  breadcrumbOnlyBeforeReveal?: boolean;
}

export interface ApplyRevealPolicyInput {
  facts: RevealPolicyFact[];
  /** Chapter being written (1-based). */
  currentChapter: number;
  /** Optional beat id for future scoping (unused in M-P0). */
  beatId?: string;
}

function isWriterSafeAtChapter(
  fact: RevealPolicyFact,
  currentChapter: number,
): boolean {
  if (fact.revealStatus === 'revealed') return true;
  if (fact.revealStatus === 'hidden') return false;
  if (fact.revealStatus === 'scheduled') {
    if (fact.scheduledChapter == null) return false;
    return currentChapter >= fact.scheduledChapter;
  }
  return false;
}

function toWriterSafe(fact: RevealPolicyFact, asBreadcrumb: boolean): WriterSafeFact {
  if (asBreadcrumb) {
    return {
      id: fact.id,
      surface: fact.breadcrumbSurface ?? fact.surface ?? fact.factKey,
      factKey: fact.factKey,
      category: fact.category,
    };
  }
  return {
    id: fact.id,
    surface: fact.surface ?? fact.truth,
    factKey: fact.factKey,
    category: fact.category,
  };
}

function toRestricted(fact: RevealPolicyFact): RestrictedFact {
  return {
    id: fact.id,
    truth: fact.truth,
    factKey: fact.factKey,
    category: fact.category,
  };
}

function toForbidden(fact: RevealPolicyFact): ForbiddenConcept {
  return {
    factId: fact.id,
    truth: fact.truth,
  };
}

/**
 * Classify facts for a given chapter into restricted / writer-safe / forbidden.
 *
 * Rules:
 * 1. Only revealed facts (or scheduled facts whose chapter has arrived) become writer-safe.
 * 2. Hidden and not-yet-scheduled facts are restricted + forbidden.
 * 3. Before schedule, optional breadcrumb surface may be writer-safe WITHOUT truth.
 * 4. Full truth never appears in writerSafeFacts for restricted facts.
 */
export function applyRevealPolicy(
  input: ApplyRevealPolicyInput,
): RevealPolicyResult {
  const restrictedFacts: RestrictedFact[] = [];
  const writerSafeFacts: WriterSafeFact[] = [];
  const forbiddenConcepts: ForbiddenConcept[] = [];

  for (const fact of input.facts) {
    if (isWriterSafeAtChapter(fact, input.currentChapter)) {
      writerSafeFacts.push(toWriterSafe(fact, false));
      continue;
    }

    // Not fully revealed yet
    restrictedFacts.push(toRestricted(fact));
    forbiddenConcepts.push(toForbidden(fact));

    // Optional safe breadcrumb (surface only — never truth)
    if (
      fact.breadcrumbSurface &&
      fact.breadcrumbSurface.trim().length > 0 &&
      !fact.breadcrumbSurface.includes(fact.truth)
    ) {
      writerSafeFacts.push(toWriterSafe(fact, true));
    }
  }

  // Invariant: no restricted truth string may appear in writer-safe surfaces
  for (const safe of writerSafeFacts) {
    for (const restricted of restrictedFacts) {
      if (safe.surface.includes(restricted.truth)) {
        // Strip leaking surface — keep factKey-only placeholder
        safe.surface = `[withheld:${safe.factKey}]`;
      }
    }
  }

  return { restrictedFacts, writerSafeFacts, forbiddenConcepts };
}

/**
 * Convenience: build writer-safe allowlist inputs from raw facts + chapter.
 */
export function classifyFactsForWriter(
  facts: RevealPolicyFact[],
  currentChapter: number,
): RevealPolicyResult {
  return applyRevealPolicy({ facts, currentChapter });
}
