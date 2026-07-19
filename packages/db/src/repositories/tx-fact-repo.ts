import type { Prisma } from '@prisma/client';
import type { FactRepo, Fact } from '@narraza/application';

type TxClient = Prisma.TransactionClient;

export function createTxFactRepo(tx: TxClient): FactRepo {
  function map(row: {
    id: string;
    projectId: string;
    factKey: string;
    truth: string;
    canonStatus: string;
    revision: number;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }): Fact {
    return {
      id: row.id,
      projectId: row.projectId,
      factKey: row.factKey,
      truth: row.truth,
      canonStatus: row.canonStatus as Fact['canonStatus'],
      revision: row.revision,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    };
  }

  return {
    async findById(id: string): Promise<Fact | null> {
      const row = await tx.fact.findUnique({ where: { id } });
      return row ? map(row) : null;
    },

    async findActiveByProjectAndKey(
      projectId: string,
      factKey: string,
    ): Promise<Fact | null> {
      const row = await tx.fact.findFirst({
        where: { projectId, factKey, deletedAt: null },
      });
      return row ? map(row) : null;
    },

    async upsert(input: {
      id?: string;
      projectId: string;
      factKey: string;
      truth: string;
      canonStatus?: 'confirmed' | 'deprecated' | 'contradicted';
    }): Promise<Fact> {
      if (input.id) {
        try {
          const row = await tx.fact.update({
            where: { id: input.id },
            data: {
              factKey: input.factKey,
              truth: input.truth,
              canonStatus: input.canonStatus ?? 'confirmed',
              revision: { increment: 1 },
              deletedAt: null,
            },
          });
          return map(row);
        } catch {
          // fall through to create by key
        }
      }

      const existing = await tx.fact.findFirst({
        where: {
          projectId: input.projectId,
          factKey: input.factKey,
          deletedAt: null,
        },
      });

      if (existing) {
        const row = await tx.fact.update({
          where: { id: existing.id },
          data: {
            truth: input.truth,
            canonStatus: input.canonStatus ?? 'confirmed',
            revision: { increment: 1 },
          },
        });
        return map(row);
      }

      const createData: {
        id?: string;
        projectId: string;
        factKey: string;
        truth: string;
        canonStatus: 'confirmed' | 'deprecated' | 'contradicted';
      } = {
        projectId: input.projectId,
        factKey: input.factKey,
        truth: input.truth,
        canonStatus: input.canonStatus ?? 'confirmed',
      };
      if (input.id) createData.id = input.id;
      const row = await tx.fact.create({
        data: createData,
      });
      return map(row);
    },

    async softDelete(id: string): Promise<Fact | null> {
      try {
        const row = await tx.fact.update({
          where: { id, deletedAt: null },
          data: { deletedAt: new Date() },
        });
        return map(row);
      } catch {
        return null;
      }
    },
  };
}
