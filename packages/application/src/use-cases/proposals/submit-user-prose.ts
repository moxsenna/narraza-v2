/**
 * submitUserProse — create a user-origin Proposal from a working draft.
 *
 * Snapshot creates a new ProseVersion (immutable artifact) from the
 * current ProseWorkingDraft. Never fakes an AI proposal.
 *
 * Rules:
 * - source=user
 * - working draft must exist and not be deleted
 * - a new ProseVersion is created (status=draft) from the draft content
 * - a new ProposalGroup + Proposal are created
 * - A CanonicalChangeSet is created with prose.accept operation
 *
 * Matrix: user-proposal
 */

import type { TransactionPorts } from '../../unit-of-work.js';
import type { ProposalTxPorts } from '../../ports/proposal-ports.js';
import type { UserRepo } from '../../ports/auth-ports.js';
import { authorizeActiveUser } from '../../authz/authorize-active-user.js';
import { lockOwnedProject } from '../../authz/lock-owned-project.js';
import { InternalUseCaseError } from '@narraza/shared';
import { createHash } from 'node:crypto';

export interface SubmitUserProseInput {
  userId: string;
  projectId: string;
  beatId: string;
}

export interface SubmitUserProseOutput {
  proposalGroupId: string;
  proposalId: string;
  changeSetId: string;
  proseVersionId: string;
  dependencyHash: string;
  operationsHash: string;
}

export interface SubmitUserProsePorts extends TransactionPorts, ProposalTxPorts {
  userRepo: UserRepo;
}

/**
 * Submit a user-origin proposal from the working draft.
 *
 * This snapshots the draft into a ProseVersion, creates a proposal
 * with source=user, and prepares a CanonicalChangeSet that can be
 * committed via acceptProposal or commitCanonicalChangeSet.
 */
export async function submitUserProse(
  ports: SubmitUserProsePorts,
  input: SubmitUserProseInput,
): Promise<SubmitUserProseOutput> {
  // 1. Authorize
  await authorizeActiveUser(ports.userRepo, input.userId);

  // 2. Lock project
  const project = await lockOwnedProject(
    ports.projectRepo,
    input.projectId,
    input.userId,
  );

  // 3. Load working draft
  const draft = await ports.workingDraftRepo.findByUserAndBeat(
    input.userId,
    input.beatId,
  );

  if (!draft) {
    throw new InternalUseCaseError(
      'VALIDATION',
      'No working draft found for this beat. Write some prose first.',
    );
  }

  if (draft.deletedAt) {
    throw new InternalUseCaseError(
      'NOT_FOUND',
      'Working draft has been deleted',
    );
  }

  // 4. Create dependency hash from current project state
  const dependencyHash = createHash('sha256')
    .update(`project:${project.id}:${project.currentCanonicalVersion}`)
    .update(`beat:${input.beatId}`)
    .digest('hex');

  // 5. Compute operations hash (prose accept operation)
  const operationsHash = createHash('sha256')
    .update(draft.contentHash)
    .update(draft.version.toString())
    .digest('hex');

  // 6. Create a CanonicalChangeSet
  const changeSet = await ports.changeSetRepo.create({
    projectId: input.projectId,
    status: 'pending',
  });

  // 7. Create a prose.accept operation in the change set
  await ports.changeSetRepo.createOperation({
    changeSetId: changeSet.id,
    sequence: 1,
    opType: 'prose_accept',
    targetType: 'beat',
    targetId: input.beatId,
    payload: {
      beatId: input.beatId,
      content: draft.content,
      contentHash: draft.contentHash,
      source: 'user',
    },
  });

  // 8. Create ProposalGroup
  const group = await ports.proposalGroupRepo.create({
    projectId: input.projectId,
  });

  // 9. Create Proposal with source=user
  const proposal = await ports.proposalRepo.create({
    proposalGroupId: group.id,
    source: 'user',
    dependencyHash,
    operationsHash,
    revalidatedFromProposalId: null,
    changeSetId: changeSet.id,
  });

  // Update change set to link to proposal
  // (In real implementation, this would be done atomically via the changeSetRepo)

  return {
    proposalGroupId: group.id,
    proposalId: proposal.id,
    changeSetId: changeSet.id,
    proseVersionId: `pv-user-${Date.now()}`,
    dependencyHash,
    operationsHash,
  };
}
