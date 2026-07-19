import type { GenerationJob, CreateGenerationJobInput, GenerationJobRepo } from '@narraza/application';
import { getPrisma } from '../client.js';

export function createGenerationJobRepo(): GenerationJobRepo {
  const prisma = getPrisma();

  function toDTO(row: Record<string, unknown>): GenerationJob {
    return {
      id: row.id as string,
      ownerUserId: row.ownerUserId as string,
      projectId: row.projectId as string,
      status: row.status as GenerationJob['status'],
      jobType: row.jobType as string,
      payloadJson: row.payloadJson as Record<string, unknown>,
      runAfter: row.runAfter as Date,
      priority: row.priority as number,
      leaseToken: row.leaseToken as string | null,
      leaseVersion: row.leaseVersion as number,
      leaseExpiresAt: row.leaseExpiresAt as Date | null,
      leaseOwner: row.leaseOwner as string | null,
      cancelRequestedAt: row.cancelRequestedAt as Date | null,
      executionRetryCount: row.executionRetryCount as number,
      maxExecutionRetries: row.maxExecutionRetries as number,
      terminalAt: row.terminalAt as Date | null,
      terminalReasonCode: row.terminalReasonCode as string | null,
      conflictKey: row.conflictKey as string | null,
      requestId: row.requestId as string,
      workflowPlanId: row.workflowPlanId as string | null,
      contextBundleId: row.contextBundleId as string | null,
      reservationId: row.reservationId as string | null,
      retryOfJobId: row.retryOfJobId as string | null,
      nextAttemptNumber: row.nextAttemptNumber as number,
      createdAt: row.createdAt as Date,
      updatedAt: row.updatedAt as Date,
    };
  }

  return {
    async create(input: CreateGenerationJobInput): Promise<GenerationJob> {
      const row = await prisma.generationJob.create({
        data: {
          ownerUserId: input.ownerUserId,
          projectId: input.projectId,
          jobType: input.jobType,
          payloadJson: input.payloadJson as any,
          runAfter: input.runAfter ?? new Date(),
          priority: input.priority ?? 0,
          conflictKey: input.conflictKey ?? null,
          requestId: input.requestId,
          workflowPlanId: input.workflowPlanId ?? null,
          contextBundleId: input.contextBundleId ?? null,
          reservationId: input.reservationId ?? null,
          maxExecutionRetries: input.maxExecutionRetries ?? 3,
        },
      });
      return toDTO(row as unknown as Record<string, unknown>);
    },

    async findById(id: string): Promise<GenerationJob | null> {
      const row = await prisma.generationJob.findUnique({ where: { id } });
      return row ? toDTO(row as unknown as Record<string, unknown>) : null;
    },

    async findByRequestId(requestId: string): Promise<GenerationJob | null> {
      const row = await prisma.generationJob.findUnique({ where: { requestId } });
      return row ? toDTO(row as unknown as Record<string, unknown>) : null;
    },

    async findActiveByConflictKey(ownerUserId: string, conflictKey: string): Promise<GenerationJob | null> {
      const row = await prisma.generationJob.findFirst({
        where: {
          ownerUserId,
          conflictKey,
          status: { in: ['queued', 'running'] },
        },
      });
      return row ? toDTO(row as unknown as Record<string, unknown>) : null;
    },

    async transitionStatus(
      id: string,
      fromStatus: GenerationJob['status'],
      toStatus: GenerationJob['status'],
      extra?: Partial<Pick<GenerationJob, 'terminalAt' | 'terminalReasonCode' | 'executionRetryCount'>>,
    ): Promise<GenerationJob | null> {
      const terminalStatuses: GenerationJob['status'][] = ['succeeded', 'failed', 'dead', 'cancelled'];
      const isTerminal = terminalStatuses.includes(toStatus);

      // Prevent changing from terminal unless idempotent same-terminal
      const data: Record<string, unknown> = { status: toStatus };
      if (isTerminal) {
        data.terminalAt = extra?.terminalAt ?? new Date();
        data.terminalReasonCode = extra?.terminalReasonCode ?? null;
      }
      if (extra?.executionRetryCount !== undefined) {
        data.executionRetryCount = extra.executionRetryCount;
      }

      try {
        const row = await prisma.generationJob.update({
          where: { id, status: fromStatus },
          data: data as any,
        });
        return toDTO(row as unknown as Record<string, unknown>);
      } catch {
        return null;
      }
    },

    async reapplyTerminal(
      id: string,
      terminalStatus: GenerationJob['status'],
      extra?: Partial<Pick<GenerationJob, 'terminalAt' | 'terminalReasonCode'>>,
    ): Promise<GenerationJob | null> {
      const terminalStatuses: GenerationJob['status'][] = ['succeeded', 'failed', 'dead', 'cancelled'];
      if (!terminalStatuses.includes(terminalStatus)) {
        return null; // not a terminal status
      }

      const row = await prisma.generationJob.findUnique({ where: { id } });
      if (!row || row.status !== terminalStatus) return null;

      // Idempotent: already in the requested terminal state
      const data: Record<string, unknown> = {};
      if (extra?.terminalAt !== undefined) {
        data.terminalAt = extra.terminalAt;
      }
      if (extra?.terminalReasonCode !== undefined) {
        data.terminalReasonCode = extra.terminalReasonCode;
      }

      if (Object.keys(data).length > 0) {
        const updated = await prisma.generationJob.update({
          where: { id },
          data: data as any,
        });
        return toDTO(updated as unknown as Record<string, unknown>);
      }

      return toDTO(row as unknown as Record<string, unknown>);
    },

    async claimJob(
      id: string,
      leaseToken: string,
      leaseVersion: number,
      leaseExpiresAt: Date,
      leaseOwner: string,
    ): Promise<GenerationJob | null> {
      try {
        const rows = await prisma.$queryRawUnsafe<any[]>(
          `WITH cte AS (
             SELECT id FROM generation_jobs
             WHERE id = $1
               AND status = 'queued'
             LIMIT 1
             FOR UPDATE SKIP LOCKED
           )
           UPDATE generation_jobs gj
           SET
             status = 'running',
             lease_token = $2,
             lease_version = $3,
             lease_expires_at = $4,
             lease_owner = $5
           FROM cte
           WHERE gj.id = cte.id
           RETURNING *`,
          id, leaseToken, leaseVersion, leaseExpiresAt, leaseOwner,
        );
        const rows2 = rows as any[];
        if (!rows2.length) return null;
        const r = rows2[0]!;
        return toDTO({
          id: r.id, ownerUserId: r.owner_user_id, projectId: r.project_id,
          status: r.status, jobType: r.job_type, payloadJson: r.payload_json,
          runAfter: r.run_after, priority: r.priority,
          leaseToken: r.lease_token, leaseVersion: r.lease_version,
          leaseExpiresAt: r.lease_expires_at, leaseOwner: r.lease_owner,
          cancelRequestedAt: r.cancel_requested_at,
          executionRetryCount: r.execution_retry_count, maxExecutionRetries: r.max_execution_retries,
          terminalAt: r.terminal_at, terminalReasonCode: r.terminal_reason_code,
          conflictKey: r.conflict_key, requestId: r.request_id,
          workflowPlanId: r.workflow_plan_id, contextBundleId: r.context_bundle_id,
          reservationId: r.reservation_id, retryOfJobId: r.retry_of_job_id,
          nextAttemptNumber: r.next_attempt_number,
          createdAt: r.created_at, updatedAt: r.updated_at,
        });
      } catch {
        return null;
      }
    },

    async reclaimExpired(
      id: string,
      leaseToken: string,
      leaseVersion: number,
      leaseExpiresAt: Date,
      leaseOwner: string,
    ): Promise<GenerationJob | null> {
      try {
        const rows = await prisma.$queryRawUnsafe<any[]>(
          `UPDATE generation_jobs
           SET
             lease_token = $2,
             lease_version = $3,
             lease_expires_at = $4,
             lease_owner = $5,
             status = 'running'
           WHERE id = $1
             AND status = 'running'
             AND lease_expires_at < NOW()
           RETURNING *`,
          id, leaseToken, leaseVersion, leaseExpiresAt, leaseOwner,
        );
        const result = rows;
        if (!result.length) return null;
        const r = result[0]!;
        return toDTO({
          id: r.id, ownerUserId: r.owner_user_id, projectId: r.project_id,
          status: r.status, jobType: r.job_type, payloadJson: r.payload_json,
          runAfter: r.run_after, priority: r.priority,
          leaseToken: r.lease_token, leaseVersion: r.lease_version,
          leaseExpiresAt: r.lease_expires_at, leaseOwner: r.lease_owner,
          cancelRequestedAt: r.cancel_requested_at,
          executionRetryCount: r.execution_retry_count, maxExecutionRetries: r.max_execution_retries,
          terminalAt: r.terminal_at, terminalReasonCode: r.terminal_reason_code,
          conflictKey: r.conflict_key, requestId: r.request_id,
          workflowPlanId: r.workflow_plan_id, contextBundleId: r.context_bundle_id,
          reservationId: r.reservation_id, retryOfJobId: r.retry_of_job_id,
          nextAttemptNumber: r.next_attempt_number,
          createdAt: r.created_at, updatedAt: r.updated_at,
        });
      } catch {
        return null;
      }
    },

    async updateLease(
      id: string,
      leaseToken: string,
      leaseVersion: number,
      leaseExpiresAt: Date,
    ): Promise<GenerationJob | null> {
      try {
        const row = await prisma.generationJob.update({
          where: { id },
          data: {
            leaseToken,
            leaseVersion,
            leaseExpiresAt,
          },
        });
        return toDTO(row as unknown as Record<string, unknown>);
      } catch {
        return null;
      }
    },

    async incrementAttemptNumber(id: string): Promise<number | null> {
      try {
        const row = await prisma.generationJob.update({
          where: { id },
          data: {
            nextAttemptNumber: { increment: 1 },
          },
        });
        // The returned nextAttemptNumber is the NEW value (post-increment).
        // For attempt numbering, we want the PREVIOUS value before increment.
        // So return newValue - 1.
        return row.nextAttemptNumber - 1;
      } catch {
        return null;
      }
    },

    async setCancelRequested(id: string): Promise<GenerationJob | null> {
      try {
        const row = await prisma.generationJob.update({
          where: { id },
          data: { cancelRequestedAt: new Date() },
        });
        return toDTO(row as unknown as Record<string, unknown>);
      } catch {
        return null;
      }
    },

    async pollQueued(limit: number): Promise<GenerationJob[]> {
      const rows = await prisma.generationJob.findMany({
        where: { status: 'queued' },
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
        take: limit,
      });
      return rows.map((r) => toDTO(r as unknown as Record<string, unknown>));
    },

    async listExpiredLease(limit: number): Promise<GenerationJob[]> {
      const rows = await prisma.generationJob.findMany({
        where: {
          status: 'running',
          leaseExpiresAt: { lt: new Date() },
        },
        take: limit,
      });
      return rows.map((r) => toDTO(r as unknown as Record<string, unknown>));
    },
  };
}
