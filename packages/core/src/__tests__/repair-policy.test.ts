import { describe, expect, it } from 'vitest';
import { evaluateRepairPolicy } from '../repair-policy.js';
import type { RepairState, Finding } from '../types.js';

function makeBlocker(code: string): Finding {
  return {
    code,
    severity: 'blocker',
    source: 'deterministic',
    message: `Blocker ${code}`,
    publicMessageCode: `pub.${code}`,
    deterministic: true,
  };
}

function makeWarning(code: string): Finding {
  return {
    code,
    severity: 'warning',
    source: 'ai',
    message: `Warning ${code}`,
    publicMessageCode: `pub.${code}`,
    deterministic: false,
  };
}

describe('repair-policy', () => {
  it('stop when all blocking resolved', () => {
    const state: RepairState = {
      attempts: 2,
      maxAttempts: 5,
      findingsHistory: [
        [makeBlocker('B1')],
        [makeBlocker('B1')],
      ],
      blockingResolved: false,
    };

    const result = evaluateRepairPolicy(state, [makeWarning('W1')]);
    expect(result.shouldStop).toBe(true);
    expect(result.reason).toBe('all_blocking_resolved');
  });

  it('stop when attempt limit reached', () => {
    const state: RepairState = {
      attempts: 5,
      maxAttempts: 5,
      findingsHistory: [
        [makeBlocker('B1')],
        [makeBlocker('B1')],
      ],
      blockingResolved: false,
    };

    const result = evaluateRepairPolicy(state, [makeBlocker('B1')]);
    expect(result.shouldStop).toBe(true);
    expect(result.reason).toBe('attempt_limit');
  });

  it('stop when no progress (same blocking count)', () => {
    const state: RepairState = {
      attempts: 3,
      maxAttempts: 5,
      findingsHistory: [
        [makeBlocker('B1'), makeBlocker('B2')],
        [makeBlocker('B1'), makeBlocker('B2')],
      ],
      blockingResolved: false,
    };

    const result = evaluateRepairPolicy(state, [
      makeBlocker('B1'),
      makeBlocker('B3'), // still 2 blockers
    ]);
    expect(result.shouldStop).toBe(true);
    expect(result.reason).toBe('no_progress');
  });

  it('continue when progress is made (fewer blockers)', () => {
    const state: RepairState = {
      attempts: 3,
      maxAttempts: 5,
      findingsHistory: [
        [makeBlocker('B1'), makeBlocker('B2'), makeBlocker('B3')],
      ],
      blockingResolved: false,
    };

    // Only one blocker now → progress
    const result = evaluateRepairPolicy(state, [makeBlocker('B1')]);
    expect(result.shouldStop).toBe(false);
    expect(result.reason).toBeNull();
  });

  it('stop on same_findings_repeated', () => {
    const state: RepairState = {
      attempts: 4,
      maxAttempts: 10,
      findingsHistory: [
        [makeBlocker('B1'), makeBlocker('B2')],
        [makeBlocker('B1'), makeBlocker('B2')],
        [makeBlocker('B1'), makeBlocker('B2')],
      ],
      blockingResolved: false,
    };

    // Same blocker codes again
    const result = evaluateRepairPolicy(state, [
      makeBlocker('B1'),
      makeBlocker('B2'),
    ]);
    expect(result.shouldStop).toBe(true);
    expect(result.reason).toBe('same_findings_repeated');
  });

  it('stop on regression (more blockers than initial)', () => {
    const state: RepairState = {
      attempts: 2,
      maxAttempts: 5,
      findingsHistory: [
        [makeBlocker('B1')],
      ],
      blockingResolved: false,
    };

    const result = evaluateRepairPolicy(state, [
      makeBlocker('B1'),
      makeBlocker('B2'),
      makeBlocker('B3'),
    ]);
    expect(result.shouldStop).toBe(true);
    expect(result.reason).toBe('regression');
  });

  it('does not trigger regression when first attempt', () => {
    const state: RepairState = {
      attempts: 1,
      maxAttempts: 5,
      findingsHistory: [],
      blockingResolved: false,
    };

    const result = evaluateRepairPolicy(state, [
      makeBlocker('B1'),
      makeBlocker('B2'),
    ]);
    expect(result.shouldStop).toBe(false);
  });

  it('all_blocking_resolved takes priority over other conditions', () => {
    const state: RepairState = {
      attempts: 10, // over attempt limit
      maxAttempts: 5,
      findingsHistory: [
        [makeBlocker('B1')],
        [makeBlocker('B1')],
      ],
      blockingResolved: false,
    };

    // But no blockers now
    const result = evaluateRepairPolicy(state, [makeWarning('W1')]);
    expect(result.shouldStop).toBe(true);
    // Even though attempt_limit would also trigger, all_blocking_resolved
    // is checked first and is the most desirable outcome
    expect(result.reason).toBe('all_blocking_resolved');
  });

  it('no progress with 0 blockers from previous should not stop if progress was already made', () => {
    const state: RepairState = {
      attempts: 3,
      maxAttempts: 5,
      findingsHistory: [
        [makeBlocker('B1'), makeBlocker('B2')],
        [], // already resolved once
      ],
      blockingResolved: false,
    };

    // Now all clear
    const result = evaluateRepairPolicy(state, []);
    expect(result.shouldStop).toBe(true);
    expect(result.reason).toBe('all_blocking_resolved');
  });

  it('continue when findings change codes but same blocker count (different blockers)', () => {
    const state: RepairState = {
      attempts: 2,
      maxAttempts: 5,
      findingsHistory: [
        [makeBlocker('B1')],
      ],
      blockingResolved: false,
    };

    // Different blocker, same count → no_progress triggers
    const result = evaluateRepairPolicy(state, [makeBlocker('B2')]);
    // Same count of blockers → no_progress
    expect(result.shouldStop).toBe(true);
    expect(result.reason).toBe('no_progress');
  });
});
