import { describe, expect, it } from 'vitest';
import {
  applyRevealPolicy,
  classifyFactsForWriter,
  type RevealPolicyFact,
} from '../reveal-policy.js';
import { buildWriterPacket } from '../context/writer-packet.js';

const majorReveal: RevealPolicyFact = {
  id: 'f-major',
  truth: 'The mayor is the cult leader',
  surface: 'The mayor is the cult leader',
  factKey: 'mayor.cult_leader',
  category: 'identity',
  revealStatus: 'scheduled',
  scheduledChapter: 25,
  breadcrumbSurface: 'The mayor avoids certain questions',
};

const publicFact: RevealPolicyFact = {
  id: 'f-public',
  truth: 'The town has a harbor',
  surface: 'The town has a harbor',
  factKey: 'setting.harbor',
  category: 'setting',
  revealStatus: 'revealed',
};

const hiddenFact: RevealPolicyFact = {
  id: 'f-hidden',
  truth: 'There is a second killer',
  surface: 'There is a second killer',
  factKey: 'plot.second_killer',
  category: 'twist',
  revealStatus: 'hidden',
};

describe('reveal-policy', () => {
  it('chapter 3: major ch25 reveal is restricted, not writer-safe truth', () => {
    const result = applyRevealPolicy({
      facts: [majorReveal, publicFact, hiddenFact],
      currentChapter: 3,
    });

    expect(result.restrictedFacts.map((f) => f.id)).toContain('f-major');
    expect(result.forbiddenConcepts.map((f) => f.factId)).toContain('f-major');

    const majorSafe = result.writerSafeFacts.find((f) => f.id === 'f-major');
    // breadcrumb only
    expect(majorSafe?.surface).toBe('The mayor avoids certain questions');
    expect(majorSafe?.surface).not.toContain('cult leader');

    const json = JSON.stringify(result.writerSafeFacts);
    expect(json).not.toContain('The mayor is the cult leader');
    expect(json).not.toContain('There is a second killer');
    expect(json).toContain('The town has a harbor');
  });

  it('chapter 25: scheduled major reveal becomes writer-safe', () => {
    const result = applyRevealPolicy({
      facts: [majorReveal],
      currentChapter: 25,
    });

    expect(result.restrictedFacts).toHaveLength(0);
    expect(result.forbiddenConcepts).toHaveLength(0);
    expect(result.writerSafeFacts).toHaveLength(1);
    expect(result.writerSafeFacts[0]!.surface).toContain('cult leader');
  });

  it('chapter 24: still restricted (scheduled is inclusive at target chapter)', () => {
    const result = applyRevealPolicy({
      facts: [majorReveal],
      currentChapter: 24,
    });
    expect(result.restrictedFacts).toHaveLength(1);
    expect(result.writerSafeFacts[0]?.surface).not.toContain('cult leader');
  });

  it('hidden facts never become writer-safe', () => {
    const result = classifyFactsForWriter([hiddenFact], 999);
    expect(result.writerSafeFacts).toHaveLength(0);
    expect(result.restrictedFacts).toHaveLength(1);
    expect(result.forbiddenConcepts[0]!.truth).toBe('There is a second killer');
  });

  it('strips breadcrumb that accidentally embeds full truth', () => {
    const leaky: RevealPolicyFact = {
      ...majorReveal,
      id: 'f-leaky',
      breadcrumbSurface: 'Hint: The mayor is the cult leader',
    };
    const result = applyRevealPolicy({ facts: [leaky], currentChapter: 3 });
    // breadcrumb contains truth → not added as safe (or stripped)
    const surfaces = result.writerSafeFacts.map((f) => f.surface).join('|');
    expect(surfaces).not.toContain('The mayor is the cult leader');
  });

  it('writer packet built from policy never contains hidden future truth', () => {
    const policy = applyRevealPolicy({
      facts: [majorReveal, publicFact, hiddenFact],
      currentChapter: 3,
    });

    const packet = buildWriterPacket({
      projectId: 'p1',
      beatId: 'b-ch3',
      restrictedFacts: policy.restrictedFacts,
      writerSafeFacts: policy.writerSafeFacts,
      forbiddenConcepts: policy.forbiddenConcepts,
    });

    const json = JSON.stringify(packet);
    expect(json).not.toContain('The mayor is the cult leader');
    expect(json).not.toContain('There is a second killer');
    expect(json).toContain('The town has a harbor');
    expect(packet.kind).toBe('writer_safe');
    expect(packet).not.toHaveProperty('restrictedFacts');
  });
});
