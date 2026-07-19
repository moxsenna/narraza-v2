import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env['DATABASE_URL']! } },
});

let projectId: string;
let chapterId: string;

beforeAll(async () => {
  // Create a test user and project for scoped assertions
  const user = await prisma.user.create({
    data: {
      email: `m1-test-${Date.now()}@example.com`,
      emailNormalized: `m1-test-${Date.now()}@example.com`,
    },
  });

  const project = await prisma.project.create({
    data: {
      id: `p-m1-test-${Date.now()}`,
      ownerUserId: user.id,
      title: 'M1 Test Project',
    },
  });
  projectId = project.id;

  const chapter = await prisma.chapter.create({
    data: {
      projectId,
      number: 1,
      title: 'Test Chapter 1',
    },
  });
  chapterId = chapter.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('soft-delete-unique', () => {
  it('insert fact key, soft-delete, re-insert same key -> success', async () => {
    const key = `test-fact-${Date.now()}`;

    // Insert first active fact
    const f1 = await prisma.fact.create({
      data: {
        projectId,
        factKey: key,
        truth: 'The sun rises in the east',
      },
    });
    expect(f1.id).toBeTruthy();

    // Soft-delete it
    await prisma.fact.update({
      where: { id: f1.id },
      data: { deletedAt: new Date() },
    });

    // Re-insert same key while deletedAt IS NULL — should succeed
    const f2 = await prisma.fact.create({
      data: {
        projectId,
        factKey: key,
        truth: 'The sun rises in the east (revised)',
      },
    });
    expect(f2.id).toBeTruthy();
    expect(f2.id).not.toBe(f1.id);
  });

  it('second active fact with same key -> fails (violates partial unique)', async () => {
    const key = `test-fact-dup-${Date.now()}`;

    // First active fact
    await prisma.fact.create({
      data: { projectId, factKey: key, truth: 'First' },
    });

    // Second active same key — should fail
    await expect(
      prisma.fact.create({
        data: { projectId, factKey: key, truth: 'Second' },
      }),
    ).rejects.toThrow();
  });

  it('soft-deleted character name can be reused', async () => {
    const name = `TestChar-${Date.now()}`;

    const c1 = await prisma.character.create({
      data: { projectId, name },
    });
    await prisma.character.update({
      where: { id: c1.id },
      data: { deletedAt: new Date() },
    });

    const c2 = await prisma.character.create({
      data: { projectId, name },
    });
    expect(c2.id).toBeTruthy();
    expect(c2.id).not.toBe(c1.id);
  });

  it('reveal soft-delete, re-insert same key -> success', async () => {
    const key = `test-reveal-${Date.now()}`;
    const fact = await prisma.fact.create({
      data: { projectId, factKey: `rf-${key}`, truth: 'Secret' },
    });

    const r1 = await prisma.reveal.create({
      data: { projectId, revealKey: key, factId: fact.id },
    });
    await prisma.reveal.update({
      where: { id: r1.id },
      data: { deletedAt: new Date() },
    });

    const r2 = await prisma.reveal.create({
      data: { projectId, revealKey: key, factId: fact.id },
    });
    expect(r2.id).toBeTruthy();
  });
});

describe('prose-fk', () => {
  it('cannot set beat.acceptedProseVersionId to prose belonging to different beat', async () => {
    // Create beat 1
    const beat1 = await prisma.beat.create({
      data: { chapterId, beatNumber: 1 },
    });

    // Create beat 2
    const beat2 = await prisma.beat.create({
      data: { chapterId, beatNumber: 2 },
    });

    // Create prose for beat 2
    const proseForBeat2 = await prisma.proseVersion.create({
      data: {
        beatId: beat2.id,
        version: 1,
        content: 'Prose for beat 2',
        contentHash: 'hash-beat2',
      },
    });

    // Now try to set beat1.acceptedProseVersionId to proseForBeat2.id
    // The composite FK beats_accepted_prose_belongs requires (beat_id, id) match
    await expect(
      prisma.beat.update({
        where: { id: beat1.id },
        data: { acceptedProseVersionId: proseForBeat2.id },
      }),
    ).rejects.toThrow();
  });

  it('can set beat.acceptedProseVersionId to prose belonging to same beat', async () => {
    const beat = await prisma.beat.create({
      data: { chapterId, beatNumber: 3 },
    });

    const prose = await prisma.proseVersion.create({
      data: {
        beatId: beat.id,
        version: 1,
        content: 'Prose for this beat',
        contentHash: 'hash-this',
      },
    });

    await prisma.beat.update({
      where: { id: beat.id },
      data: { acceptedProseVersionId: prose.id },
    });

    const updated = await prisma.beat.findUniqueOrThrow({ where: { id: beat.id } });
    expect(updated.acceptedProseVersionId).toBe(prose.id);
  });
});
