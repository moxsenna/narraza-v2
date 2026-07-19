import type { GenerationAttempt, GenerationAttemptRepo, AttemptCostExposureRepo, CreditReservationRepo } from '../ports/operational-ports.js';
import { InternalUseCaseError } from '@narraza/shared';

export interface ReconciliationResult {
  attemptId: string;
  action: 'reuse' | 'finalize' | 'reconcile_with_provider' | 'mark_unknown' | 'noop';
  retryDisposition?: string;
  error?: string;
}

/**
 * Reconcile a single generation attempt based on its current state.
 *
 * Rules:
 * - completed + artifact (not started) → reuse: no cost change
 * - started + artifact exists → finalize to completed
 * - started + providerRequestId → reconcile with provider (if provider available)
 * - else → mark unknown + retryDisposition
 * - NEVER blind retry billable unknown
 */
export async function reconcileAttempt(
  attemptRepo: GenerationAttemptRepo,
  attempt: GenerationAttempt,
  options?: {
    /** Whether an artifact (prose version, etc.) exists for this attempt */
    hasArtifact?: boolean;
    /** Whether we can reconcile with the provider */
    canReconcileWithProvider?: boolean;
  },
): Promise<ReconciliationResult> {
  const hasArtifact = options?.hasArtifact ?? false;
  const canReconcile = options?.canReconcileWithProvider ?? false;

  if (attempt.status === 'completed' || attempt.status === 'failed') {
    // Already terminal — reuse the result
    return {
      attemptId: attempt.id,
      action: 'reuse',
    };
  }

  if (attempt.status === 'started') {
    if (hasArtifact) {
      // Has output → finalize
      const finalized = await attemptRepo.finalize(attempt.id, 'completed');
      if (!finalized) {
        return {
          attemptId: attempt.id,
          action: 'mark_unknown',
          retryDisposition: 'finalize_failed',
          error: 'Failed to finalize attempt',
        };
      }
      return {
        attemptId: attempt.id,
        action: 'finalize',
      };
    }

    if (attempt.providerRequestId && canReconcile) {
      // Can reconcile with provider → do it via the provider
      return {
        attemptId: attempt.id,
        action: 'reconcile_with_provider',
      };
    }

    // Dead end — mark as unknown
    const updated = await attemptRepo.updateStatus(attempt.id, 'unknown', {
      retryDisposition: hasArtifact
        ? 'unknown_with_artifact'
        : attempt.providerRequestId
          ? 'unknown_with_provider_request'
          : 'unknown_started_no_artifact',
    });

    return {
      attemptId: attempt.id,
      action: 'mark_unknown',
      retryDisposition: updated?.retryDisposition ?? 'unknown',
    };
  }

  if (attempt.status === 'unknown') {
    // Already unknown — noop
    return {
      attemptId: attempt.id,
      action: 'noop',
      retryDisposition: attempt.retryDisposition ?? 'already_unknown',
    };
  }

  return {
    attemptId: attempt.id,
    action: 'noop',
  };
}

/**
 * Reconcile all attempts for a job.
 * Iterates through all started/unknown attempts and applies reconciliation rules.
 */
export async function reconcileJobAttempts(
  attemptRepo: GenerationAttemptRepo,
  jobId: string,
): Promise<ReconciliationResult[]> {
  const attempts = await attemptRepo.listForReconciliation(jobId);
  const results: ReconciliationResult[] = [];

  for (const attempt of attempts) {
    const result = await reconcileAttempt(attemptRepo, attempt);
    results.push(result);
  }

  return results;
}
