import type { Prisma } from '@prisma/client';
import type { CreditQuote, CreditQuoteInput, CreditQuoteRepo } from '@narraza/application';

type TxClient = Prisma.TransactionClient;

export function createTxCreditQuoteRepo(tx: TxClient): CreditQuoteRepo {
  function toDTO(row: {
    id: string; ownerUserId: string; workflowPlanHash: string; dependencyHash: string;
    estimatedMaximumMicroIdr: bigint; expiresAt: Date; consumedByJobId: string | null;
    status: string; createdAt: Date; updatedAt: Date;
  }): CreditQuote {
    return { ...row, status: row.status as CreditQuote['status'] };
  }

  return {
    async create(input: CreditQuoteInput): Promise<CreditQuote> {
      const row = await tx.creditQuote.create({
        data: {
          ownerUserId: input.ownerUserId, workflowPlanHash: input.workflowPlanHash,
          dependencyHash: input.dependencyHash, estimatedMaximumMicroIdr: input.estimatedMaximumMicroIdr,
          expiresAt: input.expiresAt, status: 'issued',
        },
      });
      return toDTO(row);
    },
    async findById(id: string): Promise<CreditQuote | null> {
      const row = await tx.creditQuote.findUnique({ where: { id } });
      return row ? toDTO(row) : null;
    },
    async findByIdAndOwner(id: string, ownerUserId: string): Promise<CreditQuote | null> {
      const row = await tx.creditQuote.findFirst({ where: { id, ownerUserId } });
      return row ? toDTO(row) : null;
    },
    async consumeIfValid(id: string, consumedByJobId: string): Promise<CreditQuote | null> {
      try {
        // Use a single atomic CAS query
        const rows = await tx.$queryRawUnsafe<any[]>(
          `UPDATE credit_quotes SET consumed_by_job_id = $2, status = 'consumed', updated_at = NOW()
           WHERE id = $1 AND status = 'issued' AND consumed_by_job_id IS NULL
           RETURNING *`,
          id, consumedByJobId,
        );
        if (!rows.length) return null;
        const r = rows[0]!;
        return {
          id: r.id, ownerUserId: r.owner_user_id, workflowPlanHash: r.workflow_plan_hash,
          dependencyHash: r.dependency_hash, estimatedMaximumMicroIdr: r.estimated_maximum_micro_idr,
          expiresAt: r.expires_at, consumedByJobId: r.consumed_by_job_id,
          status: r.status as CreditQuote['status'],
          createdAt: r.created_at, updatedAt: r.updated_at,
        };
      } catch { return null; }
    },
    async markExpired(id: string): Promise<CreditQuote | null> {
      try {
        const existing = await tx.creditQuote.findFirst({
          where: { id, status: 'issued' },
        });
        if (!existing || existing.consumedByJobId !== null) return null;
        const row = await tx.creditQuote.update({
          where: { id },
          data: { status: 'expired' },
        });
        return toDTO(row);
      } catch { return null; }
    },
    async listExpiredUnconsumed(_now: Date): Promise<CreditQuote[]> {
      const rows = await tx.creditQuote.findMany({
        where: { status: 'issued', expiresAt: { lt: new Date() }, consumedByJobId: null },
        take: 100,
      });
      return rows.map(toDTO);
    },
  };
}
