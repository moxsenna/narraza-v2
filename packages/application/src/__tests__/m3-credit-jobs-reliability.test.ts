import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';

config({ path: '../../.env' });

const dbUrl = process.env.DATABASE_URL ?? 'postgresql://narraza:narraza@localhost:5433/narraza';

let prisma: PrismaClient;

// Import repos and use cases after env is loaded
import { setPrisma } from '../../../db/src/client.js';
import { createCreditQuoteRepo } from '../../../db/src/repositories/credit-quote-repo.js';
import { createGenerationJobRepo } from '../../../db/src/repositories/generation-job-repo.js';
import { createGenerationAttemptRepo } from '../../../db/src/repositories/generation-attempt-repo.js';
import { createWorkflowInvocationRepo } from '../../../db/src/repositories/workflow-invocation-repo.js';
import { createCreditReservationRepo } from '../../../db/src/repositories/credit-reservation-repo.js';
import { createAttemptCostExposureRepo } from '../../../db/src/repositories/attempt-cost-exposure-repo.js';
import { createUserConcurrencySlotRepo } from '../../../db/src/repositories/user-concurrency-slot-repo.js';
import { createPrismaOperationalUnitOfWork } from '../../../db/src/unit-of-work.js';
import { issueQuote } from '../use-cases/credit/issue-quote.js';
import { confirmAndEnqueue } from '../use-cases/credit/confirm-and-enqueue.js';
import { transitionJobStatus, executionRetry } from '../workflows/job-transitions.js';
import { claimJob, reclaimExpiredLease, assertLease, publishUnderLease, renewLease } from '../workflows/lease.js';
import { selectInvocationWinner, recordLateAttempt } from '../workflows/invocation-reducer.js';
import { reconcileAttempt, reconcileJobAttempts } from '../reconciliation/attempt-reconcile.js';
import { closeReservation, createExposure, settleExposure, releaseExposure, assertReservationCapacity } from '../reconciliation/reservation-closing.js';

let userId: string;
let projectId: string;

beforeAll(async () => {
  prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
  setPrisma(prisma);

  // Ensure a test user and project exist
  const email = `m3-test-${Date.now()}@example.com`;
  const user = await prisma.user.create({
    data: { email, emailNormalized: email.toLowerCase(), status: 'active' },
  });
  userId = user.id;

  const project = await prisma.project.create({
    data: {
      ownerUserId: userId,
      title: 'M3 Test Project',
      startMode: 'guided',
      createRequestId: `m3-proj-${Date.now()}`,
    },
  });
  projectId = project.id;
});

afterAll(async () => {
  // Clean up test data
  await prisma.attemptCostExposure.deleteMany({});
  await prisma.creditReservation.deleteMany({});
  await prisma.generationAttempt.deleteMany({});
  await prisma.workflowInvocation.deleteMany({});
  await prisma.creditQuote.deleteMany({});
  await prisma.userConcurrencySlot.deleteMany({});
  await prisma.generationJob.deleteMany({});
  await prisma.project.deleteMany({ where: { ownerUserId: userId } });
  await prisma.user.delete({ where: { id: userId } });
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.attemptCostExposure.deleteMany({});
  await prisma.creditReservation.deleteMany({});
  await prisma.generationAttempt.deleteMany({});
  await prisma.workflowInvocation.deleteMany({});
  await prisma.creditQuote.deleteMany({});
  await prisma.userConcurrencySlot.deleteMany({});
  await prisma.generationJob.deleteMany({});
});

// =============================================================================
// M3.1: CreditQuote issue/confirm
// =============================================================================
describe('credit-quote (M3.1)', () => {
  it('issue quote returns quoteId and expiry', async () => {
    const repo = createCreditQuoteRepo();
    const result = await issueQuote(repo, {
      userId,
      workflowPlanHash: 'hash-wp-1',
      dependencyHash: 'hash-dep-1',
      estimatedMaximumMicroIdr: 1000n,
      ttlSeconds: 300,
    });
    expect(result.quoteId).toBeTruthy();
    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('confirm enqueue creates job, reservation, slot, and consumes quote', async () => {
    const quoteRepo = createCreditQuoteRepo();
    const quote = await quoteRepo.create({
      ownerUserId: userId,
      workflowPlanHash: 'hash-wp-2',
      dependencyHash: 'hash-dep-2',
      estimatedMaximumMicroIdr: 2000n,
      expiresAt: new Date(Date.now() + 300_000),
    });

    const uow = createPrismaOperationalUnitOfWork(prisma);
    const result = await uow.execute(async (ports) => {
      return confirmAndEnqueue(ports, {
        userId,
        projectId,
        quoteId: quote.id,
        requestId: `req-${Date.now()}-${randomUUID().slice(0, 8)}`,
        jobType: 'test.beat_write',
        workflowPlanHash: 'hash-wp-2',
        dependencyHash: 'hash-dep-2',
        conflictKey: `test-conflict-${Date.now()}`,
        payloadJson: { test: true },
      });
    });

    expect(result.jobId).toBeTruthy();
    expect(result.reservationId).toBeTruthy();

    // Verify quote is consumed
    const consumed = await quoteRepo.findById(quote.id);
    expect(consumed!.status).toBe('consumed');
    expect(consumed!.consumedByJobId).toBe(result.jobId);
  });

  it('second confirm with same quote throws QUOTE_CONSUMED', async () => {
    const quoteRepo = createCreditQuoteRepo();
    const quote = await quoteRepo.create({
      ownerUserId: userId,
      workflowPlanHash: 'hash-wp-3',
      dependencyHash: 'hash-dep-3',
      estimatedMaximumMicroIdr: 3000n,
      expiresAt: new Date(Date.now() + 300_000),
    });

    const uow = createPrismaOperationalUnitOfWork(prisma);
    const req1 = `req-${Date.now()}-a-${randomUUID().slice(0, 8)}`;
    await uow.execute(async (ports) => {
      return confirmAndEnqueue(ports, {
        userId,
        projectId,
        quoteId: quote.id,
        requestId: req1,
        jobType: 'test.beat_write',
        workflowPlanHash: 'hash-wp-3',
        dependencyHash: 'hash-dep-3',
        conflictKey: `test-2a-${Date.now()}`,
        payloadJson: {},
      });
    });

    // Second attempt should fail
    const req2 = `req-${Date.now()}-b-${randomUUID().slice(0, 8)}`;
    await expect(
      uow.execute(async (ports) => {
        return confirmAndEnqueue(ports, {
          userId,
          projectId,
          quoteId: quote.id,
          requestId: req2,
          jobType: 'test.beat_write',
          workflowPlanHash: 'hash-wp-3',
          dependencyHash: 'hash-dep-3',
          conflictKey: `test-2b-${Date.now()}`,
          payloadJson: {},
        });
      }),
    ).rejects.toMatchObject({ code: 'QUOTE_CONSUMED' });
  });

  it('expired quote throws QUOTE_EXPIRED', async () => {
    const quoteRepo = createCreditQuoteRepo();
    const quote = await quoteRepo.create({
      ownerUserId: userId,
      workflowPlanHash: 'hash-wp-4',
      dependencyHash: 'hash-dep-4',
      estimatedMaximumMicroIdr: 400n,
      expiresAt: new Date(Date.now() - 1000), // Expired
    });

    await quoteRepo.markExpired(quote.id);

    const uow = createPrismaOperationalUnitOfWork(prisma);
    await expect(
      uow.execute(async (ports) => {
        return confirmAndEnqueue(ports, {
          userId,
          projectId,
          quoteId: quote.id,
          requestId: `req-expired-${Date.now()}`,
          jobType: 'test.beat_write',
          workflowPlanHash: 'hash-wp-4',
          dependencyHash: 'hash-dep-4',
          payloadJson: {},
        });
      }),
    ).rejects.toMatchObject({ code: 'QUOTE_EXPIRED' });
  });

  it('confirm with changed workflow plan hash throws VALIDATION', async () => {
    const quoteRepo = createCreditQuoteRepo();
    const quote = await quoteRepo.create({
      ownerUserId: userId,
      workflowPlanHash: 'hash-wp-5',
      dependencyHash: 'hash-dep-5',
      estimatedMaximumMicroIdr: 500n,
      expiresAt: new Date(Date.now() + 300_000),
    });

    const uow = createPrismaOperationalUnitOfWork(prisma);
    await expect(
      uow.execute(async (ports) => {
        return confirmAndEnqueue(ports, {
          userId,
          projectId,
          quoteId: quote.id,
          requestId: `req-changed-${Date.now()}`,
          jobType: 'test.beat_write',
          workflowPlanHash: 'hash-wp-DIFFERENT',
          dependencyHash: 'hash-dep-5',
          payloadJson: {},
        });
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });
});

// =============================================================================
// M3.2: Job CAS transitions
// =============================================================================
describe('job-terminal + exec-retry (M3.2)', () => {
  it('queued → running → succeeded is valid', async () => {
    const jobRepo = createGenerationJobRepo();
    const job = await jobRepo.create({
      ownerUserId: userId,
      projectId,
      jobType: 'test.transition',
      payloadJson: {},
      requestId: `req-trans-${Date.now()}-${randomUUID().slice(0, 8)}`,
    });
    expect(job.status).toBe('queued');

    const running = await transitionJobStatus(jobRepo, job.id, 'queued', 'running');
    expect(running.status).toBe('running');

    const succeeded = await transitionJobStatus(jobRepo, job.id, 'running', 'succeeded');
    expect(succeeded.status).toBe('succeeded');
    expect(succeeded.terminalAt).toBeTruthy();
  });

  it('terminal immutable: same terminal re-apply is idempotent', async () => {
    const jobRepo = createGenerationJobRepo();
    const job = await jobRepo.create({
      ownerUserId: userId,
      projectId,
      jobType: 'test.terminal',
      payloadJson: {},
      requestId: `req-term-${Date.now()}-${randomUUID().slice(0, 8)}`,
    });

    await transitionJobStatus(jobRepo, job.id, 'queued', 'failed', { terminalReasonCode: 'test_fail' });
    const result = await transitionJobStatus(jobRepo, job.id, 'failed', 'failed');
    expect(result.status).toBe('failed');
    expect(result.terminalReasonCode).toBe('test_fail');
  });

  it('terminal immutable: different terminal throws TERMINAL_STATE_CONFLICT', async () => {
    const jobRepo = createGenerationJobRepo();
    const job = await jobRepo.create({
      ownerUserId: userId,
      projectId,
      jobType: 'test.terminal2',
      payloadJson: {},
      requestId: `req-term2-${Date.now()}-${randomUUID().slice(0, 8)}`,
    });

    await transitionJobStatus(jobRepo, job.id, 'queued', 'failed');

    await expect(
      transitionJobStatus(jobRepo, job.id, 'failed', 'cancelled'),
    ).rejects.toMatchObject({ code: 'TERMINAL_STATE_CONFLICT' });
  });

  it('execution retry: running → queued increments retry count', async () => {
    const jobRepo = createGenerationJobRepo();
    const job = await jobRepo.create({
      ownerUserId: userId,
      projectId,
      jobType: 'test.retry',
      payloadJson: {},
      requestId: `req-retry-${Date.now()}-${randomUUID().slice(0, 8)}`,
      maxExecutionRetries: 3,
    });

    await transitionJobStatus(jobRepo, job.id, 'queued', 'running');
    const retried = await executionRetry(jobRepo, job.id);
    expect(retried.status).toBe('queued');
    expect(retried.executionRetryCount).toBe(1);
  });

  it('execution retry exceeding max → failed', async () => {
    const jobRepo = createGenerationJobRepo();
    const job = await jobRepo.create({
      ownerUserId: userId,
      projectId,
      jobType: 'test.retry_max',
      payloadJson: {},
      requestId: `req-retrymax-${Date.now()}-${randomUUID().slice(0, 8)}`,
      maxExecutionRetries: 1,
    });

    await transitionJobStatus(jobRepo, job.id, 'queued', 'running');
    await executionRetry(jobRepo, job.id); // Count = 1, goes back to queued
    await transitionJobStatus(jobRepo, job.id, 'queued', 'running');
    
    // Now at retryCount=1, max=1 — next exec retry should go to failed
    const result = await executionRetry(jobRepo, job.id);
    expect(result.status).toBe('failed');
    expect(result.terminalReasonCode).toBe('max_execution_retries_exceeded');
  });
});

// =============================================================================
// M3.3: Claim CTE + fencing
// =============================================================================
describe('lease-fence-publish (M3.3)', () => {
  it('claim job sets lease and transitions to running', async () => {
    const jobRepo = createGenerationJobRepo();
    const job = await jobRepo.create({
      ownerUserId: userId,
      projectId,
      jobType: 'test.claim',
      payloadJson: {},
      requestId: `req-claim-${Date.now()}-${randomUUID().slice(0, 8)}`,
    });

    const claimed = await claimJob(jobRepo, job.id, 'worker-1', 60000);
    expect(claimed.status).toBe('running');
    expect(claimed.leaseToken).toBeTruthy();
    expect(claimed.leaseVersion).toBeGreaterThan(0);
    expect(claimed.leaseOwner).toBe('worker-1');
  });

  it('cannot claim already running job', async () => {
    const jobRepo = createGenerationJobRepo();
    const job = await jobRepo.create({
      ownerUserId: userId,
      projectId,
      jobType: 'test.claim2',
      payloadJson: {},
      requestId: `req-claim2-${Date.now()}-${randomUUID().slice(0, 8)}`,
    });

    await claimJob(jobRepo, job.id, 'worker-1', 60000);
    await expect(claimJob(jobRepo, job.id, 'worker-2', 60000)).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('assertLease fails on wrong token', async () => {
    const jobRepo = createGenerationJobRepo();
    const job = await jobRepo.create({
      ownerUserId: userId,
      projectId,
      jobType: 'test.lease',
      payloadJson: {},
      requestId: `req-lease-${Date.now()}-${randomUUID().slice(0, 8)}`,
    });

    const claimed = await claimJob(jobRepo, job.id, 'worker-1', 60000);
    expect(() =>
      assertLease(claimed, 'wrong-token', claimed.leaseVersion),
    ).toThrow();
  });

  it('assertLease fails on wrong version', async () => {
    const jobRepo = createGenerationJobRepo();
    const job = await jobRepo.create({
      ownerUserId: userId,
      projectId,
      jobType: 'test.lease2',
      payloadJson: {},
      requestId: `req-lease2-${Date.now()}-${randomUUID().slice(0, 8)}`,
    });

    const claimed = await claimJob(jobRepo, job.id, 'worker-1', 60000);
    expect(() =>
      assertLease(claimed, claimed.leaseToken!, claimed.leaseVersion + 1),
    ).toThrow();
  });

  it('publish under lease fence succeeds with correct token', async () => {
    const jobRepo = createGenerationJobRepo();
    const job = await jobRepo.create({
      ownerUserId: userId,
      projectId,
      jobType: 'test.publish',
      payloadJson: {},
      requestId: `req-pub-${Date.now()}-${randomUUID().slice(0, 8)}`,
    });

    const claimed = await claimJob(jobRepo, job.id, 'worker-1', 60000);
    const result = await publishUnderLease(
      jobRepo, job.id,
      claimed.leaseToken!,
      claimed.leaseVersion,
      async (j) => ({ published: true, status: j.status }),
    );
    expect(result.published).toBe(true);
  });

  it('zombie publish after lease loss is rejected', async () => {
    const jobRepo = createGenerationJobRepo();
    const job = await jobRepo.create({
      ownerUserId: userId,
      projectId,
      jobType: 'test.zombie',
      payloadJson: {},
      requestId: `req-zombie-${Date.now()}-${randomUUID().slice(0, 8)}`,
    });

    const claimed = await claimJob(jobRepo, job.id, 'worker-1', 10); // Very short lease

    // Force expire by reclaiming from another worker
    await new Promise((r) => setTimeout(r, 20)); // Wait for lease to expire
    const reclaimed = await reclaimExpiredLease(jobRepo, job.id, 'worker-2', 60000);
    expect(reclaimed.leaseOwner).toBe('worker-2');

    // Original worker tries to publish — should be rejected
    await expect(
      publishUnderLease(jobRepo, job.id, claimed.leaseToken!, claimed.leaseVersion, async () => ({})),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

// =============================================================================
// M3.4: WorkflowInvocation single winner
// =============================================================================
describe('invocation-winner + late-attempt (M3.4)', () => {
  it('first CAS select wins; second is late', async () => {
    const jobRepo = createGenerationJobRepo();
    const attemptRepo = createGenerationAttemptRepo();
    const invocationRepo = createWorkflowInvocationRepo();

    const job = await jobRepo.create({
      ownerUserId: userId,
      projectId,
      jobType: 'test.invocation',
      payloadJson: {},
      requestId: `req-inv-${Date.now()}-${randomUUID().slice(0, 8)}`,
    });

    const invocation = await invocationRepo.create({
      generationJobId: job.id,
      routingStage: 'writer',
      invocationKey: 'write-v1',
    });

    const attempt1 = await attemptRepo.create({
      generationJobId: job.id,
      workflowInvocationId: invocation.id,
      attemptNumber: 1,
    });

    const attempt2 = await attemptRepo.create({
      generationJobId: job.id,
      workflowInvocationId: invocation.id,
      attemptNumber: 2,
    });

    // First attempt wins
    const result1 = await selectInvocationWinner(invocationRepo, attemptRepo, invocation.id, attempt1.id);
    expect(result1.isWinner).toBe(true);
    expect(result1.winnerAttempt.id).toBe(attempt1.id);

    // Second attempt is late
    const result2 = await selectInvocationWinner(invocationRepo, attemptRepo, invocation.id, attempt2.id);
    expect(result2.isWinner).toBe(false);

    // Verify winner is still attempt1
    const finalInvocation = await invocationRepo.findById(invocation.id);
    expect(finalInvocation!.selectedAttemptId).toBe(attempt1.id);
  });

  it('late attempt records cost but does not replace winner', async () => {
    const jobRepo = createGenerationJobRepo();
    const attemptRepo = createGenerationAttemptRepo();
    const invocationRepo = createWorkflowInvocationRepo();
    const reservationRepo = createCreditReservationRepo();
    const exposureRepo = createAttemptCostExposureRepo();

    const job = await jobRepo.create({
      ownerUserId: userId,
      projectId,
      jobType: 'test.late',
      payloadJson: {},
      requestId: `req-late-${Date.now()}-${randomUUID().slice(0, 8)}`,
    });

    const reservation = await reservationRepo.create({
      jobId: job.id,
      userId,
      reservedAmount: 10_000n,
    });

    const invocation = await invocationRepo.create({
      generationJobId: job.id,
      routingStage: 'writer',
      invocationKey: 'write-v1',
    });

    const attempt1 = await attemptRepo.create({
      generationJobId: job.id,
      workflowInvocationId: invocation.id,
      attemptNumber: 1,
    });

    const attempt2 = await attemptRepo.create({
      generationJobId: job.id,
      workflowInvocationId: invocation.id,
      attemptNumber: 2,
    });

    // attempt1 wins
    await selectInvocationWinner(invocationRepo, attemptRepo, invocation.id, attempt1.id);

    // attempt2 is late — record cost
    const lateResult = await recordLateAttempt(
      attemptRepo, exposureRepo, reservationRepo,
      attempt2.id, reservation.id, 500n,
    );
    expect(lateResult.status).toBe('completed');

    // Winner is still attempt1
    const finalInvocation = await invocationRepo.findById(invocation.id);
    expect(finalInvocation!.selectedAttemptId).toBe(attempt1.id);
  });
});

// =============================================================================
// M3.5: Attempt reconciliation
// =============================================================================
describe('attempt-reconcile (M3.5)', () => {
  it('completed attempt → reuse', async () => {
    const jobRepo = createGenerationJobRepo();
    const attemptRepo = createGenerationAttemptRepo();

    const job = await jobRepo.create({
      ownerUserId: userId,
      projectId,
      jobType: 'test.reconcile',
      payloadJson: {},
      requestId: `req-recon-${Date.now()}-${randomUUID().slice(0, 8)}`,
    });

    const attempt = await attemptRepo.create({
      generationJobId: job.id,
      attemptNumber: 1,
    });
    await attemptRepo.finalize(attempt.id, 'completed');

    const result = await reconcileAttempt(attemptRepo, { ...attempt, status: 'completed' });
    expect(result.action).toBe('reuse');
  });

  it('started + artifact → finalize', async () => {
    const jobRepo = createGenerationJobRepo();
    const attemptRepo = createGenerationAttemptRepo();

    const job = await jobRepo.create({
      ownerUserId: userId,
      projectId,
      jobType: 'test.reconcile2',
      payloadJson: {},
      requestId: `req-recon2-${Date.now()}-${randomUUID().slice(0, 8)}`,
    });

    const attempt = await attemptRepo.create({
      generationJobId: job.id,
      attemptNumber: 1,
    });

    const result = await reconcileAttempt(attemptRepo, attempt, { hasArtifact: true });
    expect(result.action).toBe('finalize');
  });

  it('started + providerRequestId → reconcile_with_provider', async () => {
    const jobRepo = createGenerationJobRepo();
    const attemptRepo = createGenerationAttemptRepo();

    const job = await jobRepo.create({
      ownerUserId: userId,
      projectId,
      jobType: 'test.reconcile3',
      payloadJson: {},
      requestId: `req-recon3-${Date.now()}-${randomUUID().slice(0, 8)}`,
    });

    const attempt = await attemptRepo.create({
      generationJobId: job.id,
      attemptNumber: 1,
      providerRequestId: 'openai-req-123',
    });

    const result = await reconcileAttempt(attemptRepo, attempt, { canReconcileWithProvider: true });
    expect(result.action).toBe('reconcile_with_provider');
  });

  it('started no artifact no provider → mark_unknown', async () => {
    const jobRepo = createGenerationJobRepo();
    const attemptRepo = createGenerationAttemptRepo();

    const job = await jobRepo.create({
      ownerUserId: userId,
      projectId,
      jobType: 'test.reconcile4',
      payloadJson: {},
      requestId: `req-recon4-${Date.now()}-${randomUUID().slice(0, 8)}`,
    });

    const attempt = await attemptRepo.create({
      generationJobId: job.id,
      attemptNumber: 1,
    });

    const result = await reconcileAttempt(attemptRepo, attempt, { hasArtifact: false });
    expect(result.action).toBe('mark_unknown');
    expect(result.retryDisposition).toBe('unknown_started_no_artifact');
  });
});

// =============================================================================
// M3.6: Reservation closing + exposures
// =============================================================================
describe('reservation-exposure (M3.6)', () => {
  it('terminal job releases concurrency slot', async () => {
    const jobRepo = createGenerationJobRepo();
    const reservationRepo = createCreditReservationRepo();
    const attemptRepo = createGenerationAttemptRepo();
    const exposureRepo = createAttemptCostExposureRepo();
    const slotRepo = createUserConcurrencySlotRepo();

    const job = await jobRepo.create({
      ownerUserId: userId,
      projectId,
      jobType: 'test.close',
      payloadJson: {},
      requestId: `req-close-${Date.now()}-${randomUUID().slice(0, 8)}`,
    });

    await reservationRepo.create({ jobId: job.id, userId, reservedAmount: 5000n });
    await slotRepo.create({ userId, jobId: job.id, slotKey: `slot-${job.id}` });

    // Move to terminal via queued -> running -> succeeded
    await transitionJobStatus(jobRepo, job.id, 'queued', 'running');
    await transitionJobStatus(jobRepo, job.id, 'running', 'succeeded');

    const result = await closeReservation(
      jobRepo, reservationRepo, exposureRepo, attemptRepo, slotRepo, job.id,
    );
    expect(result.reservation.status).toBe('closed');

    const slot = await slotRepo.findByJobId(job.id);
    expect(slot!.releasedAt).toBeTruthy();
  });

  it('unresolved attempts → reservation closing → closed', async () => {
    const jobRepo = createGenerationJobRepo();
    const reservationRepo = createCreditReservationRepo();
    const attemptRepo = createGenerationAttemptRepo();
    const exposureRepo = createAttemptCostExposureRepo();
    const slotRepo = createUserConcurrencySlotRepo();

    const job = await jobRepo.create({
      ownerUserId: userId,
      projectId,
      jobType: 'test.close2',
      payloadJson: {},
      requestId: `req-close2-${Date.now()}-${randomUUID().slice(0, 8)}`,
    });

    const reservation = await reservationRepo.create({ jobId: job.id, userId, reservedAmount: 10_000n });
    await slotRepo.create({ userId, jobId: job.id, slotKey: `slot-${job.id}` });

    // Create an unresolved attempt with exposure
    const attempt = await attemptRepo.create({
      generationJobId: job.id,
      attemptNumber: 1,
    });

    await exposureRepo.create({
      generationAttemptId: attempt.id,
      reservationId: reservation.id,
      estimatedAmountMicro: 3000n,
    });

    // Move to terminal
    await transitionJobStatus(jobRepo, job.id, 'queued', 'failed');

    const result = await closeReservation(
      jobRepo, reservationRepo, exposureRepo, attemptRepo, slotRepo, job.id,
    );
    expect(result.reservation.status).toBe('closed');
    expect(result.reservation.settledAmount + result.reservation.releasedAmount).toBeGreaterThanOrEqual(
      3000n,
    );
  });

  it('excess exposure throws RESERVATION_EXPOSURE_EXCEEDED', () => {
    const reservation = {
      id: 'test-id',
      jobId: 'job-id',
      userId,
      reservedAmount: 100n,
      settledAmount: 80n,
      releasedAmount: 0n,
      status: 'reserved' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // 110 > 20 (remaining) — should throw
    let caught: unknown = null;
    try {
      assertReservationCapacity(reservation, 110n, 'test');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeTruthy();
    expect((caught as any).code).toBe('RESERVATION_EXPOSURE_EXCEEDED');
    
    // Does NOT silently clamp to zero
  });

  it('safeRelease within capacity works; excess throws', async () => {
    const jobRepo = createGenerationJobRepo();
    const reservationRepo = createCreditReservationRepo();

    const job = await jobRepo.create({
      ownerUserId: userId,
      projectId,
      jobType: 'test.safe_release',
      payloadJson: {},
      requestId: `req-sr-${Date.now()}-${randomUUID().slice(0, 8)}`,
    });

    const reservation = await reservationRepo.create({
      jobId: job.id, userId, reservedAmount: 5000n,
    });

    // Valid release
    const released = await reservationRepo.safeRelease(reservation.id, 1000n);
    expect(released).toBeTruthy();
    expect(released!.releasedAmount).toBe(1000n);

    // Excess release
    const excess = await reservationRepo.safeRelease(reservation.id, 5000n);
    expect(excess).toBeNull(); // CAS failure — doesn't throw, returns null
  });
});
