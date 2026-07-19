// Composition helper: pick mock vs production AIExecutionPort from env.
// Production must never silently fall back to mock.

import type { AIExecutionPort } from './types.js';
import { createMockAIExecutionPort } from './execution-port.js';
import { createProductionAIExecutionPort } from './production-execution-port.js';

export interface CreateAIExecutionPortOptions {
  /** When true, mock is allowed (dev/test/CI). Forbidden when NODE_ENV=production. */
  enableMock?: boolean | undefined;
  /** OpenRouter API key required when mock is off. */
  openRouterApiKey?: string | undefined;
  /** Optional Gemini key for alternate routing. */
  geminiApiKey?: string | undefined;
  /** Explicit NODE_ENV override; defaults to process.env.NODE_ENV. */
  nodeEnv?: string | undefined;
  /** Default model id for production routing. */
  defaultModelId?: string | undefined;
}

/**
 * Fail-fast AI port factory.
 *
 * Rules:
 * - NODE_ENV=production + enableMock → throw
 * - mock off without OPENROUTER_API_KEY → throw
 * - no silent mock fallback
 */
export function createAIExecutionPort(
  options: CreateAIExecutionPortOptions = {},
): AIExecutionPort {
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV ?? 'development';
  const enableMock =
    options.enableMock ??
    (process.env.AI_ENABLE_MOCK === 'true');

  if (nodeEnv === 'production' && enableMock) {
    throw new Error(
      'AI_ENABLE_MOCK=true is forbidden when NODE_ENV=production',
    );
  }

  if (enableMock) {
    return createMockAIExecutionPort();
  }

  const openRouterApiKey =
    options.openRouterApiKey ?? process.env.OPENROUTER_API_KEY;
  if (!openRouterApiKey || openRouterApiKey.length < 20) {
    throw new Error(
      'OPENROUTER_API_KEY required when AI_ENABLE_MOCK is not true (fail-fast, no mock fallback)',
    );
  }

  const geminiApiKey = options.geminiApiKey ?? process.env.GEMINI_API_KEY;
  const prodConfig: {
    openRouterApiKey: string;
    defaultModelId: string;
    geminiApiKey?: string;
  } = {
    openRouterApiKey,
    defaultModelId: options.defaultModelId ?? 'openrouter/auto',
  };
  if (geminiApiKey) {
    prodConfig.geminiApiKey = geminiApiKey;
  }
  return createProductionAIExecutionPort(prodConfig);
}
