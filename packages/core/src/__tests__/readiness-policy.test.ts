import { describe, expect, it } from 'vitest';
import { checkFoundationReadiness } from '../readiness-policy.js';
import type { FoundationReadinessInput } from '../types.js';

describe('readiness-policy', () => {
  const fullInput: FoundationReadinessInput = {
    premise: 'A hero must save the world',
    title: 'The Epic Quest',
    genre: 'fantasy',
    targetAudience: 'young adult',
    pov: 'third person limited',
    tone: 'serious',
    emotionalPromise: 'hope after sacrifice',
    protagonist: 'Alya',
    mainConflict: 'Empire vs rebels',
    canonFacts: ['Harbor exists', 'Alya is orphan', 'Empire taxes grain'],
    targetChapterCount: 30,
    endingDirection: 'bittersweet victory',
    hasTwist: true,
    primarySecret: 'Alya is the emperor heir',
    secretRevealChapter: 25,
    characterNamingRules: 'Use titles only for nobles',
  };

  it('ready when full checklist present', () => {
    const result = checkFoundationReadiness(fullInput);
    expect(result.ready).toBe(true);
    expect(result.status).toBe('ready');
    expect(result.score).toBeGreaterThan(80);
    expect(result.blocking).toHaveLength(0);
  });

  it('not_ready when premise empty', () => {
    const result = checkFoundationReadiness({
      ...fullInput,
      premise: '',
    });
    expect(result.ready).toBe(false);
    expect(result.status).toBe('not_ready');
    expect(result.blocking.some((b) => b.includes('premise'))).toBe(true);
  });

  it('not_ready when title empty', () => {
    const result = checkFoundationReadiness({
      ...fullInput,
      title: '',
    });
    expect(result.status).toBe('not_ready');
    expect(result.blocking.some((b) => b.includes('title'))).toBe(true);
  });

  it('not_ready when genre missing (now required)', () => {
    const result = checkFoundationReadiness({
      ...fullInput,
      genre: '',
    });
    expect(result.ready).toBe(false);
    expect(result.blocking.some((b) => b.includes('genre'))).toBe(true);
  });

  it('not_ready with only title and premise', () => {
    const result = checkFoundationReadiness({
      premise: 'has premise',
      title: 'has title',
      genre: '',
      targetAudience: '',
      pov: '',
      tone: '',
    });
    expect(result.ready).toBe(false);
    expect(result.status).toBe('not_ready');
    expect(result.blocking.length).toBeGreaterThan(3);
  });

  it('not_ready when fewer than 3 canon facts', () => {
    const result = checkFoundationReadiness({
      ...fullInput,
      canonFacts: ['one', 'two'],
    });
    expect(result.blocking.some((b) => b.includes('3 canon'))).toBe(true);
  });

  it('not_ready when twist without secret schedule', () => {
    const result = checkFoundationReadiness({
      ...fullInput,
      hasTwist: true,
      primarySecret: '',
      secretRevealChapter: undefined,
    });
    expect(result.blocking.some((b) => b.includes('primarySecret'))).toBe(true);
    expect(result.blocking.some((b) => b.includes('secretRevealChapter'))).toBe(
      true,
    );
  });

  it('risky when required ok but pov/tone missing', () => {
    const result = checkFoundationReadiness({
      ...fullInput,
      pov: '',
      tone: '',
      characterNamingRules: '',
    });
    expect(result.status).toBe('risky');
    expect(result.ready).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('empty input is not ready', () => {
    const result = checkFoundationReadiness({
      premise: '',
      title: '',
      genre: '',
      targetAudience: '',
      pov: '',
      tone: '',
    });
    expect(result.ready).toBe(false);
    expect(result.status).toBe('not_ready');
  });
});
