import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AuthPorts, EmailLoginChallenge } from '../../ports/auth-ports.js';
import {
  PublicUseCaseError,
} from '@narraza/shared';

export interface PendingCookiePayload {
  challengeId: string;
  nonce: string;
  exp: number;
}

/**
 * Sign a payload into a cookie value: base64url(payload).base64url(hmac)
 */
export function signPendingCookie(payload: PendingCookiePayload, authSecret: string): string {
  const json = JSON.stringify(payload);
  const data = Buffer.from(json, 'utf-8').toString('base64url');
  const sig = createHmac('sha256', authSecret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

/**
 * Verify and decode a signed pending cookie value.
 * Returns the payload if valid, or throws.
 */
export function verifyPendingCookie(cookieValue: string, authSecret: string): PendingCookiePayload {
  const dotIndex = cookieValue.lastIndexOf('.');
  if (dotIndex < 0) {
    throw new PublicUseCaseError('UNAUTHORIZED', 'Invalid pending cookie format');
  }

  const data = cookieValue.slice(0, dotIndex);
  const sig = cookieValue.slice(dotIndex + 1);

  const expectedSig = createHmac('sha256', authSecret).update(data).digest('base64url');

  const sigBuf = Buffer.from(sig, 'utf-8');
  const expectedBuf = Buffer.from(expectedSig, 'utf-8');

  let equal = false;
  try {
    equal = timingSafeEqual(sigBuf, expectedBuf);
  } catch {
    equal = false;
  }

  if (!equal) {
    throw new PublicUseCaseError('UNAUTHORIZED', 'Invalid pending cookie signature');
  }

  const json = Buffer.from(data, 'base64url').toString('utf-8');
  const payload = JSON.parse(json) as PendingCookiePayload;

  // Check expiration
  if (payload.exp && payload.exp * 1000 < Date.now()) {
    throw new PublicUseCaseError('UNAUTHORIZED', 'Pending cookie expired');
  }

  return payload;
}

export function formatPendingCookie(cookieValue: string): string {
  // Path=/ so POST /auth/email/confirm always receives cookie after prepare redirect.
  // Token still never appears in cookie — only opaque challenge reference + nonce.
  return `pending_login=${cookieValue}; Path=/; Max-Age=600; HttpOnly; SameSite=Lax`;
}

export function formatClearPendingCookie(): string {
  return 'pending_login=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax';
}
