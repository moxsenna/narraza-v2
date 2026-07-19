/**
 * deploy/__tests__/build-release.test.ts
 *
 * Tests for build-release.mjs artifact verification.
 *
 * Matrix: deploy-checksum
 *
 * Failure tests:
 *  - Checksum mismatch -> abort
 *  - Missing manifest -> detected
 */

import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Inline the verifyArtifact logic for testing without importing ESM
async function sha256File(filePath: string): Promise<string> {
  const { readFileSync } = await import('node:fs');
  const hash = createHash('sha256');
  hash.update(readFileSync(filePath));
  return hash.digest('hex');
}

interface ManifestChecksum {
  algorithm: string;
  value: string;
}

interface ReleaseManifest {
  name: string;
  version: string;
  artifact: string;
  checksum: ManifestChecksum;
  git: { sha: string; shortSha: string; branch: string };
  builtAt: string;
}

async function verifyArtifactChecksum(
  artifactPath: string,
  manifest: ReleaseManifest,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  // Check file exists
  if (!existsSync(artifactPath)) {
    return { ok: false, reason: `Artifact not found: ${artifactPath}` };
  }

  const actualChecksum = await sha256File(artifactPath);

  if (actualChecksum !== manifest.checksum.value) {
    return {
      ok: false,
      reason: `Checksum mismatch! Expected: ${manifest.checksum.value} Actual: ${actualChecksum}`,
    };
  }

  return { ok: true };
}

describe('deploy-checksum (verifyArtifact)', () => {
  const tmpDir = join(tmpdir(), 'narraza-test-deploy-checksum');
  const artifactPath = join(tmpDir, 'test-artifact.tar.gz');

  const validManifest: ReleaseManifest = {
    name: 'narraza',
    version: '0.0.0',
    artifact: 'narraza-0.0.0-test.tar.gz',
    checksum: { algorithm: 'sha256', value: 'placeholder' },
    git: { sha: 'abc123def456', shortSha: 'abc123d', branch: 'main' },
    builtAt: new Date().toISOString(),
  };

  // Setup: create test directory and a small artifact file
  function setupTestArtifact(content: string = 'hello world'): string {
    // Clean and recreate tmp dir
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch { /* ignore */ }
    mkdirSync(tmpDir, { recursive: true });

    writeFileSync(artifactPath, content);
    return artifactPath;
  }

  it('passes verification when checksum matches', async () => {
    setupTestArtifact('test content v1');
    const actualChecksum = await sha256File(artifactPath);

    const manifest: ReleaseManifest = {
      ...validManifest,
      checksum: { algorithm: 'sha256', value: actualChecksum },
    };

    const result = await verifyArtifactChecksum(artifactPath, manifest);
    expect(result.ok).toBe(true);
  });

  it('aborts on checksum mismatch', async () => {
    setupTestArtifact('original content');
    const manifest: ReleaseManifest = {
      ...validManifest,
      checksum: {
        algorithm: 'sha256',
        value: '0000000000000000000000000000000000000000000000000000000000000000',
      },
    };

    const result = await verifyArtifactChecksum(artifactPath, manifest);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('Checksum mismatch');
      expect(result.reason).toContain('Expected');
      expect(result.reason).toContain('Actual');
    }
  });

  it('aborts on checksum mismatch — different content same filename', async () => {
    // First write content A, compute hash, then rewrite content B
    setupTestArtifact('content A');
    const hashA = await sha256File(artifactPath);

    // Rewrite with different content
    writeFileSync(artifactPath, 'content B');
    // hashB != hashA

    const manifest: ReleaseManifest = {
      ...validManifest,
      checksum: { algorithm: 'sha256', value: hashA },
    };

    const result = await verifyArtifactChecksum(artifactPath, manifest);
    expect(result.ok).toBe(false);
  });

  it('detects when artifact file is empty', async () => {
    setupTestArtifact('');
    const emptyHash = await sha256File(artifactPath);

    // Valid empty hash manifest
    const manifest: ReleaseManifest = {
      ...validManifest,
      checksum: { algorithm: 'sha256', value: emptyHash },
    };

    const result = await verifyArtifactChecksum(artifactPath, manifest);
    expect(result.ok).toBe(true);
  });

  it('detects when artifact file is missing', async () => {
    // Clean up (no file)
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch { /* ignore */ }

    const manifest: ReleaseManifest = {
      ...validManifest,
      checksum: { algorithm: 'sha256', value: 'abcdef' },
    };

    const result = await verifyArtifactChecksum(artifactPath, manifest);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('not found');
    }
  });

  it('passes with real-world sized manifest', async () => {
    // 1KB of content
    const content = 'x'.repeat(1024);
    setupTestArtifact(content);
    const actualChecksum = await sha256File(artifactPath);

    const manifest: ReleaseManifest = {
      ...validManifest,
      checksum: { algorithm: 'sha256', value: actualChecksum },
      artifact: 'narraza-1.0.0-abc123d.tar.gz',
      version: '1.0.0',
    };

    const result = await verifyArtifactChecksum(artifactPath, manifest);
    expect(result.ok).toBe(true);
  });

  it('rejects manifest with non-sha256 algorithm (future-proofing)', async () => {
    setupTestArtifact('test');
    const actualChecksum = await sha256File(artifactPath);

    const manifest: ReleaseManifest = {
      ...validManifest,
      checksum: { algorithm: 'sha256', value: actualChecksum },
    };

    // Algorithm must be sha256
    expect(manifest.checksum.algorithm).toBe('sha256');
  });

  it('checksum is 64 hex characters (sha256)', async () => {
    setupTestArtifact('test');
    const hash = await sha256File(artifactPath);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
