import type { CreditReservation, CreateCreditReservationInput, CreditReservationRepo } from '@narraza/application';
import { getPrisma } from '../client.js';

export function createCreditReservationRepo(): CreditReservationRepo {
  const prisma = getPrisma();

  function rowToDTO(row: { id: string; jobId: string; userId: string; reservedAmount: bigint; settledAmount: bigint; releasedAmount: bigint; status: string; createdAt: Date; updatedAt: Date }): CreditReservation {
    return {
      ...row,
      status: row.status as CreditReservation['status'],
    };
  }

  return {
    async create(input: CreateCreditReservationInput): Promise<CreditReservation> {
      const row = await prisma.creditReservation.create({
        data: {
          jobId: input.jobId,
          userId: input.userId,
          reservedAmount: input.reservedAmount,
          settledAmount: 0n,
          releasedAmount: 0n,
          status: 'reserved',
        },
      });
      return rowToDTO(row);
    },

    async findById(id: string): Promise<CreditReservation | null> {
      const row = await prisma.creditReservation.findUnique({ where: { id } });
      return row ? rowToDTO(row) : null;
    },

    async findByJobId(jobId: string): Promise<CreditReservation | null> {
      const row = await prisma.creditReservation.findFirst({ where: { jobId } });
      return row ? rowToDTO(row) : null;
    },

    async updateStatus(id: string, status: CreditReservation['status']): Promise<CreditReservation | null> {
      try {
        const row = await prisma.creditReservation.update({
          where: { id },
          data: { status },
        });
        return rowToDTO(row);
      } catch {
        return null;
      }
    },

    async safeRelease(id: string, amount: bigint): Promise<CreditReservation | null> {
      if (amount < 0n) return null;
      try {
        const rows = await prisma.$queryRawUnsafe<any[]>(
          `UPDATE credit_reservations
           SET released_amount = released_amount + $2,
               status = CASE
                 WHEN released_amount + $2 + settled_amount >= reserved_amount THEN 'closed'
                 ELSE status
               END
           WHERE id = $1
             AND reserved_amount >= settled_amount + released_amount + $2
           RETURNING *`,
          id, amount,
        );
        const result = rows;
        if (!result.length) return null;
        const r = result[0]!;
        return {
          id: r.id,
          jobId: r.job_id,
          userId: r.user_id,
          reservedAmount: r.reserved_amount,
          settledAmount: r.settled_amount,
          releasedAmount: r.released_amount,
          status: r.status as CreditReservation['status'],
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        };
      } catch {
        return null;
      }
    },

    async settle(id: string, amount: bigint): Promise<CreditReservation | null> {
      if (amount < 0n) return null;
      try {
        const rows = await prisma.$queryRawUnsafe<any[]>(
          `UPDATE credit_reservations
           SET settled_amount = settled_amount + $2,
               status = CASE
                 WHEN settled_amount + $2 + released_amount >= reserved_amount THEN 'closed'
                 ELSE status
               END
           WHERE id = $1
             AND reserved_amount >= settled_amount + released_amount + $2
           RETURNING *`,
          id, amount,
        );
        const result = rows;
        if (!result.length) return null;
        const r = result[0]!;
        return {
          id: r.id,
          jobId: r.job_id,
          userId: r.user_id,
          reservedAmount: r.reserved_amount,
          settledAmount: r.settled_amount,
          releasedAmount: r.released_amount,
          status: r.status as CreditReservation['status'],
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        };
      } catch {
        return null;
      }
    },
  };
}
