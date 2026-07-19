import type { LedgerRepo } from '@narraza/application';
import type { CreditLedgerEntry } from '@narraza/application';
import { getPrisma } from '../client.js';

export function createLedgerRepo(): LedgerRepo {
  const prisma = getPrisma();

  return {
    async create(input: {
      userId: string;
      entryType: string;
      amountMicro: bigint;
      dedupeKey: string;
    }): Promise<CreditLedgerEntry> {
      const row = await prisma.creditLedger.create({
        data: {
          userId: input.userId,
          entryType: input.entryType,
          amountMicro: input.amountMicro,
          dedupeKey: input.dedupeKey,
        },
      });
      return {
        id: row.id,
        userId: row.userId,
        entryType: row.entryType,
        amountMicro: row.amountMicro,
        dedupeKey: row.dedupeKey,
        createdAt: row.createdAt,
      };
    },

    async findByDedupeKey(dedupeKey: string): Promise<CreditLedgerEntry | null> {
      const row = await prisma.creditLedger.findUnique({
        where: { dedupeKey },
      });
      if (!row) return null;
      return {
        id: row.id,
        userId: row.userId,
        entryType: row.entryType,
        amountMicro: row.amountMicro,
        dedupeKey: row.dedupeKey,
        createdAt: row.createdAt,
      };
    },

    async countByDedupeKey(dedupeKey: string): Promise<number> {
      return prisma.creditLedger.count({
        where: { dedupeKey },
      });
    },

    async listByUserId(userId: string): Promise<CreditLedgerEntry[]> {
      const rows = await prisma.creditLedger.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      });
      return rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        entryType: row.entryType,
        amountMicro: row.amountMicro,
        dedupeKey: row.dedupeKey,
        createdAt: row.createdAt,
      }));
    },
  };
}
