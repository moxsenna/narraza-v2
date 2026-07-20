/**
 * Web composition root for AIExecutionPort.
 *
 * Pages / Server Actions must import from here — never call
 * createMockAIExecutionPort() directly. Mock only when AI_ENABLE_MOCK=true
 * and NODE_ENV is not production.
 */

import { createAIExecutionPort, type AIExecutionPort } from '@narraza/ai';

export function createWebAIExecutionPort(): AIExecutionPort {
  return createAIExecutionPort({
    enableMock: process.env.AI_ENABLE_MOCK === 'true',
    apiKey: process.env.AI_API_KEY ?? process.env.OPENROUTER_API_KEY,
    baseUrl: process.env.AI_BASE_URL,
    defaultModelId: process.env.AI_MODEL,
    fallbackModelId: process.env.AI_FALLBACK_MODEL,
    providerLabel: process.env.AI_PROVIDER_LABEL,
    nodeEnv: process.env.NODE_ENV,
  });
}
