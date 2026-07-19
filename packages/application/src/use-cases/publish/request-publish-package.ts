// publish.package: artifact proposal only — does NOT bump canonical version
// Matrix: publish-artifact

import type { OperationalUnitOfWork, FullTxPorts } from '../../unit-of-work.js';
import type { AIExecutionPort } from '@narraza/ai';
import { issueQuote } from '../credit/issue-quote.js';
import { confirmAndEnqueue } from '../credit/confirm-and-enqueue.js';
import { buildDependencyManifest } from '@narraza/core';
import { randomUUID } from 'node:crypto';

export interface RequestPublishPackageInput {
  userId: string;
  projectId: string;
  artifactType: 'epub' | 'marked_text' | 'html_chapter';
  requestId?: string;
}

export interface RequestPublishPackageOutput {
  jobId: string;
  reservationId: string;
  quoteId: string;
}

export async function requestPublishPackage(
  uow: OperationalUnitOfWork,
  aiPort: AIExecutionPort,
  input: RequestPublishPackageInput,
): Promise<RequestPublishPackageOutput> {
  const requestId = input.requestId ?? `publish-${randomUUID()}`;

  const workflowPlan = aiPort.buildWorkflowPlan({
    jobType: 'publish.package',
    projectId: input.projectId,
    context: { artifactType: input.artifactType },
  });

  const { createHash } = await import('node:crypto');
  const workflowPlanHash = createHash('sha256').update(JSON.stringify(workflowPlan)).digest('hex');
  const depManifest = buildDependencyManifest([]);
  const dependencyHash = depManifest.hash;

  const quote = await issueQuote({} as any, {
    userId: input.userId,
    workflowPlanHash,
    dependencyHash,
    estimatedMaximumMicroIdr: 1000000n,
    ttlSeconds: 300,
  });

  return uow.execute(async (ports) => {
    const fullPorts = ports as unknown as FullTxPorts;
    return confirmAndEnqueue(fullPorts, {
      userId: input.userId,
      projectId: input.projectId,
      quoteId: quote.quoteId,
      requestId,
      jobType: 'publish.package',
      workflowPlanHash,
      dependencyHash,
      workflowPlanId: workflowPlan.planId,
      payloadJson: {
        artifactType: input.artifactType,
        workflowPlan,
      },
    });
  });
}

/**
 * Execute publish.package job.
 * ArtifactProposal only — does NOT bump currentCanonicalVersion.
 */
export async function executePublishPackageJob(
  uow: OperationalUnitOfWork,
  aiPort: AIExecutionPort,
  jobId: string,
  workflowPlan: Record<string, unknown>,
): Promise<void> {
  const response = await aiPort.executeSingleAttempt({
    workflowPlan: workflowPlan as any,
    stageName: 'package',
    invocationKey: 'v1',
    promptContractVersion: 'publish.package.v1',
    promptPayload: {},
  });

  const { PublishPackageContract } = await import('@narraza/ai');
  aiPort.parseOutput(PublishPackageContract, response.rawBody);

  await uow.execute(async (ports) => {
    const fullPorts = ports as unknown as FullTxPorts;
    await fullPorts.generationJobRepo.transitionStatus(jobId, 'running', 'succeeded', {
      terminalAt: new Date(),
      terminalReasonCode: 'completed',
    });
  });
}
