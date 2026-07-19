import type {
  GenerationJobRepo,
  CreditReservationRepo,
  AttemptCostExposureRepo,
  GenerationAttemptRepo,
  UserConcurrencySlotRepo,
} from '../ports/operational-ports.js';
import { reclaimExpiredLease } from '../workflows/lease.js';
import { closeReservation } from './reservation-closing.js';

export interface ReaperResult {
  leaseReclaimed: number;
  orphanReservationsClosed: number;
  slotLeaksRepaired: number;
  errors: string[];
}

/**
 * Reaper loop: identify and repair operational issues left by crashed workers.
 *
 * Three categories:
 * 1. Lease reclaim: jobs with status='running' and expired leases get a new lease
 *    so another worker can pick them up.
 * 2. Orphan reservations: terminal jobs (succeeded/failed/dead/cancelled) whose
 *    reservations haven't been fully closed — close them.
 * 3. Slot leaks: concurrency slots not released for terminal jobs.
 *
 * Prefers SQL NOW() for expiry decisions (implemented in repos via listExpiredLease).
 */
export async function reap(
  jobRepo: GenerationJobRepo,
  reservationRepo: CreditReservationRepo,
  exposureRepo: AttemptCostExposureRepo,
  attemptRepo: GenerationAttemptRepo,
  slotRepo: UserConcurrencySlotRepo,
  options?: {
    limit?: number;
    leaseOwner?: string;
    leaseDurationMs?: number;
  },
): Promise<ReaperResult> {
  const limit = options?.limit ?? 10;
  const leaseOwner = options?.leaseOwner ?? 'reaper';
  const leaseDurationMs = options?.leaseDurationMs ?? 60000;

  const result: ReaperResult = {
    leaseReclaimed: 0,
    orphanReservationsClosed: 0,
    slotLeaksRepaired: 0,
    errors: [],
  };

  // 1. Lease reclaim candidates
  const expiredLeaseJobs = await jobRepo.listExpiredLease(limit);
  for (const job of expiredLeaseJobs) {
    try {
      await reclaimExpiredLease(jobRepo, job.id, leaseOwner, leaseDurationMs);
      result.leaseReclaimed++;
    } catch (err) {
      result.errors.push(`Failed to reclaim lease for job ${job.id}: ${String(err)}`);
    }
  }

  // 2. Orphan reservations: terminal jobs with unresolved resources
  // We check terminal jobs with unreleased slots
  const terminalJobs = await jobRepo.listTerminalWithResources(limit);
  for (const job of terminalJobs) {
    try {
      // Check slot leaks: terminal jobs with unreleased slots
      const slot = await slotRepo.findByJobId(job.id);
      if (slot && !slot.releasedAt) {
        await slotRepo.release(slot.id);
        result.slotLeaksRepaired++;
      }

      // Check orphan reservations
      const reservation = await reservationRepo.findByJobId(job.id);
      if (reservation && reservation.status !== 'closed') {
        await closeReservation(
          jobRepo, reservationRepo, exposureRepo, attemptRepo, slotRepo, job.id,
        );
        result.orphanReservationsClosed++;
      }
    } catch (err) {
      result.errors.push(`Failed to repair resources for job ${job.id}: ${String(err)}`);
    }
  }

  return result;
}

/**
 * Full reaper cycle: run all sweep/reclaim operations.
 * This is the entry point called by worker-reaper or a cron job.
 */
export async function fullReaperCycle(
  jobRepo: GenerationJobRepo,
  reservationRepo: CreditReservationRepo,
  exposureRepo: AttemptCostExposureRepo,
  attemptRepo: GenerationAttemptRepo,
  slotRepo: UserConcurrencySlotRepo,
  options?: {
    limit?: number;
    leaseOwner?: string;
    leaseDurationMs?: number;
  },
): Promise<ReaperResult> {
  return reap(
    jobRepo, reservationRepo, exposureRepo, attemptRepo, slotRepo, options,
  );
}
