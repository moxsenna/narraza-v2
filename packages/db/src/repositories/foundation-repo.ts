import type { FoundationRepo, Foundation, UpsertFoundationInput } from '@narraza/application';
import { getPrisma } from '../client.js';

export function createFoundationRepo(): FoundationRepo {
  const prisma = getPrisma();

  return {
    async findByProjectId(projectId: string): Promise<Foundation | null> {
      const row = await prisma.foundation.findUnique({
        where: { projectId },
      });
      if (!row) return null;
      return {
        id: row.id,
        projectId: row.projectId,
        premise: row.premise,
        tone: row.tone,
        genre: row.genre,
        body: row.body as Record<string, unknown> | null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    },

    async upsert(input: UpsertFoundationInput): Promise<Foundation> {
      const createData: Record<string, unknown> = { projectId: input.projectId };
      createData['premise'] = input.premise ?? null;
      createData['tone'] = input.tone ?? null;
      createData['genre'] = input.genre ?? null;
      if (input.body !== undefined) createData['body'] = input.body;
      else createData['body'] = undefined;

      const updateData: Record<string, unknown> = {};
      if (input.premise !== undefined) updateData['premise'] = input.premise;
      if (input.tone !== undefined) updateData['tone'] = input.tone;
      if (input.genre !== undefined) updateData['genre'] = input.genre;
      if (input.body !== undefined) updateData['body'] = input.body;

      const row = await prisma.foundation.upsert({
        where: { projectId: input.projectId },
        create: createData as any,
        update: updateData as any,
      });
      return {
        id: row.id,
        projectId: row.projectId,
        premise: row.premise,
        tone: row.tone,
        genre: row.genre,
        body: row.body as Record<string, unknown> | null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    },
  };
}
