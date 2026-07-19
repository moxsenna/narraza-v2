import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config({ path: '../../.env' });

import { editFoundation } from '../use-cases/foundation/edit-foundation.js';
import { lockFoundation } from '../use-cases/foundation/lock-foundation.js';
import { createUserRepo } from '../../../db/src/repositories/user-repo.js';
import { createProjectRepo } from '../../../db/src/repositories/project-repo.js';
import { createFoundationRepo } from '../../../db/src/repositories/foundation-repo.js';
import { createChangeSetRepo } from '../../../db/src/repositories/change-set-repo.js';
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

beforeEach(async () => {
  await prisma.canonicalChangeOperation.deleteMany();
  await prisma.canonicalChangeSet.deleteMany();
  await prisma.foundation.deleteMany();
  await prisma.character.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany({
    where: { email: { contains: '@found-test.com' } },
  });
});

async function createTestUser(emailSuffix: string, status: string = 'active') {
  const userRepo = createUserRepo();
  return userRepo.create({
    email: `${emailSuffix}@found-test.com`,
    emailNormalized: `${emailSuffix}@found-test.com`,
    status,
  });
}

async function createTestProject(userId: string) {
  const projectRepo = createProjectRepo();
  return projectRepo.create({
    ownerUserId: userId,
    title: 'Test Novel',
    startMode: 'guided',
    createRequestId: `req-found-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  });
}

describe('editFoundation', () => {
  it('creates foundation and sets status to draft when was none', async () => {
    const user = await createTestUser(`edit1-${Date.now()}`);
    const project = await createTestProject(user.id);

    const ports = {
      userRepo: createUserRepo(),
      projectRepo: createProjectRepo(),
      foundationRepo: createFoundationRepo(prisma),
      changeSetRepo: createChangeSetRepo(prisma),
    };

    const result = await editFoundation(ports, {
      userId: user.id,
      projectId: project.id,
      premise: 'A hero rises from ashes',
      tone: 'dark',
      genre: 'fantasy',
    });

    expect(result.premise).toBe('A hero rises from ashes');
    expect(result.foundationStatus).toBe('draft');
    expect(result.currentCanonicalVersion).toBe(1);

    // Verify DB state
    const dbProject = await prisma.project.findUnique({
      where: { id: project.id },
    });
    expect(dbProject?.foundationStatus).toBe('draft');
    expect(dbProject?.currentCanonicalVersion).toBe(1);

    const dbFoundation = await prisma.foundation.findUnique({
      where: { projectId: project.id },
    });
    expect(dbFoundation?.premise).toBe('A hero rises from ashes');

    // Verify change set audit trail was created
    const changeSets = await prisma.canonicalChangeSet.findMany({
      where: { projectId: project.id },
    });
    expect(changeSets).toHaveLength(1);
    expect(changeSets[0]?.status).toBe('applied');

    const ops = await prisma.canonicalChangeOperation.findMany({
      where: { changeSetId: changeSets[0]!.id },
    });
    expect(ops).toHaveLength(1);
    expect(ops[0]?.opType).toBe('upsert');
    expect(ops[0]?.targetType).toBe('foundation');
  });

  it('updates existing foundation without changing status if already draft', async () => {
    const user = await createTestUser(`edit2-${Date.now()}`);
    const project = await createTestProject(user.id);

    // First set foundation to draft via DB
    await prisma.project.update({
      where: { id: project.id },
      data: { foundationStatus: 'draft' },
    });

    const ports = {
      userRepo: createUserRepo(),
      projectRepo: createProjectRepo(),
      foundationRepo: createFoundationRepo(prisma),
      changeSetRepo: createChangeSetRepo(prisma),
    };

    const result = await editFoundation(ports, {
      userId: user.id,
      projectId: project.id,
      premise: 'Revised premise',
      tone: 'light',
    });

    expect(result.foundationStatus).toBe('draft');
    expect(result.premise).toBe('Revised premise');
  });

  it('rejects edit from non-owner', async () => {
    const owner = await createTestUser(`edit-owner-${Date.now()}`);
    const attacker = await createTestUser(`edit-attacker-${Date.now()}`);
    const project = await createTestProject(owner.id);

    const ports = {
      userRepo: createUserRepo(),
      projectRepo: createProjectRepo(),
      foundationRepo: createFoundationRepo(prisma),
      changeSetRepo: createChangeSetRepo(prisma),
    };

    await expect(
      editFoundation(ports, {
        userId: attacker.id,
        projectId: project.id,
        premise: 'Malicious edit',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rejects edit from suspended user', async () => {
    const user = await createTestUser(`susp-edit-${Date.now()}`, 'suspended');
    const project = await createTestProject(user.id);

    const ports = {
      userRepo: createUserRepo(),
      projectRepo: createProjectRepo(),
      foundationRepo: createFoundationRepo(prisma),
      changeSetRepo: createChangeSetRepo(prisma),
    };

    await expect(
      editFoundation(ports, {
        userId: user.id,
        projectId: project.id,
        premise: 'Edit while suspended',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('lockFoundation', () => {
  it('locks foundation when ready and confirmed', async () => {
    const user = await createTestUser(`lock1-${Date.now()}`);
    const project = await createTestProject(user.id);

    // Set up foundation with required fields
    await prisma.foundation.create({
      data: {
        projectId: project.id,
        premise: 'A gripping tale of survival',
        tone: 'serious',
        genre: 'thriller',
        body: { targetAudience: 'adults', pov: 'third_person' },
      },
    });
    await prisma.project.update({
      where: { id: project.id },
      data: { foundationStatus: 'draft' },
    });

    const ports = {
      userRepo: createUserRepo(),
      projectRepo: createProjectRepo(),
      foundationRepo: createFoundationRepo(prisma),
    };

    const result = await lockFoundation(ports, {
      userId: user.id,
      projectId: project.id,
      confirm: true,
    });

    expect(result.foundationStatus).toBe('locked');

    const dbProject = await prisma.project.findUnique({
      where: { id: project.id },
    });
    expect(dbProject?.foundationStatus).toBe('locked');
  });

  it('rejects lock without confirm', async () => {
    const user = await createTestUser(`lock2-${Date.now()}`);
    const project = await createTestProject(user.id);

    // Set up foundation
    await prisma.foundation.create({
      data: {
        projectId: project.id,
        premise: 'A story',
        genre: 'fantasy',
        body: { targetAudience: 'everyone', pov: 'first_person' },
      },
    });
    await prisma.project.update({
      where: { id: project.id },
      data: { foundationStatus: 'draft' },
    });

    const ports = {
      userRepo: createUserRepo(),
      projectRepo: createProjectRepo(),
      foundationRepo: createFoundationRepo(prisma),
    };

    await expect(
      lockFoundation(ports, {
        userId: user.id,
        projectId: project.id,
        confirm: false,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('rejects lock when foundation is not ready (missing premise)', async () => {
    const user = await createTestUser(`lock3-${Date.now()}`);
    const project = await createTestProject(user.id);

    // Foundation without premise
    await prisma.foundation.create({
      data: {
        projectId: project.id,
        premise: null,
        genre: 'fantasy',
        body: { targetAudience: 'teens', pov: 'first_person' },
      },
    });
    await prisma.project.update({
      where: { id: project.id },
      data: { foundationStatus: 'draft' },
    });

    const ports = {
      userRepo: createUserRepo(),
      projectRepo: createProjectRepo(),
      foundationRepo: createFoundationRepo(prisma),
    };

    await expect(
      lockFoundation(ports, {
        userId: user.id,
        projectId: project.id,
        confirm: true,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('rejects lock when already locked', async () => {
    const user = await createTestUser(`lock4-${Date.now()}`);
    const project = await createTestProject(user.id);

    await prisma.foundation.create({
      data: {
        projectId: project.id,
        premise: 'Already locked story',
        genre: 'drama',
        body: { targetAudience: 'adults', pov: 'first_person' },
      },
    });
    await prisma.project.update({
      where: { id: project.id },
      data: { foundationStatus: 'locked' },
    });

    const ports = {
      userRepo: createUserRepo(),
      projectRepo: createProjectRepo(),
      foundationRepo: createFoundationRepo(prisma),
    };

    await expect(
      lockFoundation(ports, {
        userId: user.id,
        projectId: project.id,
        confirm: true,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('rejects lock from non-owner', async () => {
    const owner = await createTestUser(`lock-owner-${Date.now()}`);
    const attacker = await createTestUser(`lock-attacker-${Date.now()}`);
    const project = await createTestProject(owner.id);

    await prisma.foundation.create({
      data: {
        projectId: project.id,
        premise: 'A secret story',
        genre: 'mystery',
        body: { targetAudience: 'adults', pov: 'first_person' },
      },
    });
    await prisma.project.update({
      where: { id: project.id },
      data: { foundationStatus: 'draft' },
    });

    const ports = {
      userRepo: createUserRepo(),
      projectRepo: createProjectRepo(),
      foundationRepo: createFoundationRepo(prisma),
    };

    await expect(
      lockFoundation(ports, {
        userId: attacker.id,
        projectId: project.id,
        confirm: true,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
