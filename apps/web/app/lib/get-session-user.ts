import { cookies } from 'next/headers';
import { findValidSessionUserId } from './server/project-reads';

export interface SessionUser {
  userId: string;
}

/**
 * Reads the session_token cookie and returns userId if session is valid.
 * DB access goes through lib/server composition root only.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session_token')?.value;
  if (!sessionToken) return null;

  const userId = await findValidSessionUserId(sessionToken);
  if (!userId) return null;
  return { userId };
}
