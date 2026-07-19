import { randomBytes } from 'node:crypto';
import type { AuthPorts } from '../../ports/auth-ports.js';
import {
  PublicUseCaseError,
  InternalUseCaseError,
} from '@narraza/shared';
import {
  verifyPendingCookie,
  type PendingCookiePayload,
} from './pending-login-cookie.js';
import { ensureSignupGrant } from './ensure-signup-grant.js';

export interface ConsumeChallengeInput {
  pendingCookieValue: string;
}

export interface ConsumeChallengeResult {
  userId: string;
  sessionToken: string;
  isNewUser: boolean;
}

const SESSION_ABSOLUTE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function consumeChallenge(
  ports: AuthPorts,
  input: ConsumeChallengeInput,
  authSecret: string,
  signupGrantMicro: bigint,
): Promise<ConsumeChallengeResult> {
  // Verify cookie
  const payload: PendingCookiePayload = verifyPendingCookie(input.pendingCookieValue, authSecret);

  // CAS consume the challenge
  const consumed = await ports.challengeRepo.consumeIfValid(payload.challengeId);

  if (!consumed) {
    throw new PublicUseCaseError('UNAUTHORIZED', 'Login link invalid, expired, or already used');
  }

  // Verify nonce matches
  if (consumed.nonce !== payload.nonce) {
    throw new PublicUseCaseError('UNAUTHORIZED', 'Nonce mismatch');
  }

  // Find or create user
  let user = await ports.userRepo.findByEmailNormalized(consumed.identifierNormalized);
  let isNewUser = false;

  if (!user) {
    user = await ports.userRepo.create({
      email: consumed.identifierNormalized,
      emailNormalized: consumed.identifierNormalized,
      status: 'active',
    });
    isNewUser = true;
  }

  // Check user status
  if (user.status !== 'active') {
    throw new PublicUseCaseError('FORBIDDEN', 'Account is not active');
  }

  // Revoke sibling active challenges
  await ports.challengeRepo.revokeAllActive(consumed.identifierNormalized);

  // Revoke existing sessions for this user
  await ports.sessionRepo.revokeAllByUserId(user.id);

  // Create new session
  const sessionToken = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_ABSOLUTE_TTL_MS);

  await ports.sessionRepo.create({
    sessionToken,
    userId: user.id,
    expiresAt,
  });

  // Ensure signup grant (idempotent)
  await ensureSignupGrant(ports, user.id, signupGrantMicro);

  return {
    userId: user.id,
    sessionToken,
    isNewUser,
  };
}
