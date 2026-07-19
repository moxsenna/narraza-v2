import type { GenerationAttempt, CreateGenerationAttemptInput, GenerationAttemptRepo } from '@narraza/application';
import { getPrisma } from '../client.js';

export function createGenerationAttemptRepo(): GenerationAttemptRepo {
  const prisma = getPrisma();

  function toDTO(row: Record<string, unknown>): GenerationAttempt {
    return {
      id: row.id as string,
      generationJobId: row.generationJobId as string,
      workflowInvocationId: row.workflowInvocationId as string | null,
      status: row.status as GenerationAttempt['status'],
      attemptNumber: row.attemptNumber as number,
      leaseToken: row.leaseToken as string | null,
      deadlineAt: row.deadlineAt as Date | null,
      retryDisposition: row.retryDisposition as string | null,
      providerRequestId: row.providerRequestId as string | null,
      createdAt: row.createdAt as Date,
      updatedAt: row.updatedAt as Date,
    };
  }

  function rowToDTO(row: { id: string; generationJobId: string; workflowInvocationId: string | null; status: string; attemptNumber: number; leaseToken: string | null; deadlineAt: Date | null; retryDisposition: string | null; providerRequestId: string | null; createdAt: Date; updatedAt: Date }): GenerationAttempt {
    return {
      id: row.id,
      generationJobId: row.generationJobId,
      workflowInvocationId: row.workflowInvocationId,
      status: row.status as GenerationAttempt['status'],
      attemptNumber: row.attemptNumber,
      leaseToken: row.leaseToken,
      deadlineAt: row.deadlineAt,
      retryDisposition: row.retryDisposition,
      providerRequestId: row.providerRequestId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  return {
    async create(input: CreateGenerationAttemptInput): Promise<GenerationAttempt> {
      const row = await prisma.generationAttempt.create({
        data: {
          generationJobId: input.generationJobId,
          workflowInvocationId: input.workflowInvocationId ?? null,
          attemptNumber: input.attemptNumber,
          leaseToken: input.leaseToken ?? null,
          deadlineAt: input.deadlineAt ?? null,
          providerRequestId: input.providerRequestId ?? null,
          status: 'started',
        },
      });
      return rowToDTO(row);
    },

    async findById(id: string): Promise<GenerationAttempt | null> {
      const row = await prisma.generationAttempt.findUnique({ where: { id } });
      return row ? rowToDTO(row) : null;
    },

    async findByJobId(generationJobId: string): Promise<GenerationAttempt[]> {
      const rows = await prisma.generationAttempt.findMany({
        where: { generationJobId },
        orderBy: { attemptNumber: 'asc' },
      });
      return rows.map(rowToDTO);
    },

    async findStartedByJobId(generationJobId: string): Promise<GenerationAttempt[]> {
      const rows = await prisma.generationAttempt.findMany({
        where: { generationJobId, status: 'started' },
      });
      return rows.map(rowToDTO);
    },

    async updateStatus(
      id: string,
      status: GenerationAttempt['status'],
      extra?: Partial<Pick<GenerationAttempt, 'retryDisposition' | 'deadlineAt'>>,
    ): Promise<GenerationAttempt | null> {
      try {
        const data: Record<string, unknown> = { status };
        if (extra?.retryDisposition !== undefined) data.retryDisposition = extra.retryDisposition;
        if (extra?.deadlineAt !== undefined) data.deadlineAt = extra.deadlineAt;
        const row = await prisma.generationAttempt.update({
          where: { id },
          data: data as any,
        });
        return rowToDTO(row);
      } catch {
        return null;
      }
    },

    async finalize(
      id: string,
      newStatus: GenerationAttempt['status'],
      extra?: Partial<Pick<GenerationAttempt, 'retryDisposition'>>,
    ): Promise<GenerationAttempt | null> {
      try {
        const data: Record<string, unknown> = { status: newStatus };
        if (extra?.retryDisposition !== undefined) data.retryDisposition = extra.retryDisposition;
        const row = await prisma.generationAttempt.update({
          where: { id, status: 'started' },
          data: data as any,
        });
        return rowToDTO(row);
      } catch {
        return null;
      }
    },

    async listForReconciliation(generationJobId: string): Promise<GenerationAttempt[]> {
      const rows = await prisma.generationAttempt.findMany({
        where: {
          generationJobId,
          status: { in: ['started', 'unknown'] },
        },
      });
      return rows.map(rowToDTO);
    },
  };
}
