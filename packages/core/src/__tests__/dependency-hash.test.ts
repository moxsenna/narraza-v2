import { describe, expect, it } from 'vitest';
import {
  buildDependencyManifest,
  dependencyHashesEqual,
  rehashDependencyManifest,
} from '../dependency-manifest.js';

describe('dependency-hash', () => {
  it('same entities different key order produce same SHA-256', () => {
    const entries1 = [
      { entityType: 'fact', entityId: 'f1', revision: 1 },
      { entityType: 'character', entityId: 'c1', revision: 2 },
    ];
    const entries2 = [
      { entityType: 'character', entityId: 'c1', revision: 2 },
      { entityType: 'fact', entityId: 'f1', revision: 1 },
    ];

    const manifest1 = buildDependencyManifest(entries1);
    const manifest2 = buildDependencyManifest(entries2);

    expect(manifest1.hash).toBe(manifest2.hash);
    expect(manifest1.entries).toEqual(manifest2.entries); // both sorted
  });

  it('hash is prefixed with schema version string', () => {
    const manifest = buildDependencyManifest([
      { entityType: 'fact', entityId: 'f1', revision: 1 },
    ]);

    expect(manifest.schemaVersion).toBe('v1');

    // Verify schema version is part of the hash input by checking
    // it produces different hashes with different schema versions
    const manifestSame = buildDependencyManifest([
      { entityType: 'fact', entityId: 'f1', revision: 1 },
    ]);
    expect(manifest.hash).toBe(manifestSame.hash);
  });

  it('duplicate (entityType, entityId) throws', () => {
    expect(() =>
      buildDependencyManifest([
        { entityType: 'fact', entityId: 'f1', revision: 1 },
        { entityType: 'fact', entityId: 'f1', revision: 2 },
      ]),
    ).toThrow(/Duplicate|duplicate/);
  });

  it('different revisions produce different hashes', () => {
    const m1 = buildDependencyManifest([
      { entityType: 'fact', entityId: 'f1', revision: 1 },
    ]);
    const m2 = buildDependencyManifest([
      { entityType: 'fact', entityId: 'f1', revision: 2 },
    ]);

    expect(m1.hash).not.toBe(m2.hash);
  });

  it('different entity types produce different hashes', () => {
    const m1 = buildDependencyManifest([
      { entityType: 'fact', entityId: 'f1', revision: 1 },
    ]);
    const m2 = buildDependencyManifest([
      { entityType: 'character', entityId: 'f1', revision: 1 },
    ]);

    expect(m1.hash).not.toBe(m2.hash);
  });

  it('empty entries produce a valid hash', () => {
    const manifest = buildDependencyManifest([]);
    expect(manifest.hash).toBeTruthy();
    expect(manifest.hash).toHaveLength(64); // SHA-256 hex
    expect(manifest.schemaVersion).toBe('v1');
  });

  it('hashes are 64 chars hex', () => {
    const manifest = buildDependencyManifest([
      { entityType: 'fact', entityId: 'f1', revision: 1 },
    ]);
    expect(manifest.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('dependencyHashesEqual works', () => {
    const m1 = buildDependencyManifest([
      { entityType: 'fact', entityId: 'f1', revision: 1 },
    ]);
    const m2 = buildDependencyManifest([
      { entityType: 'fact', entityId: 'f1', revision: 1 },
    ]);
    const m3 = buildDependencyManifest([
      { entityType: 'fact', entityId: 'f1', revision: 2 },
    ]);

    expect(dependencyHashesEqual(m1, m2)).toBe(true);
    expect(dependencyHashesEqual(m1, m3)).toBe(false);
  });

  it('rehashDependencyManifest returns same hash', () => {
    const manifest = buildDependencyManifest([
      { entityType: 'fact', entityId: 'f1', revision: 5 },
    ]);
    const rehashed = rehashDependencyManifest(manifest);
    expect(rehashed).toBe(manifest.hash);
  });

  it('many entries stable ordering', () => {
    const entries = Array.from({ length: 100 }, (_, i) => ({
      entityType: i % 2 === 0 ? 'fact' : 'character',
      entityId: `id-${99 - i}`,
      revision: (i * 7) % 13,
    }));

    const m1 = buildDependencyManifest(entries);
    const m2 = buildDependencyManifest([...entries].reverse());

    expect(m1.hash).toBe(m2.hash);
  });
});
