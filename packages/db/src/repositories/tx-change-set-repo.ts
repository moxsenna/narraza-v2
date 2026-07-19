import type { Prisma } from '@prisma/client';
import type {
  CanonicalChangeSetRepo,
  CanonicalChangeSet,
  CanonicalChangeOperation,
  CreateChangeSetInput,
  CreateChangeOperationInput,
} from '@narraza/application';

type TxClient = Prisma.TransactionClient;

export function createTxChangeSetRepo(tx: TxClient): CanonicalChangeSetRepo {
  return {
    async create(input: CreateChangeSetInput): Promise<CanonicalChangeSet> {
      const row = await tx.canonicalChangeSet.create({
        data: {
          projectId: input.projectId,
          status: input.status ?? 'pending',
        },
      });
      return {
        id: row.id,
        projectId: row.projectId,
        proposalId: row.proposalId,
        status: row.status,
        appliedAt: row.appliedAt,
        rejectedAt: row.rejectedAt,
        createdAt: row.createdAt,
      };
    },

    async createOperation(
      input: CreateChangeOperationInput,
    ): Promise<CanonicalChangeOperation> {
      const row = await tx.canonicalChangeOperation.create({
        data: {
          changeSetId: input.changeSetId,
          sequence: input.sequence,
          opType: input.opType,
          targetType: input.targetType,
          targetId: input.targetId ?? null,
          payload: input.payload as Prisma.InputJsonValue,
        },
      });
      return {
        id: row.id,
        changeSetId: row.changeSetId,
        sequence: row.sequence,
        opType: row.opType,
        targetType: row.targetType,
        targetId: row.targetId,
        payload: row.payload as Record<string, unknown>,
        createdAt: row.createdAt,
      };
    },

    async findById(id: string): Promise<CanonicalChangeSet | null> {
      const row = await tx.canonicalChangeSet.findUnique({ where: { id } });
      if (!row) return null;
      return {
        id: row.id,
        projectId: row.projectId,
        proposalId: row.proposalId,
        status: row.status,
        appliedAt: row.appliedAt,
        rejectedAt: row.rejectedAt,
        createdAt: row.createdAt,
      };
    },

    async findOperationsByChangeSetId(changeSetId: string): Promise<CanonicalChangeOperation[]> {
      const rows = await tx.canonicalChangeOperation.findMany({
        where: { changeSetId },
        orderBy: { sequence: 'asc' },
      });
      return rows.map((row) => ({
        id: row.id,
        changeSetId: row.changeSetId,
        sequence: row.sequence,
        opType: row.opType,
        targetType: row.targetType,
        targetId: row.targetId,
        payload: row.payload as Record<string, unknown>,
        createdAt: row.createdAt,
      }));
    },

    async applyChangeSet(id: string): Promise<CanonicalChangeSet | null> {
      const current = await tx.canonicalChangeSet.findUnique({ where: { id } });
      if (!current || current.status !== 'pending') return null;
      const row = await tx.canonicalChangeSet.update({
        where: { id },
        data: {
          status: 'applied',
          appliedAt: new Date(),
        },
      });
      return {
        id: row.id,
        projectId: row.projectId,
        proposalId: row.proposalId,
        status: row.status,
        appliedAt: row.appliedAt,
        rejectedAt: row.rejectedAt,
        createdAt: row.createdAt,
      };
    },

    async rejectChangeSet(id: string): Promise<CanonicalChangeSet | null> {
      const current = await tx.canonicalChangeSet.findUnique({ where: { id } });
      if (!current || current.status !== 'pending') return null;
      const row = await tx.canonicalChangeSet.update({
        where: { id },
        data: {
          status: 'rejected',
          rejectedAt: new Date(),
        },
      });
      return {
        id: row.id,
        projectId: row.projectId,
        proposalId: row.proposalId,
        status: row.status,
        appliedAt: row.appliedAt,
        rejectedAt: row.rejectedAt,
        createdAt: row.createdAt,
      };
    },

    async findByProjectId(projectId: string): Promise<CanonicalChangeSet[]> {
      const rows = await tx.canonicalChangeSet.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
      });
      return rows.map((row) => ({
        id: row.id,
        projectId: row.projectId,
        proposalId: row.proposalId,
        status: row.status,
        appliedAt: row.appliedAt,
        rejectedAt: row.rejectedAt,
        createdAt: row.createdAt,
      }));
    },

    async createEntityRevision(input: {
      projectId: string;
      entityType: string;
      entityId: string;
      changeSetId: string;
      revision: number;
      previousHash?: string | null;
      newHash: string;
      operationCount?: number;
    }): Promise<unknown> {
      return tx.canonicalEntityRevision.create({
        data: {
          projectId: input.projectId,
          entityType: input.entityType,
          entityId: input.entityId,
          changeSetId: input.changeSetId,
          revision: input.revision,
          previousHash: input.previousHash ?? null,
          newHash: input.newHash,
          operationCount: input.operationCount ?? 1,
        },
      });
    },
  };
}
