import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

// Load .env from repo root
config({ path: '../../.env' });

import type { AuthPorts } from '../ports/auth-ports.js';
import { issueChallenge } from '../use-cases/auth/issue-challenge.js';
import { prepareConfirm } from '../use-cases/auth/prepare-confirm.js';
import { consumeChallenge } from '../use-cases/auth/consume-challenge.js';
import { ensureSignupGrant } from '../use-cases/auth/ensure-signup-grant.js';
import { verifyPendingCookie } from '../use-cases/auth/pending-login-cookie.js';
import { hashToken } from '../use-cases/auth/hash-token.js';
import { createChallengeRepo } from '../../../db/src/repositories/challenge-repo.js';
import { createUserRepo } from '../../../db/src/repositories/user-repo.js';
import { createSessionRepo } from '../../../db/src/repositories/session-repo.js';
import { createLedgerRepo } from '../../../db/src/repositories/ledger-repo.js';
import { setPrisma } from '../../../db/src/client.js';

const PEPPER = process.env.EMAIL_CHALLENGE_PEPPER ?? 'test-pepper-32-chars-long!!!!!!!';
const AUTH_SECRET = process.env.AUTH_SECRET ?? 'test-auth-secret-min-32-chars-long!!';
const BASE_URL = process.env.AUTH_URL ?? 'http://localhost:3000';
const SIGNUP_GRANT_MICRO = BigInt(process.env.SIGNUP_GRANT_MICRO_IDR ?? '5000000000');

let prisma: PrismaClient;
let ports: AuthPorts;

async function issue(email: string) {
  const result = await issueChallenge(ports, { email }, PEPPER);
  return result;
}

async function prepareConfirmFromRaw(rawToken: string) {
  return prepareConfirm(ports, { rawToken }, PEPPER, AUTH_SECRET, BASE_URL);
}

async function consumeFromPendingCookie(cookieValue: string) {
  return consumeChallenge(ports, { pendingCookieValue: cookieValue }, AUTH_SECRET, SIGNUP_GRANT_MICRO);
}

async function loadChallenge(challengeId: string) {
  return ports.challengeRepo.findById(challengeId);
}

async function forceExpire(challengeId: string) {
  await ports.challengeRepo.updateExpiresAt(challengeId, new Date(Date.now() - 1000));
}

async function revoke(challengeId: string) {
  await ports.challengeRepo.updateRevokedAt(challengeId, new Date());
}

async function listLedgerByDedupe(dedupeKey: string) {
  const entry = await ports.ledgerRepo.findByDedupeKey(dedupeKey);
  return entry ? [entry] : [];
}

beforeAll(async () => {
  const dbUrl = process.env.DATABASE_URL ?? 'postgresql://narraza:narraza@localhost:5433/narraza';
  prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
  setPrisma(prisma);

  // Clean up test data
  await prisma.creditLedger.deleteMany({
    where: { dedupeKey: { startsWith: 'grant:signup' } },
  });
  await prisma.session.deleteMany();
  await prisma.emailLoginChallenge.deleteMany();
  await prisma.user.deleteMany({
    where: { email: { contains: '@example.com' } },
  });

  ports = {
    challengeRepo: createChallengeRepo(),
    userRepo: createUserRepo(),
    sessionRepo: createSessionRepo(),
    ledgerRepo: createLedgerRepo(),
  };
});

afterAll(async () => {
  // Cleanup test data
  await prisma.creditLedger.deleteMany({
    where: { dedupeKey: { startsWith: 'grant:signup' } },
  });
  await prisma.session.deleteMany();
  await prisma.emailLoginChallenge.deleteMany();
  await prisma.user.deleteMany({
    where: { email: { contains: '@example.com' } },
  });
  await prisma.$disconnect();
});

describe('EmailLoginChallenge', () => {
  it('GET prepare does not set consumedAt', async () => {
    const { rawToken, challengeId } = await issue('user@example.com');
    const prepared = await prepareConfirmFromRaw(rawToken);
    expect(prepared.challengeId).toBe(challengeId);
    const row = await loadChallenge(challengeId);
    expect(row).not.toBeNull();
    expect(row!.consumedAt).toBeNull();
  });

  it('only one of two concurrent consumes succeeds', async () => {
    const { rawToken } = await issue('concurrent@example.com');
    const prepared = await prepareConfirmFromRaw(rawToken);

    // Extract cookie value from the Set-Cookie header
    const cookieMatch = prepared.setCookieHeader.match(/pending_login=([^;]+)/);
    expect(cookieMatch).not.toBeNull();
    const cookieValue = cookieMatch![1]!;

    const results = await Promise.allSettled([
      consumeFromPendingCookie(cookieValue),
      consumeFromPendingCookie(cookieValue),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    const fail = results.filter((r) => r.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(fail).toHaveLength(1);
  });

  it('successful consume revokes sibling active challenges', async () => {
    const a = await issue('sibling@example.com');
    const b = await issue('sibling@example.com');

    const prepared = await prepareConfirmFromRaw(a.rawToken);
    const cookieMatch = prepared.setCookieHeader.match(/pending_login=([^;]+)/);
    expect(cookieMatch).not.toBeNull();
    await consumeFromPendingCookie(cookieMatch![1]!);

    const bRow = await loadChallenge(b.challengeId);
    expect(bRow).not.toBeNull();
    expect(bRow!.revokedAt).not.toBeNull();
  });

  it('max 3 active; fourth issue revokes oldest only', async () => {
    const email = `cap-${Date.now()}@example.com`;
    const c1 = await issue(email);
    const c2 = await issue(email);
    const c3 = await issue(email);
    const c4 = await issue(email);

    const r1 = await loadChallenge(c1.challengeId);
    expect(r1!.revokedAt).not.toBeNull();

    const r2 = await loadChallenge(c2.challengeId);
    expect(r2!.revokedAt).toBeNull();

    const r3 = await loadChallenge(c3.challengeId);
    expect(r3!.revokedAt).toBeNull();

    const r4 = await loadChallenge(c4.challengeId);
    expect(r4!.revokedAt).toBeNull();
  });

  it('new issue does not revoke all active when under cap', async () => {
    const email = `under-${Date.now()}@example.com`;
    const c1 = await issue(email);
    const c2 = await issue(email);

    const r1 = await loadChallenge(c1.challengeId);
    expect(r1!.revokedAt).toBeNull();

    const r2 = await loadChallenge(c2.challengeId);
    expect(r2!.revokedAt).toBeNull();
  });

  it('expired challenge rejected', async () => {
    const { rawToken, challengeId } = await issue('exp@example.com');
    await forceExpire(challengeId);
    await expect(prepareConfirmFromRaw(rawToken)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('revoked challenge rejected', async () => {
    const { rawToken, challengeId } = await issue('rev@example.com');
    await revoke(challengeId);
    await expect(prepareConfirmFromRaw(rawToken)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('pending cookie does not contain raw token', async () => {
    const { rawToken } = await issue('cookie@example.com');
    const { setCookieHeader } = await prepareConfirmFromRaw(rawToken);
    expect(setCookieHeader).not.toContain(rawToken);
    expect(setCookieHeader).toMatch(/pending_login=/);
    expect(setCookieHeader).toMatch(/HttpOnly/i);
  });

  it('ensureSignupGrant is idempotent', async () => {
    const { rawToken } = await issue('grant@example.com');
    const prepared = await prepareConfirmFromRaw(rawToken);
    const cookieMatch = prepared.setCookieHeader.match(/pending_login=([^;]+)/);
    expect(cookieMatch).not.toBeNull();
    const result = await consumeFromPendingCookie(cookieMatch![1]!);
    const userId = result.userId;

    // Call again - should be idempotent
    await ensureSignupGrant(ports, userId, SIGNUP_GRANT_MICRO);
    await ensureSignupGrant(ports, userId, SIGNUP_GRANT_MICRO);

    const grants = await listLedgerByDedupe(`grant:signup:${userId}`);
    expect(grants).toHaveLength(1);
  });

  it('raw token never appears in logs during issue', async () => {
    const logs: string[] = [];
    const origConsole = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.map(String).join(' '));
    };

    try {
      const { rawToken } = await issue('log@example.com');

      // Simulate what might happen: check that rawToken is NOT in any captured log
      // Since our issueChallenge function doesn't log, this should pass trivially
      const allLogs = logs.join('\n');
      expect(allLogs).not.toContain(rawToken);

      // Also verify: the raw token should never appear as a hash match in our DB
      // (only the HMAC-SHA256 hashed version is stored)
      const challenge = await loadChallenge(
        (await prepareConfirmFromRaw(rawToken)).challengeId,
      );
      const expectedHash = hashToken(rawToken, PEPPER);
      expect(challenge!.tokenHash).toBe(expectedHash);
      expect(challenge!.tokenHash).not.toBe(rawToken);
    } finally {
      console.log = origConsole;
    }
  });

  it('pending cookie payload verifies correctly', async () => {
    const { rawToken, challengeId, nonce } = await issue('verify-cookie@example.com');
    const prepared = await prepareConfirmFromRaw(rawToken);

    // Extract cookie value
    const cookieMatch = prepared.setCookieHeader.match(/pending_login=([^;]+)/);
    expect(cookieMatch).not.toBeNull();
    const cookieValue = cookieMatch![1]!;

    // Verify the cookie payload
    const payload = verifyPendingCookie(cookieValue, AUTH_SECRET);
    expect(payload.challengeId).toBe(challengeId);
    expect(payload.nonce).toBe(nonce);
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('invalid cookie signature rejected', async () => {
    const fakeCookie = 'eyJjaGFsbGVuZ2VJZCI6InRlc3QiLCJub25jZSI6InRlc3QiLCJleHAiOjk5OTk5OTk5OTl9.fake_signature';
    expect(() => verifyPendingCookie(fakeCookie, AUTH_SECRET)).toThrow();
  });
});
