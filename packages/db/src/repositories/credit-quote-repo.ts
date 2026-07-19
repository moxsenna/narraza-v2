import type { CreditQuote, CreditQuoteInput, CreditQuoteRepo } from '@narraza/application';
import { getPrisma } from '../client.js';

export function createCreditQuoteRepo(): CreditQuoteRepo {
  const prisma = getPrisma();

  function toDTO(row: {
    id: string;
    ownerUserId: string;
    workflowPlanHash: string;
    dependencyHash: string;
    estimatedMaximumMicroIdr: bigint;
    expiresAt: Date;
    consumedByJobId: string | null;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }): CreditQuote {
    return {
      ...row,
      status: row.status as CreditQuote['status'],
      estimatedMaximumMicroIdr: BigInt(row.estimatedMaximumMicroIdr),
    };
  }

  return {
    async create(input: CreditQuoteInput): Promise<CreditQuote> {
      const row = await prisma.creditQuote.create({
        data: {
          ownerUserId: input.ownerUserId,
          workflowPlanHash: input.workflowPlanHash,
          dependencyHash: input.dependencyHash,
          estimatedMaximumMicroIdr: input.estimatedMaximumMicroIdr,
          expiresAt: input.expiresAt,
          status: 'issued',
        },
      });
      return toDTO(row);
    },

    async findById(id: string): Promise<CreditQuote | null> {
      const row = await prisma.creditQuote.findUnique({ where: { id } });
      return row ? toDTO(row) : null;
    },

    async findByIdAndOwner(id: string, ownerUserId: string): Promise<CreditQuote | null> {
      const row = await prisma.creditQuote.findFirst({
        where: { id, ownerUserId },
      });
      return row ? toDTO(row) : null;
    },

    async consumeIfValid(id: string, consumedByJobId: string): Promise<CreditQuote | null> {
      try {
        const rows = await prisma.$queryRawUnsafe<any[]>(
          `UPDATE credit_quotes SET consumed_by_job_id = $2, status = 'consumed', updated_at = NOW()
           WHERE id = $1 AND status = 'issued' AND consumed_by_job_id IS NULL
           RETURNING *`,
          id, consumedByJobId,
        );
        if (!rows.length) return null;
        const r = rows[0]!;
        return {
          id: r.id, ownerUserId: r.owner_user_id, workflowPlanHash: r.workflow_plan_hash,
          dependencyHash: r.dependency_hash, estimatedMaximumMicroIdr: typeof r.estimated_maximum_micro_idr === 'bigint' ? r.estimated_maximum_micro_idr : BigInt(r.estimated_maximum_micro_idr),
          expiresAt: r.expires_at, consumedByJobId: r.consumed_by_job_id,
          status: r.status as CreditQuote['status'],
          createdAt: r.created_at, updatedAt: r.updated_at,
        };
      } catch {
        return null;
      }
    },

    async markExpired(id: string): Promise<CreditQuote | null> {
      try {
        const existing = await prisma.creditQuote.findFirst({
          where: { id, status: 'issued' },
        });
        if (!existing || existing.consumedByJobId !== null) return null;
        const row = await prisma.creditQuote.update({
          where: { id },
          data: { status: 'expired' },
        });
        return toDTO(row);
      } catch {
        return null;
      }
    },

    async listExpiredUnconsumed(now: Date): Promise<CreditQuote[]> {
      const rows = await prisma.creditQuote.findMany({
        where: {
          status: 'issued',
          expiresAt: { lt: now },
          consumedByJobId: null,
        },
        take: 100,
      });
      return rows.map(toDTO);
    },
  };
}
