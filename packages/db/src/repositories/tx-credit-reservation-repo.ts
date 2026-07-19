import type { Prisma } from '@prisma/client';
import type { CreditReservation, CreateCreditReservationInput, CreditReservationRepo } from '@narraza/application';

type TxClient = Prisma.TransactionClient;

export function createTxCreditReservationRepo(tx: TxClient): CreditReservationRepo {
  function dto(r: any): CreditReservation {
    return { ...r, status: r.status as CreditReservation['status'] };
  }
  return {
    async create(input: CreateCreditReservationInput): Promise<CreditReservation> {
      const r = await tx.creditReservation.create({ data: { jobId: input.jobId, userId: input.userId, reservedAmount: input.reservedAmount, settledAmount: 0n, releasedAmount: 0n, status: 'reserved' } });
      return dto(r);
    },
    async findById(id: string): Promise<CreditReservation | null> { const r = await tx.creditReservation.findUnique({ where: { id } }); return r ? dto(r) : null; },
    async findByJobId(jobId: string): Promise<CreditReservation | null> { const r = await tx.creditReservation.findFirst({ where: { jobId } }); return r ? dto(r) : null; },
    async updateStatus(id: string, status: CreditReservation['status']): Promise<CreditReservation | null> {
      try { const r = await tx.creditReservation.update({ where: { id }, data: { status } }); return dto(r); } catch { return null; }
    },
    async safeRelease(id: string, amount: bigint): Promise<CreditReservation | null> {
      if (amount < 0n) return null;
      try {
        const rows = await tx.$queryRawUnsafe<any[]>(
          `UPDATE credit_reservations SET released_amount = released_amount + $2, status = CASE WHEN released_amount + $2 + settled_amount >= reserved_amount THEN 'closed' ELSE status END WHERE id = $1 AND reserved_amount >= settled_amount + released_amount + $2 RETURNING *`,
          id, amount,
        );
        if (!rows.length) return null;
        const r = rows[0]!;
        return { id: r.id, jobId: r.job_id, userId: r.user_id, reservedAmount: r.reserved_amount, settledAmount: r.settled_amount, releasedAmount: r.released_amount, status: r.status as CreditReservation['status'], createdAt: r.created_at, updatedAt: r.updated_at };
      } catch { return null; }
    },
    async settle(id: string, amount: bigint): Promise<CreditReservation | null> {
      if (amount < 0n) return null;
      try {
        const rows = await tx.$queryRawUnsafe<any[]>(
          `UPDATE credit_reservations SET settled_amount = settled_amount + $2, status = CASE WHEN settled_amount + $2 + released_amount >= reserved_amount THEN 'closed' ELSE status END WHERE id = $1 AND reserved_amount >= settled_amount + released_amount + $2 RETURNING *`,
          id, amount,
        );
        if (!rows.length) return null;
        const r = rows[0]!;
        return { id: r.id, jobId: r.job_id, userId: r.user_id, reservedAmount: r.reserved_amount, settledAmount: r.settled_amount, releasedAmount: r.released_amount, status: r.status as CreditReservation['status'], createdAt: r.created_at, updatedAt: r.updated_at };
      } catch { return null; }
    },
  };
}
