import { describe, expect, it } from 'vitest';
import { foldDisclosures } from '../disclosure-policy.js';
import type { DisclosureEvent } from '../types.js';

describe('disclosure-fold', () => {
  it('folds disclosures in deterministic order: sequence, createdAt, id', () => {
    const events: DisclosureEvent[] = [
      { factId: 'f1', target: 'reader', createdAt: '2024-03-01T00:00:00Z', id: 'e3', sequence: 2 },
      { factId: 'f2', target: 'reader', createdAt: '2024-01-01T00:00:00Z', id: 'e1', sequence: 1 },
      { factId: 'f3', target: 'reader', createdAt: '2024-02-01T00:00:00Z', id: 'e2', sequence: 1 },
    ];

    const result = foldDisclosures(events);

    expect(result.disclosures).toHaveLength(3);

    // e2 (seq 1, 2024-02-01) comes before e1 (seq 1, 2024-01-01) — wait:
    // seq 1 items: e1 (2024-01-01), e2 (2024-02-01) → sorted by createdAt asc:
    // e1 first, then e2, then e3 (seq 2)
    expect(result.disclosures[0]!.id).toBe('e1');
    expect(result.disclosures[1]!.id).toBe('e2');
    expect(result.disclosures[2]!.id).toBe('e3');
  });

  it('retraction target is the last disclosure by order', () => {
    const events: DisclosureEvent[] = [
      { factId: 'f1', target: 'reader', createdAt: '2024-01-01T00:00:00Z', id: 'a', sequence: 1 },
      { factId: 'f2', target: 'reader', createdAt: '2024-01-02T00:00:00Z', id: 'b', sequence: 2 },
      { factId: 'f3', target: 'reader', createdAt: '2024-01-03T00:00:00Z', id: 'c', sequence: 3 },
    ];

    const result = foldDisclosures(events);
    expect(result.retractionTarget).toBe('c');
  });

  it('empty list produces null retraction target', () => {
    const result = foldDisclosures([]);
    expect(result.disclosures).toHaveLength(0);
    expect(result.retractionTarget).toBeNull();
  });

  it('same sequence ties broken by createdAt', () => {
    const events: DisclosureEvent[] = [
      { factId: 'f1', target: 'reader', createdAt: '2024-06-01T00:00:00Z', id: 'z', sequence: 5 },
      { factId: 'f2', target: 'reader', createdAt: '2024-01-01T00:00:00Z', id: 'y', sequence: 5 },
      { factId: 'f3', target: 'reader', createdAt: '2024-03-01T00:00:00Z', id: 'x', sequence: 5 },
    ];

    const result = foldDisclosures(events);

    expect(result.disclosures[0]!.id).toBe('y'); // earliest createdAt
    expect(result.disclosures[1]!.id).toBe('x');
    expect(result.disclosures[2]!.id).toBe('z'); // latest createdAt
  });

  it('same sequence and createdAt ties broken by id', () => {
    const events: DisclosureEvent[] = [
      { factId: 'f1', target: 'reader', createdAt: '2024-01-01T00:00:00Z', id: 'c', sequence: 1 },
      { factId: 'f2', target: 'reader', createdAt: '2024-01-01T00:00:00Z', id: 'a', sequence: 1 },
      { factId: 'f3', target: 'reader', createdAt: '2024-01-01T00:00:00Z', id: 'b', sequence: 1 },
    ];

    const result = foldDisclosures(events);

    expect(result.disclosures[0]!.id).toBe('a');
    expect(result.disclosures[1]!.id).toBe('b');
    expect(result.disclosures[2]!.id).toBe('c');
  });

  it('fold is deterministic (repeat calls produce same result)', () => {
    const events: DisclosureEvent[] = [
      { factId: 'f1', target: 'reader', createdAt: '2024-02-01T00:00:00Z', id: 'b', sequence: 2 },
      { factId: 'f2', target: 'reader', createdAt: '2024-01-01T00:00:00Z', id: 'a', sequence: 1 },
    ];

    const result1 = foldDisclosures(events);
    const result2 = foldDisclosures(events);

    expect(result1.retractionTarget).toBe(result2.retractionTarget);
    expect(result1.disclosures.map((d) => d.id)).toEqual(
      result2.disclosures.map((d) => d.id),
    );
  });
});
