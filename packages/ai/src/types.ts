// @narraza/ai — types for AI execution port
// No ledger, no artifact storage, no @narraza/db, no @prisma/client

import type { z } from 'zod';

/** Frozen AI workflow plan with per-stage routing info. */
export interface AIWorkflowPlan {
  planId: string;
  stages: WorkflowStage[];
  createdAt: string;
}

export interface WorkflowStage {
  stageName: string;
  routingPlan: RoutingPlan;
  /** Contract version string, e.g. "intake.extract.v1" */
  promptContractVersion: string;
  /** Maximum number of invocations for this stage */
  maxInvocations: number;
}

export interface RoutingPlan {
  provider: string;
  modelId: string;
  /** structured | text */
  mode: string;
  timeoutMs: number;
  /** Snapshot of model price at plan creation time */
  priceSnapshotId?: string;
}

/** Result of a single AI provider call. */
export interface SingleAttemptResponse {
  attemptId: string;
  stageName: string;
  invocationKey: string;
  /** Raw response body from provider (JSON string or text) */
  rawBody: string;
  /** Provider-reported usage metadata */
  usage?: ProviderUsage;
  /** Provider request ID for reconciliation */
  providerRequestId?: string;
  /** When the call completed */
  completedAt: string;
}

export interface ProviderUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  costMicroIdr?: bigint;
}

/** Normalized error from provider calls */
export interface NormalizedProviderError {
  errorCode: string;
  message: string;
  retryable: boolean;
  /** Provider-specific error payload */
  providerDetail?: unknown;
  /** Suggested next stage or null if terminal */
  retryStage?: string | null;
}

/** Next action decision after an attempt */
export type NextAction = {
  type: 'next_candidate';
  invocationKey: string;
} | {
  type: 'terminal';
  reason: string;
} | {
  type: 'parse_repair';
  invocationKey: string;
};

/** The AIExecutionPort — what application code calls */
export interface AIExecutionPort {
  /** Build a frozen workflow plan for a given job type and context. */
  buildWorkflowPlan(params: BuildWorkflowPlanParams): AIWorkflowPlan;

  /** Execute exactly one provider call. No internal retry/fallback. */
  executeSingleAttempt(params: ExecuteSingleAttemptParams): Promise<SingleAttemptResponse>;

  /** Parse raw output against a Zod contract. */
  parseOutput<T>(contract: z.ZodType<T>, rawBody: string): T;

  /** Classify a provider error into a NormalizedProviderError. */
  classifyError(error: unknown): NormalizedProviderError;

  /** Decide what to do after an attempt completes or fails. */
  decideNextAction(
    attempt: SingleAttemptResponse | null,
    error: NormalizedProviderError | null,
    workflowPlan: AIWorkflowPlan,
    currentInvocationKey: string,
  ): NextAction;
}

export interface BuildWorkflowPlanParams {
  jobType: string;
  projectId: string;
  /** Additional context for plan selection */
  context?: Record<string, unknown>;
}

export interface ExecuteSingleAttemptParams {
  workflowPlan: AIWorkflowPlan;
  stageName: string;
  invocationKey: string;
  /** The prompt contract version, used to select prompt template */
  promptContractVersion: string;
  /** Already-serialized prompt payload for the model */
  promptPayload: Record<string, unknown>;
}
