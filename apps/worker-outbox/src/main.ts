/**
 * worker-outbox: Outbox consumer process.
 *
 * Thin adapter that calls application services.
 * NO domain logic here — all business rules are in @narraza/application.
 *
 * Lifecycle:
 * - Poll outbox, process receipts, mark complete/uncertain
 * - Dead replay: bump deliveryGeneration for new delivery cycle
 */

import { setPrisma } from '@narraza/db';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import {
  processOutboxEvent,
  replayOutboxEvent,
} from '@narraza/application';
import { createOutboxEventRepo } from '@narraza/db/repositories/outbox-event-repo.js';
import { createOutboxConsumerReceiptRepo } from '@narraza/db/repositories/outbox-consumer-receipt-repo.js';
import { createWorkerInstanceRepo } from '@narraza/db/repositories/worker-instance-repo.js';
import { config } from 'dotenv';

config({ path: '../../.env' });

const INSTANCE_ID = `worker-outbox-${randomUUID().slice(0, 8)}`;
const POLL_INTERVAL_MS = parseInt(process.env.WORKER_OUTBOX_POLL_MS ?? '1000', 10);
const HEARTBEAT_INTERVAL_MS = parseInt(process.env.WORKER_OUTBOX_HEARTBEAT_MS ?? '15000', 10);
const CONSUMER_NAME = 'default-consumer';

/**
 * Injectable sleep function — can be replaced in tests.
 */
export let _sleep: (ms: number) => Promise<void> = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Allow tests to inject a sleep replacement. */
export function setWorkerOutboxSleep(fn: (ms: number) => Promise<void>) {
  _sleep = fn;
}

// =============================================================================
// Worker state machine
// =============================================================================

let draining = false;
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

/**
 * Process a single outbox event.
 * The handler is a mock — in production this would deliver to downstream systems.
 */
async function processEvent(
  eventRepo: ReturnType<typeof createOutboxEventRepo>,
  receiptRepo: ReturnType<typeof createOutboxConsumerReceiptRepo>,
) {
  // Poll for pending events
  const pending = await eventRepo.pollPending(1);
  if (!pending.length) return;

  const event = pending[0]!;

  // Claim the event for processing
  const claimed = await eventRepo.claimForProcessing(event.id, event.deliveryGeneration);
  if (!claimed) return; // Already claimed by another worker

  // Process with a mock handler
  const result = await processOutboxEvent(eventRepo, receiptRepo, {
    eventId: claimed.id,
    consumerName: CONSUMER_NAME,
    handler: async (_event) => {
      // Mock: delivery always succeeds
      // In production this would call downstream systems, webhooks, etc.
      return true;
    },
  });

  // Mark event completed if receipt is completed
  if (result.status === 'completed') {
    await eventRepo.markCompleted(claimed.id);
  }

  // Process dead/uncertain receipts: replay by bumping delivery generation
  const unresolvedReceipts = await receiptRepo.listUnresolved(CONSUMER_NAME, 10);
  for (const receipt of unresolvedReceipts) {
    // For uncertain receipts that are too old, mark as dead
    const age = Date.now() - receipt.createdAt.getTime();
    if (receipt.status === 'uncertain' && age > 300_000) {
      // 5-minute timeout
      await receiptRepo.markDead(receipt.id);

      // Replay the event
      await replayOutboxEvent(eventRepo, receiptRepo, {
        eventId: receipt.eventId,
        reasonCode: 'uncertain_timeout',
      });
    }
  }
}

async function run() {
  const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL_OUTBOX } },
  });
  setPrisma(prisma);

  const eventRepo = createOutboxEventRepo();
  const receiptRepo = createOutboxConsumerReceiptRepo();
  const workerRepo = createWorkerInstanceRepo();

  // Register worker instance
  try {
    await workerRepo.create({ instanceId: INSTANCE_ID, role: 'outbox' });
  } catch {
    await workerRepo.heartbeat(INSTANCE_ID);
  }

  // Start heartbeat
  heartbeatTimer = setInterval(() => {
    heartbeat(workerRepo).catch(() => {});
  }, HEARTBEAT_INTERVAL_MS);

  // Main loop
  while (!draining) {
    await processEvent(eventRepo, receiptRepo);
    await _sleep(POLL_INTERVAL_MS);
  }

  clearHeartbeat();
  await prisma.$disconnect();
}

// =============================================================================
// SIGTERM graceful shutdown
// =============================================================================

async function shutdown(signal: string) {
  console.log(`[worker-outbox ${INSTANCE_ID}] Received ${signal}, draining...`);
  draining = true;
  console.log(`[worker-outbox ${INSTANCE_ID}] Drain complete, exiting.`);
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Run if this is the entry point (not imported)
const isEntryPoint = process.argv[1]?.includes('main');
if (isEntryPoint) {
  run().catch((err) => {
    console.error(`[worker-outbox ${INSTANCE_ID}] Fatal:`, err);
    process.exit(1);
  });
}

export { processEvent, run, INSTANCE_ID, draining };
