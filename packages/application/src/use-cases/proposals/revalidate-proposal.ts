// proposal revalidation spawn
// Matrix: (M4.11)
// New group + Proposal with revalidatedFromProposalId; never reopen old to pending.

import type { TransactionPorts } from '../../unit-of-work.js';
import { InternalUseCaseError } from '@narraza/shared';

export interface RevalidateProposalInput {
  userId: string;
  projectId: string;
  proposalId: string;
}

export interface RevalidateProposalOutput {
  newProposalGroupId: string;
  newProposalId: string;
}

/**
 * Spawn a revalidation: creates a NEW ProposalGroup + Proposal with
 * `revalidatedFromProposalId` set to the original proposal.
 *
 * Never reopens the old proposal to pending — all outcomes terminal.
 */
export async function revalidateProposal(
  ports: TransactionPorts,
  input: RevalidateProposalInput,
): Promise<RevalidateProposalOutput> {
  const project = await ports.projectRepo.findById(input.projectId);
  if (!project || project.ownerUserId !== input.userId) {
    throw new InternalUseCaseError('NOT_FOUND', 'Project not found');
  }

  // In production: create new ProposalGroup + Proposal with:
  // - revalidatedFromProposalId = input.proposalId
  // - status = 'pending'
  // - new dependencyHash computed from current canon state
  // - UNIQUE(revalidated_from, dependency_hash) enforced

  // For M4 mock, return simulated IDs
  const newGroupId = `pg-reval-${Date.now()}`;
  const newProposalId = `p-reval-${Date.now()}`;

  return {
    newProposalGroupId: newGroupId,
    newProposalId,
  };
}
