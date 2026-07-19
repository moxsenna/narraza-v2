import { cookies } from 'next/headers';

export interface SessionUser {
  userId: string;
}

/**
 * Reads the session_token cookie, looks up the session in the DB,
 * and returns the userId if the session is valid (not revoked, not expired).
 * Returns null if no valid session is found.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session_token')?.value;

  if (!sessionToken) return null;

  // Dynamic imports to keep server-only Prisma usage in server context
  const { getPrisma } = await import('@narraza/db/client.js');
  const prisma = getPrisma();

  const now = new Date();
  const session = await prisma.session.findFirst({
    where: {
      sessionToken,
      revokedAt: null,
      expiresAt: { gt: now },
    },
  });

  if (!session) return null;

  // Verify user is active
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
  });

  if (!user || user.status !== 'active') return null;

  return { userId: user.id };
}
