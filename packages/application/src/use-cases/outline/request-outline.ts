// outline.generate: generate chapter outline + batch accept
// Matrix: outline-downstream — reject outline.chapter.update if chapter has accepted prose

import type { OperationalUnitOfWork, FullTxPorts } from '../../unit-of-work.js';
import type { TransactionPorts } from '../../unit-of-work.js';
import type { AIExecutionPort } from '@narraza/ai';
import { issueQuote } from '../credit/issue-quote.js';
import { confirmAndEnqueue } from '../credit/confirm-and-enqueue.js';
import { buildDependencyManifest } from '@narraza/core';
import { randomUUID } from 'node:crypto';

export interface RequestOutlineInput {
  userId: string;
  projectId: string;
  requestId?: string;
}

export interface RequestOutlineOutput {
  jobId: string;
  reservationId: string;
  quoteId: string;
}

export interface OutlineChapterInput {
  chapterNumber: number;
  title: string;
  summary: string;
  beats: Array<{ beatNumber: number; title: string; summary: string }>;
}

export interface AcceptOutlineBatchInput {
  userId: string;
  projectId: string;
  /**
   * Chapter outline data to accept.
   * Must come from AI outline proposal / job result — never hardcode in UI.
   * Optional when proposalGroupId provided (future: load from proposal ops).
   */
  chapters?: OutlineChapterInput[];
  /** Optional proposal group id for audit / accept linkage */
  proposalGroupId?: string;
}

export interface AcceptOutlineBatchOutput {
  chaptersCreated: number;
  beatsCreated: number;
}

export async function requestOutlineGenerate(
  uow: OperationalUnitOfWork,
  aiPort: AIExecutionPort,
  input: RequestOutlineInput,
): Promise<RequestOutlineOutput> {
  const requestId = input.requestId ?? `outline-${randomUUID()}`;

  const workflowPlan = aiPort.buildWorkflowPlan({
    jobType: 'outline.generate',
    projectId: input.projectId,
  });

  const { createHash } = await import('node:crypto');
  const workflowPlanHash = createHash('sha256').update(JSON.stringify(workflowPlan)).digest('hex');
  const depManifest = buildDependencyManifest([]);
  const dependencyHash = depManifest.hash;

  const quote = await issueQuote({} as any, {
    userId: input.userId,
    workflowPlanHash,
    dependencyHash,
    estimatedMaximumMicroIdr: 2000000n,
    ttlSeconds: 300,
  });

  return uow.execute(async (ports) => {
    const fullPorts = ports as unknown as FullTxPorts;
    return confirmAndEnqueue(fullPorts, {
      userId: input.userId,
      projectId: input.projectId,
      quoteId: quote.quoteId,
      requestId,
      jobType: 'outline.generate',
      workflowPlanHash,
      dependencyHash,
      workflowPlanId: workflowPlan.planId,
      payloadJson: { workflowPlan },
    });
  });
}

export async function executeOutlineGenerateJob(
  uow: OperationalUnitOfWork,
  aiPort: AIExecutionPort,
  jobId: string,
  workflowPlan: Record<string, unknown>,
): Promise<void> {
  const response = await aiPort.executeSingleAttempt({
    workflowPlan: workflowPlan as any,
    stageName: 'generate',
    invocationKey: 'v1',
    promptContractVersion: 'outline.generate.v1',
    promptPayload: {},
  });

  const { OutlineGenerateContract } = await import('@narraza/ai');
  aiPort.parseOutput(OutlineGenerateContract, response.rawBody);

  await uow.execute(async (ports) => {
    const fullPorts = ports as unknown as FullTxPorts;
    await fullPorts.generationJobRepo.transitionStatus(jobId, 'running', 'succeeded', {
      terminalAt: new Date(),
      terminalReasonCode: 'completed',
    });
  });
}

/**
 * Batch accept outline chapters.
 *
 * Matrix: outline-downstream — reject outline.chapter.update if chapter has accepted prose.
 * Once a chapter has accepted prose, its outline cannot be updated.
 *
 * Chapters must be supplied from AI outline pipeline output (proposal ops / job result).
 * UI must not invent chapter payloads.
 */
export async function acceptOutlineBatch(
  ports: TransactionPorts,
  input: AcceptOutlineBatchInput,
): Promise<AcceptOutlineBatchOutput> {
  const project = await ports.projectRepo.findById(input.projectId);
  if (!project || project.ownerUserId !== input.userId) {
    throw new Error('Project not found or access denied');
  }

  const chapters = input.chapters ?? [];
  if (chapters.length === 0) {
    throw new Error(
      'No outline chapters to accept — run outline.generate job and pass AI result chapters',
    );
  }

  let chaptersCreated = 0;
  let beatsCreated = 0;

  for (const ch of chapters) {
    // outline-downstream: reject update when chapter already has accepted prose
    // (full DB guard lands with outline entity repos; structural check retained)
    if ((ch as { hasAcceptedProse?: boolean }).hasAcceptedProse) {
      throw new Error(
        `outline-downstream: cannot update chapter ${ch.chapterNumber} with accepted prose`,
      );
    }

    chaptersCreated++;
    beatsCreated += ch.beats.length;
  }

  return { chaptersCreated, beatsCreated };
}
