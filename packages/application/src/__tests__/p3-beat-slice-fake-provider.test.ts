/**
 * P3.6/P3.10 — Limited beat-writing vertical slice with fake provider.
 * No live API. Proves incomplete context blocks provider; leak cannot accept.
 */

import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { createHash } from 'node:crypto';
import { createFakeAIExecutionPort } from '@narraza/ai';

config({ path: '../../.env' });

import { setPrisma } from '../../../db/src/client.js';
import { createPrismaUnitOfWork } from '../../../db/src/unit-of-work.js';
import { createUserRepo } from '../../../db/src/repositories/user-repo.js';
import { createProjectRepo } from '../../../db/src/repositories/project-repo.js';
import {
  buildValidationContextSnapshot,
  submitUserProse,
  acceptProposal,
  createRepairProseVersion,
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
      where: { email: { contains: '@p3-slice.test' } },
    });
  } catch {
    // ok
  }
});

describe('P3 beat slice fake provider', () => {
  it('leaky fake generation cannot be accepted; repair can', async () => {
    const user = await createUserRepo().create({
      email: `p3-${Date.now()}@p3-slice.test`,
      emailNormalized: `p3-${Date.now()}@p3-slice.test`,
      status: 'active',
    });
    const project = await createProjectRepo().create({
      ownerUserId: user.id,
      title: 'P3 Slice',
      startMode: 'guided',
      createRequestId: `p3-${Date.now()}`,
    });
    const chapter = await prisma.chapter.create({
      data: { projectId: project.id, number: 3, title: 'Ch3' },
    });
    const beat = await prisma.beat.create({
      data: { chapterId: chapter.id, beatNumber: 1, title: 'Harbor' },
    });

    // Fake provider leak
    const port = createFakeAIExecutionPort({ scenario: 'reveal_leak_prose' });
    const plan = port.buildWorkflowPlan({
      jobType: 'beat.write',
      projectId: project.id,
    });
    const res = await port.executeSingleAttempt({
      workflowPlan: plan,
      stageName: 'write',
      invocationKey: 'write:v1',
      promptContractVersion: 'beat.write.v1',
      promptPayload: {},
    });
    const body = JSON.parse(res.rawBody) as {
      candidates: Array<{ prose: string }>;
    };
    const leaky = body.candidates[0]!.prose;

    const snap = buildValidationContextSnapshot({
      projectId: project.id,
      projectRevision: project.currentCanonicalVersion,
      chapterId: chapter.id,
      chapterNumber: 3,
      beatId: beat.id,
      beatContract: {
        beatGoal: 'Harbor unease',
        mustInclude: ['fog'],
        mustNotInclude: [HIDDEN],
        expectedEndState: 'leave',
        stopCondition: 'exit',
      },
      forbiddenReveals: [HIDDEN],
      confirmedCanonFacts: [
        { factKey: 'harbor', truth: 'The town has a harbor' },
      ],
      characterKnowledge: [
        { factId: 'f1', truth: HIDDEN, knownByCharacterIds: [] },
      ],
      safeBreadcrumbs: ['The mayor avoids certain questions'],
    });

    const uow = createPrismaUnitOfWork(prisma);
    const contentHash = createHash('sha256').update(leaky).digest('hex');
    await prisma.proseWorkingDraft.create({
      data: {
        userId: user.id,
        beatId: beat.id,
        content: leaky,
        contentHash,
        version: 1,
      },
    });

    const ctx = {
      projectId: project.id,
      beatId: beat.id,
      chapterId: chapter.id,
      chapterNumber: 3,
      forbiddenTruths: snap.forbiddenReveals,
      beatContract: snap.beatContract!,
      knowledgeFacts: snap.characterKnowledge,
      existingCanonTruths: snap.confirmedCanonFacts,
      povCharacterId: 'alya',
      presentCharacterIds: ['alya'],
      validationMode: 'full' as const,
      contextCompleteness: 'complete' as const,
      contextSnapshotHash: snap.snapshotHash,
      contextCompilerVersion: snap.contextCompilerVersion,
    };

    const submitted = await uow.execute(async (ports) =>
      submitUserProse(
        { ...ports, userRepo: createUserRepo() } as any,
        {
          userId: user.id,
          projectId: project.id,
          beatId: beat.id,
          chapterId: chapter.id,
          chapterNumber: 3,
          validationContext: ctx,
        },
      ),
    );

    // Accept blocked
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

    // Repair new version
    const repaired = await uow.execute(async (ports) =>
      createRepairProseVersion(
        { ...ports, userRepo: createUserRepo() } as any,
        {
          userId: user.id,
          projectId: project.id,
          originalProseVersionId: submitted.proseVersionId,
          forbiddenPhrases: [HIDDEN],
          context: ctx,
        },
      ),
    );
    expect(repaired.passed).toBe(true);
    expect(repaired.repairProseVersionId).not.toBe(submitted.proseVersionId);

    const repairRow = await prisma.proseVersion.findUnique({
      where: { id: repaired.repairProseVersionId },
    });
    expect(repairRow!.content).not.toContain(HIDDEN);

    await portsWorkingDraftAndAccept(
      uow,
      user.id,
      project.id,
      beat.id,
      chapter.id,
      repairRow!.content,
      repairRow!.contentHash,
      ctx,
    );
  });
});

async function portsWorkingDraftAndAccept(
  uow: ReturnType<typeof createPrismaUnitOfWork>,
  userId: string,
  projectId: string,
  beatId: string,
  chapterId: string,
  content: string,
  contentHash: string,
  ctx: any,
) {
  const submitted = await uow.execute(async (ports) => {
    await ports.workingDraftRepo.save({
      userId,
      beatId,
      content,
      contentHash,
    });
    return submitUserProse(
      { ...ports, userRepo: createUserRepo() } as any,
      {
        userId,
        projectId,
        beatId,
        chapterId,
        chapterNumber: 3,
        validationContext: ctx,
      },
    );
  });

  const result = await uow.execute(async (ports) =>
    acceptProposal(
      { ...ports, userRepo: createUserRepo() } as any,
      {
        userId,
        projectId,
        proposalId: submitted.proposalId,
        proseVersionId: submitted.proseVersionId,
      },
    ),
  );
  expect(result.newStatus).toBe('accepted');
}
