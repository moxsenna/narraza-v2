import type { Prisma } from '@prisma/client';
import type { BeatRepo, Beat, CreateBeatInput } from '@narraza/application';

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
    async create(input: CreateBeatInput): Promise<Beat> {
      const row = await tx.beat.create({
        data: {
          chapterId: input.chapterId,
          beatNumber: input.beatNumber,
          title: input.title ?? null,
          summary: input.summary ?? null,
        },
      });
      return map(row);
    },

    async findById(id: string): Promise<Beat | null> {
      const row = await tx.beat.findUnique({ where: { id } });
      return row ? map(row) : null;
    },

    async findByChapterAndNumber(
      chapterId: string,
      beatNumber: number,
    ): Promise<Beat | null> {
      const row = await tx.beat.findUnique({
        where: { chapterId_beatNumber: { chapterId, beatNumber } },
      });
      return row ? map(row) : null;
    },

    async listByChapter(chapterId: string): Promise<Beat[]> {
      const rows = await tx.beat.findMany({
        where: { chapterId },
        orderBy: { beatNumber: 'asc' },
      });
      return rows.map(map);
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
