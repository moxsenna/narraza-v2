/**
 * M3 Operational ports: Credit, Jobs, Workflow Invocations, Reservations, Attempts.
 */
import type { TransactionPorts } from '../unit-of-work.js';

// =============================================================================
// DTOs
// =============================================================================

export interface CreditQuote {
  id: string;
  ownerUserId: string;
  workflowPlanHash: string;
  dependencyHash: string;
  estimatedMaximumMicroIdr: bigint;
  expiresAt: Date;
  consumedByJobId: string | null;
  status: 'issued' | 'consumed' | 'expired';
  createdAt: Date;
  updatedAt: Date;
}

export interface CreditQuoteInput {
  ownerUserId: string;
  workflowPlanHash: string;
  dependencyHash: string;
  estimatedMaximumMicroIdr: bigint;
  expiresAt: Date;
}

export interface GenerationJob {
  id: string;
  ownerUserId: string;
  projectId: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'dead' | 'cancelled';
  jobType: string;
  payloadJson: Record<string, unknown>;
  runAfter: Date;
  priority: number;
  leaseToken: string | null;
  leaseVersion: number;
  leaseExpiresAt: Date | null;
  leaseOwner: string | null;
  cancelRequestedAt: Date | null;
  executionRetryCount: number;
  maxExecutionRetries: number;
  terminalAt: Date | null;
  terminalReasonCode: string | null;
  conflictKey: string | null;
  requestId: string;
  workflowPlanId: string | null;
  contextBundleId: string | null;
  reservationId: string | null;
  retryOfJobId: string | null;
  nextAttemptNumber: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateGenerationJobInput {
  ownerUserId: string;
  projectId: string;
  jobType: string;
  payloadJson: Record<string, unknown>;
  runAfter?: Date;
  priority?: number;
  conflictKey?: string | null;
  requestId: string;
  workflowPlanId?: string | null;
  contextBundleId?: string | null;
  reservationId?: string | null;
  maxExecutionRetries?: number;
}

export interface GenerationAttempt {
  id: string;
  generationJobId: string;
  workflowInvocationId: string | null;
  status: 'started' | 'completed' | 'failed' | 'unknown';
  attemptNumber: number;
  leaseToken: string | null;
  deadlineAt: Date | null;
  retryDisposition: string | null;
  providerRequestId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateGenerationAttemptInput {
  generationJobId: string;
  workflowInvocationId?: string | null;
  attemptNumber: number;
  leaseToken?: string | null;
  deadlineAt?: Date | null;
  providerRequestId?: string | null;
}

export interface WorkflowInvocation {
  id: string;
  generationJobId: string;
  routingStage: string;
  invocationKey: string;
  selectedAttemptId: string | null;
  status: 'pending' | 'started' | 'completed' | 'failed' | 'timed_out';
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWorkflowInvocationInput {
  generationJobId: string;
  routingStage: string;
  invocationKey: string;
}

export interface CreditReservation {
  id: string;
  jobId: string;
  userId: string;
  reservedAmount: bigint;
  settledAmount: bigint;
  releasedAmount: bigint;
  status: 'reserved' | 'closing' | 'closed';
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCreditReservationInput {
  jobId: string;
  userId: string;
  reservedAmount: bigint;
}

export interface AttemptCostExposure {
  id: string;
  generationAttemptId: string;
  reservationId: string;
  estimatedAmountMicro: bigint;
  actualAmountMicro: bigint | null;
  status: 'open' | 'settled' | 'released';
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAttemptCostExposureInput {
  generationAttemptId: string;
  reservationId: string;
  estimatedAmountMicro: bigint;
}

export interface UserConcurrencySlot {
  id: string;
  userId: string;
  jobId: string;
  slotKey: string;
  acquiredAt: Date;
  releasedAt: Date | null;
}

export interface CreateUserConcurrencySlotInput {
  userId: string;
  jobId: string;
  slotKey: string;
}

// =============================================================================
// Repo interfaces
// =============================================================================

export interface CreditQuoteRepo {
  create(input: CreditQuoteInput): Promise<CreditQuote>;
  findById(id: string): Promise<CreditQuote | null>;
  findByIdAndOwner(id: string, ownerUserId: string): Promise<CreditQuote | null>;
  /** CAS consume: only if status='issued' and consumedByJobId is null. Returns updated row or null. */
  consumeIfValid(id: string, consumedByJobId: string): Promise<CreditQuote | null>;
  /** Mark expired: only if status='issued' and expired. Returns updated row or null. */
  markExpired(id: string): Promise<CreditQuote | null>;
  listExpiredUnconsumed(now: Date): Promise<CreditQuote[]>;
}

export interface GenerationJobRepo {
  create(input: CreateGenerationJobInput): Promise<GenerationJob>;
  findById(id: string): Promise<GenerationJob | null>;
  findByRequestId(requestId: string): Promise<GenerationJob | null>;
  findActiveByConflictKey(ownerUserId: string, conflictKey: string): Promise<GenerationJob | null>;
  /** CAS: transition from one status to another. Returns updated row or null on conflict. */
  transitionStatus(
    id: string,
    fromStatus: GenerationJob['status'],
    toStatus: GenerationJob['status'],
    extra?: Partial<Pick<GenerationJob, 'terminalAt' | 'terminalReasonCode' | 'executionRetryCount'>>,
  ): Promise<GenerationJob | null>;
  /** CAS: same-terminal idempotent re-apply. Returns row if still in same terminal state. */
  reapplyTerminal(
    id: string,
    terminalStatus: GenerationJob['status'],
    extra?: Partial<Pick<GenerationJob, 'terminalAt' | 'terminalReasonCode'>>,
  ): Promise<GenerationJob | null>;
  /** CAS: claim job for lease. Returns updated row or null. */
  claimJob(
    id: string,
    leaseToken: string,
    leaseVersion: number,
    leaseExpiresAt: Date,
    leaseOwner: string,
  ): Promise<GenerationJob | null>;
  /** CAS: force re-claim expired lease. */
  reclaimExpired(
    id: string,
    leaseToken: string,
    leaseVersion: number,
    leaseExpiresAt: Date,
    leaseOwner: string,
  ): Promise<GenerationJob | null>;
  /** Update the lease token and version after a successful publish. */
  updateLease(id: string, leaseToken: string, leaseVersion: number, leaseExpiresAt: Date): Promise<GenerationJob | null>;
  /** Get nextAttemptNumber and increment atomically. */
  incrementAttemptNumber(id: string): Promise<number | null>;
  /** Mark cancel requested. */
  setCancelRequested(id: string): Promise<GenerationJob | null>;
  /** List queued jobs for polling. */
  pollQueued(limit: number): Promise<GenerationJob[]>;
  /** List running jobs with expired leases for reaping. */
  listExpiredLease(limit: number): Promise<GenerationJob[]>;
}

export interface GenerationAttemptRepo {
  create(input: CreateGenerationAttemptInput): Promise<GenerationAttempt>;
  findById(id: string): Promise<GenerationAttempt | null>;
  findByJobId(generationJobId: string): Promise<GenerationAttempt[]>;
  findStartedByJobId(generationJobId: string): Promise<GenerationAttempt[]>;
  updateStatus(
    id: string,
    status: GenerationAttempt['status'],
    extra?: Partial<Pick<GenerationAttempt, 'retryDisposition' | 'deadlineAt'>>,
  ): Promise<GenerationAttempt | null>;
  /** CAS finalize: only if status='started', set to newStatus. */
  finalize(
    id: string,
    newStatus: GenerationAttempt['status'],
    extra?: Partial<Pick<GenerationAttempt, 'retryDisposition'>>,
  ): Promise<GenerationAttempt | null>;
  /** List attempts for reconciliation that are started/unknown. */
  listForReconciliation(generationJobId: string): Promise<GenerationAttempt[]>;
}

export interface WorkflowInvocationRepo {
  create(input: CreateWorkflowInvocationInput): Promise<WorkflowInvocation>;
  findById(id: string): Promise<WorkflowInvocation | null>;
  findByJobStageAndKey(generationJobId: string, routingStage: string, invocationKey: string): Promise<WorkflowInvocation | null>;
  findByJobId(generationJobId: string): Promise<WorkflowInvocation[]>;
  /** CAS select winner: only if selectedAttemptId is null. Returns updated row or null. */
  selectWinnerAttempt(id: string, attemptId: string): Promise<WorkflowInvocation | null>;
  /** CAS update status. */
  updateStatus(id: string, status: WorkflowInvocation['status']): Promise<WorkflowInvocation | null>;
}

export interface CreditReservationRepo {
  create(input: CreateCreditReservationInput): Promise<CreditReservation>;
  findById(id: string): Promise<CreditReservation | null>;
  findByJobId(jobId: string): Promise<CreditReservation | null>;
  /** CAS: update status. */
  updateStatus(id: string, status: CreditReservation['status']): Promise<CreditReservation | null>;
  /** CAS: safe release. Only if reservedAmount >= settledAmount + releasedAmount + amount. */
  safeRelease(id: string, amount: bigint): Promise<CreditReservation | null>;
  /** CAS: settle. Only if reservedAmount >= settledAmount + releasedAmount + amount. */
  settle(id: string, amount: bigint): Promise<CreditReservation | null>;
}

export interface AttemptCostExposureRepo {
  create(input: CreateAttemptCostExposureInput): Promise<AttemptCostExposure>;
  findById(id: string): Promise<AttemptCostExposure | null>;
  findByReservationId(reservationId: string): Promise<AttemptCostExposure[]>;
  findByAttemptId(generationAttemptId: string): Promise<AttemptCostExposure[]>;
  listOpenByReservationId(reservationId: string): Promise<AttemptCostExposure[]>;
  /** Update status + actual amount. */
  settle(id: string, actualAmountMicro: bigint): Promise<AttemptCostExposure | null>;
  /** Release (no cost). */
  release(id: string): Promise<AttemptCostExposure | null>;
}

export interface UserConcurrencySlotRepo {
  create(input: CreateUserConcurrencySlotInput): Promise<UserConcurrencySlot>;
  findByJobId(jobId: string): Promise<UserConcurrencySlot | null>;
  findByUserId(userId: string): Promise<UserConcurrencySlot[]>;
  /** Release a slot (set releasedAt = NOW()). */
  release(id: string): Promise<UserConcurrencySlot | null>;
  /** Release all slots for a job. */
  releaseByJobId(jobId: string): Promise<number>;
}

// =============================================================================
// Combined operational transaction ports
// =============================================================================

export interface OperationalTxPorts {
  creditQuoteRepo: CreditQuoteRepo;
  generationJobRepo: GenerationJobRepo;
  generationAttemptRepo: GenerationAttemptRepo;
  workflowInvocationRepo: WorkflowInvocationRepo;
  creditReservationRepo: CreditReservationRepo;
  attemptCostExposureRepo: AttemptCostExposureRepo;
  concurrencySlotRepo: UserConcurrencySlotRepo;
}

/** Full transaction ports including both existing domain repos and operational repos. */
export interface FullTxPorts extends TransactionPorts, OperationalTxPorts {}
