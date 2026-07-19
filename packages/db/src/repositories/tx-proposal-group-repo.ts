import type { Prisma } from '@prisma/client';
import type {
  ProposalGroupRepo,
  ProposalGroup,
  CreateProposalGroupInput,
} from '@narraza/application';

type TxClient = Prisma.TransactionClient;

export function createTxProposalGroupRepo(tx: TxClient): ProposalGroupRepo {
  return {
    async create(input: CreateProposalGroupInput): Promise<ProposalGroup> {
      const row = await (tx as any).proposalGroup.create({
        data: { projectId: input.projectId },
      });
      return {
        id: row.id,
        projectId: row.projectId,
        createdAt: row.createdAt,
      };
    },
    async findById(id: string): Promise<ProposalGroup | null> {
      const row = await (tx as any).proposalGroup.findUnique({ where: { id } });
      if (!row) return null;
      return { id: row.id, projectId: row.projectId, createdAt: row.createdAt };
    },
  };
}
