import type { Prisma } from '@prisma/client';
import type {
  ProseWorkingDraftRepo,
  ProseWorkingDraft,
  SaveWorkingDraftInput,
} from '@narraza/application';

type TxClient = Prisma.TransactionClient;

export function createTxWorkingDraftRepo(tx: TxClient): ProseWorkingDraftRepo {
  function mapDraft(row: any): ProseWorkingDraft {
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
      const existing = await (tx as any).proseWorkingDraft.findFirst({
        where: { userId: input.userId, beatId: input.beatId, deletedAt: null },
      });

      if (!existing) {
        const row = await (tx as any).proseWorkingDraft.create({
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

      if (
        input.expectedVersion !== undefined &&
        existing.version !== input.expectedVersion
      ) {
        throw new Error(
          `CAS_CONFLICT: expected version ${input.expectedVersion}, got ${existing.version}`,
        );
      }

      const newVersion = existing.version + 1;
      const row = await (tx as any).proseWorkingDraft.update({
        where: { id: existing.id },
        data: {
          content: input.content,
          contentHash: input.contentHash,
          version: newVersion,
          updatedAt: new Date(),
        },
      });
      return mapDraft(row);
    },

    async findById(id: string): Promise<ProseWorkingDraft | null> {
      const row = await (tx as any).proseWorkingDraft.findUnique({
        where: { id },
      });
      if (!row) return null;
      return mapDraft(row);
    },

    async findByUserAndBeat(
      userId: string,
      beatId: string,
    ): Promise<ProseWorkingDraft | null> {
      const row = await (tx as any).proseWorkingDraft.findFirst({
        where: { userId, beatId, deletedAt: null },
      });
      if (!row) return null;
      return mapDraft(row);
    },

    async softDelete(id: string): Promise<ProseWorkingDraft | null> {
      const updated = await (tx as any).proseWorkingDraft.update({
        where: { id },
        data: { deletedAt: new Date(), updatedAt: new Date() },
      });
      return mapDraft(updated);
    },
  };
}
