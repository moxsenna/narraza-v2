import type { Prisma } from '@prisma/client';
import type { WorkflowInvocation, CreateWorkflowInvocationInput, WorkflowInvocationRepo } from '@narraza/application';

type TxClient = Prisma.TransactionClient;

export function createTxWorkflowInvocationRepo(tx: TxClient): WorkflowInvocationRepo {
  function dto(r: any): WorkflowInvocation {
    return { id: r.id, generationJobId: r.generationJobId, routingStage: r.routingStage, invocationKey: r.invocationKey, selectedAttemptId: r.selectedAttemptId, status: r.status as WorkflowInvocation['status'], createdAt: r.createdAt, updatedAt: r.updatedAt };
  }
  return {
    async create(input: CreateWorkflowInvocationInput): Promise<WorkflowInvocation> {
      const r = await tx.workflowInvocation.create({ data: { generationJobId: input.generationJobId, routingStage: input.routingStage, invocationKey: input.invocationKey, status: 'pending' } });
      return dto(r);
    },
    async findById(id: string): Promise<WorkflowInvocation | null> { const r = await tx.workflowInvocation.findUnique({ where: { id } }); return r ? dto(r) : null; },
    async findByJobStageAndKey(jobId: string, stage: string, key: string): Promise<WorkflowInvocation | null> { const r = await tx.workflowInvocation.findFirst({ where: { generationJobId: jobId, routingStage: stage, invocationKey: key } }); return r ? dto(r) : null; },
    async findByJobId(jobId: string): Promise<WorkflowInvocation[]> { const rs = await tx.workflowInvocation.findMany({ where: { generationJobId: jobId } }); return rs.map(dto); },
    async selectWinnerAttempt(id: string, attemptId: string): Promise<WorkflowInvocation | null> {
      try { const r = await tx.workflowInvocation.update({ where: { id, selectedAttemptId: null }, data: { selectedAttemptId: attemptId, status: 'completed' } }); return dto(r); } catch { return null; }
    },
    async updateStatus(id: string, status: WorkflowInvocation['status']): Promise<WorkflowInvocation | null> {
      try { const r = await tx.workflowInvocation.update({ where: { id }, data: { status } }); return dto(r); } catch { return null; }
    },
  };
}
