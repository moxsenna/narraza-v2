// foundation.propose: refine foundation via AI after concept accept
// Always available regenerate path. Does NOT auto-lock.

import type { OperationalUnitOfWork, FullTxPorts } from '../../unit-of-work.js';
import type { AIExecutionPort } from '@narraza/ai';
import { issueQuote } from '../credit/issue-quote.js';
import { confirmAndEnqueue } from '../credit/confirm-and-enqueue.js';
import { buildDependencyManifest } from '@narraza/core';
import { randomUUID } from 'node:crypto';

export interface RequestFoundationProposeInput {
  userId: string;
  projectId: string;
  requestId?: string;
}

export interface RequestFoundationProposeOutput {
  jobId: string;
  reservationId: string;
  quoteId: string;
}

export async function requestFoundationPropose(
  uow: OperationalUnitOfWork,
  aiPort: AIExecutionPort,
  input: RequestFoundationProposeInput,
): Promise<RequestFoundationProposeOutput> {
  const requestId = input.requestId ?? `foundation-propose-${randomUUID()}`;

  const workflowPlan = aiPort.buildWorkflowPlan({
    jobType: 'foundation.propose',
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
    estimatedMaximumMicroIdr: 500000n,
    ttlSeconds: 300,
  });

  return uow.execute(async (ports) => {
    const fullPorts = ports as unknown as FullTxPorts;
    return confirmAndEnqueue(fullPorts, {
      userId: input.userId,
      projectId: input.projectId,
      quoteId: quote.quoteId,
      requestId,
      jobType: 'foundation.propose',
      workflowPlanHash,
      dependencyHash,
      workflowPlanId: workflowPlan.planId,
      payloadJson: { workflowPlan },
    });
  });
}

/**
 * Execute foundation.propose job — called by worker.
 */
export async function executeFoundationProposeJob(
  uow: OperationalUnitOfWork,
  aiPort: AIExecutionPort,
  jobId: string,
  workflowPlan: Record<string, unknown>,
): Promise<void> {
  const response = await aiPort.executeSingleAttempt({
    workflowPlan: workflowPlan as any,
    stageName: 'propose',
    invocationKey: 'v1',
    promptContractVersion: 'foundation.propose.v1',
    promptPayload: {},
  });

  const { FoundationProposeContract } = await import('@narraza/ai');
  aiPort.parseOutput(FoundationProposeContract, response.rawBody);

  await uow.execute(async (ports) => {
    const fullPorts = ports as unknown as FullTxPorts;
    await fullPorts.generationJobRepo.transitionStatus(jobId, 'running', 'succeeded', {
      terminalAt: new Date(),
      terminalReasonCode: 'completed',
    });
  });
}
