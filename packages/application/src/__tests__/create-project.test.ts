import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

// Load .env from repo root
config({ path: '../../.env' });

import type { ProjectPorts } from '../use-cases/projects/create-project.js';
import { createProject } from '../use-cases/projects/create-project.js';
import { listProjects } from '../use-cases/projects/list-projects.js';
import { createProjectRepo } from '../../../db/src/repositories/project-repo.js';
import { createUserRepo } from '../../../db/src/repositories/user-repo.js';
import { setPrisma } from '../../../db/src/client.js';

let prisma: PrismaClient;
let ports: ProjectPorts;

beforeAll(async () => {
  const dbUrl =
    process.env.DATABASE_URL ??
    'postgresql://narraza:narraza@localhost:5433/narraza';
  prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
  setPrisma(prisma);

  // Clean up test data
  await prisma.project.deleteMany();
  await prisma.user.deleteMany({
    where: { email: { contains: '@test.com' } },
  });

  ports = {
    projectRepo: createProjectRepo(),
    userRepo: createUserRepo(),
  };
});

afterAll(async () => {
  await prisma.project.deleteMany();
  await prisma.user.deleteMany({
    where: { email: { contains: '@test.com' } },
  });
  await prisma.$disconnect();
});

describe('createProject', () => {
  async function createTestUser(email: string, status: string = 'active') {
    const { createUserRepo: localCreateUserRepo } = await import(
      '../../../db/src/repositories/user-repo.js'
    );
    const repo = localCreateUserRepo();
    const user = await repo.create({ email, emailNormalized: email });
    // Override status if needed
    if (status !== 'active') {
      await (prisma as PrismaClient).user.update({
        where: { id: user.id },
        data: { status: 'suspended' as const },
      });
    }
    return user;
  }

  it('creates project owned by user with foundationStatus none', async () => {
    const user = await createTestUser(`create1-${Date.now()}@test.com`);
    const result = await createProject(ports, {
      userId: user.id,
      title: 'My First Project',
      startMode: 'guided',
      requestId: `req-${Date.now()}-1`,
    });

    expect(result.id).toBeTruthy();
    expect(result.ownerUserId).toBe(user.id);
    expect(result.title).toBe('My First Project');
    expect(result.startMode).toBe('guided');
    expect(result.foundationStatus).toBe('none');
    expect(result.currentCanonicalVersion).toBe(0);
    expect(result.createRequestId).toBeTruthy();
    expect(result.deletedAt).toBeNull();
  });

  it('creates project with advanced startMode', async () => {
    const user = await createTestUser(`create2-${Date.now()}@test.com`);
    const result = await createProject(ports, {
      userId: user.id,
      title: 'Advanced Project',
      startMode: 'advanced',
      requestId: `req-${Date.now()}-2`,
    });

    expect(result.startMode).toBe('advanced');
    expect(result.foundationStatus).toBe('none');
  });

  it('is idempotent on requestId', async () => {
    const user = await createTestUser(`idempotent-${Date.now()}@test.com`);
    const requestId = `req-idempotent-${Date.now()}`;

    const first = await createProject(ports, {
      userId: user.id,
      title: 'Original Title',
      startMode: 'guided',
      requestId,
    });

    const second = await createProject(ports, {
      userId: user.id,
      title: 'Different Title Should Be Ignored',
      startMode: 'advanced',
      requestId,
    });

    expect(second.id).toBe(first.id);
    expect(second.title).toBe('Original Title');
    expect(second.startMode).toBe('guided');
    expect(second.foundationStatus).toBe('none');
  });

  it('list excludes soft-deleted', async () => {
    const user = await createTestUser(`list-${Date.now()}@test.com`);
    const p1 = await createProject(ports, {
      userId: user.id,
      title: 'Keep Me',
      startMode: 'guided',
      requestId: `req-list-${Date.now()}-keep`,
    });
    const p2 = await createProject(ports, {
      userId: user.id,
      title: 'Delete Me',
      startMode: 'advanced',
      requestId: `req-list-${Date.now()}-delete`,
    });

    // Soft delete p2
    const { softDeleteProject } = await import(
      '../use-cases/projects/soft-delete-project.js'
    );
    await softDeleteProject(
      { projectRepo: ports.projectRepo },
      p2.id,
    );

    const projects = await listProjects(
      { projectRepo: ports.projectRepo },
      user.id,
    );

    const ids = projects.map((p) => p.id);
    expect(ids).toContain(p1.id);
    expect(ids).not.toContain(p2.id);
  });

  it('rejects unknown user', async () => {
    await expect(
      createProject(ports, {
        userId: 'nonexistent-user-id',
        title: 'Test',
        startMode: 'guided',
        requestId: `req-${Date.now()}-missing`,
      }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('rejects inactive user', async () => {
    const user = await createTestUser(`suspended-${Date.now()}@test.com`, 'suspended');
    await expect(
      createProject(ports, {
        userId: user.id,
        title: 'Test',
        startMode: 'guided',
        requestId: `req-${Date.now()}-suspended`,
      }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('list returns empty array for user with no projects', async () => {
    const user = await createTestUser(`empty-${Date.now()}@test.com`);
    const projects = await listProjects(
      { projectRepo: ports.projectRepo },
      user.id,
    );
    expect(projects).toEqual([]);
  });

  it('list returns projects ordered by createdAt desc', async () => {
    const user = await createTestUser(`order-${Date.now()}@test.com`);
    const p1 = await createProject(ports, {
      userId: user.id,
      title: 'First',
      startMode: 'guided',
      requestId: `req-order-${Date.now()}-1`,
    });
    // Small delay to ensure different createdAt
    await new Promise((r) => setTimeout(r, 10));
    const p2 = await createProject(ports, {
      userId: user.id,
      title: 'Second',
      startMode: 'advanced',
      requestId: `req-order-${Date.now()}-2`,
    });

    const projects = await listProjects(
      { projectRepo: ports.projectRepo },
      user.id,
    );

    expect(projects).toHaveLength(2);
    expect(projects[0]!.id).toBe(p2.id);
    expect(projects[1]!.id).toBe(p1.id);
  });
});
