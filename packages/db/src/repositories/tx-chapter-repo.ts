import type { Prisma } from '@prisma/client';
import type {
  ChapterRepo,
  Chapter,
  CreateChapterInput,
} from '@narraza/application';

type TxClient = Prisma.TransactionClient;

export function createTxChapterRepo(tx: TxClient): ChapterRepo {
  function map(row: {
    id: string;
    projectId: string;
    number: number;
    title: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): Chapter {
    return {
      id: row.id,
      projectId: row.projectId,
      number: row.number,
      title: row.title,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  return {
    async create(input: CreateChapterInput): Promise<Chapter> {
      const row = await tx.chapter.create({
        data: {
          projectId: input.projectId,
          number: input.number,
          title: input.title ?? null,
        },
      });
      return map(row);
    },

    async findById(id: string): Promise<Chapter | null> {
      const row = await tx.chapter.findUnique({ where: { id } });
      return row ? map(row) : null;
    },

    async findByProjectAndNumber(
      projectId: string,
      number: number,
    ): Promise<Chapter | null> {
      const row = await tx.chapter.findUnique({
        where: { projectId_number: { projectId, number } },
      });
      return row ? map(row) : null;
    },

    async findByProjectId(projectId: string): Promise<Chapter[]> {
      const rows = await tx.chapter.findMany({
        where: { projectId },
        orderBy: { number: 'asc' },
      });
      return rows.map(map);
    },

    async upsert(input: CreateChapterInput): Promise<Chapter> {
      const row = await tx.chapter.upsert({
        where: {
          projectId_number: {
            projectId: input.projectId,
            number: input.number,
          },
        },
        create: {
          projectId: input.projectId,
          number: input.number,
          title: input.title ?? null,
        },
        update: {
          title: input.title ?? null,
          updatedAt: new Date(),
        },
      });
      return map(row);
    },
  };
}
