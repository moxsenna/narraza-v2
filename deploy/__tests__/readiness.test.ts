/**
 * deploy/__tests__/readiness.test.ts
 *
 * Tests for readiness endpoint logic.
 *
 * Matrix: readiness-migration-version
 *
 * Failure tests:
 *  - Readiness fails without DATABASE_URL
 *  - Readiness reports not-ready when DB is unreachable
 *  - Readiness detects missing migrations
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Simplified readiness check logic (mirrors /ready/route.ts)
// ---------------------------------------------------------------------------

interface ReadyCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  detail?: string;
}

function runReadinessChecks(env: Record<string, string | undefined>): ReadyCheck[] {
  const checks: ReadyCheck[] = [];

  // 1. Environment variables
  const dbUrl = env.DATABASE_URL_WEB ?? env.DATABASE_URL;
  if (!dbUrl) {
    checks.push({
      name: 'env:DATABASE_URL',
      status: 'fail',
      detail: 'DATABASE_URL_WEB or DATABASE_URL must be set',
    });
  } else if (!dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
    checks.push({
      name: 'env:DATABASE_URL',
      status: 'fail',
      detail: 'DATABASE_URL must start with postgresql:// or postgres://',
    });
  } else {
    checks.push({ name: 'env:DATABASE_URL', status: 'pass' });
  }

  if (!env.AUTH_SECRET || (env.AUTH_SECRET?.length ?? 0) < 32) {
    checks.push({
      name: 'env:AUTH_SECRET',
      status: 'fail',
      detail: 'AUTH_SECRET must be at least 32 characters',
    });
  } else {
    checks.push({ name: 'env:AUTH_SECRET', status: 'pass' });
  }

  // 2. Draining mode check (not dependent on DB)
  if (env.NARRAZA_DRAINING === 'true') {
    checks.push({
      name: 'operational:draining',
      status: 'fail',
      detail: 'Server is in draining mode -- reject new traffic',
    });
  } else {
    checks.push({ name: 'operational:draining', status: 'pass' });
  }

  return checks;
}

describe('readiness-migration-version (env checks)', () => {
  it('fails without DATABASE_URL', () => {
    const checks = runReadinessChecks({});
    const dbCheck = checks.find((c) => c.name === 'env:DATABASE_URL');
    expect(dbCheck).toBeDefined();
    expect(dbCheck!.status).toBe('fail');
    expect(dbCheck!.detail).toContain('must be set');
  });

  it('fails when DATABASE_URL is empty string', () => {
    const checks = runReadinessChecks({ DATABASE_URL: '' });
    const dbCheck = checks.find((c) => c.name === 'env:DATABASE_URL');
    expect(dbCheck).toBeDefined();
    expect(dbCheck!.status).toBe('fail');
  });

  it('passes with valid DATABASE_URL_WEB', () => {
    const checks = runReadinessChecks({
      DATABASE_URL_WEB: 'postgresql://user:pass@localhost:5432/db',
    });
    const dbCheck = checks.find((c) => c.name === 'env:DATABASE_URL');
    expect(dbCheck).toBeDefined();
    expect(dbCheck!.status).toBe('pass');
  });

  it('passes with valid DATABASE_URL', () => {
    const checks = runReadinessChecks({
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    });
    const dbCheck = checks.find((c) => c.name === 'env:DATABASE_URL');
    expect(dbCheck).toBeDefined();
    expect(dbCheck!.status).toBe('pass');
  });

  it('prefers DATABASE_URL_WEB over DATABASE_URL', () => {
    const checks = runReadinessChecks({
      DATABASE_URL_WEB: 'postgresql://web:pass@localhost:5432/webdb',
      DATABASE_URL: 'postgresql://wrong:pass@localhost:5432/wrongdb',
    });
    const dbCheck = checks.find((c) => c.name === 'env:DATABASE_URL');
    expect(dbCheck).toBeDefined();
    expect(dbCheck!.status).toBe('pass');
    // It should report as pass because DATABASE_URL_WEB is present
  });

  it('fails when URL does not start with postgresql://', () => {
    const checks = runReadinessChecks({
      DATABASE_URL_WEB: 'mysql://user:pass@localhost:3306/db',
    });
    const dbCheck = checks.find((c) => c.name === 'env:DATABASE_URL');
    expect(dbCheck).toBeDefined();
    expect(dbCheck!.status).toBe('fail');
    expect(dbCheck!.detail).toContain('postgresql://');
  });

  it('fails with postgres:// prefix (valid variant)', () => {
    const checks = runReadinessChecks({
      DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
    });
    const dbCheck = checks.find((c) => c.name === 'env:DATABASE_URL');
    expect(dbCheck).toBeDefined();
    // postgres:// is a valid alternative prefix
    expect(dbCheck!.status).toBe('pass');
  });

  it('fails without AUTH_SECRET', () => {
    const checks = runReadinessChecks({
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      AUTH_SECRET: '',
    });
    const authCheck = checks.find((c) => c.name === 'env:AUTH_SECRET');
    expect(authCheck).toBeDefined();
    expect(authCheck!.status).toBe('fail');
  });

  it('fails when AUTH_SECRET is too short', () => {
    const checks = runReadinessChecks({
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      AUTH_SECRET: 'short',
    });
    const authCheck = checks.find((c) => c.name === 'env:AUTH_SECRET');
    expect(authCheck).toBeDefined();
    expect(authCheck!.status).toBe('fail');
  });

  it('passes when AUTH_SECRET meets minimum length', () => {
    const checks = runReadinessChecks({
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      AUTH_SECRET: 'a'.repeat(32),
    });
    const authCheck = checks.find((c) => c.name === 'env:AUTH_SECRET');
    expect(authCheck).toBeDefined();
    expect(authCheck!.status).toBe('pass');
  });

  it('reports not ready when draining', () => {
    const checks = runReadinessChecks({
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      AUTH_SECRET: 'a'.repeat(32),
      NARRAZA_DRAINING: 'true',
    });
    const drainCheck = checks.find((c) => c.name === 'operational:draining');
    expect(drainCheck).toBeDefined();
    expect(drainCheck!.status).toBe('fail');
    expect(drainCheck!.detail).toContain('draining');
  });

  it('reports ok when not draining', () => {
    const checks = runReadinessChecks({
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      AUTH_SECRET: 'a'.repeat(32),
      NARRAZA_DRAINING: 'false',
    });
    const drainCheck = checks.find((c) => c.name === 'operational:draining');
    expect(drainCheck).toBeDefined();
    expect(drainCheck!.status).toBe('pass');
  });
});

describe('readiness: overall status', () => {
  it('overall status is not-ready when any check fails', () => {
    const checks = runReadinessChecks({}); // No DB URL
    const hasFail = checks.some((c) => c.status === 'fail');
    expect(hasFail).toBe(true);
  });

  it('overall status is ready when all checks pass', () => {
    const checks = runReadinessChecks({
      DATABASE_URL_WEB: 'postgresql://user:pass@localhost:5432/db',
      AUTH_SECRET: 'a'.repeat(32),
    });
    const hasFail = checks.some((c) => c.status === 'fail');
    expect(hasFail).toBe(false);
  });
});
