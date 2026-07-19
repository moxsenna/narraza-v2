import type { GenerationJob, GenerationJobRepo } from '../ports/operational-ports.js';
import { PublicUseCaseError, InternalUseCaseError } from '@narraza/shared';

export type JobStatus = GenerationJob['status'];

/** Allowed transitions for queued status. */
const QUEUED_TRANSITIONS: ReadonlySet<JobStatus> = new Set<JobStatus>(['running', 'failed', 'dead', 'cancelled']);

/** Allowed transitions for running status. */
const RUNNING_TRANSITIONS: ReadonlySet<JobStatus> = new Set<JobStatus>(['queued', 'succeeded', 'failed', 'dead', 'cancelled']);

/** Terminal statuses — once reached, cannot change to a different status. */
const TERMINAL_STATUSES: ReadonlySet<JobStatus> = new Set<JobStatus>(['succeeded', 'failed', 'dead', 'cancelled']);

function isTerminal(status: JobStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

export interface TransitionOptions {
  terminalReasonCode?: string | null;
  executionRetryCount?: number;
}

/**
 * CAS transition a GenerationJob from one status to another.
 *
 * Rules:
 * - queued → running | failed | dead | cancelled
 * - running → queued (exec retry) | succeeded | failed | dead | cancelled
 * - Terminal immutable: same terminal re-apply idempotent; different terminal → TERMINAL_STATE_CONFLICT
 */
export async function transitionJobStatus(
  jobRepo: GenerationJobRepo,
  jobId: string,
  fromStatus: JobStatus,
  toStatus: JobStatus,
  options?: TransitionOptions,
): Promise<GenerationJob> {
  // 1. Validate transition is allowed
  if (fromStatus === 'queued') {
    if (!QUEUED_TRANSITIONS.has(toStatus)) {
      throw new PublicUseCaseError(
        'VALIDATION',
        `Cannot transition from queued to ${toStatus}`,
      );
    }
  } else if (fromStatus === 'running') {
    if (!RUNNING_TRANSITIONS.has(toStatus)) {
      throw new PublicUseCaseError(
        'VALIDATION',
        `Cannot transition from running to ${toStatus}`,
      );
    }
  } else if (isTerminal(fromStatus)) {
    // Terminal state
    if (fromStatus === toStatus) {
      // Idempotent re-apply of same terminal
      const tCode = options?.terminalReasonCode;
      const extra = tCode !== undefined ? { terminalReasonCode: tCode } as Pick<GenerationJob, 'terminalReasonCode'> : undefined;
      const result = await jobRepo.reapplyTerminal(jobId, toStatus, extra);
      if (result) return result;
      throw new InternalUseCaseError('INTERNAL', 'Failed to reapply terminal status');
    } else {
      throw new PublicUseCaseError(
        'TERMINAL_STATE_CONFLICT',
        `Job is in terminal state '${fromStatus}' and cannot transition to '${toStatus}'`,
      );
    }
  } else {
    throw new PublicUseCaseError(
      'VALIDATION',
      `Invalid transition: ${fromStatus} -> ${toStatus}`,
    );
  }

  // 2. Perform CAS transition
  const terminalReasonCode = options?.terminalReasonCode ?? null;
  
  const extra: Partial<Pick<GenerationJob, 'terminalAt' | 'terminalReasonCode' | 'executionRetryCount'>> = {};
  if (isTerminal(toStatus)) {
    extra.terminalReasonCode = terminalReasonCode;
  }
  if (options?.executionRetryCount !== undefined) {
    extra.executionRetryCount = options.executionRetryCount;
  }

  const job = await jobRepo.transitionStatus(jobId, fromStatus, toStatus, extra);
  if (!job) {
    // Check why it failed
    const currentJob = await jobRepo.findById(jobId);
    if (!currentJob) {
      throw new PublicUseCaseError('NOT_FOUND', 'Job not found');
    }
    if (isTerminal(currentJob.status) && currentJob.status !== toStatus) {
      throw new PublicUseCaseError(
        'TERMINAL_STATE_CONFLICT',
        `Job is already in terminal state '${currentJob.status}'. Cannot transition to '${toStatus}'.`,
      );
    }
    throw new PublicUseCaseError(
      'CAS_CONFLICT',
      `Failed to transition job from '${fromStatus}' to '${toStatus}' — current status is '${currentJob.status}'`,
    );
  }

  return job;
}

/**
 * Transition a running job back to queued (execution retry).
 * Increments executionRetryCount and validates against maxExecutionRetries.
 */
export async function executionRetry(
  jobRepo: GenerationJobRepo,
  jobId: string,
): Promise<GenerationJob> {
  const job = await jobRepo.findById(jobId);
  if (!job) {
    throw new PublicUseCaseError('NOT_FOUND', 'Job not found');
  }

  if (job.status !== 'running') {
    throw new PublicUseCaseError(
      'VALIDATION',
      `Cannot execution-retry a job in '${job.status}' status`,
    );
  }

  if (job.executionRetryCount >= job.maxExecutionRetries) {
    // Transfer to failed instead
    return transitionJobStatus(jobRepo, jobId, 'running', 'failed', {
      terminalReasonCode: 'max_execution_retries_exceeded',
    });
  }

  return transitionJobStatus(jobRepo, jobId, 'running', 'queued', {
    executionRetryCount: job.executionRetryCount + 1,
  });
}
