import { describe, expect, it } from 'vitest';
import { mergeFindings } from '../validator/merge-findings.js';
import type { Finding } from '../types.js';

function makeDetBlocker(code: string): Finding {
  return {
    code,
    severity: 'blocker',
    source: 'deterministic',
    message: `Deterministic blocker ${code}`,
    publicMessageCode: `det.${code}`,
    deterministic: true,
  };
}

function makeDetWarning(code: string): Finding {
  return {
    code,
    severity: 'warning',
    source: 'deterministic',
    message: `Deterministic warning ${code}`,
    publicMessageCode: `det.${code}`,
    deterministic: true,
  };
}

function makeAiBlocker(code: string): Finding {
  return {
    code,
    severity: 'blocker',
    source: 'ai',
    message: `AI blocker ${code}`,
    publicMessageCode: `ai.${code}`,
    deterministic: false,
  };
}

function makeAiWarning(code: string): Finding {
  return {
    code,
    severity: 'warning',
    source: 'ai',
    message: `AI warning ${code}`,
    publicMessageCode: `ai.${code}`,
    deterministic: false,
  };
}

describe('merge-findings', () => {
  it('passed = no blocking findings', () => {
    const result = mergeFindings({
      deterministicFindings: [],
      aiFindings: [],
    });
    expect(result.passed).toBe(true);
  });

  it('passed = false when any blocker present', () => {
    const result = mergeFindings({
      deterministicFindings: [makeDetBlocker('B1')],
      aiFindings: [makeAiWarning('W1')],
    });
    expect(result.passed).toBe(false);
    expect(result.findings).toHaveLength(2);
  });

  it('AI findings cannot remove deterministic blockers', () => {
    const deterFindings = [makeDetBlocker('B1')];
    // AI does not mention B1 at all
    const result = mergeFindings({
      deterministicFindings: deterFindings,
      aiFindings: [makeAiWarning('W1')],
    });

    // B1 must still be in merged findings
    const b1 = result.findings.find((f) => f.code === 'B1');
    expect(b1).toBeDefined();
    expect(b1!.severity).toBe('blocker');
    expect(b1!.source).toBe('deterministic');
    expect(result.passed).toBe(false);
  });

  it('AI findings cannot downgrade deterministic blockers', () => {
    const deterFindings = [makeDetBlocker('B1')];
    // AI claims B1 is just a warning
    const aiFindings: Finding[] = [
      {
        code: 'B1',
        severity: 'warning',
        source: 'ai',
        message: 'AI says minor',
        publicMessageCode: 'ai.B1',
        deterministic: false,
      },
    ];

    const result = mergeFindings({
      deterministicFindings: deterFindings,
      aiFindings,
    });

    expect(result.conflicts.length).toBeGreaterThan(0);
    expect(result.conflicts.some((c) => c.includes('downgrade'))).toBe(true);

    // The merged finding for B1 should still be a blocker
    const b1 = result.findings.find((f) => f.code === 'B1');
    expect(b1).toBeDefined();
    expect(b1!.severity).toBe('blocker');
    expect(b1!.source).toBe('deterministic');
  });

  it('AI can add new warnings without affecting deterministic blockers', () => {
    const result = mergeFindings({
      deterministicFindings: [makeDetBlocker('B1')],
      aiFindings: [makeAiWarning('W1'), makeAiWarning('W2')],
    });

    expect(result.findings).toHaveLength(3);
    expect(result.passed).toBe(false);
  });

  it('merges non-overlapping findings', () => {
    const result = mergeFindings({
      deterministicFindings: [makeDetBlocker('D1'), makeDetWarning('D2')],
      aiFindings: [makeAiBlocker('A1')],
    });

    expect(result.findings).toHaveLength(3);
    expect(result.findings.map((f) => f.code).sort()).toEqual(['A1', 'D1', 'D2']);
  });

  it('deterministic warnings override AI warnings with same code', () => {
    const result = mergeFindings({
      deterministicFindings: [makeDetWarning('SHARED')],
      aiFindings: [makeAiBlocker('SHARED')],
    });

    const shared = result.findings.find((f) => f.code === 'SHARED');
    expect(shared).toBeDefined();
    expect(shared!.source).toBe('deterministic');
    expect(shared!.severity).toBe('warning'); // deterministic warning overrides AI blocker
  });

  it('reports conflict when AI omits deterministic blocker', () => {
    const result = mergeFindings({
      deterministicFindings: [makeDetBlocker('MISSING_IN_AI')],
      aiFindings: [],
    });

    expect(result.conflicts.length).toBeGreaterThan(0);
    expect(result.conflicts.some((c) => c.includes('MISSING_IN_AI'))).toBe(true);
    expect(result.passed).toBe(false);
  });

  it('passed = true when only warnings and info', () => {
    const result = mergeFindings({
      deterministicFindings: [makeDetWarning('D1')],
      aiFindings: [makeAiWarning('A1')],
    });

    expect(result.passed).toBe(true);
  });
});
