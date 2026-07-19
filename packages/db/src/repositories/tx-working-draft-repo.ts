import type { Prisma } from '@prisma/client';
import type {
  ProseWorkingDraftRepo,
  ProseWorkingDraft,
  SaveWorkingDraftInput,
} from '@narraza/application';

type TxClient = Prisma.TransactionClient;

export function createTxWorkingDraftRepo(tx: TxClient): ProseWorkingDraftRepo {
  function mapDraft(row: {
    id: string;
    userId: string;
    beatId: string;
    content: string;
    contentHash: string;
    version: number;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): ProseWorkingDraft {
    return {
      id: row.id,
      userId: row.userId,
      beatId: row.beatId,
      content: row.content,
      contentHash: row.contentHash,
      version: row.version,
      deletedAt: row.deletedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  return {
    async save(input: SaveWorkingDraftInput): Promise<ProseWorkingDraft> {
      const existing = await tx.proseWorkingDraft.findFirst({
        where: {
          userId: input.userId,
          beatId: input.beatId,
          deletedAt: null,
        },
      });

      if (!existing) {
        const row = await tx.proseWorkingDraft.create({
          data: {
            userId: input.userId,
            beatId: input.beatId,
            content: input.content,
            contentHash: input.contentHash,
            version: 1,
          },
        });
        return mapDraft(row);
      }

      // Atomic CAS: UPDATE ... WHERE version = expected
      const expectedVersion = input.expectedVersion ?? existing.version;

      const updated = await tx.proseWorkingDraft.updateMany({
        where: {
          id: existing.id,
          version: expectedVersion,
          deletedAt: null,
        },
        data: {
          content: input.content,
          contentHash: input.contentHash,
          version: expectedVersion + 1,
        },
      });

      if (updated.count === 0) {
        throw new Error(
          `CAS_CONFLICT: expected version ${expectedVersion}, concurrent modification`,
        );
      }

      const row = await tx.proseWorkingDraft.findUnique({
        where: { id: existing.id },
      });
      if (!row) {
        throw new Error('CAS_CONFLICT: draft disappeared after update');
      }
      return mapDraft(row);
    },

    async findById(id: string): Promise<ProseWorkingDraft | null> {
      const row = await tx.proseWorkingDraft.findUnique({
        where: { id },
      });
      if (!row) return null;
      return mapDraft(row);
    },

    async findByUserAndBeat(
      userId: string,
      beatId: string,
    ): Promise<ProseWorkingDraft | null> {
      const row = await tx.proseWorkingDraft.findFirst({
        where: { userId, beatId, deletedAt: null },
      });
      if (!row) return null;
      return mapDraft(row);
    },

    async softDelete(id: string): Promise<ProseWorkingDraft | null> {
      try {
        const updated = await tx.proseWorkingDraft.update({
          where: { id },
          data: { deletedAt: new Date() },
        });
        return mapDraft(updated);
      } catch {
        return null;
      }
    },
  };
}
