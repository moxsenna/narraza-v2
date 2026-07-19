import type { AuthPorts } from '../../ports/auth-ports.js';

export async function ensureSignupGrant(
  ports: AuthPorts,
  userId: string,
  signupGrantMicro: bigint,
): Promise<void> {
  const dedupeKey = `grant:signup:${userId}`;

  // Check if grant already exists (idempotent)
  const existing = await ports.ledgerRepo.findByDedupeKey(dedupeKey);
  if (existing) {
    return;
  }

  await ports.ledgerRepo.create({
    userId,
    entryType: 'signup_grant',
    amountMicro: signupGrantMicro,
    dedupeKey,
  });
}
