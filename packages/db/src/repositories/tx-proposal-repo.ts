import type { Prisma } from '@prisma/client';
import type {
  ProposalRepo,
  Proposal,
  ProposalGroup,
  CreateProposalInput,
} from '@narraza/application';

type TxClient = Prisma.TransactionClient;

export function createTxProposalRepo(tx: TxClient): ProposalRepo {
  function mapProposal(row: any): Proposal {
    return {
      id: row.id,
      proposalGroupId: row.proposalGroupId,
      source: row.source,
      status: row.status,
      dependencyHash: row.dependencyHash,
      operationsHash: row.operationsHash,
      revalidatedFromProposalId: row.revalidatedFromProposalId,
      changeSetId: row.changeSetId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  return {
    async create(input: CreateProposalInput): Promise<Proposal> {
      const row = await (tx as any).proposal.create({
        data: {
          proposalGroupId: input.proposalGroupId,
          source: input.source,
          dependencyHash: input.dependencyHash,
          operationsHash: input.operationsHash,
          revalidatedFromProposalId: input.revalidatedFromProposalId ?? null,
          changeSetId: input.changeSetId ?? null,
        },
      });
      return mapProposal(row);
    },

    async findById(id: string): Promise<Proposal | null> {
      const row = await (tx as any).proposal.findUnique({ where: { id } });
      if (!row) return null;
      return mapProposal(row);
    },

    async findByIdWithGroup(
      id: string,
    ): Promise<(Proposal & { group: ProposalGroup }) | null> {
      const row = await (tx as any).proposal.findUnique({
        where: { id },
        include: { proposalGroup: true },
      });
      if (!row) return null;
      return {
        ...mapProposal(row),
        group: {
          id: row.proposalGroup.id,
          projectId: row.proposalGroup.projectId,
          createdAt: row.proposalGroup.createdAt,
        },
      };
    },

    async findByGroupId(groupId: string): Promise<Proposal[]> {
      const rows = await (tx as any).proposal.findMany({
        where: { proposalGroupId: groupId },
      });
      return rows.map(mapProposal);
    },

    async findPendingByGroupId(groupId: string): Promise<Proposal[]> {
      const rows = await (tx as any).proposal.findMany({
        where: { proposalGroupId: groupId, status: 'pending' },
      });
      return rows.map(mapProposal);
    },

    async transitionStatus(
      id: string,
      fromStatus: Proposal['status'],
      toStatus: Proposal['status'],
      extra?: Partial<Pick<Proposal, 'changeSetId'>>,
    ): Promise<Proposal | null> {
      const row = await (tx as any).proposal.findUnique({ where: { id } });
      if (!row || row.status !== fromStatus) return null;
      const updated = await (tx as any).proposal.update({
        where: { id },
        data: {
          status: toStatus,
          ...(extra?.changeSetId ? { changeSetId: extra.changeSetId } : {}),
          updatedAt: new Date(),
        },
      });
      return mapProposal(updated);
    },

    async supersedeSiblings(
      proposalGroupId: string,
      exceptProposalId: string,
    ): Promise<number> {
      const result = await (tx as any).proposal.updateMany({
        where: {
          proposalGroupId,
          id: { not: exceptProposalId },
          status: 'pending',
        },
        data: { status: 'superseded', updatedAt: new Date() },
      });
      return result.count;
    },

    async markStaleIfPending(id: string): Promise<Proposal | null> {
      const row = await (tx as any).proposal.findUnique({ where: { id } });
      if (!row || row.status !== 'pending') return null;
      const updated = await (tx as any).proposal.update({
        where: { id },
        data: { status: 'stale', updatedAt: new Date() },
      });
      return mapProposal(updated);
    },

    async findByChangeSetId(changeSetId: string): Promise<Proposal[]> {
      const rows = await (tx as any).proposal.findMany({
        where: { changeSetId },
      });
      return rows.map(mapProposal);
    },

    async findWithChangeSet(
      id: string,
    ): Promise<(Proposal & { changeSet: any }) | null> {
      const row = await (tx as any).proposal.findUnique({
        where: { id },
        include: { changeSet: true },
      });
      if (!row) return null;
      return { ...mapProposal(row), changeSet: row.changeSet };
    },
  };
}
