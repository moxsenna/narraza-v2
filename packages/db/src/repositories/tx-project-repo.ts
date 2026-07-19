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

    async lockForUpdate(id: string): Promise<Project | null> {
      type RawProject = {
        id: string;
        owner_user_id: string;
        title: string;
        start_mode: string;
        foundation_status: string;
        current_canonical_version: number;
        create_request_id: string | null;
        created_at: Date;
        updated_at: Date;
        deleted_at: Date | null;
      };
      const rows = await tx.$queryRawUnsafe<RawProject[]>(
        `SELECT * FROM projects WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
        id,
      );
      if (!rows || rows.length === 0) return null;
      const r = rows[0]!;
      return {
        id: r.id,
        ownerUserId: r.owner_user_id,
        title: r.title,
        startMode: r.start_mode as 'guided' | 'advanced',
        foundationStatus: r.foundation_status as 'none' | 'draft' | 'locked',
        currentCanonicalVersion: r.current_canonical_version,
        createRequestId: r.create_request_id,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        deletedAt: r.deleted_at,
      };
    },

    async updateFoundationStatus(
      id: string,
      status: 'none' | 'draft' | 'locked',
    ): Promise<Project | null> {
      try {
        const row = await tx.project.update({
          where: { id },
          data: { foundationStatus: status },
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

    async bumpCanonicalVersion(
      id: string,
      increment: number,
    ): Promise<Project | null> {
      try {
        const row = await tx.project.update({
          where: { id },
          data: { currentCanonicalVersion: { increment } },
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
