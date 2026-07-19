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
    openRouterApiKey: process.env.OPENROUTER_API_KEY,
    geminiApiKey: process.env.GEMINI_API_KEY,
    nodeEnv: process.env.NODE_ENV,
  });
}
