-- CreateEnum
CREATE TYPE "GenerationJobStatus" AS ENUM ('queued', 'running', 'succeeded', 'failed', 'dead', 'cancelled');

-- CreateEnum
CREATE TYPE "GenerationAttemptStatus" AS ENUM ('started', 'completed', 'failed', 'unknown');

-- CreateEnum
CREATE TYPE "CreditReservationStatus" AS ENUM ('reserved', 'closing', 'closed');

-- CreateEnum
CREATE TYPE "AttemptCostExposureStatus" AS ENUM ('open', 'settled', 'released');

-- CreateEnum
CREATE TYPE "CreditQuoteStatus" AS ENUM ('issued', 'consumed', 'expired');

-- CreateEnum
CREATE TYPE "OutboxEventStatus" AS ENUM ('pending', 'processing', 'completed', 'dead');

-- CreateEnum
CREATE TYPE "OutboxReceiptStatus" AS ENUM ('processing', 'completed', 'uncertain', 'dead');

-- CreateEnum
CREATE TYPE "WorkflowInvocationStatus" AS ENUM ('pending', 'started', 'completed', 'failed', 'timed_out');

-- CreateEnum
CREATE TYPE "AuditEventClass" AS ENUM ('credit', 'job', 'proposal', 'canon', 'auth', 'outbox', 'system');

-- DropForeignKey
ALTER TABLE "beats" DROP CONSTRAINT "beats_accepted_prose_belongs";

-- CreateTable
CREATE TABLE "generation_jobs" (
    "id" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "status" "GenerationJobStatus" NOT NULL DEFAULT 'queued',
    "job_type" TEXT NOT NULL,
    "payload_json" JSONB NOT NULL,
    "run_after" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "lease_token" TEXT,
    "lease_version" INTEGER NOT NULL DEFAULT 0,
    "lease_expires_at" TIMESTAMPTZ(3),
    "lease_owner" TEXT,
    "cancel_requested_at" TIMESTAMPTZ(3),
    "execution_retry_count" INTEGER NOT NULL DEFAULT 0,
    "max_execution_retries" INTEGER NOT NULL DEFAULT 3,
    "terminal_at" TIMESTAMPTZ(3),
    "terminal_reason_code" TEXT,
    "conflict_key" TEXT,
    "request_id" TEXT NOT NULL,
    "workflow_plan_id" TEXT,
    "context_bundle_id" TEXT,
    "reservation_id" TEXT,
    "retry_of_job_id" TEXT,
    "next_attempt_number" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "generation_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_attempts" (
    "id" TEXT NOT NULL,
    "generation_job_id" TEXT NOT NULL,
    "workflow_invocation_id" TEXT,
    "status" "GenerationAttemptStatus" NOT NULL DEFAULT 'started',
    "attempt_number" INTEGER NOT NULL,
    "lease_token" TEXT,
    "deadline_at" TIMESTAMPTZ(3),
    "retry_disposition" TEXT,
    "provider_request_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "generation_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_invocations" (
    "id" TEXT NOT NULL,
    "generation_job_id" TEXT NOT NULL,
    "routing_stage" TEXT NOT NULL,
    "invocation_key" TEXT NOT NULL,
    "selected_attempt_id" TEXT,
    "status" "WorkflowInvocationStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "workflow_invocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_reservations" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "reserved_amount" BIGINT NOT NULL,
    "settled_amount" BIGINT NOT NULL DEFAULT 0,
    "released_amount" BIGINT NOT NULL DEFAULT 0,
    "status" "CreditReservationStatus" NOT NULL DEFAULT 'reserved',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "credit_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempt_cost_exposures" (
    "id" TEXT NOT NULL,
    "generation_attempt_id" TEXT NOT NULL,
    "reservation_id" TEXT NOT NULL,
    "estimated_amount_micro" BIGINT NOT NULL,
    "actual_amount_micro" BIGINT,
    "status" "AttemptCostExposureStatus" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "attempt_cost_exposures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_quotes" (
    "id" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "workflow_plan_hash" TEXT NOT NULL,
    "dependency_hash" TEXT NOT NULL,
    "estimated_maximum_micro_idr" BIGINT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "consumed_by_job_id" TEXT,
    "status" "CreditQuoteStatus" NOT NULL DEFAULT 'issued',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "credit_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_concurrency_slots" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "slot_key" TEXT NOT NULL,
    "acquired_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "released_at" TIMESTAMPTZ(3),

    CONSTRAINT "user_concurrency_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_events" (
    "id" TEXT NOT NULL,
    "generation_attempt_id" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "cost_micro_idr" BIGINT,
    "provider_reported_cost" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" TEXT NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "status" "OutboxEventStatus" NOT NULL DEFAULT 'pending',
    "payload" JSONB NOT NULL,
    "available_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivery_generation" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_consumer_receipts" (
    "id" TEXT NOT NULL,
    "consumer_name" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "delivery_generation" INTEGER NOT NULL,
    "status" "OutboxReceiptStatus" NOT NULL DEFAULT 'processing',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "outbox_consumer_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "event_class" "AuditEventClass" NOT NULL,
    "actor_user_id" TEXT,
    "tenant_project_id" TEXT,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "worker_instances" (
    "id" TEXT NOT NULL,
    "instance_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "last_heartbeat_at" TIMESTAMPTZ(3) NOT NULL,
    "draining" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "worker_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_price_snapshots" (
    "id" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "input_price_micro_idr" BIGINT NOT NULL,
    "output_price_micro_idr" BIGINT NOT NULL,
    "effective_at" TIMESTAMPTZ(3) NOT NULL,
    "deprecated_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_price_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prose_working_drafts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "beat_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "prose_working_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "generation_jobs_request_id_key" ON "generation_jobs"("request_id");

-- CreateIndex
CREATE INDEX "generation_jobs_owner_user_id_idx" ON "generation_jobs"("owner_user_id");

-- CreateIndex
CREATE INDEX "generation_jobs_project_id_idx" ON "generation_jobs"("project_id");

-- CreateIndex
CREATE INDEX "generation_attempts_generation_job_id_idx" ON "generation_attempts"("generation_job_id");

-- CreateIndex
CREATE INDEX "generation_attempts_workflow_invocation_id_idx" ON "generation_attempts"("workflow_invocation_id");

-- CreateIndex
CREATE INDEX "workflow_invocations_generation_job_id_idx" ON "workflow_invocations"("generation_job_id");

-- CreateIndex
CREATE INDEX "credit_reservations_job_id_idx" ON "credit_reservations"("job_id");

-- CreateIndex
CREATE INDEX "credit_reservations_user_id_idx" ON "credit_reservations"("user_id");

-- CreateIndex
CREATE INDEX "attempt_cost_exposures_generation_attempt_id_idx" ON "attempt_cost_exposures"("generation_attempt_id");

-- CreateIndex
CREATE INDEX "attempt_cost_exposures_reservation_id_idx" ON "attempt_cost_exposures"("reservation_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_quotes_consumed_by_job_id_key" ON "credit_quotes"("consumed_by_job_id");

-- CreateIndex
CREATE INDEX "credit_quotes_owner_user_id_idx" ON "credit_quotes"("owner_user_id");

-- CreateIndex
CREATE INDEX "user_concurrency_slots_user_id_idx" ON "user_concurrency_slots"("user_id");

-- CreateIndex
CREATE INDEX "outbox_consumer_receipts_event_id_idx" ON "outbox_consumer_receipts"("event_id");

-- CreateIndex
CREATE INDEX "audit_events_actor_user_id_idx" ON "audit_events"("actor_user_id");

-- CreateIndex
CREATE INDEX "audit_events_tenant_project_id_idx" ON "audit_events"("tenant_project_id");

-- CreateIndex
CREATE INDEX "audit_events_created_at_idx" ON "audit_events"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "worker_instances_instance_id_key" ON "worker_instances"("instance_id");

-- CreateIndex
CREATE INDEX "worker_instances_last_heartbeat_at_idx" ON "worker_instances"("last_heartbeat_at");

-- CreateIndex
CREATE INDEX "model_price_snapshots_model_id_provider_effective_at_idx" ON "model_price_snapshots"("model_id", "provider", "effective_at");

-- CreateIndex
CREATE INDEX "prose_working_drafts_user_id_idx" ON "prose_working_drafts"("user_id");

-- CreateIndex
CREATE INDEX "prose_working_drafts_beat_id_idx" ON "prose_working_drafts"("beat_id");

-- AddForeignKey
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_candidates" ADD CONSTRAINT "generated_candidates_generation_attempt_id_fkey" FOREIGN KEY ("generation_attempt_id") REFERENCES "generation_attempts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_context_bundle_id_fkey" FOREIGN KEY ("context_bundle_id") REFERENCES "generation_context_bundles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_retry_of_job_id_fkey" FOREIGN KEY ("retry_of_job_id") REFERENCES "generation_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_attempts" ADD CONSTRAINT "generation_attempts_generation_job_id_fkey" FOREIGN KEY ("generation_job_id") REFERENCES "generation_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_attempts" ADD CONSTRAINT "generation_attempts_workflow_invocation_id_fkey" FOREIGN KEY ("workflow_invocation_id") REFERENCES "workflow_invocations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_invocations" ADD CONSTRAINT "workflow_invocations_generation_job_id_fkey" FOREIGN KEY ("generation_job_id") REFERENCES "generation_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_reservations" ADD CONSTRAINT "credit_reservations_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "generation_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_reservations" ADD CONSTRAINT "credit_reservations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_cost_exposures" ADD CONSTRAINT "attempt_cost_exposures_generation_attempt_id_fkey" FOREIGN KEY ("generation_attempt_id") REFERENCES "generation_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_cost_exposures" ADD CONSTRAINT "attempt_cost_exposures_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "credit_reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_quotes" ADD CONSTRAINT "credit_quotes_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_quotes" ADD CONSTRAINT "credit_quotes_consumed_by_job_id_fkey" FOREIGN KEY ("consumed_by_job_id") REFERENCES "generation_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_concurrency_slots" ADD CONSTRAINT "user_concurrency_slots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_concurrency_slots" ADD CONSTRAINT "user_concurrency_slots_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "generation_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage_events" ADD CONSTRAINT "ai_usage_events_generation_attempt_id_fkey" FOREIGN KEY ("generation_attempt_id") REFERENCES "generation_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_consumer_receipts" ADD CONSTRAINT "outbox_consumer_receipts_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "outbox_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_tenant_project_id_fkey" FOREIGN KEY ("tenant_project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prose_working_drafts" ADD CONSTRAINT "prose_working_drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prose_working_drafts" ADD CONSTRAINT "prose_working_drafts_beat_id_fkey" FOREIGN KEY ("beat_id") REFERENCES "beats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================================================
-- M3.0 raw SQL: partial unique indexes, CHECK constraints, polling indexes
-- =============================================================================

-- Re-add composite FK dropped by Prisma (beats accepted prose must belong to same beat)
ALTER TABLE "beats"
  ADD CONSTRAINT "beats_accepted_prose_belongs"
  FOREIGN KEY (id, accepted_prose_version_id)
  REFERENCES prose_versions (beat_id, id)
  DEFERRABLE INITIALLY DEFERRED;

-- Conflict uniqueness: only one active job per (owner, conflict_key)
CREATE UNIQUE INDEX active_job_conflict_unique
  ON generation_jobs (owner_user_id, conflict_key)
  WHERE status IN ('queued', 'running');

-- Polling index for workers: claim next eligible job
CREATE INDEX generation_jobs_poll_idx
  ON generation_jobs (status, run_after, priority DESC, created_at ASC)
  WHERE status IN ('queued', 'running');

-- Expired lease cleanup
CREATE INDEX generation_jobs_expired_lease_idx
  ON generation_jobs (lease_expires_at)
  WHERE status = 'running';

-- One concurrency slot per job
CREATE UNIQUE INDEX user_concurrency_slot_job
  ON user_concurrency_slots (job_id);

-- Reservation amounts invariant
ALTER TABLE credit_reservations
  ADD CONSTRAINT credit_reservation_amounts_check
  CHECK (reserved_amount >= settled_amount + released_amount);

-- Outbox dedupe
CREATE UNIQUE INDEX outbox_dedupe
  ON outbox_events (dedupe_key);

-- Outbox polling: deliverable events ordered by availability
CREATE INDEX outbox_events_poll_idx
  ON outbox_events (status, available_at, created_at)
  WHERE status = 'pending';

-- Workflow invocation uniqueness per job/stage/key
CREATE UNIQUE INDEX workflow_invocation_key
  ON workflow_invocations (generation_job_id, routing_stage, invocation_key);

-- One AI usage event per attempt
CREATE UNIQUE INDEX ai_usage_attempt
  ON ai_usage_events (generation_attempt_id);

-- Consumer receipt dedupe by delivery generation
CREATE UNIQUE INDEX outbox_receipt_delivery
  ON outbox_consumer_receipts (consumer_name, event_id, delivery_generation);

-- Reconciliation index for in-flight attempts
CREATE INDEX attempts_reconcile_idx
  ON generation_attempts (generation_job_id, status, deadline_at)
  WHERE status IN ('started', 'unknown');

-- One active working draft per (user, beat)
CREATE UNIQUE INDEX prose_working_draft_user_beat
  ON prose_working_drafts (user_id, beat_id)
  WHERE deleted_at IS NULL;
