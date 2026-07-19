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

import { setPrisma } from '@narraza/db';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import {
  claimJob,
  transitionJobStatus,
  closeReservation,
} from '@narraza/application';
import { createGenerationJobRepo } from '@narraza/db/repositories/generation-job-repo.js';
import { createGenerationAttemptRepo } from '@narraza/db/repositories/generation-attempt-repo.js';
import { createCreditReservationRepo } from '@narraza/db/repositories/credit-reservation-repo.js';
import { createAttemptCostExposureRepo } from '@narraza/db/repositories/attempt-cost-exposure-repo.js';
import { createUserConcurrencySlotRepo } from '@narraza/db/repositories/user-concurrency-slot-repo.js';
import { createWorkerInstanceRepo } from '@narraza/db/repositories/worker-instance-repo.js';
import { config } from 'dotenv';

config({ path: '../../.env' });

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

    // ---- MOCK PROVIDER CALL ----
    const mockSuccess = true;
    // ---- END MOCK ----

    // Check cancel requested after provider call (mid-provider drain)
    const midProviderJob = await jobRepo.findById(currentJobId);
    if (midProviderJob?.cancelRequestedAt) {
      // Drain: cancel was requested mid-provider.
      // Cost already incurred — do NOT publish, but record cost.
      await transitionJobStatus(jobRepo, currentJobId, 'running', 'cancelled', {
        terminalReasonCode: 'cancelled_mid_attempt',
      });
      return;
    }

    if (mockSuccess) {
      // Create attempt record
      const attemptNum = await jobRepo.incrementAttemptNumber(currentJobId);
      if (attemptNum !== null) {
        await attemptRepo.create({
          generationJobId: currentJobId,
          attemptNumber: attemptNum,
          leaseToken: currentLeaseToken,
        });
      }

      // Transition to succeeded
      await transitionJobStatus(jobRepo, currentJobId, 'running', 'succeeded');

      // Close reservation
      try {
        await closeReservation(
          jobRepo, reservationRepo, exposureRepo, attemptRepo, slotRepo,
          currentJobId,
        );
      } catch {
        // Non-fatal: reservation closing can be repaired by reaper
      }
    } else {
      // Execution retry
      const job = await jobRepo.findById(currentJobId);
      if (job && job.executionRetryCount < job.maxExecutionRetries) {
        await transitionJobStatus(jobRepo, currentJobId, 'running', 'queued', {
          executionRetryCount: job.executionRetryCount + 1,
        });
      } else {
        await transitionJobStatus(jobRepo, currentJobId, 'running', 'failed', {
          terminalReasonCode: 'max_execution_retries_exceeded',
        });
      }
    }
  } finally {
    currentJobId = null;
    currentLeaseToken = null;
  }
}

async function run() {
  const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL_WORKER } },
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
  console.log(`[worker-gen ${INSTANCE_ID}] Drain complete, exiting.`);
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Run if this is the entry point (not imported)
const isEntryPoint = process.argv[1]?.includes('main');
if (isEntryPoint) {
  run().catch((err) => {
    console.error(`[worker-gen ${INSTANCE_ID}] Fatal:`, err);
    process.exit(1);
  });
}

export { processJob, run, INSTANCE_ID, draining };
