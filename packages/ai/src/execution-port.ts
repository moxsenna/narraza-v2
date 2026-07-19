// Mock AI provider that returns deterministic JSON matching contracts.
// Used when AI_ENABLE_MOCK=true. Production pipeline identical — mock only swaps provider adapter.

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

import { mockIntakeExtractOutput } from './prompts/contracts/intake-extract.mock.js';
import { mockFoundationProposeOutput } from './prompts/contracts/foundation-propose.mock.js';
import { mockCharacterProposeOutput } from './prompts/contracts/character-propose.mock.js';
import { mockOutlineGenerateOutput } from './prompts/contracts/outline-generate.mock.js';
import { mockBeatWriteOutput } from './prompts/contracts/beat-write.mock.js';
import { mockBeatJudgeOutput } from './prompts/contracts/beat-judge.mock.js';
import { mockBeatRepairOutput } from './prompts/contracts/beat-repair.mock.js';
import { mockJudgeOutputRepairOutput } from './prompts/contracts/judge-output-repair.mock.js';
import { mockPublishPackageOutput } from './prompts/contracts/publish-package.mock.js';

import {
  IntakeExtractContract,
  FoundationProposeContract,
  CharacterProposeContract,
  OutlineGenerateContract,
  BeatWriteContract,
  BeatJudgeContract,
  BeatRepairContract,
  JudgeOutputRepairContract,
  PublishPackageContract,
} from './prompts/contracts/index.js';

// Map prompt contract versions to mock data generators and Zod schemas
const MOCK_REGISTRY: Record<string, { generate: () => unknown; contract: z.ZodType<unknown> }> = {
  'intake.extract.v1': {
    generate: mockIntakeExtractOutput,
    contract: IntakeExtractContract,
  },
  'foundation.propose.v1': {
    generate: mockFoundationProposeOutput,
    contract: FoundationProposeContract,
  },
  'character.propose.v1': {
    generate: mockCharacterProposeOutput,
    contract: CharacterProposeContract,
  },
  'outline.generate.v1': {
    generate: mockOutlineGenerateOutput,
    contract: OutlineGenerateContract,
  },
  'beat.write.v1': {
    generate: mockBeatWriteOutput,
    contract: BeatWriteContract,
  },
  'beat.judge.v1': {
    generate: mockBeatJudgeOutput,
    contract: BeatJudgeContract,
  },
  'beat.repair.v1': {
    generate: mockBeatRepairOutput,
    contract: BeatRepairContract,
  },
  'judge-output.repair.v1': {
    generate: mockJudgeOutputRepairOutput,
    contract: JudgeOutputRepairContract,
  },
  'publish.package.v1': {
    generate: mockPublishPackageOutput,
    contract: PublishPackageContract,
  },
};

let attemptCounter = 0;

function nextAttemptId(): string {
  attemptCounter += 1;
  return `mock-attempt-${attemptCounter}`;
}

/**
 * Build a frozen AIWorkflowPlan for a job type.
 */
function buildWorkflowPlan(params: BuildWorkflowPlanParams): AIWorkflowPlan {
  const planId = `plan-${params.jobType}-${Date.now()}`;
  const stages = getStagesForJobType(params.jobType);
  return {
    planId,
    stages,
    createdAt: new Date().toISOString(),
  };
}

function getStagesForJobType(jobType: string) {
  switch (jobType) {
    case 'intake.extract':
      return [
        {
          stageName: 'extract',
          routingPlan: { provider: 'mock', modelId: 'mock/v1', mode: 'structured', timeoutMs: 30000 },
          promptContractVersion: 'intake.extract.v1',
          maxInvocations: 1,
        },
      ];
    case 'foundation.propose':
      return [
        {
          stageName: 'propose',
          routingPlan: { provider: 'mock', modelId: 'mock/v1', mode: 'structured', timeoutMs: 30000 },
          promptContractVersion: 'foundation.propose.v1',
          maxInvocations: 1,
        },
      ];
    case 'character.propose':
      return [
        {
          stageName: 'propose',
          routingPlan: { provider: 'mock', modelId: 'mock/v1', mode: 'structured', timeoutMs: 30000 },
          promptContractVersion: 'character.propose.v1',
          maxInvocations: 1,
        },
      ];
    case 'outline.generate':
      return [
        {
          stageName: 'generate',
          routingPlan: { provider: 'mock', modelId: 'mock/v1', mode: 'structured', timeoutMs: 30000 },
          promptContractVersion: 'outline.generate.v1',
          maxInvocations: 1,
        },
      ];
    case 'beat.write':
      return [
        {
          stageName: 'write',
          routingPlan: { provider: 'mock', modelId: 'mock/v1', mode: 'structured', timeoutMs: 60000 },
          promptContractVersion: 'beat.write.v1',
          maxInvocations: 3,
        },
        {
          stageName: 'judge',
          routingPlan: { provider: 'mock', modelId: 'mock/v1', mode: 'structured', timeoutMs: 30000 },
          promptContractVersion: 'beat.judge.v1',
          maxInvocations: 1,
        },
      ];
    case 'beat.repair':
      return [
        {
          stageName: 'repair',
          routingPlan: { provider: 'mock', modelId: 'mock/v1', mode: 'structured', timeoutMs: 60000 },
          promptContractVersion: 'beat.repair.v1',
          maxInvocations: 1,
        },
        {
          stageName: 'judge',
          routingPlan: { provider: 'mock', modelId: 'mock/v1', mode: 'structured', timeoutMs: 30000 },
          promptContractVersion: 'beat.judge.v1',
          maxInvocations: 1,
        },
      ];
    case 'publish.package':
      return [
        {
          stageName: 'package',
          routingPlan: { provider: 'mock', modelId: 'mock/v1', mode: 'structured', timeoutMs: 30000 },
          promptContractVersion: 'publish.package.v1',
          maxInvocations: 1,
        },
      ];
    default:
      return [
        {
          stageName: 'default',
          routingPlan: { provider: 'mock', modelId: 'mock/v1', mode: 'structured', timeoutMs: 30000 },
          promptContractVersion: 'intake.extract.v1',
          maxInvocations: 1,
        },
      ];
  }
}

/**
 * Execute exactly ONE provider call. No internal retry/fallback.
 * Mock returns deterministic JSON matching the prompt contract.
 */
async function executeSingleAttempt(
  params: ExecuteSingleAttemptParams,
): Promise<SingleAttemptResponse> {
  const registry = MOCK_REGISTRY[params.promptContractVersion];
  if (!registry) {
    throw new Error(`No mock registered for contract: ${params.promptContractVersion}`);
  }

  const mockData = registry.generate();
  // Validate mock output against the contract (ensures it stays in sync)
  const validated = registry.contract.parse(mockData);

  return {
    attemptId: nextAttemptId(),
    stageName: params.stageName,
    invocationKey: params.invocationKey,
    rawBody: JSON.stringify(validated),
    providerRequestId: `mock-req-${attemptCounter}`,
    completedAt: new Date().toISOString(),
    usage: {
      inputTokens: 100,
      outputTokens: 200,
      totalTokens: 300,
      costMicroIdr: 0n,
    },
  };
}

/**
 * Parse raw output against a Zod contract. Throws on mismatch.
 */
function parseOutput<T>(contract: z.ZodType<T>, rawBody: string): T {
  const parsed = JSON.parse(rawBody);
  return contract.parse(parsed);
}

/**
 * Classify a provider error into NormalizedProviderError.
 */
function classifyError(error: unknown): NormalizedProviderError {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('timeout') || msg.includes('timed out')) {
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

/**
 * Decide next action after an attempt.
 */
function decideNextAction(
  attempt: SingleAttemptResponse | null,
  error: NormalizedProviderError | null,
  workflowPlan: AIWorkflowPlan,
  currentInvocationKey: string,
): NextAction {
  // If we have an error
  if (error) {
    if (!error.retryable) {
      return { type: 'terminal', reason: `Non-retryable error: ${error.errorCode}` };
    }
    // For retryable errors, check if we have a specific retry stage
    if (error.retryStage) {
      return { type: 'next_candidate', invocationKey: error.retryStage };
    }
    // Fall through to terminal for simplicity
    return { type: 'terminal', reason: `Retryable but no retry stage: ${error.errorCode}` };
  }

  // No attempt means something went wrong before execution
  if (!attempt) {
    return { type: 'terminal', reason: 'No attempt produced' };
  }

  // Find next stage in workflow
  const currentStageIdx = workflowPlan.stages.findIndex(
    (s) => s.promptContractVersion === currentInvocationKey || s.stageName === currentInvocationKey,
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

/**
 * Create the AIExecutionPort with mock provider.
 */
export function createMockAIExecutionPort(): AIExecutionPort {
  return {
    buildWorkflowPlan,
    executeSingleAttempt,
    parseOutput,
    classifyError,
    decideNextAction,
  };
}
