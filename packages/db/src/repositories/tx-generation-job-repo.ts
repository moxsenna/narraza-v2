import type { Prisma } from '@prisma/client';
import type { GenerationJob, CreateGenerationJobInput, GenerationJobRepo } from '@narraza/application';

type TxClient = Prisma.TransactionClient;

export function createTxGenerationJobRepo(tx: TxClient): GenerationJobRepo {
  function toDTO(row: any): GenerationJob {
    return {
      id: row.id, ownerUserId: row.ownerUserId, projectId: row.projectId,
      status: row.status as GenerationJob['status'],
      jobType: row.jobType, payloadJson: row.payloadJson as Record<string, unknown>,
      runAfter: row.runAfter, priority: row.priority,
      leaseToken: row.leaseToken, leaseVersion: row.leaseVersion,
      leaseExpiresAt: row.leaseExpiresAt, leaseOwner: row.leaseOwner,
      cancelRequestedAt: row.cancelRequestedAt,
      executionRetryCount: row.executionRetryCount, maxExecutionRetries: row.maxExecutionRetries,
      terminalAt: row.terminalAt, terminalReasonCode: row.terminalReasonCode,
      conflictKey: row.conflictKey, requestId: row.requestId,
      workflowPlanId: row.workflowPlanId, contextBundleId: row.contextBundleId,
      reservationId: row.reservationId, retryOfJobId: row.retryOfJobId,
      nextAttemptNumber: row.nextAttemptNumber,
      createdAt: row.createdAt, updatedAt: row.updatedAt,
    };
  }

  return {
    async create(input: CreateGenerationJobInput): Promise<GenerationJob> {
      const row = await tx.generationJob.create({
        data: {
          ownerUserId: input.ownerUserId, projectId: input.projectId, jobType: input.jobType,
          payloadJson: input.payloadJson as any, runAfter: input.runAfter ?? new Date(),
          priority: input.priority ?? 0, conflictKey: input.conflictKey ?? null,
          requestId: input.requestId, workflowPlanId: input.workflowPlanId ?? null,
          contextBundleId: input.contextBundleId ?? null,
          reservationId: input.reservationId ?? null,
          maxExecutionRetries: input.maxExecutionRetries ?? 3,
        },
      });
      return toDTO(row);
    },
    async findById(id: string): Promise<GenerationJob | null> {
      const row = await tx.generationJob.findUnique({ where: { id } });
      return row ? toDTO(row) : null;
    },
    async findByRequestId(requestId: string): Promise<GenerationJob | null> {
      const row = await tx.generationJob.findUnique({ where: { requestId } });
      return row ? toDTO(row) : null;
    },
    async findActiveByConflictKey(ownerUserId: string, conflictKey: string): Promise<GenerationJob | null> {
      const row = await tx.generationJob.findFirst({
        where: { ownerUserId, conflictKey, status: { in: ['queued', 'running'] } },
      });
      return row ? toDTO(row) : null;
    },
    async transitionStatus(
      id: string, fromStatus: GenerationJob['status'], toStatus: GenerationJob['status'],
      extra?: Partial<Pick<GenerationJob, 'terminalAt' | 'terminalReasonCode' | 'executionRetryCount'>>,
    ): Promise<GenerationJob | null> {
      const terminalStatuses: GenerationJob['status'][] = ['succeeded', 'failed', 'dead', 'cancelled'];
      const isTerminal = terminalStatuses.includes(toStatus);
      const data: Record<string, unknown> = { status: toStatus };
      if (isTerminal) { data.terminalAt = extra?.terminalAt ?? new Date(); data.terminalReasonCode = extra?.terminalReasonCode ?? null; }
      if (extra?.executionRetryCount !== undefined) data.executionRetryCount = extra.executionRetryCount;
      try {
        const row = await tx.generationJob.update({ where: { id, status: fromStatus }, data: data as any });
        return toDTO(row);
      } catch { return null; }
    },
    async reapplyTerminal(
      id: string, terminalStatus: GenerationJob['status'],
      extra?: Partial<Pick<GenerationJob, 'terminalAt' | 'terminalReasonCode'>>,
    ): Promise<GenerationJob | null> {
      const terminalStatuses: GenerationJob['status'][] = ['succeeded', 'failed', 'dead', 'cancelled'];
      if (!terminalStatuses.includes(terminalStatus)) return null;
      const row = await tx.generationJob.findUnique({ where: { id } });
      if (!row || row.status !== terminalStatus) return null;
      const data: Record<string, unknown> = {};
      if (extra?.terminalAt !== undefined) data.terminalAt = extra.terminalAt;
      if (extra?.terminalReasonCode !== undefined) data.terminalReasonCode = extra.terminalReasonCode;
      if (Object.keys(data).length > 0) {
        const updated = await tx.generationJob.update({ where: { id }, data: data as any });
        return toDTO(updated);
      }
      return toDTO(row);
    },
    async claimJob(id: string, leaseToken: string, leaseVersion: number, leaseExpiresAt: Date, leaseOwner: string): Promise<GenerationJob | null> {
      try {
        const rows = await tx.$queryRawUnsafe<any[]>(
          `WITH cte AS (SELECT id FROM generation_jobs WHERE id = $1 AND status = 'queued' LIMIT 1 FOR UPDATE SKIP LOCKED)
           UPDATE generation_jobs gj SET status = 'running', lease_token = $2, lease_version = $3, lease_expires_at = $4, lease_owner = $5
           FROM cte WHERE gj.id = cte.id RETURNING *`,
          id, leaseToken, leaseVersion, leaseExpiresAt, leaseOwner,
        );
        if (!rows.length) return null;
        const r = rows[0]!;
        return toDTO({ id: r.id, ownerUserId: r.owner_user_id, projectId: r.project_id, status: r.status, jobType: r.job_type, payloadJson: r.payload_json, runAfter: r.run_after, priority: r.priority, leaseToken: r.lease_token, leaseVersion: r.lease_version, leaseExpiresAt: r.lease_expires_at, leaseOwner: r.lease_owner, cancelRequestedAt: r.cancel_requested_at, executionRetryCount: r.execution_retry_count, maxExecutionRetries: r.max_execution_retries, terminalAt: r.terminal_at, terminalReasonCode: r.terminal_reason_code, conflictKey: r.conflict_key, requestId: r.request_id, workflowPlanId: r.workflow_plan_id, contextBundleId: r.context_bundle_id, reservationId: r.reservation_id, retryOfJobId: r.retry_of_job_id, nextAttemptNumber: r.next_attempt_number, createdAt: r.created_at, updatedAt: r.updated_at });
      } catch { return null; }
    },
    async reclaimExpired(id: string, leaseToken: string, leaseVersion: number, leaseExpiresAt: Date, leaseOwner: string): Promise<GenerationJob | null> {
      try {
        const rows = await tx.$queryRawUnsafe<any[]>(
          `UPDATE generation_jobs SET lease_token = $2, lease_version = $3, lease_expires_at = $4, lease_owner = $5, status = 'running'
           WHERE id = $1 AND status = 'running' AND lease_expires_at < NOW() RETURNING *`,
          id, leaseToken, leaseVersion, leaseExpiresAt, leaseOwner,
        );
        if (!rows.length) return null;
        const r = rows[0]!;
        return toDTO({ id: r.id, ownerUserId: r.owner_user_id, projectId: r.project_id, status: r.status, jobType: r.job_type, payloadJson: r.payload_json, runAfter: r.run_after, priority: r.priority, leaseToken: r.lease_token, leaseVersion: r.lease_version, leaseExpiresAt: r.lease_expires_at, leaseOwner: r.lease_owner, cancelRequestedAt: r.cancel_requested_at, executionRetryCount: r.execution_retry_count, maxExecutionRetries: r.max_execution_retries, terminalAt: r.terminal_at, terminalReasonCode: r.terminal_reason_code, conflictKey: r.conflict_key, requestId: r.request_id, workflowPlanId: r.workflow_plan_id, contextBundleId: r.context_bundle_id, reservationId: r.reservation_id, retryOfJobId: r.retry_of_job_id, nextAttemptNumber: r.next_attempt_number, createdAt: r.created_at, updatedAt: r.updated_at });
      } catch { return null; }
    },
    async updateLease(id: string, leaseToken: string, leaseVersion: number, leaseExpiresAt: Date): Promise<GenerationJob | null> {
      try {
        const row = await tx.generationJob.update({ where: { id }, data: { leaseToken, leaseVersion, leaseExpiresAt } });
        return toDTO(row);
      } catch { return null; }
    },
    async incrementAttemptNumber(id: string): Promise<number | null> {
      try {
        const row = await tx.generationJob.update({ where: { id }, data: { nextAttemptNumber: { increment: 1 } } });
        return row.nextAttemptNumber - 1;
      } catch { return null; }
    },
    async setCancelRequested(id: string): Promise<GenerationJob | null> {
      try {
        const row = await tx.generationJob.update({ where: { id }, data: { cancelRequestedAt: new Date() } });
        return toDTO(row);
      } catch { return null; }
    },
    async pollQueued(limit: number): Promise<GenerationJob[]> {
      const rows = await tx.generationJob.findMany({
        where: { status: 'queued' }, orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }], take: limit,
      });
      return rows.map(toDTO);
    },
    async listExpiredLease(limit: number): Promise<GenerationJob[]> {
      const rows = await tx.generationJob.findMany({
        where: { status: 'running', leaseExpiresAt: { lt: new Date() } }, take: limit,
      });
      return rows.map(toDTO);
    },
  };
}
