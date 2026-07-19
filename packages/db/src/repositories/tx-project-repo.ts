import type { PrismaClient, Prisma } from '@prisma/client';
import type { ProjectRepo, CreateProjectInput } from '@narraza/application';
import type { Project } from '@narraza/application';

type TxClient = Prisma.TransactionClient;

export function createTxProjectRepo(tx: TxClient): ProjectRepo {
  return {
    async findById(id: string): Promise<Project | null> {
      const row = await tx.project.findUnique({ where: { id } });
      if (!row) return null;
      return {
        id: row.id,
        ownerUserId: row.ownerUserId,
        title: row.title,
        startMode: row.startMode as 'guided' | 'advanced',
        foundationStatus: row.foundationStatus as 'none' | 'draft' | 'locked',
        currentCanonicalVersion: row.currentCanonicalVersion,
        createRequestId: row.createRequestId,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        deletedAt: row.deletedAt,
      };
    },

    async findByOwnerUserIdAndRequestId(
      ownerUserId: string,
      requestId: string,
    ): Promise<Project | null> {
      const row = await tx.project.findUnique({
        where: {
          ownerUserId_createRequestId: {
            ownerUserId,
            createRequestId: requestId,
          },
        },
      });
      if (!row) return null;
      return {
        id: row.id,
        ownerUserId: row.ownerUserId,
        title: row.title,
        startMode: row.startMode as 'guided' | 'advanced',
        foundationStatus: row.foundationStatus as 'none' | 'draft' | 'locked',
        currentCanonicalVersion: row.currentCanonicalVersion,
        createRequestId: row.createRequestId,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        deletedAt: row.deletedAt,
      };
    },

    async create(input: CreateProjectInput): Promise<Project> {
      const row = await tx.project.create({
        data: {
          ownerUserId: input.ownerUserId,
          title: input.title,
          startMode: input.startMode,
          createRequestId: input.createRequestId,
          foundationStatus: 'none',
          currentCanonicalVersion: 0,
        },
      });
      return {
        id: row.id,
        ownerUserId: row.ownerUserId,
        title: row.title,
        startMode: row.startMode as 'guided' | 'advanced',
        foundationStatus: row.foundationStatus as 'none' | 'draft' | 'locked',
        currentCanonicalVersion: row.currentCanonicalVersion,
        createRequestId: row.createRequestId,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        deletedAt: row.deletedAt,
      };
    },

    async listByOwnerUserId(ownerUserId: string): Promise<Project[]> {
      const rows = await tx.project.findMany({
        where: {
          ownerUserId,
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
      });
      return rows.map((row) => ({
        id: row.id,
        ownerUserId: row.ownerUserId,
        title: row.title,
        startMode: row.startMode as 'guided' | 'advanced',
        foundationStatus: row.foundationStatus as 'none' | 'draft' | 'locked',
        currentCanonicalVersion: row.currentCanonicalVersion,
        createRequestId: row.createRequestId,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        deletedAt: row.deletedAt,
      }));
    },

    async softDelete(id: string): Promise<Project | null> {
      try {
        const row = await tx.project.update({
          where: { id, deletedAt: null },
          data: { deletedAt: new Date() },
        });
        return {
          id: row.id,
          ownerUserId: row.ownerUserId,
          title: row.title,
          startMode: row.startMode as 'guided' | 'advanced',
          foundationStatus: row.foundationStatus as 'none' | 'draft' | 'locked',
          currentCanonicalVersion: row.currentCanonicalVersion,
          createRequestId: row.createRequestId,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          deletedAt: row.deletedAt,
        };
      } catch {
        return null;
      }
    },
  };
}
