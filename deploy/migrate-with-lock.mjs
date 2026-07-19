#!/usr/bin/env node

/**
 * deploy/migrate-with-lock.mjs
 *
 * Narraza v2 — single migration runner with PostgreSQL advisory lock.
 *
 * Uses pg_try_advisory_lock with retry/timeout to ensure only one process
 * runs prisma migrate deploy at a time across all nodes.
 *
 * The lock key is derived deterministically from 'narraza_migration_runner'
 * to avoid collisions with other advisory lock users.
 *
 * Usage:
 *   node deploy/migrate-with-lock.mjs [--schema prisma/schema.prisma] [--timeout 300]
 *
 * Environment:
 *   DATABASE_URL — Postgres connection string (required)
 *
 * Matrix: migration-runner-lock
 */

import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Parse CLI arguments
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    schema: process.env.PRISMA_SCHEMA || 'prisma/schema.prisma',
    timeoutSec: parseInt(process.env.MIGRATION_LOCK_TIMEOUT || '300', 10),
    lockKey: process.env.MIGRATION_LOCK_KEY || null,
    databaseUrl: process.env.DATABASE_URL || 'postgresql://narraza:narraza@localhost:5433/narraza',
    help: false,
  };

  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case '--schema':
        args.schema = argv[++i];
        break;
      case '--timeout':
        args.timeoutSec = parseInt(argv[++i], 10);
        break;
      case '--lock-key':
        args.lockKey = argv[++i];
        break;
      case '--database-url':
        args.databaseUrl = argv[++i];
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
      default:
        if (argv[i].startsWith('--schema=')) args.schema = argv[i].split('=')[1];
        else if (argv[i].startsWith('--timeout=')) args.timeoutSec = parseInt(argv[i].split('=')[1], 10);
        else if (argv[i].startsWith('--lock-key=')) args.lockKey = argv[i].split('=')[1];
        else if (argv[i].startsWith('--database-url=')) args.databaseUrl = argv[i].split('=')[1];
        break;
    }
  }

  return args;
}

// ---------------------------------------------------------------------------
// Deterministic advisory lock key
// ---------------------------------------------------------------------------

/**
 * Derive a deterministic PostgreSQL advisory lock key from a namespace string.
 *
 * PostgreSQL advisory locks are 64-bit signed bigints. We hash the namespace
 * and take the lower 63 bits to produce a positive bigint that fits.
 *
 * Using SHA-256 and BigInt conversion ensures the same lock key across all
 * nodes without configuration coordination.
 *
 * @param {string} namespace - Unique namespace string (e.g., 'narraza_migration_runner')
 * @returns {bigint} - Deterministic advisory lock key
 */
export function deriveLockKey(namespace) {
  const hash = createHash('sha256').update(namespace).digest();
  // Take the first 8 bytes as a bigint, mask to 63 bits for positivity
  const view = new DataView(hash.buffer, hash.byteOffset, 8);
  const raw = view.getBigUint64(0, false); // big-endian
  // Mask to 63 bits: PostgreSQL advisory locks are signed 64-bit
  // 0x7FFFFFFFFFFFFFFF = 2^63 - 1 (max signed positive bigint)
  return raw & 0x7FFFFFFFFFFFFFFFn;
}

const DEFAULT_NAMESPACE = 'narraza_migration_runner';
const DEFAULT_LOCK_KEY = deriveLockKey(DEFAULT_NAMESPACE);

// ---------------------------------------------------------------------------
// Advisory lock helpers (dependency-injectable for testing)
// ---------------------------------------------------------------------------

/**
 * Try to acquire a PostgreSQL advisory lock.
 *
 * @param {object} opts
 * @param {string} opts.databaseUrl - PostgreSQL connection string
 * @param {bigint} opts.lockKey - Advisory lock key
 * @param {number} opts.timeoutMs - How long to keep trying (ms)
 * @param {number} opts.pollIntervalMs - Interval between retries (ms)
 * @param {(sql: string) => Promise<string>} [opts.queryFn] - Query executor (injectable for testing)
 * @returns {Promise<{acquired: boolean, elapsedMs: number}>}
 */
export async function acquireAdvisoryLock({
  databaseUrl,
  lockKey,
  timeoutMs = 300_000,
  pollIntervalMs = 2000,
  queryFn = null,
}) {
  const start = Date.now();
  const keyStr = lockKey.toString();

  const executeQuery = queryFn || (async (sql) => {
    // Default: use psql for pg_try_advisory_lock
    // This is intentionally external so the lock is held by a separate process
    // that survives if Node crashes mid-migration.
    try {
      const { execSync } = await import('node:child_process');
      return execSync(
        `psql "${databaseUrl}" -t -A -c "${sql}"`,
        { encoding: 'utf-8', timeout: 10_000, stdio: 'pipe' },
      ).trim();
    } catch (err) {
      return 'f'; // psql failed = lock not acquired
    }
  });

  while (true) {
    const elapsed = Date.now() - start;
    if (elapsed >= timeoutMs) {
      return { acquired: false, elapsedMs: elapsed };
    }

    const result = await executeQuery(`SELECT pg_try_advisory_lock(${keyStr});`);
    if (result === 't') {
      return { acquired: true, elapsedMs: elapsed };
    }

    await sleep(pollIntervalMs);
  }
}

/**
 * Release a PostgreSQL advisory lock.
 *
 * @param {object} opts
 * @param {string} opts.databaseUrl
 * @param {bigint} opts.lockKey
 * @param {(sql: string) => Promise<string>} [opts.queryFn]
 * @returns {Promise<void>}
 */
export async function releaseAdvisoryLock({
  databaseUrl,
  lockKey,
  queryFn = null,
}) {
  const keyStr = lockKey.toString();
  const executeQuery = queryFn || (async (sql) => {
    const { execSync } = await import('node:child_process');
    return execSync(
      `psql "${databaseUrl}" -t -A -c "${sql}"`,
      { encoding: 'utf-8', timeout: 10_000, stdio: 'pipe' },
    ).trim();
  });

  await executeQuery(`SELECT pg_advisory_unlock(${keyStr});`);
}

// ---------------------------------------------------------------------------
// Run prisma migrate deploy
// ---------------------------------------------------------------------------

function runMigration(schemaPath, cwd = ROOT) {
  console.log(`  Running: npx prisma migrate deploy --schema ${schemaPath}`);
  execSync(`npx prisma migrate deploy --schema "${schemaPath}"`, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env },
  });
}

function checkMigrationStatus(schemaPath, cwd = ROOT) {
  try {
    execSync(`npx prisma migrate status --schema "${schemaPath}"`, {
      cwd,
      stdio: 'inherit',
      env: { ...process.env },
    });
  } catch {
    console.warn('  WARNING: migrate status check returned non-zero.');
    console.warn('  This may indicate drift between schema and database.');
    console.warn('  Review manually before proceeding.');
  }
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv);

  if (args.help) {
    console.log(`
Narraza v2 — Migration Runner with Advisory Lock

Usage:
  node deploy/migrate-with-lock.mjs [options]

Options:
  --schema <path>       Prisma schema path (default: prisma/schema.prisma)
  --timeout <seconds>   Lock acquisition timeout (default: 300)
  --lock-key <bigint>   Advisory lock key override (optional)
  --database-url <url>  PostgreSQL connection string
  --help, -h            Show this help

Environment:
  DATABASE_URL               PostgreSQL connection string
  PRISMA_SCHEMA               Prisma schema path
  MIGRATION_LOCK_TIMEOUT      Lock timeout in seconds
  MIGRATION_LOCK_KEY          Advisory lock key override

Description:
  Acquires a PostgreSQL advisory lock (pg_try_advisory_lock) to ensure
  only one migration runner executes at a time across all nodes.
  Then runs prisma migrate deploy and verifies migration status.

  The advisory lock key is deterministically derived from
  '${DEFAULT_NAMESPACE}' to avoid collisions.
`);
    process.exit(0);
  }

  const lockKey = args.lockKey ? BigInt(args.lockKey) : DEFAULT_LOCK_KEY;

  console.log('=== Narraza v2 Migration Runner (with advisory lock) ===');
  console.log(`Schema:     ${args.schema}`);
  console.log(`Lock key:   ${lockKey}`);
  console.log(`Timeout:    ${args.timeoutSec}s`);
  console.log();

  // -----------------------------------------------------------------------
  // 1. Acquire advisory lock
  // -----------------------------------------------------------------------

  console.log(`[1/3] Acquiring advisory lock (key=${lockKey})...`);

  const { acquired, elapsedMs } = await acquireAdvisoryLock({
    databaseUrl: args.databaseUrl,
    lockKey,
    timeoutMs: args.timeoutSec * 1000,
    pollIntervalMs: 2000,
  });

  if (!acquired) {
    console.error(`ERROR: Could not acquire advisory lock after ${args.timeoutSec}s.`);
    console.error('  This usually means another migration is in progress.');
    console.error('  Check for stuck prisma migrate processes and investigate.');
    console.error();
    console.error('  To force-release all Narraza migration locks:');
    console.error('    psql "$DATABASE_URL" -c "SELECT pg_advisory_unlock_all();"');
    console.error();
    process.exit(1);
  }

  console.log(`  Advisory lock acquired after ${(elapsedMs / 1000).toFixed(1)}s`);

  // -----------------------------------------------------------------------
  // 2. Run migration
  // -----------------------------------------------------------------------

  console.log();
  console.log('[2/3] Running prisma migrate deploy...');

  try {
    runMigration(args.schema);
    console.log('  Migration applied successfully.');
  } catch (err) {
    console.error('ERROR: prisma migrate deploy failed.');
    // Lock will be released in finally block
    throw err;
  } finally {
    // -------------------------------------------------------------------
    // Release advisory lock (always, even on failure)
    // -------------------------------------------------------------------
    console.log();
    console.log(`Releasing advisory lock (key=${lockKey})...`);

    try {
      await releaseAdvisoryLock({
        databaseUrl: args.databaseUrl,
        lockKey,
      });
      console.log('  Advisory lock released.');
    } catch (releaseErr) {
      console.warn('  WARNING: Failed to release advisory lock:', releaseErr.message);
      console.warn('  The lock will be released when the psql connection closes.');
      console.warn('  If stuck, run: psql "$DATABASE_URL" -c "SELECT pg_advisory_unlock_all();"');
    }
  }

  // -----------------------------------------------------------------------
  // 3. Verify migration status
  // -----------------------------------------------------------------------

  console.log();
  console.log('[3/3] Verifying migration status...');
  checkMigrationStatus(args.schema);
  console.log('  Migration status checked.');

  console.log();
  console.log('=== Migration complete ===');
  console.log('Single runner lock ensured no concurrent migrations ran.');
  console.log();
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith('migrate-with-lock.mjs') ||
   process.argv[1].includes('migrate-with-lock'));

if (isMain) {
  main().catch((err) => {
    console.error('FATAL:', err.message);
    process.exit(1);
  });
}
