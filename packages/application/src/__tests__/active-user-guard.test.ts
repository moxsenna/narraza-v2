import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config({ path: '../../.env' });

import { authorizeActiveUser } from '../authz/authorize-active-user.js';
import { lockOwnedProject } from '../authz/lock-owned-project.js';
import { createUserRepo } from '../../../db/src/repositories/user-repo.js';
import { createProjectRepo } from '../../../db/src/repositories/project-repo.js';
import { setPrisma } from '../../../db/src/client.js';

let prisma: PrismaClient;

beforeAll(async () => {
  const dbUrl =
    process.env.DATABASE_URL ??
    'postgresql://narraza:narraza@localhost:5433/narraza';
  prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
  setPrisma(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('authorizeActiveUser', () => {
  it('returns user when active', async () => {
    const userRepo = createUserRepo();
    const user = await userRepo.create({
      email: `active-${Date.now()}@guard-test.com`,
      emailNormalized: `active-${Date.now()}@guard-test.com`,
      status: 'active',
    });

    const result = await authorizeActiveUser(userRepo, user.id);
    expect(result.id).toBe(user.id);
    expect(result.status).toBe('active');
  });

  it('throws NOT_FOUND for missing user', async () => {
    const userRepo = createUserRepo();
    await expect(
      authorizeActiveUser(userRepo, 'nonexistent-user-id'),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('throws FORBIDDEN for suspended user', async () => {
    const userRepo = createUserRepo();
    const user = await prisma.user.create({
      data: {
        email: `suspended-${Date.now()}@guard-test.com`,
        emailNormalized: `suspended-${Date.now()}@guard-test.com`,
        status: 'suspended',
      },
    });

    await expect(
      authorizeActiveUser(userRepo, user.id),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('throws FORBIDDEN for deleted user', async () => {
    const userRepo = createUserRepo();
    const user = await prisma.user.create({
      data: {
        email: `deleted-${Date.now()}@guard-test.com`,
        emailNormalized: `deleted-${Date.now()}@guard-test.com`,
        status: 'deleted',
      },
    });

    await expect(
      authorizeActiveUser(userRepo, user.id),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});

describe('lockOwnedProject', () => {
  it('returns project when owner matches and not deleted', async () => {
    const projectRepo = createProjectRepo();
    const user = await prisma.user.create({
      data: {
        email: `owner-${Date.now()}@guard-test.com`,
        emailNormalized: `owner-${Date.now()}@guard-test.com`,
      },
    });

    const project = await projectRepo.create({
      ownerUserId: user.id,
      title: 'My Project',
      startMode: 'guided',
      createRequestId: `req-owner-${Date.now()}`,
    });

    const result = await lockOwnedProject(projectRepo, project.id, user.id);
    expect(result.id).toBe(project.id);
    expect(result.ownerUserId).toBe(user.id);
  });

  it('throws NOT_FOUND for non-existent project', async () => {
    const projectRepo = createProjectRepo();
    await expect(
      lockOwnedProject(projectRepo, 'nonexistent', 'user-123'),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('throws NOT_FOUND when caller is not owner (IDOR)', async () => {
    const projectRepo = createProjectRepo();
    const owner = await prisma.user.create({
      data: {
        email: `idor-owner-${Date.now()}@guard-test.com`,
        emailNormalized: `idor-owner-${Date.now()}@guard-test.com`,
      },
    });
    const attacker = await prisma.user.create({
      data: {
        email: `idor-attacker-${Date.now()}@guard-test.com`,
        emailNormalized: `idor-attacker-${Date.now()}@guard-test.com`,
      },
    });

    const project = await projectRepo.create({
      ownerUserId: owner.id,
      title: 'Target Project',
      startMode: 'guided',
      createRequestId: `req-idor-${Date.now()}`,
    });

    await expect(
      lockOwnedProject(projectRepo, project.id, attacker.id),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Project not found',
    });
  });

  it('throws NOT_FOUND for soft-deleted project', async () => {
    const projectRepo = createProjectRepo();
    const user = await prisma.user.create({
      data: {
        email: `softdel-${Date.now()}@guard-test.com`,
        emailNormalized: `softdel-${Date.now()}@guard-test.com`,
      },
    });

    const project = await projectRepo.create({
      ownerUserId: user.id,
      title: 'Soft Delete Me',
      startMode: 'guided',
      createRequestId: `req-softdel-${Date.now()}`,
    });

    // Soft delete the project
    await prisma.project.update({
      where: { id: project.id },
      data: { deletedAt: new Date() },
    });

    await expect(
      lockOwnedProject(projectRepo, project.id, user.id),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('IDOR returns identical error as missing (no information leak)', async () => {
    const projectRepo = createProjectRepo();
    const owner = await prisma.user.create({
      data: {
        email: `infoleak-owner-${Date.now()}@guard-test.com`,
        emailNormalized: `infoleak-owner-${Date.now()}@guard-test.com`,
      },
    });
    const attacker = await prisma.user.create({
      data: {
        email: `infoleak-att-${Date.now()}@guard-test.com`,
        emailNormalized: `infoleak-att-${Date.now()}@guard-test.com`,
      },
    });

    const project = await projectRepo.create({
      ownerUserId: owner.id,
      title: 'InfoLeak Test',
      startMode: 'guided',
      createRequestId: `req-infoleak-${Date.now()}`,
    });

    const missingErr = await lockOwnedProject(projectRepo, 'nonexistent', attacker.id).catch(
      (e: unknown) => e,
    );
    const idorErr = await lockOwnedProject(projectRepo, project.id, attacker.id).catch(
      (e: unknown) => e,
    );

    expect(missingErr).toMatchObject({ code: 'NOT_FOUND' });
    expect(idorErr).toMatchObject({ code: 'NOT_FOUND' });
    // Same public message — indistinguishable
    expect((idorErr as Error).message).toBe((missingErr as Error).message);
  });
});
