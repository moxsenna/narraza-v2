// Production AIExecutionPort — OpenAI-compatible chat completions HTTP.
// Supports custom base URL, primary model, and one-shot fallback model.
// No silent mock fallback.

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

export interface ProductionAIConfig {
  /** Bearer API key (server-side only) */
  apiKey: string;
  /** Chat completions base, e.g. https://host/v1 */
  baseUrl?: string;
  /** Primary model id */
  defaultModelId?: string;
  /** Optional fallback model on retryable provider failure */
  fallbackModelId?: string;
  /** Display name for logs (never shown to end users as raw provider) */
  providerLabel?: string;
}

function getStagesForJobType(
  jobType: string,
  modelId: string,
  providerLabel: string,
) {
  const routing = {
    provider: providerLabel,
    modelId,
    mode: 'structured',
    timeoutMs: 60_000,
  };
  switch (jobType) {
    case 'intake.extract':
      return [
        {
          stageName: 'extract',
          routingPlan: { ...routing, timeoutMs: 30_000 },
          promptContractVersion: 'intake.extract.v1',
          maxInvocations: 1,
        },
      ];
    case 'foundation.propose':
      return [
        {
          stageName: 'propose',
          routingPlan: { ...routing, timeoutMs: 30_000 },
          promptContractVersion: 'foundation.propose.v1',
          maxInvocations: 1,
        },
      ];
    case 'character.propose':
      return [
        {
          stageName: 'propose',
          routingPlan: { ...routing, timeoutMs: 30_000 },
          promptContractVersion: 'character.propose.v1',
          maxInvocations: 1,
        },
      ];
    case 'outline.generate':
      return [
        {
          stageName: 'generate',
          routingPlan: { ...routing, timeoutMs: 30_000 },
          promptContractVersion: 'outline.generate.v1',
          maxInvocations: 1,
        },
      ];
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
          routingPlan: { ...routing, timeoutMs: 30_000 },
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
        {
          stageName: 'judge',
          routingPlan: { ...routing, timeoutMs: 30_000 },
          promptContractVersion: 'beat.judge.v1',
          maxInvocations: 1,
        },
      ];
    case 'publish.package':
      return [
        {
          stageName: 'package',
          routingPlan: { ...routing, timeoutMs: 30_000 },
          promptContractVersion: 'publish.package.v1',
          maxInvocations: 1,
        },
      ];
    default:
      return [
        {
          stageName: 'default',
          routingPlan: { ...routing, timeoutMs: 30_000 },
          promptContractVersion: 'intake.extract.v1',
          maxInvocations: 1,
        },
      ];
  }
}

function buildWorkflowPlan(
  params: BuildWorkflowPlanParams,
  modelId: string,
  providerLabel: string,
): AIWorkflowPlan {
  return {
    planId: `plan-${params.jobType}-${Date.now()}`,
    stages: getStagesForJobType(params.jobType, modelId, providerLabel),
    createdAt: new Date().toISOString(),
  };
}

function parseOutput<T>(contract: z.ZodType<T>, rawBody: string): T {
  const parsed = JSON.parse(rawBody);
  return contract.parse(parsed);
}

function classifyError(error: unknown): NormalizedProviderError {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('aborted')) {
      return {
        errorCode: 'PROVIDER_TIMEOUT',
        message: error.message,
        retryable: true,
        retryStage: null,
      };
    }
    if (msg.includes('rate limit') || msg.includes('429')) {
      return {
        errorCode: 'RATE_LIMITED',
        message: error.message,
        retryable: true,
        retryStage: null,
      };
    }
    if (msg.includes('unauthorized') || msg.includes('401') || msg.includes('403')) {
      return {
        errorCode: 'PROVIDER_AUTH',
        message: error.message,
        retryable: false,
      };
    }
    if (msg.includes('safety') || msg.includes('content policy')) {
      return {
        errorCode: 'SAFETY_REFUSAL',
        message: error.message,
        retryable: false,
      };
    }
    if (msg.includes('context too large') || msg.includes('too many tokens')) {
      return {
        errorCode: 'CONTEXT_TOO_LARGE',
        message: error.message,
        retryable: false,
      };
    }
    if (msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('unavailable')) {
      return {
        errorCode: 'PROVIDER_UNAVAILABLE',
        message: error.message,
        retryable: true,
      };
    }
    return {
      errorCode: 'PROVIDER_ERROR',
      message: error.message,
      retryable: true,
    };
  }
  return {
    errorCode: 'UNKNOWN_ERROR',
    message: String(error),
    retryable: false,
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
      return { type: 'terminal', reason: `Non-retryable error: ${error.errorCode}` };
    }
    if (error.retryStage) {
      return { type: 'next_candidate', invocationKey: error.retryStage };
    }
    return { type: 'terminal', reason: `Retryable but no retry stage: ${error.errorCode}` };
  }
  if (!attempt) {
    return { type: 'terminal', reason: 'No attempt produced' };
  }
  const currentStageIdx = workflowPlan.stages.findIndex(
    (s) =>
      s.promptContractVersion === currentInvocationKey ||
      s.stageName === currentInvocationKey,
  );
  if (currentStageIdx >= 0 && currentStageIdx < workflowPlan.stages.length - 1) {
    const nextStage = workflowPlan.stages[currentStageIdx + 1]!;
    return {
      type: 'next_candidate',
      invocationKey: `${nextStage.stageName}:${nextStage.invocationKey ?? 'v1'}`,
    };
  }
  return { type: 'terminal', reason: 'All stages completed' };
}

function isRetryableHttpStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

/**
 * Normalize common provider omissions so Zod contracts still pass.
 * Does not invent plot — only fills structural required fields.
 */
function normalizeContractRawBody(
  promptContractVersion: string,
  rawBody: string,
): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return rawBody;
  }

  if (promptContractVersion === 'beat.write.v1' && parsed && typeof parsed === 'object') {
    const obj = parsed as {
      candidates?: Array<Record<string, unknown>>;
    };
    if (Array.isArray(obj.candidates)) {
      obj.candidates = obj.candidates.map((c, i) => {
        const next = { ...c };
        if (typeof next.candidateIndex !== 'number') {
          next.candidateIndex = i + 1;
        }
        if (!Array.isArray(next.suggestions)) {
          next.suggestions = [];
        }
        if (typeof next.prose === 'string') {
          // strip accidental markdown fences
          next.prose = next.prose
            .replace(/^```(?:json|text|markdown)?\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();
        }
        return next;
      });
      return JSON.stringify(obj);
    }
  }

  if (promptContractVersion === 'beat.repair.v1' && parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    if (!Array.isArray(obj.suggestions)) obj.suggestions = [];
    if (!Array.isArray(obj.addressedFindings)) obj.addressedFindings = [];
    if (typeof obj.repairedProse === 'string') {
      obj.repairedProse = obj.repairedProse
        .replace(/^```(?:json|text|markdown)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
    }
    return JSON.stringify(obj);
  }

  return rawBody;
}

/**
 * Create production AIExecutionPort (OpenAI-compatible /v1/chat/completions).
 */
export function createProductionAIExecutionPort(
  config: ProductionAIConfig,
): AIExecutionPort {
  const apiKey = config.apiKey;
  if (!apiKey || apiKey.length < 20) {
    throw new Error('createProductionAIExecutionPort: apiKey required');
  }

  const modelId = config.defaultModelId ?? 'ag/gemini-pro-agent';
  const fallbackModelId = config.fallbackModelId;
  const baseUrl = (config.baseUrl ?? 'https://openrouter.ai/api/v1').replace(/\/$/, '');
  const providerLabel = config.providerLabel ?? 'openai-compatible';

  async function callChatCompletions(
    model: string,
    params: ExecuteSingleAttemptParams,
    timeoutMs: number,
  ): Promise<SingleAttemptResponse> {
    let system = [
      'You are a structured fiction-production assistant for Narraza.',
      `Respond with JSON only matching contract ${params.promptContractVersion}.`,
      'Do not include markdown fences or commentary.',
    ].join(' ');

    try {
      const contract = requirePromptContract(params.promptContractVersion);
      system = `${contract.systemInstruction} Respond with JSON only. No markdown fences.`;
    } catch {
      // unknown contract version — keep default system
    }

    const userContent =
      typeof params.promptPayload === 'string'
        ? params.promptPayload
        : JSON.stringify(params.promptPayload ?? {});

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://narraza.local',
          'X-Title': 'Narraza v2 worker-gen',
        },
        body: JSON.stringify({
          model,
          stream: false,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: userContent },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.4,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        const err = new Error(
          `Provider HTTP ${res.status}: ${text.slice(0, 300)}`,
        );
        (err as Error & { httpStatus?: number }).httpStatus = res.status;
        throw err;
      }

      const contentType = res.headers.get('content-type') ?? '';
      const rawText = await res.text();

      // Some OpenAI-compatible gateways default to SSE unless stream:false is honored.
      // If we still receive SSE, parse the last data chunk for content.
      let body: {
        id?: string;
        choices?: Array<{ message?: { content?: string }; delta?: { content?: string } }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
      };

      if (
        contentType.includes('text/event-stream') ||
        rawText.trimStart().startsWith('data:')
      ) {
        let content = '';
        let id: string | undefined;
        for (const line of rawText.split(/\r?\n/)) {
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (!data || data === '[DONE]') continue;
          try {
            const chunk = JSON.parse(data) as {
              id?: string;
              choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>;
            };
            if (chunk.id) id = chunk.id;
            const delta = chunk.choices?.[0]?.delta?.content;
            const msg = chunk.choices?.[0]?.message?.content;
            if (typeof delta === 'string') content += delta;
            if (typeof msg === 'string') content = msg;
          } catch {
            // ignore partial SSE parse errors
          }
        }
        const sseBody: {
          id?: string;
          choices: Array<{ message: { content: string } }>;
        } = {
          choices: [{ message: { content: content || '{}' } }],
        };
        if (id) sseBody.id = id;
        body = sseBody;
      } else {
        try {
          body = JSON.parse(rawText) as typeof body;
        } catch {
          throw new Error(
            `Provider returned non-JSON body: ${rawText.slice(0, 200)}`,
          );
        }
      }

      let rawBody = body.choices?.[0]?.message?.content ?? '{}';
      rawBody = normalizeContractRawBody(params.promptContractVersion, rawBody);
      const usage = body.usage;

      const result: SingleAttemptResponse = {
        attemptId: randomUUID(),
        stageName: params.stageName,
        invocationKey: params.invocationKey,
        rawBody,
        completedAt: new Date().toISOString(),
      };
      if (body.id) {
        result.providerRequestId = body.id;
      }
      if (usage) {
        const providerUsage: NonNullable<SingleAttemptResponse['usage']> = {};
        if (usage.prompt_tokens != null) providerUsage.inputTokens = usage.prompt_tokens;
        if (usage.completion_tokens != null) {
          providerUsage.outputTokens = usage.completion_tokens;
        }
        if (usage.total_tokens != null) providerUsage.totalTokens = usage.total_tokens;
        result.usage = providerUsage;
      }
      return result;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Provider timeout after ${timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async function executeSingleAttempt(
    params: ExecuteSingleAttemptParams,
  ): Promise<SingleAttemptResponse> {
    const stage = params.workflowPlan.stages.find(
      (s) => s.stageName === params.stageName,
    );
    const routeModel = stage?.routingPlan.modelId ?? modelId;
    const timeoutMs = stage?.routingPlan.timeoutMs ?? 60_000;

    try {
      return await callChatCompletions(routeModel, params, timeoutMs);
    } catch (primaryErr) {
      // One-shot fallback model on retryable failures only
      if (!fallbackModelId || fallbackModelId === routeModel) {
        throw primaryErr;
      }
      const classified = classifyError(primaryErr);
      const httpStatus = (primaryErr as Error & { httpStatus?: number }).httpStatus;
      const retryableHttp =
        httpStatus != null ? isRetryableHttpStatus(httpStatus) : false;
      if (!classified.retryable && !retryableHttp) {
        throw primaryErr;
      }
      return callChatCompletions(fallbackModelId, params, timeoutMs);
    }
  }

  return {
    buildWorkflowPlan: (params) =>
      buildWorkflowPlan(params, modelId, providerLabel),
    executeSingleAttempt,
    parseOutput,
    classifyError,
    decideNextAction,
  };
}
