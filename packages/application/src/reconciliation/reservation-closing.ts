import type {
  GenerationJob, GenerationJobRepo,
  CreditReservation, CreditReservationRepo,
  AttemptCostExposure, AttemptCostExposureRepo,
  GenerationAttemptRepo, UserConcurrencySlotRepo,
} from '../ports/operational-ports.js';
import { PublicUseCaseError, InternalUseCaseError } from '@narraza/shared';

/**
 * Close a reservation for a terminal job.
 *
 * Rules:
 * - Terminal job releases concurrency slot immediately
 * - Unresolved attempts → reservation 'closing'; only safeRelease (>= 0); settle/release exposures then 'closed'
 * - Excess exposure → RESERVATION_EXPOSURE_EXCEEDED (no silent clamp below zero)
 */
export async function closeReservation(
  jobRepo: GenerationJobRepo,
  reservationRepo: CreditReservationRepo,
  exposureRepo: AttemptCostExposureRepo,
  attemptRepo: GenerationAttemptRepo,
  slotRepo: UserConcurrencySlotRepo,
  jobId: string,
): Promise<{ reservation: CreditReservation; exposures: AttemptCostExposure[] }> {
  // 1. Verify job is terminal
  const job = await jobRepo.findById(jobId);
  if (!job) {
    throw new PublicUseCaseError('NOT_FOUND', 'Job not found');
  }

  const terminalStatuses: GenerationJob['status'][] = ['succeeded', 'failed', 'dead', 'cancelled'];
  if (!terminalStatuses.includes(job.status)) {
    throw new PublicUseCaseError(
      'VALIDATION',
      `Cannot close reservation for non-terminal job (status: ${job.status})`,
    );
  }

  // 2. Find reservation
  const reservation = await reservationRepo.findByJobId(jobId);
  if (!reservation) {
    throw new PublicUseCaseError('NOT_FOUND', 'No reservation found for this job');
  }

  if (reservation.status === 'closed') {
    // Already closed — idempotent
    const exposures = await exposureRepo.findByReservationId(reservation.id);
    return { reservation, exposures };
  }

  // 3. Release concurrency slot immediately
  await slotRepo.releaseByJobId(jobId);

  // 4. Check for unresolved attempts
  const unresolvedAttempts = await attemptRepo.findStartedByJobId(jobId);
  const unknownAttempts = await attemptRepo.listForReconciliation(jobId);

  const allUnresolved = [...unresolvedAttempts, ...unknownAttempts];

  if (allUnresolved.length > 0) {
    // Transition reservation to 'closing'
    const closing = await reservationRepo.updateStatus(reservation.id, 'closing');
    if (!closing) {
      throw new InternalUseCaseError('INTERNAL', 'Failed to transition reservation to closing');
    }

    // Resolve exposures
    const exposures = await exposureRepo.findByReservationId(reservation.id);
    for (const exposure of exposures) {
      if (exposure.status === 'open') {
        // If we know the actual cost, settle; otherwise safeRelease the estimate
        if (exposure.actualAmountMicro !== null) {
          // Settle with actual cost
          const settleResult = await reservationRepo.settle(
            reservation.id,
            exposure.actualAmountMicro,
          );
          if (!settleResult) {
            throw new InternalUseCaseError(
              'RESERVATION_EXPOSURE_EXCEEDED',
              `Exposure ${exposure.id} actual amount ${exposure.actualAmountMicro} exceeds reservation capacity`,
            );
          }
          await exposureRepo.settle(exposure.id, exposure.actualAmountMicro);
        } else {
          // Release the estimated amount safely
          const releaseResult = await reservationRepo.safeRelease(
            reservation.id,
            exposure.estimatedAmountMicro,
          );
          if (!releaseResult) {
            throw new InternalUseCaseError(
              'RESERVATION_EXPOSURE_EXCEEDED',
              `Exposure ${exposure.id} estimated ${exposure.estimatedAmountMicro} exceeds reservation remaining`,
            );
          }
          await exposureRepo.release(exposure.id);
        }
      }
    }
  }

  // 5. If still not closed, close it now
  const current = await reservationRepo.findById(reservation.id);
  if (!current) {
    throw new InternalUseCaseError('INTERNAL', 'Reservation disappeared during closing');
  }

  if (current.status !== 'closed') {
    const closed = await reservationRepo.updateStatus(current.id, 'closed');
    if (!closed) {
      throw new InternalUseCaseError('INTERNAL', 'Failed to close reservation');
    }
    const exposures = await exposureRepo.findByReservationId(current.id);
    return { reservation: closed, exposures };
  }

  const exposures = await exposureRepo.findByReservationId(current.id);
  return { reservation: current, exposures };
}

/**
 * Validate that a settled/released amount does not exceed the reservation capacity.
 * Throws RESERVATION_EXPOSURE_EXCEEDED if the amount would exceed remaining capacity.
 * Does NOT silently clamp to zero — excess is an operational incident.
 */
export function assertReservationCapacity(
  reservation: CreditReservation,
  amount: bigint,
  context: string,
): void {
  const remaining = reservation.reservedAmount - reservation.settledAmount - reservation.releasedAmount;
  if (remaining < amount) {
    throw new InternalUseCaseError(
      'RESERVATION_EXPOSURE_EXCEEDED',
      `${context}: amount ${amount} exceeds remaining reservation capacity ${remaining} (reserved: ${reservation.reservedAmount}, settled: ${reservation.settledAmount}, released: ${reservation.releasedAmount})`,
    );
  }
}

/**
 * Create an exposure for a generation attempt.
 */
export async function createExposure(
  exposureRepo: AttemptCostExposureRepo,
  generationAttemptId: string,
  reservationId: string,
  estimatedAmountMicro: bigint,
): Promise<AttemptCostExposure> {
  return exposureRepo.create({
    generationAttemptId,
    reservationId,
    estimatedAmountMicro,
  });
}

/**
 * Settle an exposure (provider reported actual cost).
 */
export async function settleExposure(
  exposureRepo: AttemptCostExposureRepo,
  reservationRepo: CreditReservationRepo,
  exposureId: string,
  reservationId: string,
  actualAmountMicro: bigint,
): Promise<{ exposure: AttemptCostExposure; reservation: CreditReservation }> {
  const reservation = await reservationRepo.findById(reservationId);
  if (!reservation) {
    throw new PublicUseCaseError('NOT_FOUND', 'Reservation not found');
  }

  assertReservationCapacity(reservation, actualAmountMicro, 'settleExposure');

  const settled = await reservationRepo.settle(reservationId, actualAmountMicro);
  if (!settled) {
    throw new InternalUseCaseError(
      'RESERVATION_EXPOSURE_EXCEEDED',
      'Failed to settle — reservation capacity exceeded',
    );
  }

  const exposure = await exposureRepo.settle(exposureId, actualAmountMicro);
  if (!exposure) {
    throw new InternalUseCaseError('INTERNAL', 'Failed to settle exposure');
  }

  return { exposure, reservation: settled };
}

/**
 * Release an exposure (attempt recorded no cost).
 */
export async function releaseExposure(
  exposureRepo: AttemptCostExposureRepo,
  reservationRepo: CreditReservationRepo,
  exposureId: string,
  reservationId: string,
): Promise<{ exposure: AttemptCostExposure; reservation: CreditReservation }> {
  const exposure = await exposureRepo.findById(exposureId);
  if (!exposure) {
    throw new PublicUseCaseError('NOT_FOUND', 'Exposure not found');
  }

  const reservation = await reservationRepo.findById(reservationId);
  if (!reservation) {
    throw new PublicUseCaseError('NOT_FOUND', 'Reservation not found');
  }

  const amount = exposure.estimatedAmountMicro;
  assertReservationCapacity(reservation, amount, 'releaseExposure');

  const released = await reservationRepo.safeRelease(reservationId, amount);
  if (!released) {
    throw new InternalUseCaseError(
      'RESERVATION_EXPOSURE_EXCEEDED',
      'Failed to release — reservation capacity exceeded',
    );
  }

  const releasedExposure = await exposureRepo.release(exposureId);
  if (!releasedExposure) {
    throw new InternalUseCaseError('INTERNAL', 'Failed to release exposure');
  }

  return { exposure: releasedExposure, reservation: released };
}
