/**
 * P3.9 — Fake HTTP-backed AI provider for CI (no live OpenRouter).
 *
 * Handlers can simulate success, malformed JSON, timeout, 429, 500, etc.
 */

import { randomUUID } from 'node:crypto';
import type { z } from 'zod';
import type {
  AIExecutionPort,
  AIWorkflowPlan,
  BuildWorkflowPlanParams,
  ExecuteSingleAttemptParams,
  NextAction,
  NormalizedProviderError,
  SingleAttemptResponse,
} from './types.js';
import { requirePromptContract } from './prompt-contract-registry.js';

export type FakeProviderScenario =
  | 'success'
  | 'malformed_json'
  | 'schema_invalid'
  | 'timeout'
  | 'rate_limit'
  | 'provider_500'
  | 'auth_error'
  | 'safety_refusal'
  | 'context_too_large'
  | 'reveal_leak_prose'
  | 'cancelled_late';

export interface FakeProviderConfig {
  scenario?: FakeProviderScenario;
  /** Custom body for success */
  successBody?: string;
  /** Delay before response (ms) */
  delayMs?: number;
  /** Track calls for assertions */
  onCall?: (params: ExecuteSingleAttemptParams) => void;
  /** If true, late response after abort still "returns" to caller — tests should not persist */
  ignoreAbort?: boolean;
}

const LEAK_PROSE = JSON.stringify({
  candidates: [
    {
      candidateIndex: 1,
      prose:
        'Alya walked the foggy harbor. She realized The mayor is the cult leader. Fog rolled in.',
      suggestions: [],
    },
  ],
});

function defaultSuccessBody(promptContractVersion: string): string {
  const contract = requirePromptContract(promptContractVersion);
  // Minimal valid-ish payloads per contract — prefer registry mock generators via dynamic
  if (promptContractVersion === 'beat.write.v1') {
    return JSON.stringify({
      candidates: [
        {
          candidateIndex: 1,
          prose:
            'Alya walked the foggy harbor. The mayor avoided certain questions. She bought bread and left uneasy.',
          suggestions: [],
        },
      ],
    });
  }
  if (promptContractVersion === 'beat.repair.v1') {
    return JSON.stringify({
      repairedProse:
        'Alya walked the foggy harbor. The mayor avoided certain questions. She bought bread and left uneasy.',
      suggestions: [],
    });
  }
  if (promptContractVersion === 'beat.judge.v1') {
    return JSON.stringify({
      passed: true,
      findings: [],
    });
  }
  // Generic empty object may fail schema — use parse-safe fallbacks
  void contract;
  return JSON.stringify({});
}

function getStagesForJobType(jobType: string) {
  const routing = {
    provider: 'fake',
    modelId: 'fake/v1',
    mode: 'structured',
    timeoutMs: 30_000,
  };
  switch (jobType) {
    case 'beat.write':
      return [
        {
          stageName: 'write',
          routingPlan: { ...routing },
          promptContractVersion: 'beat.write.v1',
          maxInvocations: 3,
        },
        {
          stageName: 'judge',
          routingPlan: { ...routing, timeoutMs: 15_000 },
          promptContractVersion: 'beat.judge.v1',
          maxInvocations: 1,
        },
      ];
    case 'beat.repair':
      return [
        {
          stageName: 'repair',
          routingPlan: { ...routing },
          promptContractVersion: 'beat.repair.v1',
          maxInvocations: 1,
        },
      ];
    default:
      return [
        {
          stageName: 'default',
          routingPlan: { ...routing },
          promptContractVersion: 'intake.extract.v1',
          maxInvocations: 1,
        },
      ];
  }
}

/**
 * Create AIExecutionPort backed by fake scenarios (CI-safe).
 */
export function createFakeAIExecutionPort(
  config: FakeProviderConfig = {},
): AIExecutionPort {
  const scenario = config.scenario ?? 'success';
  let callCount = 0;

  function buildWorkflowPlan(params: BuildWorkflowPlanParams): AIWorkflowPlan {
    return {
      planId: `fake-plan-${params.jobType}-${Date.now()}`,
      stages: getStagesForJobType(params.jobType),
      createdAt: new Date().toISOString(),
    };
  }

  async function executeSingleAttempt(
    params: ExecuteSingleAttemptParams,
  ): Promise<SingleAttemptResponse> {
    callCount += 1;
    config.onCall?.(params);

    const delay = config.delayMs ?? 0;
    if (delay > 0) {
      await new Promise((r) => setTimeout(r, delay));
    }

    if (scenario === 'timeout') {
      throw new Error('Provider timeout after 30000ms');
    }
    if (scenario === 'rate_limit') {
      throw new Error('rate limit 429 too many requests');
    }
    if (scenario === 'provider_500') {
      throw new Error('OpenRouter HTTP 500: internal error');
    }
    if (scenario === 'auth_error') {
      throw new Error('unauthorized 401 invalid api key');
    }
    if (scenario === 'safety_refusal') {
      throw new Error('safety refusal: content policy blocked');
    }
    if (scenario === 'context_too_large') {
      throw new Error('context too large: prompt exceeds model limit');
    }
    if (scenario === 'malformed_json') {
      return {
        attemptId: randomUUID(),
        stageName: params.stageName,
        invocationKey: params.invocationKey,
        rawBody: 'not-json{{{',
        providerRequestId: `fake-req-${callCount}`,
        completedAt: new Date().toISOString(),
      };
    }
    if (scenario === 'schema_invalid') {
      return {
        attemptId: randomUUID(),
        stageName: params.stageName,
        invocationKey: params.invocationKey,
        rawBody: JSON.stringify({ wrong: true }),
        providerRequestId: `fake-req-${callCount}`,
        completedAt: new Date().toISOString(),
      };
    }
    if (scenario === 'reveal_leak_prose') {
      return {
        attemptId: randomUUID(),
        stageName: params.stageName,
        invocationKey: params.invocationKey,
        rawBody: LEAK_PROSE,
        providerRequestId: `fake-req-${callCount}`,
        completedAt: new Date().toISOString(),
        usage: { inputTokens: 10, outputTokens: 50, totalTokens: 60 },
      };
    }

    // success
    const rawBody =
      config.successBody ??
      defaultSuccessBody(params.promptContractVersion);

    return {
      attemptId: randomUUID(),
      stageName: params.stageName,
      invocationKey: params.invocationKey,
      rawBody,
      providerRequestId: `fake-req-${callCount}`,
      completedAt: new Date().toISOString(),
      usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
    };
  }

  function parseOutput<T>(contract: z.ZodType<T>, rawBody: string): T {
    return contract.parse(JSON.parse(rawBody));
  }

  function classifyError(error: unknown): NormalizedProviderError {
    if (!(error instanceof Error)) {
      return {
        errorCode: 'UNKNOWN_ERROR',
        message: String(error),
        retryable: false,
      };
    }
    const msg = error.message.toLowerCase();
    if (msg.includes('timeout')) {
      return {
        errorCode: 'PROVIDER_TIMEOUT',
        message: error.message,
        retryable: true,
        retryStage: null,
      };
    }
    if (msg.includes('429') || msg.includes('rate limit')) {
      return {
        errorCode: 'RATE_LIMITED',
        message: error.message,
        retryable: true,
        retryStage: null,
      };
    }
    if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('403')) {
      return {
        errorCode: 'PROVIDER_AUTH',
        message: error.message,
        retryable: false,
      };
    }
    if (msg.includes('safety')) {
      return {
        errorCode: 'SAFETY_REFUSAL',
        message: error.message,
        retryable: false,
      };
    }
    if (msg.includes('context too large')) {
      return {
        errorCode: 'CONTEXT_TOO_LARGE',
        message: error.message,
        retryable: false,
      };
    }
    if (msg.includes('500') || msg.includes('unavailable')) {
      return {
        errorCode: 'PROVIDER_UNAVAILABLE',
        message: error.message,
        retryable: true,
      };
    }
    if (msg.includes('malformed') || msg.includes('invalid json')) {
      return {
        errorCode: 'MALFORMED_OUTPUT',
        message: error.message,
        retryable: false,
      };
    }
    return {
      errorCode: 'PROVIDER_ERROR',
      message: error.message,
      retryable: true,
    };
  }

  function decideNextAction(
    attempt: SingleAttemptResponse | null,
    error: NormalizedProviderError | null,
    workflowPlan: AIWorkflowPlan,
    currentInvocationKey: string,
  ): NextAction {
    if (error) {
      if (!error.retryable) {
        return { type: 'terminal', reason: `Non-retryable: ${error.errorCode}` };
      }
      return {
        type: 'terminal',
        reason: `Retryable but no auto-retry in single attempt: ${error.errorCode}`,
      };
    }
    if (!attempt) return { type: 'terminal', reason: 'No attempt' };
    const idx = workflowPlan.stages.findIndex(
      (s) =>
        s.promptContractVersion === currentInvocationKey ||
        s.stageName === currentInvocationKey,
    );
    if (idx >= 0 && idx < workflowPlan.stages.length - 1) {
      const next = workflowPlan.stages[idx + 1]!;
      return {
        type: 'next_candidate',
        invocationKey: `${next.stageName}:v1`,
      };
    }
    return { type: 'terminal', reason: 'All stages completed' };
  }

  return {
    buildWorkflowPlan,
    executeSingleAttempt,
    parseOutput,
    classifyError,
    decideNextAction,
  };
}

export function getFakeCallCount(port: AIExecutionPort & { __calls?: number }): number {
  return (port as { __calls?: number }).__calls ?? 0;
}
