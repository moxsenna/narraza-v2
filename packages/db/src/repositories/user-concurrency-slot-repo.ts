import type { UserConcurrencySlot, CreateUserConcurrencySlotInput, UserConcurrencySlotRepo } from '@narraza/application';
import { getPrisma } from '../client.js';

export function createUserConcurrencySlotRepo(): UserConcurrencySlotRepo {
  const prisma = getPrisma();

  function rowToDTO(row: { id: string; userId: string; jobId: string; slotKey: string; acquiredAt: Date; releasedAt: Date | null }): UserConcurrencySlot {
    return row;
  }

  return {
    async create(input: CreateUserConcurrencySlotInput): Promise<UserConcurrencySlot> {
      const row = await prisma.userConcurrencySlot.create({
        data: {
          userId: input.userId,
          jobId: input.jobId,
          slotKey: input.slotKey,
        },
      });
      return rowToDTO(row);
    },

    async findByJobId(jobId: string): Promise<UserConcurrencySlot | null> {
      const row = await prisma.userConcurrencySlot.findFirst({ where: { jobId } });
      return row ? rowToDTO(row) : null;
    },

    async findByUserId(userId: string): Promise<UserConcurrencySlot[]> {
      const rows = await prisma.userConcurrencySlot.findMany({
        where: { userId, releasedAt: null },
      });
      return rows.map(rowToDTO);
    },

    async release(id: string): Promise<UserConcurrencySlot | null> {
      try {
        const row = await prisma.userConcurrencySlot.update({
          where: { id },
          data: { releasedAt: new Date() },
        });
        return rowToDTO(row);
      } catch {
        return null;
      }
    },

    async releaseByJobId(jobId: string): Promise<number> {
      try {
        const result = await prisma.userConcurrencySlot.updateMany({
          where: { jobId, releasedAt: null },
          data: { releasedAt: new Date() },
        });
        return result.count;
      } catch {
        return 0;
      }
    },
  };
}
