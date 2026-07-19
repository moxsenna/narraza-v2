import type { Prisma } from '@prisma/client';
import type { GenerationAttempt, CreateGenerationAttemptInput, GenerationAttemptRepo } from '@narraza/application';

type TxClient = Prisma.TransactionClient;

export function createTxGenerationAttemptRepo(tx: TxClient): GenerationAttemptRepo {
  function dto(r: any): GenerationAttempt {
    return { id: r.id, generationJobId: r.generationJobId, workflowInvocationId: r.workflowInvocationId, status: r.status as GenerationAttempt['status'], attemptNumber: r.attemptNumber, leaseToken: r.leaseToken, deadlineAt: r.deadlineAt, retryDisposition: r.retryDisposition, providerRequestId: r.providerRequestId, createdAt: r.createdAt, updatedAt: r.updatedAt };
  }
  return {
    async create(input: CreateGenerationAttemptInput): Promise<GenerationAttempt> {
      const r = await tx.generationAttempt.create({ data: { generationJobId: input.generationJobId, workflowInvocationId: input.workflowInvocationId ?? null, attemptNumber: input.attemptNumber, leaseToken: input.leaseToken ?? null, deadlineAt: input.deadlineAt ?? null, providerRequestId: input.providerRequestId ?? null, status: 'started' } });
      return dto(r);
    },
    async findById(id: string): Promise<GenerationAttempt | null> { const r = await tx.generationAttempt.findUnique({ where: { id } }); return r ? dto(r) : null; },
    async findByJobId(jobId: string): Promise<GenerationAttempt[]> { const rs = await tx.generationAttempt.findMany({ where: { generationJobId: jobId }, orderBy: { attemptNumber: 'asc' } }); return rs.map(dto); },
    async findStartedByJobId(jobId: string): Promise<GenerationAttempt[]> { const rs = await tx.generationAttempt.findMany({ where: { generationJobId: jobId, status: 'started' } }); return rs.map(dto); },
    async updateStatus(id: string, status: GenerationAttempt['status'], extra?: Partial<Pick<GenerationAttempt, 'retryDisposition' | 'deadlineAt'>>): Promise<GenerationAttempt | null> {
      try { const data: any = { status }; if (extra?.retryDisposition !== undefined) data.retryDisposition = extra.retryDisposition; if (extra?.deadlineAt !== undefined) data.deadlineAt = extra.deadlineAt; const r = await tx.generationAttempt.update({ where: { id }, data }); return dto(r); } catch { return null; }
    },
    async finalize(id: string, newStatus: GenerationAttempt['status'], extra?: Partial<Pick<GenerationAttempt, 'retryDisposition'>>): Promise<GenerationAttempt | null> {
      try { const data: any = { status: newStatus }; if (extra?.retryDisposition !== undefined) data.retryDisposition = extra.retryDisposition; const r = await tx.generationAttempt.update({ where: { id, status: 'started' }, data }); return dto(r); } catch { return null; }
    },
    async listForReconciliation(jobId: string): Promise<GenerationAttempt[]> {
      const rs = await tx.generationAttempt.findMany({ where: { generationJobId: jobId, status: { in: ['started', 'unknown'] } } });
      return rs.map(dto);
    },
  };
}
