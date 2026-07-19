import type {
  GenerationJobRepo,
  CreditReservationRepo,
  AttemptCostExposureRepo,
  GenerationAttemptRepo,
  UserConcurrencySlotRepo,
} from '../../ports/operational-ports.js';
import type { GenerationJob } from '../../ports/operational-ports.js';
import { transitionJobStatus } from '../../workflows/job-transitions.js';
import { PublicUseCaseError } from '@narraza/shared';

export interface CancelJobInput {
  jobId: string;
  requestedBy: string;
  reasonCode?: string;
}

export interface CancelJobOutput {
  jobId: string;
  previousStatus: GenerationJob['status'];
  newStatus: GenerationJob['status'];
  reservationReleased: boolean;
  slotReleased: boolean;
  /** If running, cancel is requested but not yet terminal (worker must yield) */
  cancelPending: boolean;
}

/**
 * Cancel a generation job.
 *
 * Rules:
 * - queued: transition directly to 'cancelled', release slot + reservation
 * - running: set cancelRequestedAt; worker checks before stages;
 *   late cost via exposure; no proposal publish after cancel.
 *   The job is NOT transitioned to cancelled here — the worker must yield.
 * - terminal: no-op (idempotent)
 */
export async function cancelJob(
  jobRepo: GenerationJobRepo,
  reservationRepo: CreditReservationRepo,
  exposureRepo: AttemptCostExposureRepo,
  attemptRepo: GenerationAttemptRepo,
  slotRepo: UserConcurrencySlotRepo,
  input: CancelJobInput,
): Promise<CancelJobOutput> {
  const job = await jobRepo.findById(input.jobId);
  if (!job) {
    throw new PublicUseCaseError('NOT_FOUND', 'Job not found');
  }

  const terminalStatuses: GenerationJob['status'][] = ['succeeded', 'failed', 'dead', 'cancelled'];

  if (terminalStatuses.includes(job.status)) {
    // Already terminal — idempotent
    return {
      jobId: job.id,
      previousStatus: job.status,
      newStatus: job.status,
      reservationReleased: false,
      slotReleased: false,
      cancelPending: false,
    };
  }

  if (job.status === 'queued') {
    // Direct cancel: queued -> cancelled
    const cancelled = await transitionJobStatus(jobRepo, job.id, 'queued', 'cancelled', {
      terminalReasonCode: input.reasonCode ?? 'user_cancelled',
    });

    // Release concurrency slot
    const slot = await slotRepo.findByJobId(job.id);
    if (slot && !slot.releasedAt) {
      await slotRepo.release(slot.id);
    }

    // Release remaining reservation
    const reservation = await reservationRepo.findByJobId(job.id);
    let reservationReleased = false;
    if (reservation) {
      const remaining =
        reservation.reservedAmount - reservation.settledAmount - reservation.releasedAmount;
      if (remaining > 0n) {
        const released = await reservationRepo.safeRelease(reservation.id, remaining);
        reservationReleased = released !== null;
      } else {
        reservationReleased = true; // fully consumed
      }
    }

    return {
      jobId: job.id,
      previousStatus: 'queued',
      newStatus: cancelled.status,
      reservationReleased,
      slotReleased: true,
      cancelPending: false,
    };
  }

  if (job.status === 'running') {
    // Set cancelRequestedAt; worker must check before stages
    const updated = await jobRepo.setCancelRequested(job.id);
    if (!updated) {
      throw new PublicUseCaseError('CAS_CONFLICT', 'Failed to set cancel request on job');
    }

    return {
      jobId: job.id,
      previousStatus: 'running',
      newStatus: 'running',
      reservationReleased: false,
      slotReleased: false,
      cancelPending: true,
    };
  }

  throw new PublicUseCaseError('VALIDATION', `Cannot cancel job in status '${job.status}'`);
}

/**
 * Tombstone a mid-attempt job: record cost for the in-progress attempt,
 * transition to 'cancelled' or 'dead', and release resources.
 *
 * This is called by the worker when it detects cancelRequestedAt during execution,
 * or by the reaper when it determines the attempt is unrecoverable.
 */
export async function tombstoneMidAttempt(
  jobRepo: GenerationJobRepo,
  reservationRepo: CreditReservationRepo,
  exposureRepo: AttemptCostExposureRepo,
  attemptRepo: GenerationAttemptRepo,
  slotRepo: UserConcurrencySlotRepo,
  jobId: string,
  options?: {
    /** Actual cost incurred by this mid-attempt (exposed even though cancelled) */
    actualCostMicroIdr?: bigint;
    /** The attempt ID that was in progress */
    attemptId?: string;
    /** Terminal reason code */
    reasonCode?: string;
  },
): Promise<CancelJobOutput> {
  const job = await jobRepo.findById(jobId);
  if (!job) {
    throw new PublicUseCaseError('NOT_FOUND', 'Job not found');
  }

  const terminalStatuses: GenerationJob['status'][] = ['succeeded', 'failed', 'dead', 'cancelled'];
  if (terminalStatuses.includes(job.status)) {
    return {
      jobId: job.id,
      previousStatus: job.status,
      newStatus: job.status,
      reservationReleased: false,
      slotReleased: false,
      cancelPending: false,
    };
  }

  if (job.status !== 'running') {
    throw new PublicUseCaseError(
      'VALIDATION',
      `Cannot tombstone job in status '${job.status}'`,
    );
  }

  // Record cost for mid-attempt if provided
  const reservation = await reservationRepo.findByJobId(job.id);
  if (options?.actualCostMicroIdr && options.actualCostMicroIdr > 0n) {
    // Settle the exposure (late cost)
    if (reservation) {
      const settleResult = await reservationRepo.settle(
        reservation.id,
        options.actualCostMicroIdr,
      );
      if (settleResult) {
        // Create and settle an exposure for the attempt
        if (options.attemptId) {
          await exposureRepo.create({
            generationAttemptId: options.attemptId,
            reservationId: reservation.id,
            estimatedAmountMicro: options.actualCostMicroIdr,
          });
          const exposures = await exposureRepo.findByAttemptId(options.attemptId);
          for (const exposure of exposures) {
            if (exposure.status === 'open') {
              await exposureRepo.settle(exposure.id, options.actualCostMicroIdr);
            }
          }
        }
      }
    }

    // Finalize the attempt as failed
    if (options.attemptId) {
      await attemptRepo.finalize(options.attemptId, 'failed', {
        retryDisposition: 'cancelled_mid_attempt',
      });
    }
  }

  // Transition to cancelled
  const cancelled = await transitionJobStatus(jobRepo, job.id, 'running', 'cancelled', {
    terminalReasonCode: options?.reasonCode ?? 'cancelled_mid_attempt',
  });

  // Release concurrency slot
  const slot = await slotRepo.findByJobId(job.id);
  if (slot && !slot.releasedAt) {
    await slotRepo.release(slot.id);
  }

  // Release remaining reservation
  const updatedReservation = await reservationRepo.findByJobId(job.id);
  let reservationReleased = false;
  if (updatedReservation) {
    const remaining =
      updatedReservation.reservedAmount -
      updatedReservation.settledAmount -
      updatedReservation.releasedAmount;
    if (remaining > 0n) {
      const released = await reservationRepo.safeRelease(updatedReservation.id, remaining);
      reservationReleased = released !== null;
    } else {
      reservationReleased = true;
    }
  }

  return {
    jobId: job.id,
    previousStatus: 'running',
    newStatus: cancelled.status,
    reservationReleased,
    slotReleased: true,
    cancelPending: false,
  };
}
