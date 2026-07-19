import type { Finding } from '../types.js';

export type CanonSensitiveCategory =
  | 'family_relation'
  | 'death'
  | 'pregnancy'
  | 'child'
  | 'marriage_status'
  | 'important_object'
  | 'world_rule';

export interface CanonFactRecord {
  factKey: string;
  truth: string;
  category?: string;
}

export interface CanonProposal {
  /** Free-text claim introduced by prose or AI suggestion */
  claim: string;
  category: CanonSensitiveCategory;
  /** If true, claim was approved via formal proposal pipeline */
  hasApprovedProposal: boolean;
}

export interface CanonContradictionInput {
  proseContent: string;
  /** Existing confirmed canon facts */
  existingFacts: CanonFactRecord[];
  /** Sensitive claims detected or proposed for this beat */
  proposals: CanonProposal[];
}

/** Phrase patterns that flag sensitive canon introductions in free prose. */
const SENSITIVE_PATTERNS: Array<{ category: CanonSensitiveCategory; re: RegExp }> = [
  { category: 'family_relation', re: /\b(my (father|mother|brother|sister|son|daughter)|is (my|his|her) (father|mother|brother|sister))\b/i },
  { category: 'death', re: /\b(died|is dead|was killed|murdered|killed him|killed her)\b/i },
  { category: 'pregnancy', re: /\b(pregnant|pregnancy|expecting a (baby|child))\b/i },
  { category: 'child', re: /\b(gave birth|newborn|their child was born)\b/i },
  { category: 'marriage_status', re: /\b(married|divorced|widow|widower|wedding)\b/i },
  { category: 'important_object', re: /\b(the (amulet|relic|sword|key|artifact) of)\b/i },
  { category: 'world_rule', re: /\b(magic only works|the law of|world rule:)\b/i },
];

/**
 * Basic canon contradiction / unauthorized sensitive fact gate.
 * Blocks sensitive categories without approved proposal.
 * Also flags prose that contradicts an existing confirmed truth when
 * a claim with same factKey-style surface is inverted (simple include check).
 */
export function validateCanonContradiction(
  input: CanonContradictionInput,
): Finding[] {
  const findings: Finding[] = [];
  const prose = input.proseContent;

  for (const proposal of input.proposals ?? []) {
    if (!proposal.hasApprovedProposal) {
      findings.push({
        code: 'CANON_SENSITIVE_WITHOUT_PROPOSAL',
        severity: 'blocker',
        source: 'deterministic',
        message: `Sensitive canon claim (${proposal.category}) lacks approved proposal: ${proposal.claim}`,
        publicMessageCode: 'canon.sensitive.no_proposal',
        deterministic: true,
      });
    }
  }

  for (const { category, re } of SENSITIVE_PATTERNS) {
    if (re.test(prose)) {
      const approved = (input.proposals ?? []).some(
        (p) => p.category === category && p.hasApprovedProposal,
      );
      if (!approved) {
        findings.push({
          code: 'CANON_SENSITIVE_IN_PROSE',
          severity: 'blocker',
          source: 'deterministic',
          message: `Prose introduces sensitive canon (${category}) without approved proposal`,
          publicMessageCode: 'canon.sensitive.prose',
          deterministic: true,
        });
      }
    }
  }

  // Simple contradiction: existing truth present as negation "not X" when X is confirmed
  for (const fact of input.existingFacts ?? []) {
    if (!fact.truth?.trim()) continue;
    const neg = `not ${fact.truth}`.toLowerCase();
    if (prose.toLowerCase().includes(neg)) {
      findings.push({
        code: 'CANON_CONTRADICTION',
        severity: 'blocker',
        source: 'deterministic',
        message: `Prose contradicts confirmed fact ${fact.factKey}`,
        publicMessageCode: 'canon.contradiction',
        deterministic: true,
      });
    }
  }

  return findings;
}
