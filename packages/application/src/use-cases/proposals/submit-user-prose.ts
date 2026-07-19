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
import {
  runAndPersistProseValidation,
  type ProseValidationContext,
} from './prose-validation-gate.js';

export interface SubmitUserProseInput {
  userId: string;
  projectId: string;
  beatId: string;
  /**
   * Optional validation context for deterministic gates.
   * When omitted, a minimal context is built from project/beat ids.
   */
  validationContext?: ProseValidationContext;
  chapterId?: string;
  chapterNumber?: number;
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

  // 6. Snapshot working draft into immutable ProseVersion (new version always)
  const nextVersion = await ports.proseVersionRepo.nextVersion(input.beatId);
  const proseVersion = await ports.proseVersionRepo.create({
    beatId: input.beatId,
    version: nextVersion,
    content: draft.content,
    contentHash: draft.contentHash,
    status: 'draft',
  });

  // 7. Run deterministic validators + persist report (fail-open for submit;
  // accept path still blocks on blockers)
  const validationContext: ProseValidationContext =
    input.validationContext ?? {
      projectId: input.projectId,
      beatId: input.beatId,
      chapterId: input.chapterId ?? input.beatId,
      chapterNumber: input.chapterNumber ?? 0,
    };

  const validation = await runAndPersistProseValidation(
    ports.validationReportRepo,
    {
      proseContent: draft.content,
      proseVersionId: proseVersion.id,
      context: validationContext,
    },
  );

  // 8. Create a CanonicalChangeSet
  const changeSet = await ports.changeSetRepo.create({
    projectId: input.projectId,
    status: 'pending',
  });

  // 9. Create a prose.accept operation with proseVersionId + context for accept gate
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
      proseVersionId: proseVersion.id,
      chapterId: validationContext.chapterId,
      chapterNumber: validationContext.chapterNumber,
      source: 'user',
      validationContext,
      validationBindingHash: validation.bindingHash,
      validationPassed: validation.passed,
    },
  });

  // 10. Create ProposalGroup
  const group = await ports.proposalGroupRepo.create({
    projectId: input.projectId,
  });

  // 11. Create Proposal with source=user
  const proposal = await ports.proposalRepo.create({
    proposalGroupId: group.id,
    source: 'user',
    dependencyHash,
    operationsHash,
    revalidatedFromProposalId: null,
    changeSetId: changeSet.id,
  });

  return {
    proposalGroupId: group.id,
    proposalId: proposal.id,
    changeSetId: changeSet.id,
    proseVersionId: proseVersion.id,
    dependencyHash,
    operationsHash,
  };
}
