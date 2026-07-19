import { describe, expect, it } from 'vitest';
import { validateBeliefTransition } from '../knowledge-policy.js';
import type { Belief, BeliefTransition, BeliefTransitionReason } from '../types.js';

describe('belief-transition', () => {
  const baseBelief: Belief = {
    characterId: 'c1',
    beliefKey: 'suspect',
    content: 'The butler did it',
    confidence: 0.6,
    source: 'hunch',
    allowedTransitionReasons: ['direct_experience', 'trusted_report'],
  };

  it('belief downgrade with allowed reason → accepted', () => {
    const transition: BeliefTransition = {
      from: baseBelief,
      to: { ...baseBelief, confidence: 0.3 },
      reason: 'direct_experience',
    };

    const result = validateBeliefTransition(transition);
    expect(result.accepted).toBe(true);
    expect(result.reason).toBe('direct_experience');
    expect(result.violations).toHaveLength(0);
  });

  it('belief downgrade without allowed reason → rejected', () => {
    const transition: BeliefTransition = {
      from: baseBelief,
      to: { ...baseBelief, confidence: 0.2 },
      reason: 'discovery' as BeliefTransitionReason,
    };

    const result = validateBeliefTransition(transition);
    expect(result.accepted).toBe(false);
    expect(result.reason).toBeNull();
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations.some((v) => v.includes('not allowed'))).toBe(true);
  });

  it('belief upgrade with allowed reason → accepted', () => {
    const transition: BeliefTransition = {
      from: baseBelief,
      to: { ...baseBelief, confidence: 0.95 },
      reason: 'trusted_report',
    };

    const result = validateBeliefTransition(transition);
    expect(result.accepted).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('belief upgrade with disallowed reason → rejected', () => {
    const transition: BeliefTransition = {
      from: baseBelief,
      to: { ...baseBelief, confidence: 0.95 },
      reason: 'logical_deduction' as BeliefTransitionReason,
    };

    const result = validateBeliefTransition(transition);
    expect(result.accepted).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it('same confidence + allowed reason (no change) is still validated', () => {
    // The transition still checks reason membership; no-change is not a violation here
    // since the policy checks reasons for any transition
    const transition: BeliefTransition = {
      from: baseBelief,
      to: { ...baseBelief, confidence: 0.6 },
      reason: 'direct_experience',
    };

    const result = validateBeliefTransition(transition);
    // If confidence is the same, downgrade/upgrade rules don't fire,
    // but the general reason check still applies
    expect(result.accepted).toBe(true);
  });

  it('reports all violations for a bad transition', () => {
    const transition: BeliefTransition = {
      from: baseBelief,
      to: { ...baseBelief, confidence: 0.1 },
      reason: 'discovery' as BeliefTransitionReason,
    };

    const result = validateBeliefTransition(transition);
    expect(result.accepted).toBe(false);
    // Should have at least the general not-allowed and downgrade violations
    expect(result.violations.length).toBeGreaterThanOrEqual(1);
    expect(result.violations.some((v) => v.includes('discovery'))).toBe(true);
  });

  it('strict belief with only direct_experience rejects trusted_report downgrade', () => {
    const strictBelief: Belief = {
      characterId: 'c1',
      beliefKey: 'strict',
      content: 'hard truth',
      confidence: 0.9,
      source: 'core',
      allowedTransitionReasons: ['direct_experience'],
    };

    const transition: BeliefTransition = {
      from: strictBelief,
      to: { ...strictBelief, confidence: 0.3 },
      reason: 'trusted_report' as BeliefTransitionReason,
    };

    const result = validateBeliefTransition(transition);
    expect(result.accepted).toBe(false);
  });
});
