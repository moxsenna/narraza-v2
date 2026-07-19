import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { createPrismaUnitOfWork } from '../unit-of-work.js';
import { setPrisma } from '../client.js';

config({ path: '../../.env' });

const dbUrl =
  process.env.DATABASE_URL ??
  'postgresql://narraza:narraza@localhost:5433/narraza';

let prisma: PrismaClient;

beforeAll(async () => {
  prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
  setPrisma(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Clean up test data
  await prisma.canonicalChangeOperation.deleteMany();
  await prisma.canonicalChangeSet.deleteMany();
  await prisma.foundation.deleteMany();
  await prisma.character.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany({
    where: { email: { contains: '@uow-test.com' } },
  });
});

describe('UnitOfWork', () => {
  it('commits when callback succeeds', async () => {
    const uow = createPrismaUnitOfWork(prisma);

    const user = await prisma.user.create({
      data: {
        email: `uow-commit-${Date.now()}@uow-test.com`,
        emailNormalized: `uow-commit-${Date.now()}@uow-test.com`,
      },
    });

    const projectId = `p-uow-commit-${Date.now()}`;

    await uow.execute(async (ports) => {
      const project = await ports.projectRepo.create({
        ownerUserId: user.id,
        title: 'UoW Commit Test',
        startMode: 'guided',
        createRequestId: `req-uow-commit-${Date.now()}`,
      });

      await ports.foundationRepo.upsert({
        projectId: project.id,
        premise: 'A test premise',
        tone: 'dark',
        genre: 'fantasy',
      });
    });

    // Verify both were committed
    const projects = await prisma.project.findMany({
      where: { ownerUserId: user.id },
    });
    expect(projects).toHaveLength(1);
    const p = projects[0]!;
    expect(p.title).toBe('UoW Commit Test');

    const foundation = await prisma.foundation.findUnique({
      where: { projectId: p.id },
    });
    expect(foundation).not.toBeNull();
    expect(foundation!.premise).toBe('A test premise');
  });

  it('rolls back when callback throws', async () => {
    const uow = createPrismaUnitOfWork(prisma);

    const user = await prisma.user.create({
      data: {
        email: `uow-rollback-${Date.now()}@uow-test.com`,
        emailNormalized: `uow-rollback-${Date.now()}@uow-test.com`,
      },
    });

    let projectIdInside: string | undefined;

    await expect(
      uow.execute(async (ports) => {
        const project = await ports.projectRepo.create({
          ownerUserId: user.id,
          title: 'UoW Rollback Test',
          startMode: 'guided',
          createRequestId: `req-uow-rollback-${Date.now()}`,
        });
        projectIdInside = project.id;

        await ports.foundationRepo.upsert({
          projectId: project.id,
          premise: 'Should be rolled back',
        });

        throw new Error('simulated failure');
      }),
    ).rejects.toThrow('simulated failure');

    // Verify nothing was committed
    const projects = await prisma.project.findMany({
      where: { ownerUserId: user.id },
    });
    expect(projects).toHaveLength(0);

    if (projectIdInside) {
      const foundation = await prisma.foundation.findUnique({
        where: { projectId: projectIdInside },
      });
      expect(foundation).toBeNull();
    }
  });

  it('rolls back all operations when one fails mid-transaction', async () => {
    const uow = createPrismaUnitOfWork(prisma);

    const user = await prisma.user.create({
      data: {
        email: `uow-atomic-${Date.now()}@uow-test.com`,
        emailNormalized: `uow-atomic-${Date.now()}@uow-test.com`,
      },
    });

    let projectIdInside: string | undefined;

    await expect(
      uow.execute(async (ports) => {
        const project = await ports.projectRepo.create({
          ownerUserId: user.id,
          title: 'UoW Atomic Test',
          startMode: 'guided',
          createRequestId: `req-uow-atomic-${Date.now()}`,
        });
        projectIdInside = project.id;

        // Insert a character successfully
        await ports.characterRepo.create({
          projectId: project.id,
          name: 'Test Character',
        });

        // Now throw so everything rolls back
        throw new Error('mid-transaction failure');
      }),
    ).rejects.toThrow('mid-transaction failure');

    const projects = await prisma.project.findMany({
      where: { ownerUserId: user.id },
    });
    expect(projects).toHaveLength(0);

    // Character should not exist either
    const allChars = await prisma.character.findMany();
    expect(allChars.filter((c) => c.name === 'Test Character')).toHaveLength(0);
  });

  it('can create multiple entities in single transaction', async () => {
    const uow = createPrismaUnitOfWork(prisma);

    const user = await prisma.user.create({
      data: {
        email: `uow-multi-${Date.now()}@uow-test.com`,
        emailNormalized: `uow-multi-${Date.now()}@uow-test.com`,
      },
    });

    const result = await uow.execute(async (ports) => {
      const project = await ports.projectRepo.create({
        ownerUserId: user.id,
        title: 'Multi Entity Test',
        startMode: 'guided',
        createRequestId: `req-uow-multi-${Date.now()}`,
      });

      await ports.foundationRepo.upsert({
        projectId: project.id,
        premise: 'A grand adventure',
        genre: 'sci-fi',
        tone: 'serious',
      });

      const char = await ports.characterRepo.create({
        projectId: project.id,
        name: 'Hero',
      });

      return { projectId: project.id, characterId: char.id };
    });

    const project = await prisma.project.findUnique({
      where: { id: result.projectId },
    });
    expect(project).not.toBeNull();

    const foundation = await prisma.foundation.findUnique({
      where: { projectId: result.projectId },
    });
    expect(foundation).not.toBeNull();
    expect(foundation!.genre).toBe('sci-fi');

    const character = await prisma.character.findUnique({
      where: { id: result.characterId },
    });
    expect(character).not.toBeNull();
    expect(character!.name).toBe('Hero');
  });

  it('supports serializable isolation', async () => {
    const uow = createPrismaUnitOfWork(prisma);

    const user = await prisma.user.create({
      data: {
        email: `uow-serial-${Date.now()}@uow-test.com`,
        emailNormalized: `uow-serial-${Date.now()}@uow-test.com`,
      },
    });

    const result = await uow.execute(
      async (ports) => {
        const project = await ports.projectRepo.create({
          ownerUserId: user.id,
          title: 'Serializable Test',
          startMode: 'guided',
          createRequestId: `req-uow-serial-${Date.now()}`,
        });
        return { projectId: project.id };
      },
      { isolation: 'serializable' },
    );

    const project = await prisma.project.findUnique({
      where: { id: result.projectId },
    });
    expect(project).not.toBeNull();
  });
});
