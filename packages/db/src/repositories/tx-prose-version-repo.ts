import type { Prisma } from '@prisma/client';
import type { ProseVersionRepo, ProseVersion } from '@narraza/application';

type TxClient = Prisma.TransactionClient;

export function createTxProseVersionRepo(tx: TxClient): ProseVersionRepo {
  function map(row: {
    id: string;
    beatId: string;
    version: number;
    content: string;
    contentHash: string;
    status: string;
    createdAt: Date;
  }): ProseVersion {
    return {
      id: row.id,
      beatId: row.beatId,
      version: row.version,
      content: row.content,
      contentHash: row.contentHash,
      status: row.status,
      createdAt: row.createdAt,
    };
  }

  return {
    async findById(id: string): Promise<ProseVersion | null> {
      const row = await tx.proseVersion.findUnique({ where: { id } });
      return row ? map(row) : null;
    },

    async create(input: {
      beatId: string;
      version: number;
      content: string;
      contentHash: string;
      status?: string;
    }): Promise<ProseVersion> {
      const row = await tx.proseVersion.create({
        data: {
          beatId: input.beatId,
          version: input.version,
          content: input.content,
          contentHash: input.contentHash,
          status: (input.status as 'draft' | 'validated' | 'rejected' | 'superseded') ?? 'draft',
        },
      });
      return map(row);
    },

    async nextVersion(beatId: string): Promise<number> {
      const latest = await tx.proseVersion.findFirst({
        where: { beatId },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      return (latest?.version ?? 0) + 1;
    },
  };
}
