import { describe, expect, it } from 'vitest';
import { createAIExecutionPort } from '../create-ai-execution-port.js';

describe('createAIExecutionPort', () => {
  it('returns mock when enableMock true and not production', () => {
    const port = createAIExecutionPort({
      enableMock: true,
      nodeEnv: 'development',
    });
    const plan = port.buildWorkflowPlan({
      jobType: 'intake.extract',
      projectId: 'p1',
    });
    expect(plan.stages[0]?.routingPlan.provider).toBe('mock');
  });

  it('throws when production + mock', () => {
    expect(() =>
      createAIExecutionPort({
        enableMock: true,
        nodeEnv: 'production',
      }),
    ).toThrow(/forbidden/i);
  });

  it('throws when mock off and no API key (no silent mock fallback)', () => {
    expect(() =>
      createAIExecutionPort({
        enableMock: false,
        nodeEnv: 'development',
        openRouterApiKey: '',
      }),
    ).toThrow(/OPENROUTER_API_KEY/i);
  });

  it('returns production port when mock off and key present', () => {
    const port = createAIExecutionPort({
      enableMock: false,
      nodeEnv: 'production',
      openRouterApiKey: 'sk-or-v1-test-key-1234567890',
    });
    const plan = port.buildWorkflowPlan({
      jobType: 'beat.write',
      projectId: 'p1',
    });
    expect(plan.stages[0]?.routingPlan.provider).toBe('openrouter');
  });
});
