import type { SessionRepo } from '@narraza/application';
import type { Session } from '@narraza/application';
import { getPrisma } from '../client.js';

export function createSessionRepo(): SessionRepo {
  const prisma = getPrisma();

  return {
    async create(input: { sessionToken: string; userId: string; expiresAt: Date }): Promise<Session> {
      const row = await prisma.session.create({
        data: {
          sessionToken: input.sessionToken,
          userId: input.userId,
          expiresAt: input.expiresAt,
        },
      });
      return {
        id: row.id,
        sessionToken: row.sessionToken,
        userId: row.userId,
        expiresAt: row.expiresAt,
        lastActiveAt: row.lastActiveAt,
        revokedAt: row.revokedAt,
        createdAt: row.createdAt,
      };
    },

    async revokeAllByUserId(userId: string): Promise<number> {
      const now = new Date();
      const result = await prisma.session.updateMany({
        where: {
          userId,
          revokedAt: null,
        },
        data: { revokedAt: now },
      });
      return result.count;
    },

    async revokeBySessionToken(sessionToken: string): Promise<Session | null> {
      const now = new Date();
      try {
        const row = await prisma.session.update({
          where: { sessionToken },
          data: { revokedAt: now },
        });
        return {
          id: row.id,
          sessionToken: row.sessionToken,
          userId: row.userId,
          expiresAt: row.expiresAt,
          lastActiveAt: row.lastActiveAt,
          revokedAt: row.revokedAt,
          createdAt: row.createdAt,
        };
      } catch {
        return null;
      }
    },

    async findBySessionToken(sessionToken: string): Promise<Session | null> {
      const row = await prisma.session.findUnique({
        where: { sessionToken },
      });
      if (!row) return null;
      return {
        id: row.id,
        sessionToken: row.sessionToken,
        userId: row.userId,
        expiresAt: row.expiresAt,
        lastActiveAt: row.lastActiveAt,
        revokedAt: row.revokedAt,
        createdAt: row.createdAt,
      };
    },
  };
}
