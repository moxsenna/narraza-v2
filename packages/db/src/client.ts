import { PrismaClient } from '@prisma/client';

let _prisma: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
  if (!_prisma) {
    _prisma = new PrismaClient();
  }
  return _prisma;
}

export function setPrisma(prisma: PrismaClient): void {
  _prisma = prisma;
}

export type { PrismaClient } from '@prisma/client';
