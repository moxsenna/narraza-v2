import type { WorkflowInvocation, CreateWorkflowInvocationInput, WorkflowInvocationRepo } from '@narraza/application';
import { getPrisma } from '../client.js';

export function createWorkflowInvocationRepo(): WorkflowInvocationRepo {
  const prisma = getPrisma();

  function rowToDTO(row: { id: string; generationJobId: string; routingStage: string; invocationKey: string; selectedAttemptId: string | null; status: string; createdAt: Date; updatedAt: Date }): WorkflowInvocation {
    return {
      id: row.id,
      generationJobId: row.generationJobId,
      routingStage: row.routingStage,
      invocationKey: row.invocationKey,
      selectedAttemptId: row.selectedAttemptId,
      status: row.status as WorkflowInvocation['status'],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  return {
    async create(input: CreateWorkflowInvocationInput): Promise<WorkflowInvocation> {
      const row = await prisma.workflowInvocation.create({
        data: {
          generationJobId: input.generationJobId,
          routingStage: input.routingStage,
          invocationKey: input.invocationKey,
          status: 'pending',
        },
      });
      return rowToDTO(row);
    },

    async findById(id: string): Promise<WorkflowInvocation | null> {
      const row = await prisma.workflowInvocation.findUnique({ where: { id } });
      return row ? rowToDTO(row) : null;
    },

    async findByJobStageAndKey(
      generationJobId: string,
      routingStage: string,
      invocationKey: string,
    ): Promise<WorkflowInvocation | null> {
      const row = await prisma.workflowInvocation.findFirst({
        where: { generationJobId, routingStage, invocationKey },
      });
      return row ? rowToDTO(row) : null;
    },

    async findByJobId(generationJobId: string): Promise<WorkflowInvocation[]> {
      const rows = await prisma.workflowInvocation.findMany({
        where: { generationJobId },
      });
      return rows.map(rowToDTO);
    },

    async selectWinnerAttempt(id: string, attemptId: string): Promise<WorkflowInvocation | null> {
      try {
        const row = await prisma.workflowInvocation.update({
          where: { id, selectedAttemptId: null },
          data: { selectedAttemptId: attemptId, status: 'completed' },
        });
        return rowToDTO(row);
      } catch {
        return null;
      }
    },

    async updateStatus(id: string, status: WorkflowInvocation['status']): Promise<WorkflowInvocation | null> {
      try {
        const row = await prisma.workflowInvocation.update({
          where: { id },
          data: { status },
        });
        return rowToDTO(row);
      } catch {
        return null;
      }
    },
  };
}
