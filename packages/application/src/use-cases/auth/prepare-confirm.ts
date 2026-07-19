import type { AuthPorts } from '../../ports/auth-ports.js';
import {
  PublicUseCaseError,
} from '@narraza/shared';
import { hashToken } from './hash-token.js';
import {
  signPendingCookie,
  formatPendingCookie,
  type PendingCookiePayload,
} from './pending-login-cookie.js';

export interface PrepareConfirmInput {
  rawToken: string;
}

export interface PrepareConfirmResult {
  challengeId: string;
  nonce: string;
  setCookieHeader: string;
  redirectUrl: string;
}

export async function prepareConfirm(
  ports: AuthPorts,
  input: PrepareConfirmInput,
  pepper: string,
  authSecret: string,
  baseUrl: string,
): Promise<PrepareConfirmResult> {
  const tokenHash = hashToken(input.rawToken, pepper);
  const challenge = await ports.challengeRepo.findByTokenHash(tokenHash);

  if (!challenge) {
    throw new PublicUseCaseError('UNAUTHORIZED', 'Invalid or expired login link');
  }

  // Validate: not consumed, not revoked, not expired
  if (challenge.consumedAt) {
    throw new PublicUseCaseError('UNAUTHORIZED', 'Login link already used');
  }

  if (challenge.revokedAt) {
    throw new PublicUseCaseError('UNAUTHORIZED', 'Login link has been revoked');
  }

  if (challenge.expiresAt < new Date()) {
    throw new PublicUseCaseError('UNAUTHORIZED', 'Login link expired');
  }

  // Build pending cookie payload
  const exp = Math.floor(Date.now() / 1000) + 600; // 10 minutes
  const payload: PendingCookiePayload = {
    challengeId: challenge.id,
    nonce: challenge.nonce,
    exp,
  };

  const cookieValue = signPendingCookie(payload, authSecret);
  const setCookieHeader = formatPendingCookie(cookieValue);
  const redirectUrl = `${baseUrl}/auth/email/confirm`;

  return {
    challengeId: challenge.id,
    nonce: challenge.nonce,
    setCookieHeader,
    redirectUrl,
  };
}
