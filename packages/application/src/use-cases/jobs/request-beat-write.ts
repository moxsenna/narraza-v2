// beat.write + judge + repair: full generation pipeline
// Matrix: command-no-ai (web never calls executeSingleAttempt)
// Matrix: repair-reextract (integration test)

import type { OperationalUnitOfWork, FullTxPorts } from '../../unit-of-work.js';
import type { TransactionPorts } from '../../unit-of-work.js';
import type { AIExecutionPort } from '@narraza/ai';
import { issueQuote } from '../credit/issue-quote.js';
import { confirmAndEnqueue } from '../credit/confirm-and-enqueue.js';
import { buildDependencyManifest } from '@narraza/core';
import { randomUUID, createHash } from 'node:crypto';

// =============================================================================
// Request
// =============================================================================

export interface RequestBeatWriteInput {
  userId: string;
  projectId: string;
  chapterId: string;
  beatNumber: number;
  requestId?: string;
}

export interface RequestBeatWriteOutput {
  jobId: string;
  reservationId: string;
  quoteId: string;
}

export async function requestBeatWrite(
  uow: OperationalUnitOfWork,
  aiPort: AIExecutionPort,
  input: RequestBeatWriteInput,
): Promise<RequestBeatWriteOutput> {
  const requestId = input.requestId ?? `beat-write-${randomUUID()}`;

  const workflowPlan = aiPort.buildWorkflowPlan({
    jobType: 'beat.write',
    projectId: input.projectId,
    context: { chapterId: input.chapterId, beatNumber: input.beatNumber },
  });

  const { createHash } = await import('node:crypto');
  const workflowPlanHash = createHash('sha256').update(JSON.stringify(workflowPlan)).digest('hex');
  const depManifest = buildDependencyManifest([]);
  const dependencyHash = depManifest.hash;

  return uow.execute(async (ports) => {
    const quote = await issueQuote(ports.creditQuoteRepo, {
      userId: input.userId,
      workflowPlanHash,
      dependencyHash,
      estimatedMaximumMicroIdr: 5000000n,
      ttlSeconds: 300,
    });

    return confirmAndEnqueue(ports, {
      userId: input.userId,
      projectId: input.projectId,
      quoteId: quote.quoteId,
      requestId,
      jobType: 'beat.write',
      workflowPlanHash,
      dependencyHash,
      workflowPlanId: workflowPlan.planId,
      conflictKey: `beat-write:${input.projectId}:${input.chapterId}:${input.beatNumber}`,
      payloadJson: {
        chapterId: input.chapterId,
        beatNumber: input.beatNumber,
        workflowPlan,
      },
    });
  });
}

// =============================================================================
// Execute beat.write stage: write prose + suggestions
// =============================================================================

export async function executeBeatWriteStage(
  uow: OperationalUnitOfWork,
  aiPort: AIExecutionPort,
  jobId: string,
  workflowPlan: Record<string, unknown>,
): Promise<{ rawBody: string; candidates: unknown[] }> {
  const response = await aiPort.executeSingleAttempt({
    workflowPlan: workflowPlan as any,
    stageName: 'write',
    invocationKey: 'write:v1',
    promptContractVersion: 'beat.write.v1',
    promptPayload: {},
  });

  const { BeatWriteContract } = await import('@narraza/ai');
  const output = aiPort.parseOutput(BeatWriteContract, response.rawBody);

  return { rawBody: response.rawBody, candidates: output.candidates };
}

// =============================================================================
// Execute beat.judge stage: judge each candidate
// =============================================================================

export async function executeBeatJudgeStage(
  aiPort: AIExecutionPort,
  workflowPlan: Record<string, unknown>,
  candidateIndex: number,
): Promise<{ passed: boolean; findings: unknown[] }> {
  const response = await aiPort.executeSingleAttempt({
    workflowPlan: workflowPlan as any,
    stageName: 'judge',
    invocationKey: `judge:c${candidateIndex}`,
    promptContractVersion: 'beat.judge.v1',
    promptPayload: { candidateIndex },
  });

  const { BeatJudgeContract } = await import('@narraza/ai');
  const output = aiPort.parseOutput(BeatJudgeContract, response.rawBody);

  return { passed: output.passed, findings: output.findings };
}

// =============================================================================
// Execute beat.repair stage: full re-extraction
// Matrix: repair-reextract
// =============================================================================

export async function executeBeatRepairStage(
  aiPort: AIExecutionPort,
  workflowPlan: Record<string, unknown>,
  previousFindings: unknown[],
): Promise<{ repairedProse: string; suggestions: unknown[] }> {
  const response = await aiPort.executeSingleAttempt({
    workflowPlan: workflowPlan as any,
    stageName: 'repair',
    invocationKey: 'repair:v1',
    promptContractVersion: 'beat.repair.v1',
    promptPayload: { previousFindings },
  });

  const { BeatRepairContract } = await import('@narraza/ai');
  const output = aiPort.parseOutput(BeatRepairContract, response.rawBody);

  // Full re-extraction: new prose + new suggestions (NOT reusing old ops)
  return { repairedProse: output.repairedProse, suggestions: output.suggestions };
}

// =============================================================================
// Full beat pipeline: write → judge → [repair → judge] → persist prose → succeed
// =============================================================================

export async function executeBeatJob(
  uow: OperationalUnitOfWork,
  aiPort: AIExecutionPort,
  jobId: string,
  workflowPlan: Record<string, unknown>,
): Promise<void> {
  // Stage 1: write
  const writeResult = await executeBeatWriteStage(uow, aiPort, jobId, workflowPlan);

  // Stage 2: judge first candidate
  const judgeResult = await executeBeatJudgeStage(aiPort, workflowPlan, 1);

  let proseContent = writeResult.candidates[0] as any;
  let prose: string | null = null;

  // If not passed, attempt repair
  if (!judgeResult.passed) {
    // Stage 3: repair (full re-extraction)
    const repairResult = await executeBeatRepairStage(aiPort, workflowPlan, judgeResult.findings);
    prose = repairResult.repairedProse;
  } else if (proseContent && typeof proseContent.prose === 'string') {
    prose = proseContent.prose;
  }

  // Persist ProseVersion for the beat
  await uow.execute(async (ports) => {
    // Get job to find beat context
    const job = await ports.generationJobRepo.findById(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);

    const payload = job.payloadJson as Record<string, unknown>;
    const chapterId = payload.chapterId as string | undefined;
    const beatNumber = payload.beatNumber as number | undefined;

    if (chapterId && beatNumber) {
      const beat = await ports.beatRepo.findByChapterAndNumber(chapterId, beatNumber);
      if (beat && prose) {
        const version = await ports.proseVersionRepo.nextVersion(beat.id);
        await ports.proseVersionRepo.create({
          beatId: beat.id,
          version,
          content: prose,
          contentHash: createHash('sha256').update(prose).digest('hex'),
          status: 'draft',
        });
      }
    }

    // Mark job succeeded
    await ports.generationJobRepo.transitionStatus(jobId, 'running', 'succeeded', {
      terminalAt: new Date(),
      terminalReasonCode: 'completed',
    });
  });
}

// =============================================================================
// Request beat repair (explicit repair)
// =============================================================================

export interface RequestBeatRepairInput {
  userId: string;
  projectId: string;
  chapterId: string;
  beatNumber: number;
  requestId?: string;
}

export async function requestBeatRepair(
  uow: OperationalUnitOfWork,
  aiPort: AIExecutionPort,
  input: RequestBeatRepairInput,
): Promise<RequestBeatWriteOutput> {
  const requestId = input.requestId ?? `beat-repair-${randomUUID()}`;

  const workflowPlan = aiPort.buildWorkflowPlan({
    jobType: 'beat.repair',
    projectId: input.projectId,
    context: { chapterId: input.chapterId, beatNumber: input.beatNumber },
  });

  const { createHash } = await import('node:crypto');
  const workflowPlanHash = createHash('sha256').update(JSON.stringify(workflowPlan)).digest('hex');
  const depManifest = buildDependencyManifest([]);
  const dependencyHash = depManifest.hash;

  return uow.execute(async (ports) => {
    const quote = await issueQuote(ports.creditQuoteRepo, {
      userId: input.userId,
      workflowPlanHash,
      dependencyHash,
      estimatedMaximumMicroIdr: 3000000n,
      ttlSeconds: 300,
    });

    return confirmAndEnqueue(ports, {
      userId: input.userId,
      projectId: input.projectId,
      quoteId: quote.quoteId,
      requestId,
      jobType: 'beat.repair',
      workflowPlanHash,
      dependencyHash,
      workflowPlanId: workflowPlan.planId,
      conflictKey: `beat-repair:${input.projectId}:${input.chapterId}:${input.beatNumber}`,
      payloadJson: {
        chapterId: input.chapterId,
        beatNumber: input.beatNumber,
        workflowPlan,
      },
    });
  });
}
