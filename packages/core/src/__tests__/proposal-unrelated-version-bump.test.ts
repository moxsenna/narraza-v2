import { describe, expect, it } from 'vitest';
import { evaluateStalePolicy } from '../stale-policy.js';

describe('proposal-unrelated-version-bump', () => {
  it('global version bump with same dep hash → valid', () => {
    const result = evaluateStalePolicy({
      currentDependencyHash: 'abc123',
      proposalDependencyHash: 'abc123',
      proposalVersion: 1,
      currentCanonicalVersion: 42,
      depRevisionsChanged: false,
      regenerable: false,
    });

    expect(result.status).toBe('valid');
    expect(result.reason).toContain('hash matches');
  });

  it('dep revision change on non-regenerable → stale', () => {
    const result = evaluateStalePolicy({
      currentDependencyHash: 'abc123',
      proposalDependencyHash: 'def456',
      proposalVersion: 1,
      currentCanonicalVersion: 5,
      depRevisionsChanged: true,
      regenerable: false,
    });

    expect(result.status).toBe('stale');
    expect(result.reason).toContain('not regenerable');
  });

  it('dep revision change on regenerable → needs_revalidation', () => {
    const result = evaluateStalePolicy({
      currentDependencyHash: 'abc123',
      proposalDependencyHash: 'def456',
      proposalVersion: 1,
      currentCanonicalVersion: 5,
      depRevisionsChanged: true,
      regenerable: true,
    });

    expect(result.status).toBe('needs_revalidation');
    expect(result.reason).toContain('regenerable');
  });

  it('hash mismatch without explicit revision change → stale', () => {
    const result = evaluateStalePolicy({
      currentDependencyHash: 'abc123',
      proposalDependencyHash: 'def456',
      proposalVersion: 1,
      currentCanonicalVersion: 5,
      depRevisionsChanged: false,
      regenerable: true,
    });

    expect(result.status).toBe('stale');
    expect(result.reason).toContain('hash mismatch');
  });

  it('large version gap with same hash → still valid', () => {
    const result = evaluateStalePolicy({
      currentDependencyHash: 'samehash',
      proposalDependencyHash: 'samehash',
      proposalVersion: 1,
      currentCanonicalVersion: 999_999,
      depRevisionsChanged: false,
      regenerable: false,
    });

    expect(result.status).toBe('valid');
  });

  it('version unchanged with different hash → stale or revalidation', () => {
    const result = evaluateStalePolicy({
      currentDependencyHash: 'newhash',
      proposalDependencyHash: 'oldhash',
      proposalVersion: 1,
      currentCanonicalVersion: 1,
      depRevisionsChanged: true,
      regenerable: false,
    });

    expect(result.status).toBe('stale');
  });
});
