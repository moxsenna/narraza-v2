import { describe, expect, it } from 'vitest';
import { createFakeAIExecutionPort } from '../fake-http-provider.js';
import {
  listPromptContracts,
  requirePromptContract,
  validateContractOutput,
} from '../prompt-contract-registry.js';
import { createAIExecutionPort } from '../create-ai-execution-port.js';
import { BeatWriteContract } from '../prompts/contracts/index.js';

describe('prompt contract registry', () => {
  it('lists versioned contracts including beat.write.v1', () => {
    const list = listPromptContracts();
    expect(list.some((c) => c.version === 'beat.write.v1')).toBe(true);
    const beat = requirePromptContract('beat.write.v1');
    expect(beat.contextPolicy).toBe('writer_safe');
    expect(beat.outputMode).toBe('prose_candidates');
  });

  it('validateContractOutput rejects malformed JSON', () => {
    expect(() => validateContractOutput('beat.write.v1', 'not-json')).toThrow(
      /MALFORMED_OUTPUT|invalid JSON/i,
    );
  });

  it('validateContractOutput rejects schema-invalid body', () => {
    expect(() =>
      validateContractOutput('beat.write.v1', JSON.stringify({ wrong: true })),
    ).toThrow();
  });
});

describe('fake provider scenarios', () => {
  it('success returns parseable beat.write body', async () => {
    const port = createFakeAIExecutionPort({ scenario: 'success' });
    const plan = port.buildWorkflowPlan({
      jobType: 'beat.write',
      projectId: 'p1',
    });
    const res = await port.executeSingleAttempt({
      workflowPlan: plan,
      stageName: 'write',
      invocationKey: 'write:v1',
      promptContractVersion: 'beat.write.v1',
      promptPayload: {},
    });
    const out = port.parseOutput(BeatWriteContract, res.rawBody);
    expect(out.candidates[0]!.prose.length).toBeGreaterThan(10);
  });

  it('timeout classifies as retryable', () => {
    const port = createFakeAIExecutionPort({ scenario: 'timeout' });
    const err = port.classifyError(new Error('Provider timeout after 30000ms'));
    expect(err.errorCode).toBe('PROVIDER_TIMEOUT');
    expect(err.retryable).toBe(true);
  });

  it('auth error is non-retryable', () => {
    const port = createFakeAIExecutionPort({ scenario: 'auth_error' });
    const err = port.classifyError(new Error('unauthorized 401 invalid api key'));
    expect(err.retryable).toBe(false);
  });

  it('rate limit is retryable', () => {
    const port = createFakeAIExecutionPort({ scenario: 'rate_limit' });
    const err = port.classifyError(new Error('rate limit 429'));
    expect(err.errorCode).toBe('RATE_LIMITED');
    expect(err.retryable).toBe(true);
  });

  it('reveal_leak_prose returns hidden truth in prose', async () => {
    const port = createFakeAIExecutionPort({ scenario: 'reveal_leak_prose' });
    const plan = port.buildWorkflowPlan({
      jobType: 'beat.write',
      projectId: 'p1',
    });
    const res = await port.executeSingleAttempt({
      workflowPlan: plan,
      stageName: 'write',
      invocationKey: 'write:v1',
      promptContractVersion: 'beat.write.v1',
      promptPayload: {},
    });
    expect(res.rawBody).toContain('cult leader');
  });

  it('onCall tracks provider invocations', async () => {
    let calls = 0;
    const port = createFakeAIExecutionPort({
      scenario: 'success',
      onCall: () => {
        calls += 1;
      },
    });
    const plan = port.buildWorkflowPlan({ jobType: 'beat.write', projectId: 'p1' });
    await port.executeSingleAttempt({
      workflowPlan: plan,
      stageName: 'write',
      invocationKey: 'write:v1',
      promptContractVersion: 'beat.write.v1',
      promptPayload: {},
    });
    expect(calls).toBe(1);
  });
});

describe('production mock fail-fast (P3.2)', () => {
  it('production + mock throws', () => {
    expect(() =>
      createAIExecutionPort({
        enableMock: true,
        nodeEnv: 'production',
      }),
    ).toThrow(/forbidden/i);
  });

  it('production without key throws no silent mock', () => {
    expect(() =>
      createAIExecutionPort({
        enableMock: false,
        nodeEnv: 'production',
        openRouterApiKey: '',
      }),
    ).toThrow(/OPENROUTER_API_KEY/i);
  });
});
