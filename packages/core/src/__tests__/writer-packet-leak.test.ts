import { describe, expect, it } from 'vitest';
import { buildWriterPacket } from '../context/writer-packet.js';

describe('writer-packet-leak', () => {
  it('serialized writer packet has no restricted truth fields', () => {
    const packet = buildWriterPacket({
      projectId: 'p1',
      beatId: 'b1',
      restrictedFacts: [
        { id: 'f1', truth: 'The killer is Andi', factKey: 'killer', category: 'identity' },
      ],
      writerSafeFacts: [
        { id: 'f2', surface: 'Someone is dead', factKey: 'death', category: 'event' },
      ],
      forbiddenConcepts: [
        { factId: 'f1', truth: 'The killer is Andi' },
      ],
    });
    const json = JSON.stringify(packet);
    expect(json).not.toContain('The killer is Andi');
    expect(json).not.toContain('restrictedFacts');
    expect(json).not.toContain('restrictedGuardSet');
    expect(packet.kind).toBe('writer_safe');
  });

  it('restricted facts are never present in writer packet', () => {
    const packet = buildWriterPacket({
      projectId: 'p1',
      beatId: 'b1',
      restrictedFacts: [
        { id: 'r1', truth: 'SECRET_1', factKey: 'secret1', category: 'twist' },
        { id: 'r2', truth: 'SECRET_2', factKey: 'secret2', category: 'twist' },
      ],
      writerSafeFacts: [
        { id: 's1', surface: 'Safe fact', factKey: 'safe', category: 'info' },
      ],
      forbiddenConcepts: [],
    });

    expect(packet.facts).toHaveLength(1);
    expect(packet.facts[0]!.id).toBe('s1');

    // Check the serialized form doesn't contain restricted truths
    const json = JSON.stringify(packet);
    expect(json).not.toContain('SECRET_1');
    expect(json).not.toContain('SECRET_2');
  });

  it('writer packet does not contain restrictedFacts field', () => {
    const packet = buildWriterPacket({
      projectId: 'p1',
      beatId: 'b1',
      restrictedFacts: [],
      writerSafeFacts: [],
      forbiddenConcepts: [],
    });

    expect(packet).not.toHaveProperty('restrictedFacts');
    expect(packet).not.toHaveProperty('restrictedGuardSet');
  });

  it('kind is always writer_safe', () => {
    const packet = buildWriterPacket({
      projectId: 'p1',
      beatId: 'b1',
      restrictedFacts: [{ id: 'f1', truth: 'TRUTH', factKey: 'k', category: 'cat' }],
      writerSafeFacts: [],
      forbiddenConcepts: [],
    });

    expect(packet.kind).toBe('writer_safe');
  });
});

describe('writer-guidance-safe', () => {
  it('writer guidance never embeds raw forbidden truth phrases', () => {
    const packet = buildWriterPacket({
      projectId: 'p1',
      beatId: 'b1',
      restrictedFacts: [
        { id: 'f1', truth: 'SECRET_TRUTH_XYZ', factKey: 'k', category: 'cat' },
      ],
      writerSafeFacts: [],
      forbiddenConcepts: [
        { factId: 'f1', truth: 'SECRET_TRUTH_XYZ' },
      ],
    });

    // Guidance may reference the fact key but NOT the forbidden truth
    for (const g of packet.writerGuidance ?? []) {
      expect(g).not.toContain('SECRET_TRUTH_XYZ');
    }
  });

  it('guidance uses only safe fact surfaces, not restricted truths', () => {
    const packet = buildWriterPacket({
      projectId: 'p1',
      beatId: 'b1',
      restrictedFacts: [
        { id: 'r1', truth: 'CONFIDENTIAL_DATA', factKey: 'conf', category: 'twist' },
      ],
      writerSafeFacts: [
        { id: 's1', surface: 'A known public detail', factKey: 'pub', category: 'setting' },
      ],
      forbiddenConcepts: [
        { factId: 'r1', truth: 'CONFIDENTIAL_DATA' },
      ],
    });

    const json = JSON.stringify(packet);
    expect(json).not.toContain('CONFIDENTIAL_DATA');
    expect(json).toContain('A known public detail');
  });

  it('multiple forbidden concepts are all excluded from guidance', () => {
    const packet = buildWriterPacket({
      projectId: 'p1',
      beatId: 'b1',
      restrictedFacts: [
        { id: 'r1', truth: 'FORBIDDEN_A', factKey: 'fa', category: 'cat' },
        { id: 'r2', truth: 'FORBIDDEN_B', factKey: 'fb', category: 'cat' },
      ],
      writerSafeFacts: [],
      forbiddenConcepts: [
        { factId: 'r1', truth: 'FORBIDDEN_A' },
        { factId: 'r2', truth: 'FORBIDDEN_B' },
      ],
    });

    const json = JSON.stringify(packet);
    expect(json).not.toContain('FORBIDDEN_A');
    expect(json).not.toContain('FORBIDDEN_B');
  });
});
