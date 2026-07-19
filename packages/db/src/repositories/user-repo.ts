import type { UserRepo } from '@narraza/application';
import type { User } from '@narraza/application';
import { getPrisma } from '../client.js';

export function createUserRepo(): UserRepo {
  const prisma = getPrisma();

  return {
    async findByEmailNormalized(emailNormalized: string): Promise<User | null> {
      const row = await prisma.user.findFirst({
        where: { emailNormalized },
      });
      if (!row) return null;
      return {
        id: row.id,
        email: row.email,
        emailNormalized: row.emailNormalized,
        name: row.name,
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        deletedAt: row.deletedAt,
      };
    },

    async findById(id: string): Promise<User | null> {
      const row = await prisma.user.findUnique({ where: { id } });
      if (!row) return null;
      return {
        id: row.id,
        email: row.email,
        emailNormalized: row.emailNormalized,
        name: row.name,
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        deletedAt: row.deletedAt,
      };
    },

    async create(input: { email: string; emailNormalized: string; status?: string }): Promise<User> {
      const row = await prisma.user.create({
        data: {
          email: input.email,
          emailNormalized: input.emailNormalized,
          status: (input.status as 'active' | 'suspended' | 'deleted') || 'active',
        },
      });
      return {
        id: row.id,
        email: row.email,
        emailNormalized: row.emailNormalized,
        name: row.name,
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        deletedAt: row.deletedAt,
      };
    },
  };
}
