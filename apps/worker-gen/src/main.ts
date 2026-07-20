/**
 * worker-gen: Generation job worker process.
 *
 * Thin adapter that calls application services.
 * NO domain logic here — all business rules are in @narraza/application.
 *
 * Lifecycle:
 * - Poll queued jobs, claim lease, heartbeat, process
 * - SIGTERM graceful: pre-provider requeue fenced; mid-provider drain
 */

import { setPrisma, getPrisma, createPrismaOperationalUnitOfWork } from '@narraza/db';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import {
  claimJob,
  transitionJobStatus,
  closeReservation,
  executeIntakeJob,
  executeOutlineGenerateJob,
  executeBeatJob,
  executeFoundationProposeJob,
  executeCharacterProposeJob,
} from '@narraza/application';
import { createAIExecutionPort } from '@narraza/ai';
import { createGenerationJobRepo } from '@narraza/db/repositories/generation-job-repo.js';
import { createGenerationAttemptRepo } from '@narraza/db/repositories/generation-attempt-repo.js';
import { createCreditReservationRepo } from '@narraza/db/repositories/credit-reservation-repo.js';
import { createAttemptCostExposureRepo } from '@narraza/db/repositories/attempt-cost-exposure-repo.js';
import { createUserConcurrencySlotRepo } from '@narraza/db/repositories/user-concurrency-slot-repo.js';
import { createWorkerInstanceRepo } from '@narraza/db/repositories/worker-instance-repo.js';
import { config } from 'dotenv';

import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __workerDir = dirname(fileURLToPath(import.meta.url));
const envCandidates = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '../../.env'),
  resolve(__workerDir, '../../../.env'),
];
for (const p of envCandidates) {
  if (existsSync(p)) {
    config({ path: p });
    break;
  }
}

const INSTANCE_ID = `worker-gen-${randomUUID().slice(0, 8)}`;
const POLL_INTERVAL_MS = parseInt(process.env.WORKER_GEN_POLL_MS ?? '1000', 10);
const LEASE_DURATION_MS = parseInt(process.env.WORKER_GEN_LEASE_MS ?? '60000', 10);
const HEARTBEAT_INTERVAL_MS = parseInt(process.env.WORKER_GEN_HEARTBEAT_MS ?? '15000', 10);

/**
 * Injectable sleep function — can be replaced in tests.
 */
export let _sleep: (ms: number) => Promise<void> = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Allow tests to inject a sleep replacement. */
export function setWorkerGenSleep(fn: (ms: number) => Promise<void>) {
  _sleep = fn;
}

// =============================================================================
// Worker state machine
// =============================================================================

let draining = false;
let currentJobId: string | null = null;
let currentLeaseToken: string | null = null;
let currentLeaseVersion: number = 0;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

async function heartbeat(workerRepo: ReturnType<typeof createWorkerInstanceRepo>) {
  await workerRepo.heartbeat(INSTANCE_ID);
}

function clearHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

async function processJob(
  jobRepo: ReturnType<typeof createGenerationJobRepo>,
  attemptRepo: ReturnType<typeof createGenerationAttemptRepo>,
  reservationRepo: ReturnType<typeof createCreditReservationRepo>,
  exposureRepo: ReturnType<typeof createAttemptCostExposureRepo>,
  slotRepo: ReturnType<typeof createUserConcurrencySlotRepo>,
) {
  // Poll for a queued job
  const queued = await jobRepo.pollQueued(1);
  if (!queued.length) return;

  const job = queued[0]!;

  // Check if cancel was requested before we even claim
  const freshJob = await jobRepo.findById(job.id);
  if (!freshJob || freshJob.status !== 'queued') return;

  // Claim the job
  let claimed;
  try {
    claimed = await claimJob(jobRepo, job.id, INSTANCE_ID, LEASE_DURATION_MS);
  } catch {
    return; // Already claimed by someone else
  }

  currentJobId = claimed.id;
  currentLeaseToken = claimed.leaseToken!;
  currentLeaseVersion = claimed.leaseVersion;

  try {
    // Check cancel requested before provider call (pre-provider fence)
    const preProviderJob = await jobRepo.findById(currentJobId);
    if (preProviderJob?.cancelRequestedAt) {
      // Fenced: cancel was requested, requeue for another worker
      await transitionJobStatus(jobRepo, currentJobId, 'running', 'queued');
      return;
    }

    // ---- DISPATCH TO JOB EXECUTOR ----
    const uow = createPrismaOperationalUnitOfWork(getPrisma());
    // Fail-fast factory: mock only when AI_ENABLE_MOCK=true and not production
    const aiPort = createAIExecutionPort({
      enableMock: process.env.AI_ENABLE_MOCK === 'true',
      apiKey: process.env.AI_API_KEY ?? process.env.OPENROUTER_API_KEY,
      baseUrl: process.env.AI_BASE_URL,
      defaultModelId: process.env.AI_MODEL,
      fallbackModelId: process.env.AI_FALLBACK_MODEL,
      providerLabel: process.env.AI_PROVIDER_LABEL,
      nodeEnv: process.env.NODE_ENV,
    });
    const payload = claimed.payloadJson as Record<string, unknown>;
    const jobType = claimed.jobType;
    const workflowPlan = (payload as any)?.workflowPlan ?? {};

    try {
      switch (jobType) {
        case 'intake.extract':
          await executeIntakeJob(uow, aiPort, currentJobId, workflowPlan);
          break;
        case 'outline.generate':
          await executeOutlineGenerateJob(uow, aiPort, currentJobId, workflowPlan);
          break;
        case 'beat.write':
        case 'beat.repair':
          await executeBeatJob(uow, aiPort, currentJobId, workflowPlan);
          break;
        case 'foundation.propose':
          await executeFoundationProposeJob(uow, aiPort, currentJobId, workflowPlan);
          break;
        case 'character.propose':
          await executeCharacterProposeJob(uow, aiPort, currentJobId, workflowPlan);
          break;
        default:
          // Unknown job type — fail rather than mock succeed
          await transitionJobStatus(
            jobRepo, currentJobId, 'running', 'failed',
            { terminalReasonCode: `unknown_job_type:${jobType}` },
          );
          return;
      }
    } catch (err) {
      // Check cancel before retry
      const retryJob = await jobRepo.findById(currentJobId);
      if (retryJob?.cancelRequestedAt) {
        await transitionJobStatus(jobRepo, currentJobId, 'running', 'cancelled', {
          terminalReasonCode: 'cancelled_mid_attempt',
        });
        return;
      }

      const job = await jobRepo.findById(currentJobId);
      if (job && job.executionRetryCount < job.maxExecutionRetries) {
        await transitionJobStatus(jobRepo, currentJobId, 'running', 'queued', {
          executionRetryCount: job.executionRetryCount + 1,
        });
      } else {
        await transitionJobStatus(jobRepo, currentJobId, 'running', 'failed', {
          terminalReasonCode: err instanceof Error ? err.message.slice(0, 200) : 'execution_error',
        });
      }
      return;
    }
    // ---- END JOB DISPATCH ----
    // Executors own attempt records + terminal job status when they succeed.
    // Worker only closes reservation and handles post-dispatch cancel.

    // Check cancel requested after provider call (mid-provider drain)
    const midProviderJob = await jobRepo.findById(currentJobId);
    if (midProviderJob?.cancelRequestedAt) {
      // Drain: cancel was requested mid-provider.
      // Cost already incurred — do NOT publish, but record cost.
      if (midProviderJob.status === 'running') {
        await transitionJobStatus(jobRepo, currentJobId, 'running', 'cancelled', {
          terminalReasonCode: 'cancelled_mid_attempt',
        });
      }
      return;
    }

    // Close reservation after successful dispatch (terminal status set by executor)
    try {
      await closeReservation(
        jobRepo,
        reservationRepo,
        exposureRepo,
        attemptRepo,
        slotRepo,
        currentJobId,
      );
    } catch {
      // Non-fatal: reservation closing can be repaired by reaper
    }
  } finally {
    currentJobId = null;
    currentLeaseToken = null;
  }
}

async function run() {
  const workerDbUrl = process.env.DATABASE_URL_WORKER;
  if (!workerDbUrl) {
    throw new Error('DATABASE_URL_WORKER is required');
  }
  const prisma = new PrismaClient({
    datasources: { db: { url: workerDbUrl } },
  });
  setPrisma(prisma);

  const jobRepo = createGenerationJobRepo();
  const attemptRepo = createGenerationAttemptRepo();
  const reservationRepo = createCreditReservationRepo();
  const exposureRepo = createAttemptCostExposureRepo();
  const slotRepo = createUserConcurrencySlotRepo();
  const workerRepo = createWorkerInstanceRepo();

  // Register worker instance
  try {
    await workerRepo.create({ instanceId: INSTANCE_ID, role: 'gen' });
  } catch {
    // Already exists — heartbeat instead
    await workerRepo.heartbeat(INSTANCE_ID);
  }

  // Start heartbeat
  heartbeatTimer = setInterval(() => {
    heartbeat(workerRepo).catch(() => {});
  }, HEARTBEAT_INTERVAL_MS);

  // Main loop
  while (!draining) {
    await processJob(jobRepo, attemptRepo, reservationRepo, exposureRepo, slotRepo);
    await _sleep(POLL_INTERVAL_MS);
  }

  clearHeartbeat();
  await prisma.$disconnect();
}

// =============================================================================
// SIGTERM graceful shutdown
// =============================================================================

async function shutdown(signal: string) {
  console.log(`[worker-gen ${INSTANCE_ID}] Received ${signal}, draining...`);
  draining = true;

  // Persist draining state to DB so readiness endpoint can detect it
  try {
    const { getPrisma } = await import('@narraza/db');
    const p = getPrisma();
    await p.workerInstance.update({
      where: { instanceId: INSTANCE_ID },
      data: { draining: true, lastHeartbeatAt: new Date() },
    });
  } catch {
    // Non-fatal: worker may already be gone from DB
  }

  console.log(`[worker-gen ${INSTANCE_ID}] Drain complete, exiting.`);
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Run if this is the entry point (not imported)
const isEntryPoint = process.argv[1]?.endsWith('main.js') || process.argv[1]?.endsWith('main.ts');
if (isEntryPoint) {
  run().catch((err) => {
    console.error(`[worker-gen ${INSTANCE_ID}] Fatal:`, err);
    process.exit(1);
  });
}

export { processJob, run, INSTANCE_ID, draining };
