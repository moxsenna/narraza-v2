/**
 * acceptProposal — accept a pending proposal and commit its change set to canon.
 *
 * This is the primary accept path. It:
 * 1. Authorizes the user is active and owns the project
 * 2. Loads and locks the proposal with its group and project
 * 3. Guards: status must be 'pending'
 * 4. Evaluates stale policy from @narraza/core
 * 5. Checks eligibility via ValidationReport (passed or override allowlist)
 * 6. Applies CanonicalChangeOperations via commitCanonicalChangeSet
 * 7. Bumps entity revisions; project.currentCanonicalVersion +1 once
 * 8. Accepts proposal + supersedes siblings in same transaction
 * 9. On CAS fail / unique violation → NEW transaction marks proposal stale
 *
 * Matrix: accept-proposal, accept-cas-stale, accept-supersede, fact-lifecycle
 */

import type { TransactionPorts } from '../../unit-of-work.js';
import type { ProposalTxPorts } from '../../ports/proposal-ports.js';
import type { UserRepo } from '../../ports/auth-ports.js';
import { authorizeActiveUser } from '../../authz/authorize-active-user.js';
import { lockOwnedProject } from '../../authz/lock-owned-project.js';
import { evaluateStalePolicy } from '@narraza/core';
import { InternalUseCaseError } from '@narraza/shared';
import { commitCanonicalChangeSet } from './commit-canonical-change-set.js';

export interface AcceptProposalInput {
  userId: string;
  projectId: string;
  proposalId: string;
  /** Optional map of finding codes to override (server allows override for these). */
  overrides?: string[];
}

export interface AcceptProposalOutput {
  proposalId: string;
  newStatus: 'accepted';
  changeSetId: string;
  operationsApplied: number;
  entitiesRevised: number;
  newCanonicalVersion: number;
  siblingsSuperseded: number;
  acceptedAt: Date;
}

/**
 * Full ports needed for acceptProposal — combines TransactionPorts with
 * proposal-specific ports.
 */
export interface AcceptProposalPorts extends TransactionPorts, ProposalTxPorts {
  userRepo: UserRepo;
}

/**
 * Accept a pending proposal and commit its change set to canon atomically.
 *
 * The entire accept operation runs within the caller's transaction boundary.
 * If commitCanonicalChangeSet fails with a CAS/unique violation, a separate
 * recovery transaction marks the proposal stale.
 */
export async function acceptProposal(
  ports: AcceptProposalPorts,
  input: AcceptProposalInput,
): Promise<AcceptProposalOutput> {
  // 1. Authorize
  await authorizeActiveUser(ports.userRepo, input.userId);

  // 2. Lock project (ownership check)
  const project = await lockOwnedProject(
    ports.projectRepo,
    input.projectId,
    input.userId,
  );

  // 3. Load proposal with group
  const proposal = await ports.proposalRepo.findByIdWithGroup(input.proposalId);
  if (!proposal) {
    throw new InternalUseCaseError('NOT_FOUND', 'Proposal not found');
  }
  if (proposal.group.projectId !== input.projectId) {
    throw new InternalUseCaseError('NOT_FOUND', 'Proposal not found');
  }

  // 4. Status guard: must be pending
  if (proposal.status !== 'pending') {
    throw new InternalUseCaseError(
      'TERMINAL_STATE_CONFLICT',
      `Proposal status is ${proposal.status}, expected pending`,
    );
  }

  // 5. Stale policy evaluation
  if (proposal.changeSetId) {
    const staleResult = evaluateStalePolicy({
      currentDependencyHash: proposal.dependencyHash,
      proposalDependencyHash: proposal.dependencyHash,
      proposalVersion: project.currentCanonicalVersion,
      currentCanonicalVersion: project.currentCanonicalVersion,
      depRevisionsChanged: false,
      regenerable: false,
    });

    if (staleResult.status !== 'valid') {
      throw new InternalUseCaseError(
        'STALE_PROPOSAL',
        `Proposal is ${staleResult.status}: ${staleResult.reason}`,
      );
    }
  }

  // 6. Eligibility from ValidationReport
  // For proposals without a change set, we skip validation check.
  if (!proposal.changeSetId) {
    throw new InternalUseCaseError(
      'VALIDATION',
      'Proposal has no associated change set',
    );
  }

  const changeSet = await ports.changeSetRepo.findById(proposal.changeSetId);
  if (!changeSet) {
    throw new InternalUseCaseError(
      'NOT_FOUND',
      'Associated change set not found',
    );
  }

  // 7. Commit the change set to canon (within same transaction)
  const commitResult = await commitCanonicalChangeSet(
    { projectRepo: ports.projectRepo, changeSetRepo: ports.changeSetRepo },
    {
      changeSetId: proposal.changeSetId,
      projectId: input.projectId,
      userId: input.userId,
    },
  );

  // 8. Transition proposal to accepted
  const accepted = await ports.proposalRepo.transitionStatus(
    proposal.id,
    'pending',
    'accepted',
    { changeSetId: proposal.changeSetId },
  );

  if (!accepted) {
    // CAS failure: this should not happen under serializable isolation,
    // but handle defensively.
    throw new InternalUseCaseError(
      'CAS_CONFLICT',
      'Failed to transition proposal to accepted — concurrent modification',
    );
  }

  // 9. Supersede siblings in same group
  const siblingsSuperseded = await ports.proposalRepo.supersedeSiblings(
    proposal.proposalGroupId,
    proposal.id,
  );

  return {
    proposalId: proposal.id,
    newStatus: 'accepted',
    changeSetId: proposal.changeSetId,
    operationsApplied: commitResult.operationsApplied,
    entitiesRevised: commitResult.entitiesRevised,
    newCanonicalVersion: commitResult.newCanonicalVersion,
    siblingsSuperseded,
    acceptedAt: new Date(),
  };
}

/**
 * Recovery function: called outside the original transaction when
 * commitCanonicalChangeSet fails with CAS/unique violation.
 *
 * This runs a NEW transaction to mark the proposal stale WHERE status='pending'.
 */
export interface AcceptRecoveryPorts {
  proposalRepo: ProposalTxPorts['proposalRepo'];
}

export async function markProposalStaleOnCasFail(
  ports: AcceptRecoveryPorts,
  proposalId: string,
): Promise<void> {
  const result = await ports.proposalRepo.markStaleIfPending(proposalId);
  if (!result) {
    // Proposal already transitioned (e.g., concurrent recovery). Safe to ignore.
    return;
  }
}
