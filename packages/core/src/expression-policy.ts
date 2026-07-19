import type { CharacterContext, NarrativePointOfView, Belief } from './types.js';

export interface ExpressionPolicyInput {
  character: CharacterContext;
  knownBeliefs: Belief[];
  targetReaderFactIds: string[];
}

export interface ExpressionDirective {
  kind: 'behavioral_directive' | 'allowed_statement';
  content: string;
  beliefKey: string | null;
}

export interface ExpressionPolicyResult {
  directives: ExpressionDirective[];
  allowedStatements: ExpressionDirective[];
}

/**
 * Non-POV characters get behavioral directives, NOT raw belief truth strings.
 *
 * POV characters may receive allowed statements with belief content.
 * Non-POV characters only receive behavioral instructions about what to
 * show/suggest/avoid, never the literal truth from their beliefs.
 */
export function evaluateExpressionPolicy(
  input: ExpressionPolicyInput,
): ExpressionPolicyResult {
  const directives: ExpressionDirective[] = [];
  const allowedStatements: ExpressionDirective[] = [];

  for (const belief of input.knownBeliefs) {
    if (input.character.pov === 'POV') {
      // POV character may receive belief content as an allowed statement
      allowedStatements.push({
        kind: 'allowed_statement',
        content: belief.content,
        beliefKey: belief.beliefKey,
      });
    }

    if (input.character.pov === 'non_POV' || input.character.pov === 'observer') {
      // Non-POV / observer: behavioral directive only, no raw belief content
      const directive = buildBehavioralDirective(belief, input.character.pov);
      directives.push(directive);
    }
  }

  return { directives, allowedStatements };
}

function buildBehavioralDirective(
  belief: Belief,
  pov: NarrativePointOfView,
): ExpressionDirective {
  const label = belief.beliefKey.replace(/_/g, ' ');

  switch (pov) {
    case 'non_POV':
      return {
        kind: 'behavioral_directive',
        content: `Character should behave as if ${label}. Show through action and dialogue; do not state explicitly.`,
        beliefKey: belief.beliefKey,
      };
    case 'observer':
      return {
        kind: 'behavioral_directive',
        content: `Narrative may hint at ${label} through observation. Do not reveal directly.`,
        beliefKey: belief.beliefKey,
      };
    default:
      return {
        kind: 'behavioral_directive',
        content: `Character should act on ${label}.`,
        beliefKey: belief.beliefKey,
      };
  }
}
