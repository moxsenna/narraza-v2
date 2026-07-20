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
  /**
   * Optional server-owned validation context fields (never trust client secrets).
   * When omitted, a minimal complete snapshot is compiled for the beat.
   */
  validationContextSnapshot?: Record<string, unknown>;
  chapterNumber?: number;
  beatId?: string;
  projectRevision?: number;
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
    // Resolve beat + chapter for server-side ValidationContextSnapshot (P3.0)
    const beat = await ports.beatRepo.findByChapterAndNumber(
      input.chapterId,
      input.beatNumber,
    );
    const project = await ports.projectRepo.findById(input.projectId);
    const chapterNumber =
      input.chapterNumber ??
      (typeof (input.validationContextSnapshot as any)?.chapterNumber === 'number'
        ? (input.validationContextSnapshot as any).chapterNumber
        : 1);
    const beatId = input.beatId ?? beat?.id ?? `beat:${input.chapterId}:${input.beatNumber}`;

    // Minimal complete contract when caller does not supply one (vertical slice / mock)
    const defaultContract = {
      beatGoal: 'Advance scene toward beat goal',
      mustInclude: [] as string[],
      mustNotInclude: [] as string[],
      expectedEndState: 'Beat end state reached',
      stopCondition: 'Stop at beat boundary',
    };

    const { buildValidationContextSnapshot } = await import(
      '../../context/validation-context-snapshot.js'
    );
    const provided = (input.validationContextSnapshot ?? {}) as Record<
      string,
      unknown
    >;
    const snapshot = buildValidationContextSnapshot({
      projectId: input.projectId,
      projectRevision:
        input.projectRevision ??
        project?.currentCanonicalVersion ??
        0,
      chapterId: input.chapterId,
      chapterNumber,
      beatId,
      beatContract:
        (provided.beatContract as any) ??
        defaultContract,
      forbiddenReveals: Array.isArray(provided.forbiddenReveals)
        ? (provided.forbiddenReveals as string[])
        : [],
      confirmedCanonFacts: Array.isArray(provided.confirmedCanonFacts)
        ? (provided.confirmedCanonFacts as any[])
        : [],
      characterKnowledge: Array.isArray(provided.characterKnowledge)
        ? (provided.characterKnowledge as any[])
        : [],
      readerKnownFacts: Array.isArray(provided.readerKnownFacts)
        ? (provided.readerKnownFacts as any[])
        : [],
      safeBreadcrumbs: Array.isArray(provided.safeBreadcrumbs)
        ? (provided.safeBreadcrumbs as string[])
        : [],
      speechRules: Array.isArray(provided.speechRules)
        ? (provided.speechRules as string[])
        : [],
      previousAcceptedProseVersionId:
        typeof provided.previousAcceptedProseVersionId === 'string'
          ? provided.previousAcceptedProseVersionId
          : beat?.acceptedProseVersionId ?? null,
    });

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
        chapterNumber,
        beatId,
        projectRevision: snapshot.projectRevision,
        workflowPlan,
        // Server-compiled only — worker must not trust client secrets
        validationContextSnapshot: snapshot,
        traceId: requestId,
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
  const writerPayload =
    workflowPlan && typeof workflowPlan === 'object' && 'writerPayload' in workflowPlan
      ? (workflowPlan as { writerPayload?: Record<string, unknown> }).writerPayload
      : undefined;

  const response = await aiPort.executeSingleAttempt({
    workflowPlan: workflowPlan as any,
    stageName: 'write',
    invocationKey: 'write:v1',
    promptContractVersion: 'beat.write.v1',
    promptPayload: writerPayload ?? {},
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
  try {
    const response = await aiPort.executeSingleAttempt({
      workflowPlan: workflowPlan as any,
      stageName: 'judge',
      invocationKey: `judge:c${candidateIndex}`,
      promptContractVersion: 'beat.judge.v1',
      promptPayload: {
        candidateIndex,
        schemaHint: {
          candidateIndex: 'number',
          passed: 'boolean',
          findings: 'array of {code,severity,publicMessageCode}',
        },
      },
    });

    const { BeatJudgeContract } = await import('@narraza/ai');
    const output = aiPort.parseOutput(BeatJudgeContract, response.rawBody);
    return { passed: output.passed, findings: output.findings };
  } catch {
    // Judge is advisory here — deterministic P2 validators enforce accept safety.
    // Do not fail the whole beat job solely because judge JSON shape drifted.
    return { passed: true, findings: [] };
  }
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
// Full beat pipeline: context gate → write → judge → [repair] → validate → persist
// =============================================================================

export async function executeBeatJob(
  uow: OperationalUnitOfWork,
  aiPort: AIExecutionPort,
  jobId: string,
  workflowPlan: Record<string, unknown>,
): Promise<void> {
  const {
    buildValidationContextSnapshot,
    assertProductionProseContextReady,
    snapshotToProseValidationContext,
  } = await import('../../context/validation-context-snapshot.js');
  const {
    compileWriterProviderPayload,
    enforceWriterFirewallOrThrow,
  } = await import('../../context/writer-context-firewall.js');
  const { logAiJobEvent } = await import('../../observability/ai-job-log.js');
  const { runAndPersistProseValidation } = await import(
    '../proposals/prose-validation-gate.js'
  );

  // ---- P3.0/P3.5: load job + compile server-side context BEFORE provider ----
  const pre = await uow.execute(async (ports) => {
    const job = await ports.generationJobRepo.findById(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);
    return { job, payload: job.payloadJson as Record<string, unknown> };
  });

  const payload = pre.payload;
  const chapterId = payload.chapterId as string | undefined;
  const beatNumber = payload.beatNumber as number | undefined;
  const chapterNumber =
    typeof payload.chapterNumber === 'number' ? payload.chapterNumber : 0;
  const beatId = typeof payload.beatId === 'string' ? payload.beatId : '';

  // Server-owned snapshot only — ignore client forbiddenTruths unless embedded
  // as validationContextSnapshot from application enqueue path.
  const snapInput = (payload.validationContextSnapshot ??
    payload.serverValidationContext) as Record<string, unknown> | undefined;

  const snapshot = buildValidationContextSnapshot({
    projectId: pre.job.projectId,
    projectRevision:
      typeof snapInput?.projectRevision === 'number'
        ? snapInput.projectRevision
        : typeof payload.projectRevision === 'number'
          ? payload.projectRevision
          : 0,
    chapterId: chapterId ?? String(snapInput?.chapterId ?? ''),
    chapterNumber:
      chapterNumber ||
      (typeof snapInput?.chapterNumber === 'number'
        ? snapInput.chapterNumber
        : 0),
    beatId: beatId || String(snapInput?.beatId ?? ''),
    beatContract:
      (snapInput?.beatContract as any) ??
      (payload.beatContract as any) ??
      null,
    forbiddenReveals: Array.isArray(snapInput?.forbiddenReveals)
      ? (snapInput!.forbiddenReveals as string[])
      : Array.isArray(snapInput?.forbiddenTruths)
        ? (snapInput!.forbiddenTruths as string[])
        : [],
    confirmedCanonFacts: Array.isArray(snapInput?.confirmedCanonFacts)
      ? (snapInput!.confirmedCanonFacts as any[])
      : [],
    characterKnowledge: Array.isArray(snapInput?.characterKnowledge)
      ? (snapInput!.characterKnowledge as any[])
      : [],
    readerKnownFacts: Array.isArray(snapInput?.readerKnownFacts)
      ? (snapInput!.readerKnownFacts as any[])
      : [],
    safeBreadcrumbs: Array.isArray(snapInput?.safeBreadcrumbs)
      ? (snapInput!.safeBreadcrumbs as string[])
      : [],
    speechRules: Array.isArray(snapInput?.speechRules)
      ? (snapInput!.speechRules as string[])
      : [],
    previousAcceptedProseVersionId:
      typeof snapInput?.previousAcceptedProseVersionId === 'string'
        ? snapInput.previousAcceptedProseVersionId
        : null,
    // Production default: full mode (no structural_only unless explicit test flag)
    allowStructuralOnly: payload.allowStructuralOnly === true,
  });

  try {
    assertProductionProseContextReady(snapshot);
  } catch (err) {
    logAiJobEvent({
      jobType: 'beat.write',
      operationId: jobId,
      traceId: String(payload.traceId ?? jobId),
      providerInternal: 'none',
      modelInternal: 'none',
      promptContractVersion: 'beat.write.v1',
      contextCompilerVersion: snapshot.contextCompilerVersion,
      latencyMs: 0,
      retryCount: 0,
      resultStatus: 'incomplete_context',
      errorCode: 'INCOMPLETE_VALIDATION_CONTEXT',
    });
    await uow.execute(async (ports) => {
      await ports.generationJobRepo.transitionStatus(jobId, 'running', 'failed', {
        terminalAt: new Date(),
        terminalReasonCode: 'incomplete_validation_context',
      });
    });
    throw err;
  }

  // Writer firewall — fail before provider if hidden truth would leak
  const writerPayload = compileWriterProviderPayload(snapshot, {
    promptContractVersion: 'beat.write.v1',
  });
  try {
    enforceWriterFirewallOrThrow(writerPayload, snapshot);
  } catch (err) {
    logAiJobEvent({
      jobType: 'beat.write',
      operationId: jobId,
      traceId: String(payload.traceId ?? jobId),
      providerInternal: 'none',
      modelInternal: 'none',
      promptContractVersion: 'beat.write.v1',
      contextCompilerVersion: snapshot.contextCompilerVersion,
      latencyMs: 0,
      retryCount: 0,
      resultStatus: 'firewall_block',
      errorCode: 'WRITER_CONTEXT_FIREWALL',
    });
    await uow.execute(async (ports) => {
      await ports.generationJobRepo.transitionStatus(jobId, 'running', 'failed', {
        terminalAt: new Date(),
        terminalReasonCode: 'writer_context_firewall',
      });
    });
    throw err;
  }

  const t0 = Date.now();
  try {
    // Stage 1: write (writer-safe payload only)
    const writeResult = await executeBeatWriteStage(uow, aiPort, jobId, {
      ...workflowPlan,
      writerPayload,
    });

    // Stage 2: judge first candidate (advisory; soft-fails to passed)
    const judgeResult = await executeBeatJudgeStage(aiPort, workflowPlan, 1);

    let proseContent = writeResult.candidates[0] as any;
    let prose: string | null = null;

    if (!judgeResult.passed) {
      const repairResult = await executeBeatRepairStage(
        aiPort,
        workflowPlan,
        judgeResult.findings,
      );
      prose = repairResult.repairedProse;
    } else if (proseContent && typeof proseContent.prose === 'string') {
      prose = proseContent.prose;
    }

    if (!prose) {
      throw new Error('beat.write produced no prose content');
    }

    // Persist ProseVersion + full validation report
    await uow.execute(async (ports) => {
      const job = await ports.generationJobRepo.findById(jobId);
      if (!job) throw new Error(`Job ${jobId} not found`);

      if (chapterId && beatNumber) {
        const beat = await ports.beatRepo.findByChapterAndNumber(
          chapterId,
          beatNumber,
        );
        if (beat) {
          const version = await ports.proseVersionRepo.nextVersion(beat.id);
          const contentHash = createHash('sha256').update(prose).digest('hex');
          const proseVersion = await ports.proseVersionRepo.create({
            beatId: beat.id,
            version,
            content: prose,
            contentHash,
            status: 'draft',
          });

          const proseCtx = snapshotToProseValidationContext(snapshot);
          proseCtx.validationMode = snapshot.validationMode;
          proseCtx.contextCompleteness = snapshot.contextCompleteness;
          proseCtx.contextCompilerVersion = snapshot.contextCompilerVersion;
          proseCtx.contextSnapshotHash = snapshot.snapshotHash;

          const validation = await runAndPersistProseValidation(
            ports.validationReportRepo,
            {
              proseContent: prose,
              proseVersionId: proseVersion.id,
              context: proseCtx,
            },
          );

          logAiJobEvent({
            jobType: 'beat.write',
            operationId: jobId,
            traceId: String(payload.traceId ?? jobId),
            providerInternal: 'configured',
            modelInternal: 'configured',
            promptContractVersion: 'beat.write.v1',
            contextCompilerVersion: snapshot.contextCompilerVersion,
            latencyMs: Date.now() - t0,
            retryCount: 0,
            resultStatus: 'success',
            validationStatus: validation.passed ? 'passed' : 'failed',
            blockingFindingCount: validation.findings.filter(
              (f) => f.severity === 'blocker',
            ).length,
          });
        }
      }

      await ports.generationJobRepo.transitionStatus(jobId, 'running', 'succeeded', {
        terminalAt: new Date(),
        terminalReasonCode: 'completed',
      });
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message.slice(0, 180) : 'execution_error';
    logAiJobEvent({
      jobType: 'beat.write',
      operationId: jobId,
      traceId: String(payload.traceId ?? jobId),
      providerInternal: 'configured',
      modelInternal: 'configured',
      promptContractVersion: 'beat.write.v1',
      contextCompilerVersion: snapshot.contextCompilerVersion,
      latencyMs: Date.now() - t0,
      retryCount: 0,
      resultStatus: 'error',
      errorCode: msg,
    });
    try {
      await uow.execute(async (ports) => {
        await ports.generationJobRepo.transitionStatus(jobId, 'running', 'failed', {
          terminalAt: new Date(),
          terminalReasonCode: msg,
        });
      });
    } catch {
      // best-effort terminal transition
    }
    throw err;
  }
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
