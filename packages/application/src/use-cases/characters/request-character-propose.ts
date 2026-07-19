// character.propose pipeline: character proposals via AI
// Same pipeline machinery as foundation.propose

import type { OperationalUnitOfWork, FullTxPorts } from '../../unit-of-work.js';
import type { AIExecutionPort } from '@narraza/ai';
import { issueQuote } from '../credit/issue-quote.js';
import { confirmAndEnqueue } from '../credit/confirm-and-enqueue.js';
import { buildDependencyManifest } from '@narraza/core';
import { randomUUID } from 'node:crypto';

export interface RequestCharacterProposeInput {
  userId: string;
  projectId: string;
  requestId?: string;
}

export interface RequestCharacterProposeOutput {
  jobId: string;
  reservationId: string;
  quoteId: string;
}

export async function requestCharacterPropose(
  uow: OperationalUnitOfWork,
  aiPort: AIExecutionPort,
  input: RequestCharacterProposeInput,
): Promise<RequestCharacterProposeOutput> {
  const requestId = input.requestId ?? `char-propose-${randomUUID()}`;

  const workflowPlan = aiPort.buildWorkflowPlan({
    jobType: 'character.propose',
    projectId: input.projectId,
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
      estimatedMaximumMicroIdr: 500000n,
      ttlSeconds: 300,
    });

    return confirmAndEnqueue(ports, {
      userId: input.userId,
      projectId: input.projectId,
      quoteId: quote.quoteId,
      requestId,
      jobType: 'character.propose',
      workflowPlanHash,
      dependencyHash,
      workflowPlanId: workflowPlan.planId,
      payloadJson: { workflowPlan },
    });
  });
}

export async function executeCharacterProposeJob(
  uow: OperationalUnitOfWork,
  aiPort: AIExecutionPort,
  jobId: string,
  workflowPlan: Record<string, unknown>,
): Promise<void> {
  const response = await aiPort.executeSingleAttempt({
    workflowPlan: workflowPlan as any,
    stageName: 'propose',
    invocationKey: 'v1',
    promptContractVersion: 'character.propose.v1',
    promptPayload: {},
  });

  const { CharacterProposeContract } = await import('@narraza/ai');
  aiPort.parseOutput(CharacterProposeContract, response.rawBody);

  await uow.execute(async (ports) => {
    const fullPorts = ports as unknown as FullTxPorts;
    await fullPorts.generationJobRepo.transitionStatus(jobId, 'running', 'succeeded', {
      terminalAt: new Date(),
      terminalReasonCode: 'completed',
    });
  });
}
