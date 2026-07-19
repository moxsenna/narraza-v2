import type { Prisma } from '@prisma/client';
import type {
  ChapterOutlineRepo,
  ChapterOutline,
  CreateChapterOutlineInput,
} from '@narraza/application';

type TxClient = Prisma.TransactionClient;

export function createTxChapterOutlineRepo(tx: TxClient): ChapterOutlineRepo {
  function map(row: {
    id: string;
    projectId: string;
    chapterNumber: number;
    title: string | null;
    summary: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): ChapterOutline {
    return {
      id: row.id,
      projectId: row.projectId,
      chapterNumber: row.chapterNumber,
      title: row.title,
      summary: row.summary,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  return {
    async create(input: CreateChapterOutlineInput): Promise<ChapterOutline> {
      const row = await tx.chapterOutline.create({
        data: {
          projectId: input.projectId,
          chapterNumber: input.chapterNumber,
          title: input.title ?? null,
          summary: input.summary ?? null,
        },
      });
      return map(row);
    },

    async findById(id: string): Promise<ChapterOutline | null> {
      const row = await tx.chapterOutline.findUnique({ where: { id } });
      return row ? map(row) : null;
    },

    async findByProjectAndNumber(
      projectId: string,
      chapterNumber: number,
    ): Promise<ChapterOutline | null> {
      const row = await tx.chapterOutline.findUnique({
        where: { projectId_chapterNumber: { projectId, chapterNumber } },
      });
      return row ? map(row) : null;
    },

    async findByProjectId(projectId: string): Promise<ChapterOutline[]> {
      const rows = await tx.chapterOutline.findMany({
        where: { projectId },
        orderBy: { chapterNumber: 'asc' },
      });
      return rows.map(map);
    },

    async upsert(input: CreateChapterOutlineInput): Promise<ChapterOutline> {
      const row = await tx.chapterOutline.upsert({
        where: {
          projectId_chapterNumber: {
            projectId: input.projectId,
            chapterNumber: input.chapterNumber,
          },
        },
        create: {
          projectId: input.projectId,
          chapterNumber: input.chapterNumber,
          title: input.title ?? null,
          summary: input.summary ?? null,
        },
        update: {
          title: input.title ?? null,
          summary: input.summary ?? null,
          updatedAt: new Date(),
        },
      });
      return map(row);
    },
  };
}
