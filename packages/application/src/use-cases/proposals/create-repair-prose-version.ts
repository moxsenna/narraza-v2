/**
 * P2 — Safe repair creates a NEW ProseVersion (never overwrites original).
 *
 * Flow:
 * Original version → validation failed → repair version created →
 * re-validation → user compares → accept repaired version.
 */

import { createHash } from 'node:crypto';
import { applyMinimalSafeRepair } from '@narraza/core';
import type { TransactionPorts } from '../../unit-of-work.js';
import type { ProposalTxPorts } from '../../ports/proposal-ports.js';
import type { UserRepo } from '../../ports/auth-ports.js';
import { authorizeActiveUser } from '../../authz/authorize-active-user.js';
import { lockOwnedProject } from '../../authz/lock-owned-project.js';
import { InternalUseCaseError } from '@narraza/shared';
import {
  runAndPersistProseValidation,
  type ProseValidationContext,
} from './prose-validation-gate.js';

export interface CreateRepairProseVersionInput {
  userId: string;
  projectId: string;
  /** Original ProseVersion id that failed validation */
  originalProseVersionId: string;
  /** Forbidden phrases to strip (from blocker findings) */
  forbiddenPhrases: string[];
  /** Validation context for re-check */
  context: ProseValidationContext;
  /**
   * Optional explicit repaired content. When omitted, applyMinimalSafeRepair
   * strips forbidden phrases from original content.
   */
  repairedContent?: string;
}

export interface CreateRepairProseVersionOutput {
  originalProseVersionId: string;
  repairProseVersionId: string;
  repairVersion: number;
  bindingHash: string;
  passed: boolean;
  hasBlockers: boolean;
  findingsCount: number;
}

export interface CreateRepairProseVersionPorts
  extends TransactionPorts, ProposalTxPorts {
  userRepo: UserRepo;
}

export async function createRepairProseVersion(
  ports: CreateRepairProseVersionPorts,
  input: CreateRepairProseVersionInput,
): Promise<CreateRepairProseVersionOutput> {
  await authorizeActiveUser(ports.userRepo, input.userId);
  await lockOwnedProject(ports.projectRepo, input.projectId, input.userId);

  const original = await ports.proseVersionRepo.findById(
    input.originalProseVersionId,
  );
  if (!original) {
    throw new InternalUseCaseError('NOT_FOUND', 'Original prose version not found');
  }

  const repairedContent =
    input.repairedContent ??
    applyMinimalSafeRepair(original.content, input.forbiddenPhrases);

  if (!repairedContent.trim()) {
    throw new InternalUseCaseError(
      'VALIDATION',
      'Repair produced empty prose — provide repairedContent or fewer strips',
    );
  }

  // Always a NEW version — never overwrite original
  const nextVersion = await ports.proseVersionRepo.nextVersion(original.beatId);
  const contentHash = createHash('sha256').update(repairedContent).digest('hex');
  const repair = await ports.proseVersionRepo.create({
    beatId: original.beatId,
    version: nextVersion,
    content: repairedContent,
    contentHash,
    status: 'draft',
  });

  const validation = await runAndPersistProseValidation(
    ports.validationReportRepo,
    {
      proseContent: repairedContent,
      proseVersionId: repair.id,
      context: input.context,
      repairOriginalProse: original.content,
    },
  );

  return {
    originalProseVersionId: original.id,
    repairProseVersionId: repair.id,
    repairVersion: repair.version,
    bindingHash: validation.bindingHash,
    passed: validation.passed,
    hasBlockers: validation.hasBlockers,
    findingsCount: validation.findings.length,
  };
}
