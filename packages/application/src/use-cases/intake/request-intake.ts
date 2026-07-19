// intake.extract: request intake → job enqueue (quote + confirm pattern)
// Web never calls LLM — always through job pipeline.
import type { OperationalUnitOfWork, FullTxPorts } from '../../unit-of-work.js';
import type { AIExecutionPort } from '@narraza/ai';
import { issueQuote } from '../credit/issue-quote.js';
import { confirmAndEnqueue } from '../credit/confirm-and-enqueue.js';
import { buildDependencyManifest } from '@narraza/core';
import type { DependencyEntry } from '@narraza/core';
import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';

export interface RequestIntakeInput {
  userId: string;
  projectId: string;
  /** Idea or description provided by user */
  userInput: string;
  /** Idempotency key */
  requestId?: string;
}

export interface RequestIntakeOutput {
  jobId: string;
  reservationId: string;
  quoteId: string;
}

/**
 * Request intake.extract for a project.
 *
 * 1. Build dependency manifest from current state (empty for initial intake)
 * 2. Build workflow plan hash
 * 3. Issue credit quote
 * 4. Confirm quote → create job → enqueue
 */
export async function requestIntake(
  uow: OperationalUnitOfWork,
  aiPort: AIExecutionPort,
  input: RequestIntakeInput,
): Promise<RequestIntakeOutput> {
  const requestId = input.requestId ?? `intake-${randomUUID()}`;

  // Build workflow plan
  const workflowPlan = aiPort.buildWorkflowPlan({
    jobType: 'intake.extract',
    projectId: input.projectId,
    context: { userInput: input.userInput },
  });

  const workflowPlanHash = createHash('sha256').update(JSON.stringify(workflowPlan)).digest('hex');

  // Build dependency manifest (empty for intake — no canon yet)
  const depManifest = buildDependencyManifest([]);
  const dependencyHash = depManifest.hash;

  // Issue quote
  const quote = await issueQuote(
    {} as any, // quoteRepo will be provided through the UoW when used with full ports
    {
      userId: input.userId,
      workflowPlanHash,
      dependencyHash,
      estimatedMaximumMicroIdr: 1000000n, // ~10 cents mock
      ttlSeconds: 300,
    },
  );

  // Confirm and enqueue
  const result = await uow.execute(async (ports) => {
    const fullPorts = ports as unknown as FullTxPorts;
    return confirmAndEnqueue(fullPorts, {
      userId: input.userId,
      projectId: input.projectId,
      quoteId: quote.quoteId,
      requestId,
      jobType: 'intake.extract',
      workflowPlanHash,
      dependencyHash,
      workflowPlanId: workflowPlan.planId,
      payloadJson: {
        userInput: input.userInput,
        workflowPlan: workflowPlan,
      },
    });
  });

  return result;
}

/**
 * Execute intake.extract job — called by worker.
 *
 * Pipeline:
 * 1. Execute AI attempt (intake.extract contract)
 * 2. Parse output
 * 3. Extract model suggestions (concept alternatives)
 * 4. Create ProposalGroup with alternatives
 * 5. Mark job succeeded
 */
export async function executeIntakeJob(
  uow: OperationalUnitOfWork,
  aiPort: AIExecutionPort,
  jobId: string,
  workflowPlan: Record<string, unknown>,
): Promise<void> {
  const plan = workflowPlan as any;
  const stageName = 'extract';

  // Execute AI attempt
  const response = await aiPort.executeSingleAttempt({
    workflowPlan: plan,
    stageName,
    invocationKey: 'v1',
    promptContractVersion: 'intake.extract.v1',
    promptPayload: {},
  });

  // Parse output
  const output = aiPort.parseOutput(
    await import('@narraza/ai').then((m) => m.IntakeExtractContract),
    response.rawBody,
  );

  // Create ProposalGroup with alternatives
  await uow.execute(async (ports) => {
    // In production: persist ProposalGroup, Proposal entries, GeneratedCandidate entries
    // For M4 mock: just mark job succeeded
    const fullPorts = ports as unknown as FullTxPorts;
    await fullPorts.generationJobRepo.transitionStatus(jobId, 'running', 'succeeded', {
      terminalAt: new Date(),
      terminalReasonCode: 'completed',
    });
  });
}

// hashWorkflowPlan replaced by direct createHash call using top-level import
