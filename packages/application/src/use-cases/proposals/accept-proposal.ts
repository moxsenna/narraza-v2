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
 * 9. On CAS fail / unique violation → marks proposal stale (recovery)
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
import { isOverridable } from '../../dto/public-proposal-view.js';
import {
  assertProseAcceptEligible,
  computeContextSnapshotHash,
  computeValidationBindingHash,
  extractProseAcceptPayload,
  type ProseValidationContext,
} from './prose-validation-gate.js';
import {
  assertReportContextAcceptable,
  parseValidationMetaFromFindings,
} from '../../context/validation-context-snapshot.js';

export interface AcceptProposalInput {
  userId: string;
  projectId: string;
  proposalId: string;
  /** Optional finding codes to override (must be server-allowlisted). */
  overrides?: string[];
  /**
   * Current dependency hash from canon. When provided and differs from
   * proposal.dependencyHash, stale policy rejects accept.
   */
  currentDependencyHash?: string;
  /** Whether dependency entity revisions changed (feeds stale policy). */
  depRevisionsChanged?: boolean;
  /** Whether proposal can be regenerated (needs_revalidation vs stale). */
  regenerable?: boolean;
  /**
   * Optional prose version for ValidationReport eligibility check.
   * When omitted, eligibility check is skipped (e.g. pure structure proposals).
   */
  proseVersionId?: string;
  /** Optional content hash to match validation report binding. */
  contentHash?: string;
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
 * Full ports needed for acceptProposal — TransactionPorts already include
 * domain write repos (foundation/character/fact/beat/prose/chapter).
 */
export interface AcceptProposalPorts extends TransactionPorts, ProposalTxPorts {
  userRepo: UserRepo;
}

/**
 * Accept a pending proposal and commit its change set to canon atomically.
 *
 * The entire accept operation runs within the caller's transaction boundary.
 * If commitCanonicalChangeSet fails with a CAS/unique violation, recovery
 * marks the proposal stale WHERE status='pending'.
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

  // 5. Stale policy evaluation (dependency-based)
  const currentDependencyHash =
    input.currentDependencyHash ?? proposal.dependencyHash;
  const depRevisionsChanged =
    input.depRevisionsChanged ??
    currentDependencyHash !== proposal.dependencyHash;

  const staleResult = evaluateStalePolicy({
    currentDependencyHash,
    proposalDependencyHash: proposal.dependencyHash,
    proposalVersion: project.currentCanonicalVersion,
    currentCanonicalVersion: project.currentCanonicalVersion,
    depRevisionsChanged,
    regenerable: input.regenerable ?? true,
  });

  if (staleResult.status !== 'valid') {
    throw new InternalUseCaseError(
      'STALE_PROPOSAL',
      `Proposal is ${staleResult.status}: ${staleResult.reason}`,
    );
  }

  // 7. Require change set
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

  // 6. Eligibility from ValidationReport — REQUIRED for prose_accept paths
  const operations = await ports.changeSetRepo.findOperationsByChangeSetId(
    proposal.changeSetId,
  );
  const proseAccept = extractProseAcceptPayload(operations);

  if (proseAccept) {
    // Backend enforcement: prose accept cannot skip validation
    const proseVersionId =
      input.proseVersionId ?? proseAccept.proseVersionId ?? null;

    if (!proseVersionId) {
      throw new InternalUseCaseError(
        'VALIDATION',
        'Prose accept requires a proseVersionId (validate before accept)',
      );
    }

    const ctx: ProseValidationContext = proseAccept.validationContext ?? {
      projectId: input.projectId,
      beatId: proseAccept.beatId,
      chapterId: proseAccept.chapterId ?? proseAccept.beatId,
      chapterNumber: proseAccept.chapterNumber ?? 0,
    };

    // Prefer binding hash stored at validation time (stable across JSON reordering).
    // Fall back to recomputing from embedded/minimal context.
    const contextSnapshotHash = computeContextSnapshotHash(ctx);
    const recomputedBinding = computeValidationBindingHash(
      proseAccept.content,
      contextSnapshotHash,
    );
    const expectedBindingHash =
      proseAccept.validationBindingHash ?? recomputedBinding;

    const report =
      (await ports.validationReportRepo.findLatestByProseVersionId(
        proseVersionId,
      )) ?? null;

    // Match report by stored binding hash, recomputed binding, or legacy content hash
    if (
      report &&
      (report.contentHash === expectedBindingHash ||
        report.contentHash === recomputedBinding ||
        report.contentHash === proseAccept.contentHash ||
        (input.contentHash != null && report.contentHash === input.contentHash))
    ) {
      // P3.0: structural_only / incomplete context reports cannot accept production prose
      try {
        assertReportContextAcceptable(
          parseValidationMetaFromFindings(report.findings),
        );
      } catch (err) {
        throw new InternalUseCaseError(
          'VALIDATION',
          err instanceof Error ? err.message : 'Invalid validation context for accept',
        );
      }
      assertProseAcceptEligible({
        report,
        expectedBindingHash: report.contentHash,
        overrides: input.overrides,
        requireReport: true,
      });
    } else if (
      report &&
      !report.findings.some((f) => f.code === 'META_VALIDATOR_CONTEXT')
    ) {
      // Pre-P2 reports without meta: enforce blockers if content still matches
      if (
        input.contentHash &&
        report.contentHash !== input.contentHash &&
        report.contentHash !== proseAccept.contentHash
      ) {
        throw new InternalUseCaseError(
          'VALIDATION',
          'Validation report is stale (content or context changed). Re-validate before accept.',
        );
      }
      assertProseAcceptEligible({
        report,
        expectedBindingHash: report.contentHash,
        overrides: input.overrides,
        requireReport: true,
      });
    } else {
      // No usable report for this prose version — fail closed
      assertProseAcceptEligible({
        report: null,
        expectedBindingHash,
        overrides: input.overrides,
        requireReport: true,
      });
    }
  } else if (input.proseVersionId) {
    // Explicit proseVersionId without prose_accept op (structure-adjacent)
    const report = input.contentHash
      ? await ports.validationReportRepo.findValidReport(
          input.proseVersionId,
          input.contentHash,
        )
      : await ports.validationReportRepo.findLatestByProseVersionId(
          input.proseVersionId,
        );

    if (report && !report.passed) {
      const blockers = report.findings.filter((f) => f.severity === 'blocker');
      const overrideSet = new Set(input.overrides ?? []);
      const unresolved = blockers.filter((b) => {
        if (!isOverridable(b.code) && !isOverridable(b.publicMessageCode)) {
          return true;
        }
        return (
          !overrideSet.has(b.code) && !overrideSet.has(b.publicMessageCode)
        );
      });
      if (unresolved.length > 0) {
        throw new InternalUseCaseError(
          'VALIDATION',
          `Proposal not eligible: ${unresolved.length} blocking finding(s) without override`,
        );
      }
    }
  }

  try {
    // 8. Commit the change set to canon (within same transaction)
    const commitResult = await commitCanonicalChangeSet(
      {
        projectRepo: ports.projectRepo,
        changeSetRepo: ports.changeSetRepo,
        foundationRepo: ports.foundationRepo,
        characterRepo: ports.characterRepo,
        factRepo: ports.factRepo,
        beatRepo: ports.beatRepo,
        proseVersionRepo: ports.proseVersionRepo,
      },
      {
        changeSetId: proposal.changeSetId,
        projectId: input.projectId,
        userId: input.userId,
      },
    );

    // 9. Transition proposal to accepted
    const accepted = await ports.proposalRepo.transitionStatus(
      proposal.id,
      'pending',
      'accepted',
      { changeSetId: proposal.changeSetId },
    );

    if (!accepted) {
      throw new InternalUseCaseError(
        'CAS_CONFLICT',
        'Failed to transition proposal to accepted — concurrent modification',
      );
    }

    // 10. Supersede siblings in same group
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
  } catch (err) {
    // CAS / unique violation recovery: mark proposal stale if still pending
    if (
      err instanceof InternalUseCaseError &&
      (err.code === 'CAS_CONFLICT' || err.code === 'CONFLICT')
    ) {
      await markProposalStaleOnCasFail(
        { proposalRepo: ports.proposalRepo },
        proposal.id,
      );
    }
    throw err;
  }
}

/**
 * Recovery function: called when commitCanonicalChangeSet fails with
 * CAS/unique violation. Marks proposal stale WHERE status='pending'.
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
