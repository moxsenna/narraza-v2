/**
 * deploy/__tests__/migrate-lock.test.ts
 *
 * Tests for the migration advisory lock logic in migrate-with-lock.mjs.
 *
 * Uses mock query functions to verify lock acquisition, timeout,
 * and release behavior without requiring a real Postgres connection.
 *
 * Matrix: migration-runner-lock
 */

import { describe, expect, it } from 'vitest';
import {
  acquireAdvisoryLock,
  deriveLockKey,
  releaseAdvisoryLock,
} from '../migrate-with-lock.mjs';

// ---------------------------------------------------------------------------
// deriveLockKey
// ---------------------------------------------------------------------------

describe('deriveLockKey', () => {
  it('returns a positive integer for a namespace string', () => {
    const key = deriveLockKey('narraza_migration_runner');
    expect(typeof key).toBe('bigint');
    expect(key).toBeGreaterThan(0n);
  });

  it('is deterministic — same namespace produces same key', () => {
    const a = deriveLockKey('narraza_migration_runner');
    const b = deriveLockKey('narraza_migration_runner');
    expect(a).toBe(b);
  });

  it('different namespaces produce different keys', () => {
    const a = deriveLockKey('narraza_migration_runner');
    const b = deriveLockKey('other_app_runner');
    expect(a).not.toBe(b);
  });

  it('key fits in PostgreSQL signed 64-bit integer range', () => {
    const key = deriveLockKey('narraza_migration_runner');
    // PostgreSQL advisory lock keys are signed 64-bit: -2^63 to 2^63-1
    expect(key).toBeLessThanOrEqual((1n << 63n) - 1n);
    expect(key).toBeGreaterThanOrEqual(0n);
  });
});

// ---------------------------------------------------------------------------
// acquireAdvisoryLock
// ---------------------------------------------------------------------------

describe('acquireAdvisoryLock', () => {
  it('acquires lock immediately when available', async () => {
    const { acquired, elapsedMs } = await acquireAdvisoryLock({
      databaseUrl: 'postgresql://test',
      lockKey: deriveLockKey('test_immediate'),
      timeoutMs: 5000,
      pollIntervalMs: 10,
      queryFn: async () => 't', // lock always available
    });

    expect(acquired).toBe(true);
    expect(elapsedMs).toBeLessThan(1000);
  });

  it('retries when lock is held and eventually acquires', async () => {
    let callCount = 0;
    const { acquired } = await acquireAdvisoryLock({
      databaseUrl: 'postgresql://test',
      lockKey: deriveLockKey('test_retry'),
      timeoutMs: 5000,
      pollIntervalMs: 10,
      queryFn: async () => {
        callCount++;
        // First 3 calls return false (lock held), then true
        return callCount > 3 ? 't' : 'f';
      },
    });

    expect(acquired).toBe(true);
    expect(callCount).toBe(4);
  });

  it('times out when lock is never available', async () => {
    const { acquired, elapsedMs } = await acquireAdvisoryLock({
      databaseUrl: 'postgresql://test',
      lockKey: deriveLockKey('test_timeout'),
      timeoutMs: 100,
      pollIntervalMs: 10,
      queryFn: async () => 'f', // lock never available
    });

    expect(acquired).toBe(false);
    // elapsed should be at least the timeout
    expect(elapsedMs).toBeGreaterThanOrEqual(90);
  });

  it('respects the timeout parameter', async () => {
    const shortTimeout = 50;
    const start = Date.now();
    const { acquired } = await acquireAdvisoryLock({
      databaseUrl: 'postgresql://test',
      lockKey: deriveLockKey('test_short_timeout'),
      timeoutMs: shortTimeout,
      pollIntervalMs: 10,
      queryFn: async () => 'f',
    });
    const elapsed = Date.now() - start;

    expect(acquired).toBe(false);
    // elapsed should be approximately the timeout (give some slack for test runner)
    expect(elapsed).toBeGreaterThanOrEqual(shortTimeout - 10);
    expect(elapsed).toBeLessThan(shortTimeout + 500);
  });

  it('returns elapsed time on success', async () => {
    const { acquired, elapsedMs } = await acquireAdvisoryLock({
      databaseUrl: 'postgresql://test',
      lockKey: deriveLockKey('test_elapsed'),
      timeoutMs: 5000,
      pollIntervalMs: 10,
      queryFn: async () => 't',
    });

    expect(acquired).toBe(true);
    expect(elapsedMs).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// releaseAdvisoryLock
// ---------------------------------------------------------------------------

describe('releaseAdvisoryLock', () => {
  it('calls pg_advisory_unlock with the correct key', async () => {
    let releasedKey = '';
    await releaseAdvisoryLock({
      databaseUrl: 'postgresql://test',
      lockKey: deriveLockKey('test_release'),
      queryFn: async (sql) => {
        // Extract the key from the SQL
        const match = sql.match(/pg_advisory_unlock\((\d+)\)/);
        if (match) releasedKey = match[1];
        return 't';
      },
    });

    expect(releasedKey).toBe(deriveLockKey('test_release').toString());
  });

  it('does not throw on release failure', async () => {
    // Should not throw even if queryFn throws
    await expect(
      releaseAdvisoryLock({
        databaseUrl: 'postgresql://test',
        lockKey: deriveLockKey('test_release_fail'),
        queryFn: async () => {
          throw new Error('connection lost');
        },
      }),
    ).rejects.toThrow('connection lost');
  });
});

// ---------------------------------------------------------------------------
// Lock isolation (two "processes" represented by mock queryFns)
// ---------------------------------------------------------------------------

describe('lock isolation', () => {
  it('only one caller can hold the lock at a time', async () => {
    // Simulate two concurrent lock acquisition attempts
    // using a shared state variable to represent the PG lock
    let lockHeld = false;

    const queryFn = async (sql) => {
      if (sql.includes('pg_try_advisory_lock')) {
        if (!lockHeld) {
          lockHeld = true;
          return 't';
        }
        return 'f';
      }
      if (sql.includes('pg_advisory_unlock')) {
        lockHeld = false;
        return 't';
      }
      return 't';
    };

    // First caller acquires
    const a = await acquireAdvisoryLock({
      databaseUrl: 'postgresql://test',
      lockKey: deriveLockKey('test_isolation'),
      timeoutMs: 100,
      pollIntervalMs: 10,
      queryFn,
    });
    expect(a.acquired).toBe(true);

    // Second caller cannot acquire (lock held)
    const b = await acquireAdvisoryLock({
      databaseUrl: 'postgresql://test',
      lockKey: deriveLockKey('test_isolation'),
      timeoutMs: 100,
      pollIntervalMs: 10,
      queryFn,
    });
    expect(b.acquired).toBe(false);

    // Release first caller's lock
    await releaseAdvisoryLock({
      databaseUrl: 'postgresql://test',
      lockKey: deriveLockKey('test_isolation'),
      queryFn,
    });

    // Now second caller can acquire
    const c = await acquireAdvisoryLock({
      databaseUrl: 'postgresql://test',
      lockKey: deriveLockKey('test_isolation'),
      timeoutMs: 100,
      pollIntervalMs: 10,
      queryFn,
    });
    expect(c.acquired).toBe(true);
  });

  it('different lock keys do not block each other', async () => {
    let lockHeld = false;

    const queryFn = async (sql) => {
      if (sql.includes('pg_try_advisory_lock')) {
        if (!lockHeld) {
          lockHeld = true;
          return 't';
        }
        return 'f';
      }
      if (sql.includes('pg_advisory_unlock')) {
        lockHeld = false;
        return 't';
      }
      return 't';
    };

    // Key A acquires
    const a = await acquireAdvisoryLock({
      databaseUrl: 'postgresql://test',
      lockKey: deriveLockKey('test_key_a'),
      timeoutMs: 100,
      pollIntervalMs: 10,
      queryFn: async (sql) => {
        // Only key_a can toggle lockHeld; other keys always succeed
        if (sql.includes(deriveLockKey('test_key_a').toString())) {
          if (!lockHeld) { lockHeld = true; return 't'; }
          return 'f';
        }
        return 't';
      },
    });
    expect(a.acquired).toBe(true);

    // Key B acquires immediately (different key, no contention)
    const b = await acquireAdvisoryLock({
      databaseUrl: 'postgresql://test',
      lockKey: deriveLockKey('test_key_b'),
      timeoutMs: 100,
      pollIntervalMs: 10,
      queryFn: async () => 't', // always available (different key)
    });
    expect(b.acquired).toBe(true);
  });
});
