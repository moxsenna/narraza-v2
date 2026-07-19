// Tests for AIExecutionPort, mock provider, and prompt contracts
import { describe, expect, it } from 'vitest';
import { createMockAIExecutionPort } from '../execution-port.js';
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
} from '../prompts/contracts/index.js';

// =============================================================================
// AIExecutionPort tests
// =============================================================================

describe('AIExecutionPort', () => {
  const port = createMockAIExecutionPort();

  describe('buildWorkflowPlan', () => {
    it('builds plan for intake.extract job type', () => {
      const plan = port.buildWorkflowPlan({
        jobType: 'intake.extract',
        projectId: 'p1',
      });
      expect(plan.stages).toHaveLength(1);
      expect(plan.stages[0]!.promptContractVersion).toBe('intake.extract.v1');
      expect(plan.planId).toContain('plan-intake.extract');
    });

    it('builds plan for beat.write with write+judge stages', () => {
      const plan = port.buildWorkflowPlan({
        jobType: 'beat.write',
        projectId: 'p1',
      });
      expect(plan.stages).toHaveLength(2);
      expect(plan.stages[0]!.promptContractVersion).toBe('beat.write.v1');
      expect(plan.stages[1]!.promptContractVersion).toBe('beat.judge.v1');
    });

    it('builds plan for beat.repair with repair+judge stages', () => {
      const plan = port.buildWorkflowPlan({
        jobType: 'beat.repair',
        projectId: 'p1',
      });
      expect(plan.stages).toHaveLength(2);
      expect(plan.stages[0]!.promptContractVersion).toBe('beat.repair.v1');
    });

    it('each stage has maxInvocations set', () => {
      const plan = port.buildWorkflowPlan({
        jobType: 'beat.write',
        projectId: 'p1',
      });
      for (const stage of plan.stages) {
        expect(stage.maxInvocations).toBeGreaterThan(0);
        expect(stage.routingPlan.provider).toBe('mock');
        expect(stage.routingPlan.mode).toBe('structured');
      }
    });
  });

  describe('executeSingleAttempt', () => {
    it('executes intake.extract.v1 and returns valid JSON', async () => {
      const plan = port.buildWorkflowPlan({ jobType: 'intake.extract', projectId: 'p1' });
      const response = await port.executeSingleAttempt({
        workflowPlan: plan,
        stageName: 'extract',
        invocationKey: 'v1',
        promptContractVersion: 'intake.extract.v1',
        promptPayload: {},
      });

      expect(response.attemptId).toContain('mock-attempt-');
      expect(response.stageName).toBe('extract');
      expect(response.providerRequestId).toContain('mock-req-');
      expect(response.usage).toBeDefined();
      expect(response.usage!.costMicroIdr).toBe(0n);

      // Parse and validate
      const parsed = port.parseOutput(IntakeExtractContract, response.rawBody);
      expect(parsed.alternatives).toHaveLength(3);
      expect(parsed.alternatives[0]!.title).toBeDefined();
    });

    it('executes beat.write.v1 with multiple candidates', async () => {
      const plan = port.buildWorkflowPlan({ jobType: 'beat.write', projectId: 'p1' });
      const response = await port.executeSingleAttempt({
        workflowPlan: plan,
        stageName: 'write',
        invocationKey: 'v1',
        promptContractVersion: 'beat.write.v1',
        promptPayload: {},
      });

      const parsed = port.parseOutput(BeatWriteContract, response.rawBody);
      expect(parsed.candidates).toHaveLength(2);
      expect(parsed.candidates[0]!.prose.length).toBeGreaterThan(10);
    });

    it('executes beat.judge.v1 with publicMessageCode', async () => {
      const plan = port.buildWorkflowPlan({ jobType: 'beat.write', projectId: 'p1' });
      const response = await port.executeSingleAttempt({
        workflowPlan: plan,
        stageName: 'judge',
        invocationKey: 'v1',
        promptContractVersion: 'beat.judge.v1',
        promptPayload: {},
      });

      const parsed = port.parseOutput(BeatJudgeContract, response.rawBody);
      expect(parsed.findings.length).toBeGreaterThan(0);
      expect(parsed.findings[0]!.publicMessageCode).toBeDefined();
    });

    it('executes beat.repair.v1 with full re-extract', async () => {
      const plan = port.buildWorkflowPlan({ jobType: 'beat.repair', projectId: 'p1' });
      const response = await port.executeSingleAttempt({
        workflowPlan: plan,
        stageName: 'repair',
        invocationKey: 'v1',
        promptContractVersion: 'beat.repair.v1',
        promptPayload: {},
      });

      const parsed = port.parseOutput(BeatRepairContract, response.rawBody);
      expect(parsed.repairedProse.length).toBeGreaterThan(10);
      expect(parsed.suggestions.length).toBeGreaterThan(0);
    });

    it('throws for unknown contract version', async () => {
      const plan = port.buildWorkflowPlan({ jobType: 'intake.extract', projectId: 'p1' });
      await expect(
        port.executeSingleAttempt({
          workflowPlan: plan,
          stageName: 'unknown',
          invocationKey: 'v1',
          promptContractVersion: 'nonexistent.v1',
          promptPayload: {},
        }),
      ).rejects.toThrow('No mock registered');
    });
  });

  describe('parseOutput', () => {
    it('parses and validates against strict contract', () => {
      const raw = JSON.stringify({
        alternatives: [
          {
            altIndex: 1,
            title: 'Test',
            premise: 'A test premise with enough text',
            genre: 'Fiction',
            targetAudience: 'Adults',
            tone: 'Serious',
            pov: 'First person',
            suggestedCharacterNames: ['Alice'],
            summary: 'A summary with enough text to pass validation',
          },
        ],
      });

      const result = port.parseOutput(IntakeExtractContract, raw);
      expect(result.alternatives).toHaveLength(1);
    });

    it('throws on invalid data', () => {
      const raw = JSON.stringify({ alternatives: [{ altIndex: -1 }] });
      expect(() => port.parseOutput(IntakeExtractContract, raw)).toThrow();
    });

    it('throws on extra fields (strict mode)', () => {
      // Zod .strict() on outer object should reject extra keys at the root level
      const raw = JSON.stringify({
        alternatives: [
          {
            altIndex: 1,
            title: 'Test',
            premise: 'A test premise with enough text',
            genre: 'Fiction',
            targetAudience: 'Adults',
            tone: 'Serious',
            pov: 'First person',
            suggestedCharacterNames: ['Alice'],
            summary: 'A summary with enough text to pass validation',
          },
        ],
        extraTopLevelField: 'should not be here',
      });
      expect(() => port.parseOutput(IntakeExtractContract, raw)).toThrow();
    });
  });

  describe('classifyError', () => {
    it('classifies timeout errors as retryable', () => {
      const err = port.classifyError(new Error('Request timed out after 30s'));
      expect(err.errorCode).toBe('PROVIDER_TIMEOUT');
      expect(err.retryable).toBe(true);
    });

    it('classifies rate limit errors as retryable', () => {
      const err = port.classifyError(new Error('HTTP 429 Rate limit exceeded'));
      expect(err.errorCode).toBe('RATE_LIMITED');
      expect(err.retryable).toBe(true);
    });

    it('classifies auth errors as non-retryable', () => {
      const err = port.classifyError(new Error('401 Unauthorized'));
      expect(err.errorCode).toBe('PROVIDER_AUTH');
      expect(err.retryable).toBe(false);
    });

    it('classifies unknown errors with default', () => {
      const err = port.classifyError('some string error');
      expect(err.errorCode).toBe('UNKNOWN_ERROR');
      expect(err.retryable).toBe(false);
    });
  });

  describe('decideNextAction', () => {
    it('returns terminal for non-retryable errors', () => {
      const plan = port.buildWorkflowPlan({ jobType: 'intake.extract', projectId: 'p1' });
      const error = port.classifyError(new Error('403 Forbidden'));
      const action = port.decideNextAction(null, error, plan, 'v1');
      expect(action.type).toBe('terminal');
    });

    it('returns terminal when all stages complete', () => {
      const plan = port.buildWorkflowPlan({ jobType: 'beat.write', projectId: 'p1' });
      const action = port.decideNextAction(
        {
          attemptId: 'a1',
          stageName: 'judge',
          invocationKey: 'v1',
          rawBody: '{}',
          completedAt: new Date().toISOString(),
        },
        null,
        plan,
        'beat.judge.v1',
      );
      expect(action.type).toBe('terminal');
    });
  });
});

// =============================================================================
// Contract validation tests (confirm all contracts are strict)
// =============================================================================

describe('Prompt Contracts', () => {
  it('intake.extract.v1 is strict', () => {
    const mock = {
      alternatives: [
        {
          altIndex: 1,
          title: 'Test',
          premise: 'A good enough premise with more characters for validation',
          genre: 'Fiction',
          targetAudience: 'Adults',
          tone: 'Dark',
          pov: 'First',
          suggestedCharacterNames: ['A'],
          summary: 'A summary that has enough words to satisfy minimum length requirements',
        },
      ],
    };
    const result = IntakeExtractContract.parse(mock);
    expect(result.alternatives).toHaveLength(1);
  });

  it('foundation.propose.v1 is strict', () => {
    const mock = {
      proposals: [
        { section: 'premise', field: 'concept', proposedValue: 'New idea', rationale: 'Because reasons', confidence: 0.8 },
      ],
    };
    const result = FoundationProposeContract.parse(mock);
    expect(result.proposals).toHaveLength(1);
  });

  it('character.propose.v1 is strict', () => {
    const mock = {
      characters: [
        { name: 'Alice', role: 'Hero', description: 'A brave person', traits: ['Brave'], suggestedFacts: [] },
      ],
    };
    const result = CharacterProposeContract.parse(mock);
    expect(result.characters).toHaveLength(1);
  });

  it('outline.generate.v1 has 10 chapters', async () => {
    const { mockOutlineGenerateOutput } = await import('../prompts/contracts/outline-generate.mock.js');
    const mock = mockOutlineGenerateOutput();
    const result = OutlineGenerateContract.parse(mock);
    expect(result.chapters).toHaveLength(10);
  });

  it('beat.write.v1 has multiple candidates with suggestions', async () => {
    const { mockBeatWriteOutput } = await import('../prompts/contracts/beat-write.mock.js');
    const mock = mockBeatWriteOutput();
    const result = BeatWriteContract.parse(mock);
    expect(result.candidates.length).toBeGreaterThanOrEqual(1);
    expect(result.candidates[0]!.suggestions.length).toBeGreaterThan(0);
  });

  it('beat.judge.v1 uses publicMessageCode', () => {
    const mock = {
      candidateIndex: 1,
      passed: true,
      findings: [
        { code: 'test', severity: 'info', publicMessageCode: 'generic_passable' },
      ],
    };
    const result = BeatJudgeContract.parse(mock);
    expect(result.findings[0]!.publicMessageCode).toBe('generic_passable');
    // internalRationale is optional
    expect(result.findings[0]!.internalRationale).toBeUndefined();
  });

  it('beat.judge.v1 rejects invalid publicMessageCode', () => {
    const mock = {
      candidateIndex: 1,
      passed: true,
      findings: [
        { code: 'test', severity: 'info', publicMessageCode: 'INVALID_CODE' },
      ],
    };
    expect(() => BeatJudgeContract.parse(mock)).toThrow();
  });

  it('beat.repair.v1 has full re-extraction shape', () => {
    const mock = {
      repairedProse: 'This is repaired prose with enough length to pass the minimum validation',
      suggestions: [],
      addressedFindings: ['f1'],
    };
    const result = BeatRepairContract.parse(mock);
    expect(result.repairedProse).toBeDefined();
  });

  it('judge-output.repair.v1 passes', () => {
    const mock = {
      revisedFindings: [
        { code: 'test', severity: 'warning', publicMessageCode: 'generic_passable' },
      ],
      passed: true,
    };
    const result = JudgeOutputRepairContract.parse(mock);
    expect(result.passed).toBe(true);
  });

  it('publish.package.v1 is strict', () => {
    const mock = {
      artifactType: 'marked_text',
      contentHash: 'abc123',
      metadata: { title: 'Book', chapterCount: 1, wordCount: 1000, generatedAt: '2024-01-01' },
      chapters: [{ chapterNumber: 1, title: 'Ch1', content: 'Hello', wordCount: 1 }],
    };
    const result = PublishPackageContract.parse(mock);
    expect(result.artifactType).toBe('marked_text');
  });
});
