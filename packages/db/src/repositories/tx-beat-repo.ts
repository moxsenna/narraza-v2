import type { Prisma } from '@prisma/client';
import type { BeatRepo, Beat } from '@narraza/application';

type TxClient = Prisma.TransactionClient;

export function createTxBeatRepo(tx: TxClient): BeatRepo {
  function map(row: {
    id: string;
    chapterId: string;
    beatNumber: number;
    acceptedProseVersionId: string | null;
    title: string | null;
    summary: string | null;
  }): Beat {
    return {
      id: row.id,
      chapterId: row.chapterId,
      beatNumber: row.beatNumber,
      acceptedProseVersionId: row.acceptedProseVersionId,
      title: row.title,
      summary: row.summary,
    };
  }

  return {
    async findById(id: string): Promise<Beat | null> {
      const row = await tx.beat.findUnique({ where: { id } });
      return row ? map(row) : null;
    },

    async setAcceptedProseVersion(
      beatId: string,
      proseVersionId: string,
    ): Promise<Beat | null> {
      try {
        const row = await tx.beat.update({
          where: { id: beatId },
          data: { acceptedProseVersionId: proseVersionId },
        });
        return map(row);
      } catch {
        return null;
      }
    },
  };
}
