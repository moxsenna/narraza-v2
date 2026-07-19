import type { GenerationAttempt, WorkflowInvocation, WorkflowInvocationRepo, GenerationAttemptRepo, AttemptCostExposureRepo, CreditReservationRepo } from '../ports/operational-ports.js';
import { PublicUseCaseError, InternalUseCaseError } from '@narraza/shared';

export interface InvocationWinnerResult {
  invocation: WorkflowInvocation;
  winnerAttempt: GenerationAttempt;
  isWinner: boolean;
}

/**
 * CAS select winner attempt for a workflow invocation.
 *
 * Rules:
 * - Only one attempt can win (first to call selectWinnerAttempt gets it)
 * - Late success records usage/cost but does NOT replace winner
 * - Returns isWinner=true if this attempt was selected, false if it was late
 */
export async function selectInvocationWinner(
  invocationRepo: WorkflowInvocationRepo,
  attemptRepo: GenerationAttemptRepo,
  invocationId: string,
  attemptId: string,
): Promise<InvocationWinnerResult> {
  // Verify invocation exists
  const invocation = await invocationRepo.findById(invocationId);
  if (!invocation) {
    throw new PublicUseCaseError('NOT_FOUND', 'Workflow invocation not found');
  }

  // Verify attempt exists and belongs to this invocation
  const attempt = await attemptRepo.findById(attemptId);
  if (!attempt) {
    throw new PublicUseCaseError('NOT_FOUND', 'Generation attempt not found');
  }

  if (attempt.workflowInvocationId !== invocationId) {
    throw new PublicUseCaseError(
      'VALIDATION',
      'Attempt does not belong to this invocation',
    );
  }

  // CAS select winner: first one to set selectedAttemptId wins
  const selected = await invocationRepo.selectWinnerAttempt(invocationId, attemptId);
  if (selected) {
    // We won — finalize the attempt
    await attemptRepo.finalize(attemptId, 'completed');
    return {
      invocation: selected,
      winnerAttempt: attempt,
      isWinner: true,
    };
  }

  // We lost — some other attempt already won
  // Re-fetch to get the winner info
  const updatedInvocation = await invocationRepo.findById(invocationId);
  if (!updatedInvocation) {
    throw new InternalUseCaseError('INTERNAL', 'Invocation disappeared during winner selection');
  }

  if (updatedInvocation.selectedAttemptId === attemptId) {
    // Race condition: we won but selectWinnerAttempt returned null due to timing
    // This can happen with CAS — treat it as a win
    await attemptRepo.finalize(attemptId, 'completed');
    return {
      invocation: updatedInvocation,
      winnerAttempt: attempt,
      isWinner: true,
    };
  }

  // Truly late — record the attempt but don't select it
  // Late success records usage/cost but does NOT replace winner
  // We still mark the attempt as 'completed' since it finished, just not as winner
  await attemptRepo.finalize(attemptId, 'completed', {
    retryDisposition: 'late_winner_already_selected',
  });

  const winnerAttempt = updatedInvocation.selectedAttemptId
    ? await attemptRepo.findById(updatedInvocation.selectedAttemptId)
    : null;

  return {
    invocation: updatedInvocation,
    winnerAttempt: winnerAttempt ?? attempt, // fallback
    isWinner: false,
  };
}

/**
 * Record a late attempt — it completed but was not selected as winner.
 * Cost is still recorded but the attempt does not replace the winner.
 */
export async function recordLateAttempt(
  attemptRepo: GenerationAttemptRepo,
  exposureRepo: AttemptCostExposureRepo,
  reservationRepo: CreditReservationRepo,
  attemptId: string,
  reservationId: string,
  actualCostMicroIdr: bigint,
): Promise<GenerationAttempt> {
  const attempt = await attemptRepo.findById(attemptId);
  if (!attempt) {
    throw new PublicUseCaseError('NOT_FOUND', 'Generation attempt not found');
  }

  // Mark as completed (even though late)
  const finalized = await attemptRepo.finalize(attemptId, 'completed', {
    retryDisposition: 'late_attempt_cost_recorded',
  });

  if (!finalized) {
    throw new PublicUseCaseError('CAS_CONFLICT', 'Failed to finalize late attempt');
  }

  // Still record the cost exposure
  await exposureRepo.create({
    generationAttemptId: attemptId,
    reservationId,
    estimatedAmountMicro: actualCostMicroIdr,
  });

  // Settle the exposure
  const exposures = await exposureRepo.findByAttemptId(attemptId);
  for (const exposure of exposures) {
    await exposureRepo.settle(exposure.id, actualCostMicroIdr);
  }

  // Settle against reservation
  await reservationRepo.settle(reservationId, actualCostMicroIdr);

  return finalized;
}
