import { describe, expect, it } from 'vitest';
import { evaluateExpressionPolicy } from '../expression-policy.js';
import type { CharacterContext, Belief } from '../types.js';

describe('expression-policy', () => {
  const povCharacter: CharacterContext = {
    characterId: 'c1',
    name: 'Nadira',
    pov: 'POV',
  };

  const nonPovCharacter: CharacterContext = {
    characterId: 'c2',
    name: 'Guard',
    pov: 'non_POV',
  };

  const observerCharacter: CharacterContext = {
    characterId: 'c3',
    name: 'Narrator',
    pov: 'observer',
  };

  const beliefs: Belief[] = [
    {
      characterId: 'c2',
      beliefKey: 'knows_secret',
      content: 'The king is a usurper',
      confidence: 0.9,
      source: 'witnessed',
      allowedTransitionReasons: ['direct_experience', 'trusted_report'],
    },
    {
      characterId: 'c2',
      beliefKey: 'loyal_to_queen',
      content: 'Only the queen is the true ruler',
      confidence: 0.8,
      source: 'inheritance',
      allowedTransitionReasons: ['direct_experience'],
    },
  ];

  it('Non-POV character gets behavioral directives, not raw belief truth strings', () => {
    const result = evaluateExpressionPolicy({
      character: nonPovCharacter,
      knownBeliefs: beliefs,
      targetReaderFactIds: [],
    });

    expect(result.directives.length).toBeGreaterThan(0);

    for (const d of result.directives) {
      // Behavioral directives should be about behavior, not raw belief
      expect(d.kind).toBe('behavioral_directive');
      // Should NOT contain raw belief content
      expect(d.content).not.toContain('The king is a usurper');
      expect(d.content).not.toContain('Only the queen is the true ruler');
      // But should reference the belief key in some form
      expect(d.content.toLowerCase()).toMatch(/knows.secret|loyal.to.queen/);
    }

    // Non-POV should have no allowed statements
    expect(result.allowedStatements).toHaveLength(0);
  });

  it('POV character may receive allowed statements with belief content', () => {
    const result = evaluateExpressionPolicy({
      character: povCharacter,
      knownBeliefs: beliefs,
      targetReaderFactIds: [],
    });

    expect(result.allowedStatements.length).toBeGreaterThan(0);

    const contentTexts = result.allowedStatements.map((s) => s.content);
    expect(contentTexts).toContain('The king is a usurper');
    expect(contentTexts).toContain('Only the queen is the true ruler');
  });

  it('Observer character gets behavioral directives only', () => {
    const result = evaluateExpressionPolicy({
      character: observerCharacter,
      knownBeliefs: beliefs.slice(0, 1),
      targetReaderFactIds: [],
    });

    expect(result.directives.length).toBeGreaterThan(0);
    expect(result.allowedStatements).toHaveLength(0);

    for (const d of result.directives) {
      expect(d.kind).toBe('behavioral_directive');
    }
  });

  it('Non-POV directives reference belief keys not truth content', () => {
    const result = evaluateExpressionPolicy({
      character: nonPovCharacter,
      knownBeliefs: [
        {
          characterId: 'c2',
          beliefKey: 'secret_identity',
          content: 'Alice is actually Bob',
          confidence: 1.0,
          source: 'direct',
          allowedTransitionReasons: ['direct_experience'],
        },
      ],
      targetReaderFactIds: [],
    });

    expect(result.directives).toHaveLength(1);
    const directive = result.directives[0]!;
    expect(directive.content).not.toContain('Alice is actually Bob');
    expect(directive.content).toMatch(/secret.identity/);
  });
});
