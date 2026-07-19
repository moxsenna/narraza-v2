import type { GenerationJobRepo, GenerationJob } from '../../ports/operational-ports.js';
import { PublicUseCaseError } from '@narraza/shared';

export interface RetryJobInput {
  originalJobId: string;
  requestedBy: string;
  requestId: string;
  /** Optional parameter overrides for the retry job */
  priority?: number;
  maxExecutionRetries?: number;
}

export interface RetryJobOutput {
  newJobId: string;
  originalJobId: string;
}

/**
 * Create a new job row as a manual retry of a terminal job.
 *
 * Rules:
 * - Original job MUST be terminal (succeeded, failed, dead, cancelled)
 * - New job row created with retryOfJobId set to the original job ID
 * - Never requeue a terminal job in-place
 * - The new job copies relevant fields from the original
 */
export async function retryJob(
  jobRepo: GenerationJobRepo,
  input: RetryJobInput,
): Promise<RetryJobOutput> {
  const originalJob = await jobRepo.findById(input.originalJobId);
  if (!originalJob) {
    throw new PublicUseCaseError('NOT_FOUND', 'Original job not found');
  }

  const terminalStatuses: GenerationJob['status'][] = ['succeeded', 'failed', 'dead', 'cancelled'];

  if (!terminalStatuses.includes(originalJob.status)) {
    throw new PublicUseCaseError(
      'VALIDATION',
      `Cannot retry a non-terminal job (status: ${originalJob.status}). ` +
        `Only terminal jobs can be retried.`,
    );
  }

  // Check for duplicate requestId
  const existingByRequest = await jobRepo.findByRequestId(input.requestId);
  if (existingByRequest) {
    throw new PublicUseCaseError('CONFLICT', 'A job with this request ID already exists');
  }

  // Create new job row linked to original
  const newJob = await jobRepo.create({
    ownerUserId: originalJob.ownerUserId,
    projectId: originalJob.projectId,
    jobType: originalJob.jobType,
    payloadJson: originalJob.payloadJson,
    requestId: input.requestId,
    workflowPlanId: originalJob.workflowPlanId ?? null,
    contextBundleId: originalJob.contextBundleId ?? null,
    conflictKey: originalJob.conflictKey,
    priority: input.priority ?? originalJob.priority,
    maxExecutionRetries: input.maxExecutionRetries ?? originalJob.maxExecutionRetries,
    retryOfJobId: input.originalJobId,
  });

  return {
    newJobId: newJob.id,
    originalJobId: input.originalJobId,
  };
}
