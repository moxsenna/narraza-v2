import type { Prisma } from '@prisma/client';
import type { UserConcurrencySlot, CreateUserConcurrencySlotInput, UserConcurrencySlotRepo } from '@narraza/application';

type TxClient = Prisma.TransactionClient;

export function createTxUserConcurrencySlotRepo(tx: TxClient): UserConcurrencySlotRepo {
  function dto(r: any): UserConcurrencySlot {
    return r;
  }
  return {
    async create(input: CreateUserConcurrencySlotInput): Promise<UserConcurrencySlot> {
      const r = await tx.userConcurrencySlot.create({ data: { userId: input.userId, jobId: input.jobId, slotKey: input.slotKey } });
      return dto(r);
    },
    async findByJobId(jobId: string): Promise<UserConcurrencySlot | null> { const r = await tx.userConcurrencySlot.findFirst({ where: { jobId } }); return r ? dto(r) : null; },
    async findByUserId(userId: string): Promise<UserConcurrencySlot[]> { const rs = await tx.userConcurrencySlot.findMany({ where: { userId, releasedAt: null } }); return rs.map(dto); },
    async release(id: string): Promise<UserConcurrencySlot | null> {
      try { const r = await tx.userConcurrencySlot.update({ where: { id }, data: { releasedAt: new Date() } }); return dto(r); } catch { return null; }
    },
    async releaseByJobId(jobId: string): Promise<number> {
      try { const r = await tx.userConcurrencySlot.updateMany({ where: { jobId, releasedAt: null }, data: { releasedAt: new Date() } }); return r.count; } catch { return 0; }
    },
  };
}
