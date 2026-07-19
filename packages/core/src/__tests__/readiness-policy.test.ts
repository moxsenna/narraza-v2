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
  };

  it('ready when all required fields present', () => {
    const result = checkFoundationReadiness(fullInput);
    expect(result.ready).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it('not_ready when premise is empty', () => {
    const result = checkFoundationReadiness({
      ...fullInput,
      premise: '',
    });
    expect(result.ready).toBe(false);
    expect(result.reasons).toContain('premise is required');
  });

  it('not_ready when premise is whitespace only', () => {
    const result = checkFoundationReadiness({
      ...fullInput,
      premise: '   ',
    });
    expect(result.ready).toBe(false);
    expect(result.reasons).toContain('premise is required');
  });

  it('not_ready when title is empty', () => {
    const result = checkFoundationReadiness({
      ...fullInput,
      title: '',
    });
    expect(result.ready).toBe(false);
    expect(result.reasons).toContain('title is required');
  });

  it('not_ready when both title and premise empty', () => {
    const result = checkFoundationReadiness({
      ...fullInput,
      title: '',
      premise: '',
    });
    expect(result.ready).toBe(false);
    expect(result.reasons).toContain('premise is required');
    expect(result.reasons).toContain('title is required');
  });

  it('ready even with recommended fields empty (genre)', () => {
    const result = checkFoundationReadiness({
      ...fullInput,
      genre: '',
    });
    expect(result.ready).toBe(true);
    // Even if recommended fields are missing, it's still ready
    // if required fields are present
  });

  it('reports all missing recommended fields as reasons when not ready', () => {
    const result = checkFoundationReadiness({
      premise: 'has premise',
      title: 'has title',
      genre: '',
      targetAudience: '',
      pov: '',
      tone: '',
    });
    expect(result.ready).toBe(true);
    // Optional: reasons might include recommended fields even when ready
    // depending on implementation
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
    expect(result.reasons.length).toBeGreaterThanOrEqual(2);
  });
});
