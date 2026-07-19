#!/usr/bin/env node

/**
 * deploy/build-release.mjs
 *
 * Build an immutable release artifact and generate a release manifest.
 *
 * Order (design S10):
 *   1. Build application (Next.js + workers)
 *   2. Package into tarball (immutable artifact)
 *   3. Generate release-manifest.json with gitSha, builtAt, checksum
 *
 * Build BEFORE any migrate.
 *
 * Usage:
 *   node deploy/build-release.mjs [--output-dir ./releases]
 *
 * Matrix: deploy-checksum
 */

import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import { createReadStream, createWriteStream } from 'node:fs';
import { tmpdir } from 'node:os';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const ROOT = resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const pkg = require(join(ROOT, 'package.json'));
const VERSION = pkg.version || '0.0.0';

// Files to include in the tarball
const INCLUDE_PATTERNS = [
  'apps/web/.next/**',        // Next.js build output
  'apps/worker-gen/dist/**',  // Worker build output
  'apps/worker-outbox/dist/**',
  'packages/*/dist/**',       // Packages build output
  'prisma/schema.prisma',
  'prisma/migrations/**',
  'package.json',
  'package-lock.json',
  'node_modules/.prisma/**',  // Prisma generated client
  'node_modules/@prisma/client/**',
  'deploy/ecosystem.config.cjs',
];

// Files/dirs to exclude
const EXCLUDE_PATTERNS = [
  'node_modules/.cache/**',
  '**/*.tsbuildinfo',
  '**/tsconfig.tsbuildinfo',
  '**/*.map',                 // Exclude source maps from release
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sh(cmd, opts = {}) {
  console.log(`  $ ${cmd}`);
  return execSync(cmd, {
    cwd: ROOT,
    stdio: 'inherit',
    ...opts,
  });
}

function shCapture(cmd, opts = {}) {
  return execSync(cmd, {
    cwd: ROOT,
    encoding: 'utf-8',
    stdio: 'pipe',
    ...opts,
  }).trim();
}

/**
 * Compute SHA-256 hash of a file.
 */
async function sha256File(filePath) {
  const hash = createHash('sha256');
  const stream = createReadStream(filePath);
  for await (const chunk of stream) {
    hash.update(chunk);
  }
  return hash.digest('hex');
}

/**
 * Get current git SHA (short + full).
 */
function getGitInfo() {
  try {
    const sha = shCapture('git rev-parse HEAD');
    const shortSha = shCapture('git rev-parse --short HEAD');
    const branch = shCapture('git rev-parse --abbrev-ref HEAD');
    return { sha, shortSha, branch };
  } catch {
    return { sha: 'unknown', shortSha: 'unknown', branch: 'unknown' };
  }
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

function buildAll() {
  console.log('\n[1/4] Installing dependencies...');
  sh('npm ci --production=false');

  console.log('\n[2/4] Generating Prisma client...');
  sh('npx prisma generate --schema prisma/schema.prisma');

  console.log('\n[3/4] Building packages...');
  // Build all packages first (workers depend on them)
  sh('npm run build --workspaces --if-present', { shell: true });

  console.log('\n[4/4] Building Next.js web app...');
  // chdir into apps/web for next build
  sh('npx next build', { cwd: join(ROOT, 'apps/web') });

  console.log('  Build complete.');
}

// ---------------------------------------------------------------------------
// Package artifact
// ---------------------------------------------------------------------------

async function packageArtifact() {
  const outputDir = resolve(ROOT, process.env.RELEASE_OUTPUT_DIR || 'releases');
  mkdirSync(outputDir, { recursive: true });

  const gitInfo = getGitInfo();
  const builtAt = new Date().toISOString();
  const artifactName = `narraza-${VERSION}-${gitInfo.shortSha}.tar.gz`;
  const artifactPath = join(outputDir, artifactName);

  console.log(`\n[Package] Creating tarball: ${artifactPath}`);

  // Build tar include list
  // tar on Windows (Git Bash) works fine
  const includeArgs = INCLUDE_PATTERNS.flatMap((p) => ['--include', p]);
  const excludeArgs = EXCLUDE_PATTERNS.flatMap((p) => ['--exclude', p]);

  try {
    sh(
      `tar -czf "${artifactPath}" ${includeArgs.join(' ')} ${excludeArgs.join(' ')} .`,
      { stdio: 'pipe' },
    );
  } catch {
    // Fallback: create a simpler tarball with explicit file list
    console.log('  tar with patterns failed, using simple tarball...');
    const fileList = shCapture('find . -type f -not -path "./node_modules/*" -not -path "./.git/*" -not -path "./.data/*" -not -path "./dist/*" -not -path "*.tsbuildinfo"');
    const listPath = join(tmpdir(), 'narraza-release-files.txt');
    writeFileSync(listPath, fileList);
    sh(`tar -czf "${artifactPath}" -T "${listPath}"`);
  }

  // Compute checksum
  console.log('  Computing SHA-256 checksum...');
  const checksum = await sha256File(artifactPath);

  // Generate manifest
  const manifest = {
    name: pkg.name || 'narraza',
    version: VERSION,
    artifact: artifactName,
    checksum: { algorithm: 'sha256', value: checksum },
    git: {
      sha: gitInfo.sha,
      shortSha: gitInfo.shortSha,
      branch: gitInfo.branch,
    },
    builtAt,
    builtBy: process.env.USER || process.env.USERNAME || 'unknown',
    nodeVersion: process.version,
  };

  const manifestPath = join(outputDir, 'release-manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

  console.log(`\n  Artifact:  ${artifactPath}`);
  console.log(`  Manifest:  ${manifestPath}`);
  console.log(`  Checksum:  ${checksum}`);
  console.log(`  Git SHA:   ${gitInfo.shortSha}`);
  console.log(`  Built at:  ${builtAt}`);

  return { artifactName, artifactPath, manifest, checksum };
}

// ---------------------------------------------------------------------------
// Verify artifact
// ---------------------------------------------------------------------------

export async function verifyArtifact(artifactPath, manifest) {
  console.log('\n[Verify] Verifying artifact checksum...');
  const actualChecksum = await sha256File(artifactPath);
  if (actualChecksum !== manifest.checksum.value) {
    throw new Error(
      `Checksum mismatch!\n` +
        `  Expected: ${manifest.checksum.value}\n` +
        `  Actual:   ${actualChecksum}\n` +
        `  ABORTING — artifact may be corrupted or tampered.`,
    );
  }
  console.log(`  Checksum OK: ${actualChecksum}`);
  return true;
}

/**
 * Verify a checksum from manifest file.
 * Returns { ok: true } or { ok: false, reason: string }.
 */
export async function verifyChecksumFromManifest(artifactPath, manifestPath) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  try {
    await verifyArtifact(artifactPath, manifest);
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== Narraza v2 Release Builder ===\n');

  const skipBuild = process.argv.includes('--skip-build');

  if (!skipBuild) {
    buildAll();
  }

  const result = await packageArtifact();

  console.log('\n=== Release artifact ready ===');
  console.log('Next steps:');
  console.log(`  1. Upload ${result.artifactName} to VPS releases directory`);
  console.log('  2. Run deploy/release.sh on VPS');
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith('build-release.mjs') || process.argv[1].includes('build-release'));

if (isMain) {
  main().catch((err) => {
    console.error('FATAL:', err.message);
    process.exit(1);
  });
}
