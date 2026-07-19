import type { Finding } from '../types.js';

export interface CharacterKnowledgeFact {
  factId: string;
  /** Exact or distinctive truth phrase characters may leak */
  truth: string;
  /** Character ids who already know this fact */
  knownByCharacterIds: string[];
}

export interface CharacterKnowledgeValidationInput {
  proseContent: string;
  /** POV character id for this beat (if any) */
  povCharacterId?: string;
  /** Characters speaking / acting in the beat */
  presentCharacterIds: string[];
  facts: CharacterKnowledgeFact[];
}

function containsPhrase(prose: string, phrase: string): boolean {
  if (!phrase.trim()) return false;
  return prose.toLowerCase().includes(phrase.toLowerCase());
}

/**
 * Character knowledge gate:
 * - POV must not think in terms of hidden truth they do not know
 * - Present characters who do not know a fact must not state that truth
 */
export function validateCharacterKnowledge(
  input: CharacterKnowledgeValidationInput,
): Finding[] {
  const findings: Finding[] = [];
  const prose = input.proseContent;

  for (const fact of input.facts ?? []) {
    if (!containsPhrase(prose, fact.truth)) continue;

    const knowers = new Set(fact.knownByCharacterIds ?? []);

    if (input.povCharacterId && !knowers.has(input.povCharacterId)) {
      findings.push({
        code: 'KNOWLEDGE_POV_LEAK',
        severity: 'blocker',
        source: 'deterministic',
        message: `POV ${input.povCharacterId} uses unknown fact ${fact.factId}`,
        publicMessageCode: 'knowledge.pov.leak',
        deterministic: true,
      });
    }

    for (const cid of input.presentCharacterIds ?? []) {
      if (!knowers.has(cid)) {
        findings.push({
          code: 'KNOWLEDGE_CHARACTER_LEAK',
          severity: 'blocker',
          source: 'deterministic',
          message: `Character ${cid} states unknown fact ${fact.factId}`,
          publicMessageCode: 'knowledge.character.leak',
          deterministic: true,
        });
        // One finding per fact is enough once any present character is ignorant
        break;
      }
    }

    // If no POV and no present list, still block bare truth that nobody is known to know
    if (
      !input.povCharacterId &&
      (input.presentCharacterIds?.length ?? 0) === 0 &&
      knowers.size === 0
    ) {
      findings.push({
        code: 'KNOWLEDGE_UNATTRIBUTED_LEAK',
        severity: 'blocker',
        source: 'deterministic',
        message: `Prose states fact ${fact.factId} with no known knower`,
        publicMessageCode: 'knowledge.unattributed.leak',
        deterministic: true,
      });
    }
  }

  return findings;
}
