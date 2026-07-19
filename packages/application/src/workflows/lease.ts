import { randomBytes } from 'node:crypto';
import type { GenerationJob, GenerationJobRepo, GenerationAttemptRepo, WorkflowInvocationRepo, AttemptCostExposureRepo, CreditReservationRepo, UserConcurrencySlotRepo } from '../ports/operational-ports.js';
import { PublicUseCaseError, InternalUseCaseError } from '@narraza/shared';

/**
 * Claim a queued job for execution.
 * Uses FOR UPDATE SKIP LOCKED to atomically pick up the job.
 */
export async function claimJob(
  jobRepo: GenerationJobRepo,
  jobId: string,
  leaseOwner: string,
  leaseDurationMs: number = 60000,
): Promise<GenerationJob> {
  const leaseToken = randomBytes(16).toString('hex');
  const leaseExpiresAt = new Date(Date.now() + leaseDurationMs);

  const job = await jobRepo.findById(jobId);
  if (!job) {
    throw new PublicUseCaseError('NOT_FOUND', 'Job not found');
  }

  // Determine current lease version
  const leaseVersion = job.leaseVersion + 1;

  // Try claim
  const claimed = await jobRepo.claimJob(jobId, leaseToken, leaseVersion, leaseExpiresAt, leaseOwner);
  if (!claimed) {
    // Check if already claimed by someone else
    const currentJob = await jobRepo.findById(jobId);
    if (currentJob?.status === 'running') {
      throw new PublicUseCaseError(
        'CONFLICT',
        `Job is already claimed by ${currentJob.leaseOwner ?? 'unknown'}`,
      );
    }
    throw new PublicUseCaseError('CAS_CONFLICT', 'Failed to claim job');
  }

  return claimed;
}

/**
 * Reclaim a job whose lease has expired.
 * Only allowed if leaseExpiresAt < NOW() and status is still 'running'.
 */
export async function reclaimExpiredLease(
  jobRepo: GenerationJobRepo,
  jobId: string,
  leaseOwner: string,
  leaseDurationMs: number = 60000,
): Promise<GenerationJob> {
  const job = await jobRepo.findById(jobId);
  if (!job) {
    throw new PublicUseCaseError('NOT_FOUND', 'Job not found');
  }

  if (job.status !== 'running') {
    throw new PublicUseCaseError('VALIDATION', 'Cannot reclaim non-running job');
  }

  if (!job.leaseExpiresAt) {
    throw new PublicUseCaseError('VALIDATION', 'Job has no lease to reclaim');
  }

  if (job.leaseExpiresAt >= new Date()) {
    throw new PublicUseCaseError(
      'VALIDATION',
      'Lease has not expired yet — cannot reclaim',
    );
  }

  const leaseToken = randomBytes(16).toString('hex');
  const leaseVersion = job.leaseVersion + 1;
  const leaseExpiresAt = new Date(Date.now() + leaseDurationMs);

  const reclaimed = await jobRepo.reclaimExpired(
    jobId, leaseToken, leaseVersion, leaseExpiresAt, leaseOwner,
  );

  if (!reclaimed) {
    throw new PublicUseCaseError('CAS_CONFLICT', 'Failed to reclaim lease — job may have been reclaimed concurrently');
  }

  return reclaimed;
}

/**
 * Validate that the caller still holds the lease.
 * Zoombie after lease loss is rejected.
 */
export function assertLease(
  job: GenerationJob,
  expectedLeaseToken: string,
  expectedLeaseVersion: number,
): void {
  if (job.leaseToken !== expectedLeaseToken) {
    throw new PublicUseCaseError(
      'FORBIDDEN',
      `Lease token mismatch: expected ${expectedLeaseToken.slice(0, 8)}..., got ${(job.leaseToken ?? '').slice(0, 8)}...`,
    );
  }

  if (job.leaseVersion !== expectedLeaseVersion) {
    throw new PublicUseCaseError(
      'FORBIDDEN',
      `Lease version mismatch: expected ${expectedLeaseVersion}, got ${job.leaseVersion}`,
    );
  }

  if (job.leaseExpiresAt && job.leaseExpiresAt < new Date()) {
    throw new PublicUseCaseError(
      'FORBIDDEN',
      'Lease has expired — cannot publish',
    );
  }
}

/**
 * Publish under lease fence: re-fetch the job, assert lease still matches,
 * then do the write.
 *
 * This is "Tx C" from the design — the final transaction that publishes
 * candidates/proposals under the lease fence.
 */
export async function publishUnderLease<T>(
  jobRepo: GenerationJobRepo,
  jobId: string,
  leaseToken: string,
  leaseVersion: number,
  fn: (job: GenerationJob) => Promise<T>,
): Promise<T> {
  // Re-fetch to check lease
  const job = await jobRepo.findById(jobId);
  if (!job) {
    throw new PublicUseCaseError('NOT_FOUND', 'Job not found');
  }

  assertLease(job, leaseToken, leaseVersion);

  // Execute the publish function
  return fn(job);
}

/**
 * Convert the validated generation job lease into an extended lease.
 */
export interface LeaseInfo {
  leaseToken: string;
  leaseVersion: number;
  leaseExpiresAt: Date;
  leaseOwner: string;
}

/**
 * Renew the lease (extend expiry).
 */
export async function renewLease(
  jobRepo: GenerationJobRepo,
  jobId: string,
  leaseToken: string,
  leaseVersion: number,
  leaseDurationMs: number = 60000,
): Promise<GenerationJob> {
  const job = await jobRepo.findById(jobId);
  if (!job) {
    throw new PublicUseCaseError('NOT_FOUND', 'Job not found');
  }

  assertLease(job, leaseToken, leaseVersion);

  const newExpiry = new Date(Date.now() + leaseDurationMs);
  const updated = await jobRepo.updateLease(jobId, leaseToken, leaseVersion, newExpiry);
  if (!updated) {
    throw new PublicUseCaseError('CAS_CONFLICT', 'Failed to renew lease');
  }

  return updated;
}

export function generateLeaseToken(): string {
  return randomBytes(16).toString('hex');
}
