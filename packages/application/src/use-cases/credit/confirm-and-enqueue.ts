import type { FullTxPorts } from '../../ports/operational-ports.js';
import { PublicUseCaseError, InternalUseCaseError } from '@narraza/shared';

export interface ConfirmAndEnqueueInput {
  userId: string;
  projectId: string;
  quoteId: string;
  requestId: string;
  jobType: string;
  workflowPlanHash: string;
  dependencyHash: string;
  conflictKey?: string | null;
  workflowPlanId?: string | null;
  contextBundleId?: string | null;
  /** Optional override for credit reservation amount. Defaults to quote amount. */
  reserveAmountOverride?: bigint | null;
  payloadJson?: Record<string, unknown>;
}

export interface ConfirmAndEnqueueOutput {
  jobId: string;
  reservationId: string;
  quoteId: string;
}

/**
 * Two-phase confirm:
 * 1. Revalidate quote: owner match, not expired, not consumed, hashes match
 * 2. Create GenerationJob referencing quote/plan
 * 3. Reserve credit
 * 4. Mark quote consumedByJobId → consumed
 *
 * All within a single UnitOfWork transaction.
 */
export async function confirmAndEnqueue(
  ports: FullTxPorts,
  input: ConfirmAndEnqueueInput,
): Promise<ConfirmAndEnqueueOutput> {
  const { creditQuoteRepo, generationJobRepo, creditReservationRepo, concurrencySlotRepo } = ports;

  // 1. Revalidate quote
  const quote = await creditQuoteRepo.findByIdAndOwner(input.quoteId, input.userId);
  if (!quote) {
    throw new PublicUseCaseError('NOT_FOUND', 'Credit quote not found');
  }

  if (quote.status === 'consumed') {
    throw new PublicUseCaseError('QUOTE_CONSUMED', 'Credit quote has already been consumed');
  }

  if (quote.status === 'expired') {
    throw new PublicUseCaseError('QUOTE_EXPIRED', 'Credit quote has expired');
  }

  if (quote.expiresAt < new Date()) {
    // Mark as expired atomically
    await creditQuoteRepo.markExpired(input.quoteId);
    throw new PublicUseCaseError('QUOTE_EXPIRED', 'Credit quote has expired');
  }

  // Verify hashes match
  if (quote.workflowPlanHash !== input.workflowPlanHash) {
    throw new PublicUseCaseError(
      'VALIDATION',
      'Workflow plan has changed since quote was issued. Request a new quote.',
    );
  }

  if (quote.dependencyHash !== input.dependencyHash) {
    throw new PublicUseCaseError(
      'VALIDATION',
      'Dependencies have changed since quote was issued. Request a new quote.',
    );
  }

  // 2. Check for active job with same conflict key (PREVENT duplicate)
  if (input.conflictKey) {
    const existingJob = await generationJobRepo.findActiveByConflictKey(
      input.userId,
      input.conflictKey,
    );
    if (existingJob) {
      throw new PublicUseCaseError('JOB_ALREADY_ACTIVE', 'A job with this conflict key is already active', );
    }
  }

  // Check for duplicate requestId
  const existingByRequest = await generationJobRepo.findByRequestId(input.requestId);
  if (existingByRequest) {
    throw new PublicUseCaseError('CONFLICT', 'A job with this request ID already exists');
  }

  // 3. Reserve credit
  const reserveAmount = input.reserveAmountOverride ?? quote.estimatedMaximumMicroIdr;
  // We don't check balance here — that's done by creditSummary read model
  // The reservation is just an upper-bound hold

  // 4. Create job
  const job = await generationJobRepo.create({
    ownerUserId: input.userId,
    projectId: input.projectId,
    jobType: input.jobType,
    payloadJson: input.payloadJson ?? {},
    requestId: input.requestId,
    workflowPlanId: input.workflowPlanId ?? null,
    contextBundleId: input.contextBundleId ?? null,
    conflictKey: input.conflictKey ?? null,
  });

  // 5. Create reservation linked to job
  const reservation = await creditReservationRepo.create({
    jobId: job.id,
    userId: input.userId,
    reservedAmount: reserveAmount,
  });

  // 6. Create concurrency slot
  await concurrencySlotRepo.create({
    userId: input.userId,
    jobId: job.id,
    slotKey: `job:${job.id}`,
  });

  // 8. Consume the quote — CAS: only if still issued
  const consumed = await creditQuoteRepo.consumeIfValid(input.quoteId, job.id);
  if (!consumed) {
    // Quote was consumed by another concurrent request — this shouldn't happen
    // within the UoW, but if the quote was consumed outside this tx, we throw
    throw new PublicUseCaseError('QUOTE_CONSUMED', 'Credit quote was consumed concurrently');
  }

  return {
    jobId: job.id,
    reservationId: reservation.id,
    quoteId: input.quoteId,
  };
}
