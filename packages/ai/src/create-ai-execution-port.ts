// Composition helper: pick mock vs production AIExecutionPort from env.
// Production must never silently fall back to mock.

import type { AIExecutionPort } from './types.js';
import { createMockAIExecutionPort } from './execution-port.js';
import { createProductionAIExecutionPort } from './production-execution-port.js';

export interface CreateAIExecutionPortOptions {
  /** When true, mock is allowed (dev/test/CI). Forbidden when NODE_ENV=production. */
  enableMock?: boolean | undefined;
  /** API key required when mock is off. */
  apiKey?: string | undefined;
  /** @deprecated use apiKey — kept for call-site compatibility */
  openRouterApiKey?: string | undefined;
  geminiApiKey?: string | undefined;
  /** Explicit NODE_ENV override; defaults to process.env.NODE_ENV. */
  nodeEnv?: string | undefined;
  /** Primary model id for production routing. */
  defaultModelId?: string | undefined;
  /** Fallback model id on retryable provider failure. */
  fallbackModelId?: string | undefined;
  /** OpenAI-compatible base URL (…/v1). */
  baseUrl?: string | undefined;
  /** Internal provider label for logs. */
  providerLabel?: string | undefined;
}

/**
 * Fail-fast AI port factory.
 *
 * Rules:
 * - NODE_ENV=production + enableMock → throw
 * - mock off without API key → throw
 * - no silent mock fallback
 */
export function createAIExecutionPort(
  options: CreateAIExecutionPortOptions = {},
): AIExecutionPort {
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV ?? 'development';
  const enableMock =
    options.enableMock ?? process.env.AI_ENABLE_MOCK === 'true';

  if (nodeEnv === 'production' && enableMock) {
    throw new Error(
      'AI_ENABLE_MOCK=true is forbidden when NODE_ENV=production',
    );
  }

  if (enableMock) {
    return createMockAIExecutionPort();
  }

  const apiKey =
    options.apiKey ??
    options.openRouterApiKey ??
    process.env.AI_API_KEY ??
    process.env.OPENROUTER_API_KEY;

  if (!apiKey || apiKey.length < 20) {
    throw new Error(
      'AI_API_KEY (or OPENROUTER_API_KEY) required when AI_ENABLE_MOCK is not true (fail-fast, no mock fallback)',
    );
  }

  const baseUrl =
    options.baseUrl ??
    process.env.AI_BASE_URL ??
    'https://openrouter.ai/api/v1';
  const defaultModelId =
    options.defaultModelId ??
    process.env.AI_MODEL ??
    'ag/gemini-pro-agent';
  const fallbackModelId =
    options.fallbackModelId ?? process.env.AI_FALLBACK_MODEL;
  const providerLabel =
    options.providerLabel ?? process.env.AI_PROVIDER_LABEL ?? 'openai-compatible';

  const prodConfig: {
    apiKey: string;
    baseUrl: string;
    defaultModelId: string;
    providerLabel: string;
    fallbackModelId?: string;
  } = {
    apiKey,
    baseUrl,
    defaultModelId,
    providerLabel,
  };
  if (fallbackModelId) {
    prodConfig.fallbackModelId = fallbackModelId;
  }

  return createProductionAIExecutionPort(prodConfig);
}
