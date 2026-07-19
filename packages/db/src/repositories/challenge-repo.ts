import type { ChallengeRepo, CreateChallengeInput } from '@narraza/application';
import type { EmailLoginChallenge } from '@narraza/application';
import { getPrisma } from '../client.js';

export function createChallengeRepo(): ChallengeRepo {
  const prisma = getPrisma();

  return {
    async create(input: CreateChallengeInput): Promise<EmailLoginChallenge> {
      const row = await prisma.emailLoginChallenge.create({
        data: {
          identifierNormalized: input.identifierNormalized,
          tokenHash: input.tokenHash,
          nonce: input.nonce,
          expiresAt: input.expiresAt,
        },
      });
      return {
        id: row.id,
        userId: row.userId,
        identifierNormalized: row.identifierNormalized,
        tokenHash: row.tokenHash,
        nonce: row.nonce,
        expiresAt: row.expiresAt,
        consumedAt: row.consumedAt,
        revokedAt: row.revokedAt,
        createdAt: row.createdAt,
      };
    },

    async findByTokenHash(tokenHash: string): Promise<EmailLoginChallenge | null> {
      const row = await prisma.emailLoginChallenge.findFirst({
        where: { tokenHash },
        orderBy: { createdAt: 'desc' },
      });
      if (!row) return null;
      return {
        id: row.id,
        userId: row.userId,
        identifierNormalized: row.identifierNormalized,
        tokenHash: row.tokenHash,
        nonce: row.nonce,
        expiresAt: row.expiresAt,
        consumedAt: row.consumedAt,
        revokedAt: row.revokedAt,
        createdAt: row.createdAt,
      };
    },

    async findById(id: string): Promise<EmailLoginChallenge | null> {
      const row = await prisma.emailLoginChallenge.findUnique({ where: { id } });
      if (!row) return null;
      return {
        id: row.id,
        userId: row.userId,
        identifierNormalized: row.identifierNormalized,
        tokenHash: row.tokenHash,
        nonce: row.nonce,
        expiresAt: row.expiresAt,
        consumedAt: row.consumedAt,
        revokedAt: row.revokedAt,
        createdAt: row.createdAt,
      };
    },

    async countActiveByIdentifier(identifierNormalized: string): Promise<number> {
      const now = new Date();
      return prisma.emailLoginChallenge.count({
        where: {
          identifierNormalized,
          consumedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
      });
    },

    async revokeOldestActive(identifierNormalized: string): Promise<EmailLoginChallenge | null> {
      const now = new Date();
      const oldest = await prisma.emailLoginChallenge.findFirst({
        where: {
          identifierNormalized,
          consumedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        orderBy: { createdAt: 'asc' },
      });

      if (!oldest) return null;

      const updated = await prisma.emailLoginChallenge.update({
        where: { id: oldest.id },
        data: { revokedAt: now },
      });

      return {
        id: updated.id,
        userId: updated.userId,
        identifierNormalized: updated.identifierNormalized,
        tokenHash: updated.tokenHash,
        nonce: updated.nonce,
        expiresAt: updated.expiresAt,
        consumedAt: updated.consumedAt,
        revokedAt: updated.revokedAt,
        createdAt: updated.createdAt,
      };
    },

    async consumeIfValid(id: string): Promise<EmailLoginChallenge | null> {
      const now = new Date();
      try {
        const updated = await prisma.emailLoginChallenge.update({
          where: {
            id,
            consumedAt: null,
            revokedAt: null,
            expiresAt: { gt: now },
          },
          data: { consumedAt: now },
        });
        return {
          id: updated.id,
          userId: updated.userId,
          identifierNormalized: updated.identifierNormalized,
          tokenHash: updated.tokenHash,
          nonce: updated.nonce,
          expiresAt: updated.expiresAt,
          consumedAt: updated.consumedAt,
          revokedAt: updated.revokedAt,
          createdAt: updated.createdAt,
        };
      } catch {
        return null;
      }
    },

    async revokeAllActive(identifierNormalized: string): Promise<number> {
      const now = new Date();
      const result = await prisma.emailLoginChallenge.updateMany({
        where: {
          identifierNormalized,
          consumedAt: null,
          revokedAt: null,
        },
        data: { revokedAt: now },
      });
      return result.count;
    },

    async updateExpiresAt(id: string, expiresAt: Date): Promise<void> {
      await prisma.emailLoginChallenge.update({
        where: { id },
        data: { expiresAt },
      });
    },

    async updateRevokedAt(id: string, revokedAt: Date): Promise<void> {
      await prisma.emailLoginChallenge.update({
        where: { id },
        data: { revokedAt },
      });
    },
  };
}
