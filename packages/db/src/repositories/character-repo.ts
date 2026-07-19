import type {
  CharacterRepo,
  Character,
  CreateCharacterInput,
} from '@narraza/application';
import { getPrisma } from '../client.js';

export function createCharacterRepo(): CharacterRepo {
  const prisma = getPrisma();

  return {
    async findById(id: string): Promise<Character | null> {
      const row = await prisma.character.findUnique({ where: { id } });
      if (!row) return null;
      return {
        id: row.id,
        projectId: row.projectId,
        name: row.name,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        deletedAt: row.deletedAt,
      };
    },

    async findActiveByProjectId(projectId: string): Promise<Character[]> {
      const rows = await prisma.character.findMany({
        where: { projectId, deletedAt: null },
        orderBy: { createdAt: 'asc' },
      });
      return rows.map((row) => ({
        id: row.id,
        projectId: row.projectId,
        name: row.name,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        deletedAt: row.deletedAt,
      }));
    },

    async create(input: CreateCharacterInput): Promise<Character> {
      const row = await prisma.character.create({
        data: {
          projectId: input.projectId,
          name: input.name,
        },
      });
      return {
        id: row.id,
        projectId: row.projectId,
        name: row.name,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        deletedAt: row.deletedAt,
      };
    },

    async updateName(id: string, name: string): Promise<Character | null> {
      try {
        const row = await prisma.character.update({
          where: { id, deletedAt: null },
          data: { name },
        });
        return {
          id: row.id,
          projectId: row.projectId,
          name: row.name,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          deletedAt: row.deletedAt,
        };
      } catch {
        return null;
      }
    },

    async softDelete(id: string): Promise<Character | null> {
      try {
        const row = await prisma.character.update({
          where: { id, deletedAt: null },
          data: { deletedAt: new Date() },
        });
        return {
          id: row.id,
          projectId: row.projectId,
          name: row.name,
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
