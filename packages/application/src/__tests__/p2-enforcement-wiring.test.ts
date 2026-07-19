/**
 * P2 — Enforcement wiring tests.
 *
 * Generated/user prose with reveal leak → blocker → accept rejected by backend
 * → repair as new version → re-validate → accept repaired → original preserved.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { createHash } from 'node:crypto';

config({ path: '../../.env' });

import { setPrisma } from '../../../db/src/client.js';
import { createPrismaUnitOfWork } from '../../../db/src/unit-of-work.js';
import { createUserRepo } from '../../../db/src/repositories/user-repo.js';
import { createProjectRepo } from '../../../db/src/repositories/project-repo.js';
import {
  acceptProposal,
  submitUserProse,
  createRepairProseVersion,
  runAndPersistProseValidation,
  computeContextSnapshotHash,
  computeValidationBindingHash,
  assertProseAcceptEligible,
  PROSE_VALIDATOR_VERSION,
} from '../index.js';

const HIDDEN = 'The mayor is the cult leader';

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
  try {
    await prisma.validationReport.deleteMany();
    await prisma.proseVersion.deleteMany();
    await prisma.beat.updateMany({
      where: { acceptedProseVersionId: { not: null } },
      data: { acceptedProseVersionId: null },
    });
    await prisma.canonicalChangeOperation.deleteMany();
    await prisma.canonicalChangeSet.deleteMany();
    await prisma.proposal.deleteMany();
    await prisma.proposalGroup.deleteMany();
    await prisma.proseWorkingDraft.deleteMany();
    await prisma.beat.deleteMany();
    await prisma.chapter.deleteMany();
    await prisma.project.deleteMany();
    await prisma.user.deleteMany({
      where: { email: { contains: '@p2-enforce.test' } },
    });
  } catch {
    // empty DB ok
  }
});

async function seedUserProjectBeat() {
  const user = await createUserRepo().create({
    email: `p2-${Date.now()}@p2-enforce.test`,
    emailNormalized: `p2-${Date.now()}@p2-enforce.test`,
    status: 'active',
  });
  const project = await createProjectRepo().create({
    ownerUserId: user.id,
    title: 'P2 Enforcement',
    startMode: 'guided',
    createRequestId: `p2-${Date.now()}`,
  });
  const chapter = await prisma.chapter.create({
    data: { projectId: project.id, number: 3, title: 'Chapter 3' },
  });
  const beat = await prisma.beat.create({
    data: { chapterId: chapter.id, beatNumber: 1, title: 'Harbor' },
  });
  return { user, project, chapter, beat };
}

describe('P2 validation gate unit', () => {
  it('binding hash changes when context (reveal chapter) changes', () => {
    const ctxA = {
      projectId: 'p1',
      beatId: 'b1',
      chapterId: 'c1',
      chapterNumber: 3,
      forbiddenTruths: [HIDDEN],
    };
    const ctxB = { ...ctxA, chapterNumber: 25, forbiddenTruths: [] as string[] };
    const hA = computeContextSnapshotHash(ctxA);
    const hB = computeContextSnapshotHash(ctxB);
    expect(hA).not.toBe(hB);
    const content = 'Safe prose about fog.';
    expect(computeValidationBindingHash(content, hA)).not.toBe(
      computeValidationBindingHash(content, hB),
    );
    expect(PROSE_VALIDATOR_VERSION).toMatch(/^p2-/);
  });

  it('assertProseAcceptEligible fails closed without report', () => {
    expect(() =>
      assertProseAcceptEligible({
        report: null,
        expectedBindingHash: 'x',
        requireReport: true,
      }),
    ).toThrow(/requires a current validation report/i);
  });
});

describe('P2 enforcement integration', () => {
  it('blocker prevents accept; repair version accepts; original preserved', async () => {
    const { user, project, chapter, beat } = await seedUserProjectBeat();
    const uow = createPrismaUnitOfWork(prisma);

    const leaky = `Alya walked the foggy harbor. She realized ${HIDDEN}. Fog rolled in.`;
    const contentHash = createHash('sha256').update(leaky).digest('hex');

    // Working draft with leak
    await prisma.proseWorkingDraft.create({
      data: {
        userId: user.id,
        beatId: beat.id,
        content: leaky,
        contentHash,
        version: 1,
      },
    });

    const validationContext = {
      projectId: project.id,
      beatId: beat.id,
      chapterId: chapter.id,
      chapterNumber: 3,
      forbiddenTruths: [HIDDEN],
      beatContract: {
        beatGoal: 'Harbor unease',
        mustInclude: ['fog'],
        mustNotInclude: [HIDDEN],
        expectedEndState: 'Alya leaves',
        stopCondition: 'exits dock',
      },
      knowledgeFacts: [
        {
          factId: 'f-major',
          truth: HIDDEN,
          knownByCharacterIds: [] as string[],
        },
      ],
      povCharacterId: 'alya',
      presentCharacterIds: ['alya'],
    };

    // Submit creates prose version + validation report
    const submitted = await uow.execute(async (ports) =>
      submitUserProse(
        { ...ports, userRepo: createUserRepo() } as any,
        {
          userId: user.id,
          projectId: project.id,
          beatId: beat.id,
          chapterId: chapter.id,
          chapterNumber: 3,
          validationContext,
        },
      ),
    );

    expect(submitted.proseVersionId).toBeTruthy();

    // Report should have failed (blockers)
    const report = await prisma.validationReport.findFirst({
      where: { proseVersionId: submitted.proseVersionId },
      orderBy: { createdAt: 'desc' },
    });
    expect(report).toBeTruthy();
    expect(report!.passed).toBe(false);

    // Accept must be rejected by backend
    await expect(
      uow.execute(async (ports) =>
        acceptProposal(
          { ...ports, userRepo: createUserRepo() } as any,
          {
            userId: user.id,
            projectId: project.id,
            proposalId: submitted.proposalId,
            proseVersionId: submitted.proseVersionId,
          },
        ),
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION' });

    // Original prose version still draft (not accepted)
    const original = await prisma.proseVersion.findUnique({
      where: { id: submitted.proseVersionId },
    });
    expect(original).toBeTruthy();
    expect(original!.content).toContain(HIDDEN);

    // Repair as NEW version
    const repaired = await uow.execute(async (ports) =>
      createRepairProseVersion(
        { ...ports, userRepo: createUserRepo() } as any,
        {
          userId: user.id,
          projectId: project.id,
          originalProseVersionId: submitted.proseVersionId,
          forbiddenPhrases: [HIDDEN],
          context: validationContext,
        },
      ),
    );

    expect(repaired.repairProseVersionId).not.toBe(
      repaired.originalProseVersionId,
    );
    expect(repaired.passed).toBe(true);
    expect(repaired.hasBlockers).toBe(false);

    const repairRow = await prisma.proseVersion.findUnique({
      where: { id: repaired.repairProseVersionId },
    });
    expect(repairRow!.content).not.toContain(HIDDEN);
    expect(repairRow!.version).toBeGreaterThan(original!.version);

    // Original still intact
    const originalAgain = await prisma.proseVersion.findUnique({
      where: { id: submitted.proseVersionId },
    });
    expect(originalAgain!.content).toContain(HIDDEN);

    // Create accept proposal for repaired version
    const acceptSubmitted = await uow.execute(async (ports) => {
      // Save repaired as working draft then submit
      await ports.workingDraftRepo.save({
        userId: user.id,
        beatId: beat.id,
        content: repairRow!.content,
        contentHash: repairRow!.contentHash,
      });
      return submitUserProse(
        { ...ports, userRepo: createUserRepo() } as any,
        {
          userId: user.id,
          projectId: project.id,
          beatId: beat.id,
          chapterId: chapter.id,
          chapterNumber: 3,
          validationContext,
        },
      );
    });

    const acceptResult = await uow.execute(async (ports) =>
      acceptProposal(
        { ...ports, userRepo: createUserRepo() } as any,
        {
          userId: user.id,
          projectId: project.id,
          proposalId: acceptSubmitted.proposalId,
          proseVersionId: acceptSubmitted.proseVersionId,
        },
      ),
    );

    expect(acceptResult.newStatus).toBe('accepted');

    // Stale protection: changing forbidden list invalidates binding
    const staleCtx = {
      ...validationContext,
      forbiddenTruths: [HIDDEN, 'extra secret'],
    };
    const freshHash = computeValidationBindingHash(
      repairRow!.content,
      computeContextSnapshotHash(validationContext),
    );
    const staleHash = computeValidationBindingHash(
      repairRow!.content,
      computeContextSnapshotHash(staleCtx),
    );
    expect(freshHash).not.toBe(staleHash);
  });

  it('runAndPersistProseValidation stores binding hash as contentHash', async () => {
    const { user, project, chapter, beat } = await seedUserProjectBeat();
    const uow = createPrismaUnitOfWork(prisma);

    const prose = 'Safe harbor fog without secrets.';
    const pv = await uow.execute(async (ports) => {
      const version = await ports.proseVersionRepo.nextVersion(beat.id);
      return ports.proseVersionRepo.create({
        beatId: beat.id,
        version,
        content: prose,
        contentHash: createHash('sha256').update(prose).digest('hex'),
        status: 'draft',
      });
    });

    const ctx = {
      projectId: project.id,
      beatId: beat.id,
      chapterId: chapter.id,
      chapterNumber: 3,
      forbiddenTruths: [HIDDEN],
    };

    const result = await uow.execute(async (ports) =>
      runAndPersistProseValidation(ports.validationReportRepo, {
        proseContent: prose,
        proseVersionId: pv.id,
        context: ctx,
      }),
    );

    expect(result.passed).toBe(true);
    expect(result.bindingHash).toBe(
      computeValidationBindingHash(
        prose,
        computeContextSnapshotHash(ctx),
      ),
    );
    // silence unused
    expect(user.id).toBeTruthy();
  });
});
