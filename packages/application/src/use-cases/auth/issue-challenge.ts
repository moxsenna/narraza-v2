import type { AuthPorts } from '../../ports/auth-ports.js';
import {
  InternalUseCaseError,
  PublicUseCaseError,
} from '@narraza/shared';
import { hashToken, generateRawToken, generateNonce } from './hash-token.js';

export interface IssueChallengeInput {
  email: string;
}

export interface IssueChallengeResult {
  challengeId: string;
  rawToken: string;
  nonce: string;
  expiresAt: Date;
}

const MAX_ACTIVE_CHALLENGES = 3;
const CHALLENGE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function issueChallenge(
  ports: AuthPorts,
  input: IssueChallengeInput,
  pepper: string,
): Promise<IssueChallengeResult> {
  const identifierNormalized = input.email.toLowerCase().trim();

  if (!identifierNormalized.includes('@')) {
    throw new PublicUseCaseError('VALIDATION', 'Invalid email address');
  }

  // Count active challenges
  const activeCount = await ports.challengeRepo.countActiveByIdentifier(identifierNormalized);

  // If at cap, revoke oldest only
  if (activeCount >= MAX_ACTIVE_CHALLENGES) {
    await ports.challengeRepo.revokeOldestActive(identifierNormalized);
  }

  const rawToken = generateRawToken(32);
  const tokenHash = hashToken(rawToken, pepper);
  const nonce = generateNonce();
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);

  const challenge = await ports.challengeRepo.create({
    identifierNormalized,
    tokenHash,
    nonce,
    expiresAt,
  });

  return {
    challengeId: challenge.id,
    rawToken,
    nonce,
    expiresAt,
  };
}
