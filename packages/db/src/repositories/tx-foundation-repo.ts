import type { Prisma } from '@prisma/client';
import type {
  FoundationRepo,
  Foundation,
  UpsertFoundationInput,
} from '@narraza/application';

type TxClient = Prisma.TransactionClient;

export function createTxFoundationRepo(tx: TxClient): FoundationRepo {
  return {
    async findByProjectId(projectId: string): Promise<Foundation | null> {
      const row = await tx.foundation.findUnique({
        where: { projectId },
      });
      if (!row) return null;
      return {
        id: row.id,
        projectId: row.projectId,
        premise: row.premise,
        tone: row.tone,
        genre: row.genre,
        body: row.body as Record<string, unknown> | null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    },

    async upsert(input: UpsertFoundationInput): Promise<Foundation> {
      const row = await tx.foundation.upsert({
        where: { projectId: input.projectId },
        create: {
          projectId: input.projectId,
          premise: input.premise ?? null,
          tone: input.tone ?? null,
          genre: input.genre ?? null,
          body: input.body ?? undefined,
        },
        update: {
          premise: input.premise !== undefined ? input.premise : undefined,
          tone: input.tone !== undefined ? input.tone : undefined,
          genre: input.genre !== undefined ? input.genre : undefined,
          body: input.body !== undefined ? (input.body as Prisma.InputJsonValue) : undefined,
        },
      });
      return {
        id: row.id,
        projectId: row.projectId,
        premise: row.premise,
        tone: row.tone,
        genre: row.genre,
        body: row.body as Record<string, unknown> | null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    },
  };
}
