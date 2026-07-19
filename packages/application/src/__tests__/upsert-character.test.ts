import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config({ path: '../../.env' });

import { upsertCharacter } from '../use-cases/characters/upsert-character.js';
import { createUserRepo } from '../../../db/src/repositories/user-repo.js';
import { createProjectRepo } from '../../../db/src/repositories/project-repo.js';
import { createChangeSetRepo } from '../../../db/src/repositories/change-set-repo.js';
import { createCharacterRepo } from '../../../db/src/repositories/character-repo.js';
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
    where: { email: { contains: '@char-test.com' } },
  });
});

async function createTestUser(emailSuffix: string, status: string = 'active') {
  const userRepo = createUserRepo();
  return userRepo.create({
    email: `${emailSuffix}@char-test.com`,
    emailNormalized: `${emailSuffix}@char-test.com`,
    status,
  });
}

async function createTestProject(userId: string) {
  const projectRepo = createProjectRepo();
  const project = await projectRepo.create({
    ownerUserId: userId,
    title: 'Test Novel',
    startMode: 'guided',
    createRequestId: `req-char-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  });
  // Set foundation to draft so characters can be added
  await prisma.foundation.create({
    data: {
      projectId: project.id,
      premise: 'A story with characters',
    },
  });
  await prisma.project.update({
    where: { id: project.id },
    data: { foundationStatus: 'draft' },
  });
  return project;
}

describe('upsertCharacter', () => {
  it('creates a new character for a project', async () => {
    const user = await createTestUser(`char-create-${Date.now()}`);
    const project = await createTestProject(user.id);

    const ports = {
      userRepo: createUserRepo(),
      projectRepo: createProjectRepo(),
      characterRepo: createCharacterRepo(),
      changeSetRepo: createChangeSetRepo(),
    };

    const result = await upsertCharacter(ports, {
      userId: user.id,
      projectId: project.id,
      name: 'Aria Stormwind',
    });

    expect(result.id).toBeTruthy();
    expect(result.name).toBe('Aria Stormwind');
    expect(result.projectId).toBe(project.id);
    expect(result.deletedAt).toBeNull();

    // Verify DB
    const dbChar = await prisma.character.findUnique({
      where: { id: result.id },
    });
    expect(dbChar?.name).toBe('Aria Stormwind');

    // Verify change set
    const changesets = await prisma.canonicalChangeSet.findMany({
      where: { projectId: project.id },
    });
    expect(changesets).toHaveLength(1);
    const ops = await prisma.canonicalChangeOperation.findMany({
      where: { changeSetId: changesets[0]!.id },
    });
    expect(ops[0]?.opType).toBe('create');
    expect(ops[0]?.targetType).toBe('character');
  });

  it('updates existing character name', async () => {
    const user = await createTestUser(`char-update-${Date.now()}`);
    const project = await createTestProject(user.id);

    // Create a character directly
    const char = await prisma.character.create({
      data: { projectId: project.id, name: 'Old Name' },
    });

    const ports = {
      userRepo: createUserRepo(),
      projectRepo: createProjectRepo(),
      characterRepo: createCharacterRepo(),
      changeSetRepo: createChangeSetRepo(),
    };

    const result = await upsertCharacter(ports, {
      userId: user.id,
      projectId: project.id,
      characterId: char.id,
      name: 'New Name',
    });

    expect(result.name).toBe('New Name');
    expect(result.id).toBe(char.id);

    const dbChar = await prisma.character.findUnique({
      where: { id: char.id },
    });
    expect(dbChar?.name).toBe('New Name');
  });

  it('rejects when foundation is none', async () => {
    const user = await createTestUser(`char-none-${Date.now()}`);
    const projectRepo = createProjectRepo();
    const project = await projectRepo.create({
      ownerUserId: user.id,
      title: 'No Foundation',
      startMode: 'guided',
      createRequestId: `req-char-none-${Date.now()}`,
    });

    const ports = {
      userRepo: createUserRepo(),
      projectRepo: createProjectRepo(),
      characterRepo: createCharacterRepo(),
      changeSetRepo: createChangeSetRepo(),
    };

    await expect(
      upsertCharacter(ports, {
        userId: user.id,
        projectId: project.id,
        name: 'Ghost',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('rejects duplicate active character name', async () => {
    const user = await createTestUser(`char-dup-${Date.now()}`);
    const project = await createTestProject(user.id);

    // Create first character
    await prisma.character.create({
      data: { projectId: project.id, name: 'Unique Name' },
    });

    const ports = {
      userRepo: createUserRepo(),
      projectRepo: createProjectRepo(),
      characterRepo: createCharacterRepo(),
      changeSetRepo: createChangeSetRepo(),
    };

    await expect(
      upsertCharacter(ports, {
        userId: user.id,
        projectId: project.id,
        name: 'Unique Name',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('allows reuse of soft-deleted character name', async () => {
    const user = await createTestUser(`char-reuse-${Date.now()}`);
    const project = await createTestProject(user.id);

    // Create and soft-delete a character
    const deletedChar = await prisma.character.create({
      data: { projectId: project.id, name: 'Reusable Name' },
    });
    await prisma.character.update({
      where: { id: deletedChar.id },
      data: { deletedAt: new Date() },
    });

    // Now create a new character with the same name
    const ports = {
      userRepo: createUserRepo(),
      projectRepo: createProjectRepo(),
      characterRepo: createCharacterRepo(),
      changeSetRepo: createChangeSetRepo(),
    };

    const result = await upsertCharacter(ports, {
      userId: user.id,
      projectId: project.id,
      name: 'Reusable Name',
    });

    expect(result.id).toBeTruthy();
    expect(result.id).not.toBe(deletedChar.id);
    expect(result.name).toBe('Reusable Name');
  });

  it('rejects from non-owner', async () => {
    const owner = await createTestUser(`char-owner-${Date.now()}`);
    const attacker = await createTestUser(`char-att-${Date.now()}`);
    const project = await createTestProject(owner.id);

    const ports = {
      userRepo: createUserRepo(),
      projectRepo: createProjectRepo(),
      characterRepo: createCharacterRepo(),
      changeSetRepo: createChangeSetRepo(),
    };

    await expect(
      upsertCharacter(ports, {
        userId: attacker.id,
        projectId: project.id,
        name: 'Stolen',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rejects update of non-existent character', async () => {
    const user = await createTestUser(`char-missing-${Date.now()}`);
    const project = await createTestProject(user.id);

    const ports = {
      userRepo: createUserRepo(),
      projectRepo: createProjectRepo(),
      characterRepo: createCharacterRepo(),
      changeSetRepo: createChangeSetRepo(),
    };

    await expect(
      upsertCharacter(ports, {
        userId: user.id,
        projectId: project.id,
        characterId: 'nonexistent-id',
        name: 'Phantom',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('soft-deleted character update is rejected', async () => {
    const user = await createTestUser(`char-softdel-${Date.now()}`);
    const project = await createTestProject(user.id);

    const char = await prisma.character.create({
      data: { projectId: project.id, name: 'Doomed' },
    });
    await prisma.character.update({
      where: { id: char.id },
      data: { deletedAt: new Date() },
    });

    const ports = {
      userRepo: createUserRepo(),
      projectRepo: createProjectRepo(),
      characterRepo: createCharacterRepo(),
      changeSetRepo: createChangeSetRepo(),
    };

    await expect(
      upsertCharacter(ports, {
        userId: user.id,
        projectId: project.id,
        characterId: char.id,
        name: 'Resurrected',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
