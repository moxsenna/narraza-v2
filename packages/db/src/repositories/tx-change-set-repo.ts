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
  };
}
