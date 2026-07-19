// Vertical slice backend integration test with mock AI and real Postgres
// Tests full pipeline: intake -> accept concept -> outline generate -> accept outline -> beat write

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

// Application layer
import {
  requestIntake,
  executeIntakeJob,
  acceptConcept,
  requestOutlineGenerate,
  executeOutlineGenerateJob,
  acceptOutlineBatch,
  requestBeatWrite,
  executeBeatJob,
  claimJob,
} from '@narraza/application';

// DB layer - use relative source imports (same pattern as m3 tests)
import { setPrisma } from '../../../db/src/client.js';
import { createPrismaOperationalUnitOfWork } from '../../../db/src/unit-of-work.js';
import { createGenerationJobRepo } from '../../../db/src/repositories/generation-job-repo.js';

// AI layer
import { createMockAIExecutionPort } from '@narraza/ai';

config({ path: '../../.env' });

const dbUrl =
  process.env.DATABASE_URL ??
  'postgresql://narraza:narraza@localhost:5433/narraza';

let prisma: PrismaClient;
const aiPort = createMockAIExecutionPort();

beforeAll(async () => {
  prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
  setPrisma(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Clear accepted prose pointers first to avoid FK violations
  const allBeats = await prisma.beat.findMany();
  for (const b of allBeats) {
    if (b.acceptedProseVersionId) {
      await prisma.beat.update({
        where: { id: b.id },
        data: { acceptedProseVersionId: null },
      });
    }
  }
  // Clean up in reverse dependency order
  await prisma.validationReport.deleteMany({});
  await prisma.proseWorkingDraft.deleteMany({});
  await prisma.proseVersion.deleteMany({});
  await prisma.beat.deleteMany({});
  await prisma.chapter.deleteMany({});
  await prisma.chapterOutline.deleteMany({});
  await prisma.proposal.deleteMany({});
  await prisma.proposalGroup.deleteMany({});
  await prisma.userConcurrencySlot.deleteMany({});
  await prisma.creditReservation.deleteMany({});
  await prisma.generationAttempt.deleteMany({});
  await prisma.workflowInvocation.deleteMany({});
  await prisma.generationJob.deleteMany({});
  await prisma.creditQuote.deleteMany({});
  await prisma.canonicalChangeOperation.deleteMany({});
  await prisma.canonicalChangeSet.deleteMany({});
  await prisma.foundation.deleteMany({});
  await prisma.character.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.user.deleteMany({
    where: { email: { contains: '@vertical-slice.com' } },
  });
});

async function createTestUser() {
  return prisma.user.create({
    data: {
      email: `vs-${Date.now()}@vertical-slice.com`,
      emailNormalized: `vs-${Date.now()}@vertical-slice.com`,
      status: 'active',
    },
  });
}

/** Claim a job to running state (simulating worker lease) so executors can transition it. */
async function claimAndExecute(
  jobId: string,
  executor: () => Promise<void>,
) {
  const jobRepo = createGenerationJobRepo();
  await claimJob(jobRepo, jobId, 'test-worker', 60000);
  await executor();
}

// =============================================================================
// 1. intake -> proposals
// =============================================================================

describe('vertical slice: intake -> accept concept', () => {
  it('requestIntake + executeIntakeJob creates proposal group with alternatives', async () => {
    const user = await createTestUser();
    const uow = createPrismaOperationalUnitOfWork(prisma);

    // Create project first
    const project = await prisma.project.create({
      data: {
        ownerUserId: user.id,
        title: 'VS Test Project',
        startMode: 'guided',
      },
    });

    // Request intake (enqueues job)
    const reqResult = await requestIntake(uow, aiPort, {
      userId: user.id,
      projectId: project.id,
      userInput: 'A story about memory trading',
    });

    expect(reqResult.jobId).toBeDefined();
    expect(reqResult.reservationId).toBeDefined();

    // Execute intake job (worker side) — claim first, then execute
    const job = await prisma.generationJob.findUnique({
      where: { id: reqResult.jobId },
    });
    expect(job).toBeTruthy();

    const workflowPlan = (job!.payloadJson as any)?.workflowPlan ?? {};
    await claimAndExecute(reqResult.jobId, () =>
      executeIntakeJob(uow, aiPort, reqResult.jobId, workflowPlan),
    );

    // Verify proposals exist
    const proposalGroups = await prisma.proposalGroup.findMany({
      where: { projectId: project.id },
    });
    expect(proposalGroups.length).toBeGreaterThanOrEqual(1);

    const proposals = await prisma.proposal.findMany({
      where: { proposalGroupId: proposalGroups[0]!.id },
    });
    expect(proposals.length).toBeGreaterThanOrEqual(1);
    expect(proposals[0]!.source).toBe('ai');
    expect(proposals[0]!.status).toBe('pending');

    // Verify change sets exist
    const changeSets = await prisma.canonicalChangeSet.findMany({
      where: { projectId: project.id },
    });
    expect(changeSets.length).toBeGreaterThanOrEqual(1);

    // Verify job succeeded
    const updatedJob = await prisma.generationJob.findUnique({
      where: { id: reqResult.jobId },
    });
    expect(updatedJob?.status).toBe('succeeded');
  });

  it('acceptConcept sets foundation draft status', async () => {
    const user = await createTestUser();
    const uow = createPrismaOperationalUnitOfWork(prisma);

    const project = await prisma.project.create({
      data: {
        ownerUserId: user.id,
        title: 'VS Accept Test',
        startMode: 'guided',
        foundationStatus: 'none',
      },
    });

    // Run intake
    const reqResult = await requestIntake(uow, aiPort, {
      userId: user.id,
      projectId: project.id,
      userInput: 'A story about memory trading',
    });

    const job = await prisma.generationJob.findUnique({
      where: { id: reqResult.jobId },
    });
    const workflowPlan = (job!.payloadJson as any)?.workflowPlan ?? {};
    await claimAndExecute(reqResult.jobId, () =>
      executeIntakeJob(uow, aiPort, reqResult.jobId, workflowPlan),
    );

    // Get proposal group
    const proposalGroups = await prisma.proposalGroup.findMany({
      where: { projectId: project.id },
    });
    expect(proposalGroups.length).toBeGreaterThanOrEqual(1);

    // Accept concept using TransactionPorts via StandardUnitOfWork
    await uow.execute(async (ports) => {
      const result = await acceptConcept(ports, {
        userId: user.id,
        projectId: project.id,
        altIndex: 1,
        proposalGroupId: proposalGroups[0]!.id,
      });

      expect(result.foundationStatus).toBe('draft');
    });

    // Verify foundation exists
    const foundation = await prisma.foundation.findUnique({
      where: { projectId: project.id },
    });
    expect(foundation).toBeTruthy();
    expect(foundation!.premise).toBeTruthy();

    // Verify project foundationStatus updated
    const updatedProject = await prisma.project.findUnique({
      where: { id: project.id },
    });
    expect(updatedProject?.foundationStatus).toBe('draft');
  });
});

// =============================================================================
// 2. outline -> chapters + beats
// =============================================================================

describe('vertical slice: outline generate + accept', () => {
  it('executeOutlineGenerateJob creates chapters and beats', async () => {
    const user = await createTestUser();
    const uow = createPrismaOperationalUnitOfWork(prisma);

    const project = await prisma.project.create({
      data: {
        ownerUserId: user.id,
        title: 'VS Outline Test',
        startMode: 'guided',
        foundationStatus: 'draft',
      },
    });

    // Create foundation (required for outline)
    await prisma.foundation.create({
      data: {
        projectId: project.id,
        premise: 'A test premise about memory trading',
        tone: 'Suspenseful',
        genre: 'Science Fiction',
      },
    });

    // Request outline
    const reqResult = await requestOutlineGenerate(uow, aiPort, {
      userId: user.id,
      projectId: project.id,
    });

    // Execute job
    const job = await prisma.generationJob.findUnique({
      where: { id: reqResult.jobId },
    });
    const workflowPlan = (job!.payloadJson as any)?.workflowPlan ?? {};

    await claimAndExecute(reqResult.jobId, () =>
      executeOutlineGenerateJob(uow, aiPort, reqResult.jobId, workflowPlan),
    );

    // Verify chapters exist
    const chapters = await prisma.chapter.findMany({
      where: { projectId: project.id },
      orderBy: { number: 'asc' },
    });
    expect(chapters.length).toBeGreaterThanOrEqual(1);

    // Verify chapter outlines exist
    const outlines = await prisma.chapterOutline.findMany({
      where: { projectId: project.id },
    });
    expect(outlines.length).toBeGreaterThanOrEqual(1);

    // Verify beats exist
    const beats = await prisma.beat.findMany({
      where: { chapterId: { in: chapters.map((c) => c.id) } },
    });
    expect(beats.length).toBeGreaterThanOrEqual(1);
  });

  it('acceptOutlineBatch persists structure from UI input', async () => {
    const user = await createTestUser();
    const uow = createPrismaOperationalUnitOfWork(prisma);

    const project = await prisma.project.create({
      data: {
        ownerUserId: user.id,
        title: 'VS Accept Outline Test',
        startMode: 'guided',
        foundationStatus: 'draft',
      },
    });

    await uow.execute(async (ports) => {
      const result = await acceptOutlineBatch(ports, {
        userId: user.id,
        projectId: project.id,
        chapters: [
          {
            chapterNumber: 1,
            title: 'The Extraction Room',
            summary: 'Kael performs a routine memory extraction.',
            beats: [
              { beatNumber: 1, title: 'The Ritual', summary: 'Extraction begins.' },
              { beatNumber: 2, title: 'The Flash', summary: 'A memory flashes.' },
            ],
          },
        ],
      });

      expect(result.chaptersCreated).toBe(1);
      expect(result.beatsCreated).toBe(2);
    });

    // Verify persisted
    const chapters = await prisma.chapter.findMany({
      where: { projectId: project.id },
    });
    expect(chapters.length).toBe(1);

    const beats = await prisma.beat.findMany({
      where: { chapterId: chapters[0]!.id },
    });
    expect(beats.length).toBe(2);
  });

  it('outline-downstream: rejects update when chapter has accepted prose', async () => {
    const user = await createTestUser();
    const uow = createPrismaOperationalUnitOfWork(prisma);

    const project = await prisma.project.create({
      data: {
        ownerUserId: user.id,
        title: 'VS Downstream Test',
        startMode: 'guided',
        foundationStatus: 'draft',
      },
    });

    // Create initial chapter + beat with accepted prose
    await uow.execute(async (ports) => {
      const chapter = await ports.chapterRepo.upsert({
        projectId: project.id,
        number: 1,
        title: 'Original',
      });
      await ports.beatRepo.create({
        chapterId: chapter.id,
        beatNumber: 1,
        title: 'Beat 1',
        summary: 'Original beat',
      });
      const beat = await ports.beatRepo.findByChapterAndNumber(chapter.id, 1);
      if (beat) {
        // Create a ProseVersion first to satisfy the composite FK
        const version = await ports.proseVersionRepo.nextVersion(beat.id);
        const pv = await ports.proseVersionRepo.create({
          beatId: beat.id,
          version,
          content: 'Some prose',
          contentHash: 'abc123',
          status: 'draft',
        });
        // Set accepted prose version on beat
        const beatRepo = ports.beatRepo;
        const nonTxBeat = beatRepo;
        await nonTxBeat.setAcceptedProseVersion(beat.id, pv.id);
      }
    });

    // Now try to accept outline update — should reject
    await expect(
      uow.execute(async (ports) =>
        acceptOutlineBatch(ports, {
          userId: user.id,
          projectId: project.id,
          chapters: [
            {
              chapterNumber: 1,
              title: 'Updated',
              summary: 'Updated summary',
              beats: [{ beatNumber: 2, title: 'New Beat', summary: 'New beat' }],
            },
          ],
        }),
      ),
    ).rejects.toThrow('outline-downstream');
  });
});

// =============================================================================
// 3. beat write -> prose version
// =============================================================================

describe('vertical slice: beat write creates prose', () => {
  it('executeBeatJob creates ProseVersion for beat', async () => {
    const user = await createTestUser();
    const uow = createPrismaOperationalUnitOfWork(prisma);

    const project = await prisma.project.create({
      data: {
        ownerUserId: user.id,
        title: 'VS Beat Test',
        startMode: 'guided',
        foundationStatus: 'draft',
      },
    });

    // Create foundation
    await prisma.foundation.create({
      data: {
        projectId: project.id,
        premise: 'Test premise',
        tone: 'Suspenseful',
        genre: 'Science Fiction',
      },
    });

    // Create chapter + beat via outline
    const outlineResult = await requestOutlineGenerate(uow, aiPort, {
      userId: user.id,
      projectId: project.id,
    });
    const outlineJob = await prisma.generationJob.findUnique({
      where: { id: outlineResult.jobId },
    });
    await claimAndExecute(outlineResult.jobId, () =>
      executeOutlineGenerateJob(
        uow,
        aiPort,
        outlineResult.jobId,
        (outlineJob!.payloadJson as any)?.workflowPlan ?? {},
      ),
    );

    // Get a chapter and beat
    const chapters = await prisma.chapter.findMany({
      where: { projectId: project.id },
      include: { beats: true },
    });
    const chapter = chapters[0]!;
    const beat = chapter.beats[0]!;

    // Request beat write
    const beatResult = await requestBeatWrite(uow, aiPort, {
      userId: user.id,
      projectId: project.id,
      chapterId: chapter.id,
      beatNumber: beat.beatNumber,
    });

    // Execute beat job
    const beatJob = await prisma.generationJob.findUnique({
      where: { id: beatResult.jobId },
    });
    const beatPayload = beatJob!.payloadJson as Record<string, unknown>;
    await claimAndExecute(beatResult.jobId, () =>
      executeBeatJob(
        uow,
        aiPort,
        beatResult.jobId,
        (beatPayload as any)?.workflowPlan ?? {},
      ),
    );

    // Verify prose version created
    const proseVersions = await prisma.proseVersion.findMany({
      where: { beatId: beat.id },
    });
    expect(proseVersions.length).toBeGreaterThanOrEqual(1);
    expect(proseVersions[0]!.content.length).toBeGreaterThan(0);

    // Verify beat job succeeded
    const updatedBeatJob = await prisma.generationJob.findUnique({
      where: { id: beatResult.jobId },
    });
    expect(updatedBeatJob?.status).toBe('succeeded');
  });
});
