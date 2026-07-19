import { createHmac, randomBytes } from 'node:crypto';

export function hashToken(rawToken: string, pepper: string): string {
  return createHmac('sha256', pepper).update(rawToken).digest('hex');
}

export function generateRawToken(length = 32): string {
  return randomBytes(length).toString('hex');
}

export function generateNonce(): string {
  return randomBytes(16).toString('hex');
}
