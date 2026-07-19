/**
 * P2 — Prose validation enforcement wiring.
 *
 * Runs deterministic validators, persists ValidationReport, and provides
 * accept-time eligibility checks that cannot be skipped for prose_accept.
 *
 * Binding hash = sha256(content + "\0" + contextSnapshotHash)
 * so stale context (reveal/beat/knowledge/canon/validator version) invalidates reports.
 */

import { createHash } from 'node:crypto';
import {
  validateProseDeterministic,
  type BeatContract,
  type FullProseValidationInput,
  type Finding,
} from '@narraza/core';
import type {
  ValidationReportRepo,
  ValidationReportEntry,
  CreateValidationReportInput,
} from '../../ports/proposal-ports.js';
import { InternalUseCaseError } from '@narraza/shared';
import { isOverridable } from '../../dto/public-proposal-view.js';

/** Bump when deterministic validator semantics change. */
export const PROSE_VALIDATOR_VERSION = 'p2-deterministic-v1';

export interface ProseValidationContext {
  projectId: string;
  beatId: string;
  chapterId: string;
  chapterNumber: number;
  beatContract?: BeatContract | undefined;
  forbiddenTruths?: string[] | undefined;
  futureEventPhrases?: string[] | undefined;
  overExplicitBreadcrumbs?: string[] | undefined;
  povCharacterId?: string | undefined;
  presentCharacterIds?: string[] | undefined;
  knowledgeFacts?:
    | Array<{
        factId: string;
        truth: string;
        knownByCharacterIds: string[];
      }>
    | undefined;
  existingCanonTruths?:
    | Array<{ factKey: string; truth: string; category?: string }>
    | undefined;
  /** Sensitive claims already approved via proposal pipeline */
  approvedSensitiveCategories?: string[] | undefined;
  /** P3: full | structural_only */
  validationMode?: 'full' | 'structural_only' | undefined;
  /** P3: complete | incomplete */
  contextCompleteness?: 'complete' | 'incomplete' | undefined;
  contextCompilerVersion?: string | undefined;
  contextSnapshotHash?: string | undefined;
}

export interface RunProseValidationInput {
  proseContent: string;
  proseVersionId: string;
  candidateId?: string | null;
  context: ProseValidationContext;
  /** Optional original prose when validating a repair version */
  repairOriginalProse?: string;
}

export interface RunProseValidationResult {
  report: ValidationReportEntry;
  findings: Finding[];
  passed: boolean;
  hasBlockers: boolean;
  bindingHash: string;
  contextSnapshotHash: string;
  validatorVersion: string;
}

export function computeContextSnapshotHash(
  context: ProseValidationContext,
): string {
  const payload = {
    v: PROSE_VALIDATOR_VERSION,
    projectId: context.projectId,
    beatId: context.beatId,
    chapterId: context.chapterId,
    chapterNumber: context.chapterNumber,
    beatContract: context.beatContract ?? null,
    forbiddenTruths: [...(context.forbiddenTruths ?? [])].sort(),
    futureEventPhrases: [...(context.futureEventPhrases ?? [])].sort(),
    knowledgeFacts: context.knowledgeFacts ?? [],
    existingCanonTruths: context.existingCanonTruths ?? [],
    approvedSensitiveCategories: [
      ...(context.approvedSensitiveCategories ?? []),
    ].sort(),
    povCharacterId: context.povCharacterId ?? null,
    presentCharacterIds: [...(context.presentCharacterIds ?? [])].sort(),
  };
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export function computeValidationBindingHash(
  content: string,
  contextSnapshotHash: string,
): string {
  return createHash('sha256')
    .update(content)
    .update('\0')
    .update(contextSnapshotHash)
    .update('\0')
    .update(PROSE_VALIDATOR_VERSION)
    .digest('hex');
}

function buildFullValidationInput(
  proseContent: string,
  context: ProseValidationContext,
  repairOriginalProse?: string,
): FullProseValidationInput {
  const input: FullProseValidationInput = {
    structural: {
      proseContent,
      beatId: context.beatId,
      chapterId: context.chapterId,
    },
  };

  if (context.beatContract) {
    input.beatContract = {
      proseContent,
      contract: context.beatContract,
    };
  }

  if (
    (context.forbiddenTruths && context.forbiddenTruths.length > 0) ||
    (context.futureEventPhrases && context.futureEventPhrases.length > 0)
  ) {
    const reveal: NonNullable<FullProseValidationInput['reveal']> = {
      proseContent,
      forbiddenConcepts: (context.forbiddenTruths ?? []).map((truth, i) => ({
        factId: `forbidden-${i}`,
        truth,
      })),
    };
    if (context.futureEventPhrases) {
      reveal.futureEventPhrases = context.futureEventPhrases;
    }
    if (context.overExplicitBreadcrumbs) {
      reveal.overExplicitBreadcrumbs = context.overExplicitBreadcrumbs;
    }
    input.reveal = reveal;
  }

  if (context.knowledgeFacts && context.knowledgeFacts.length > 0) {
    const knowledge: NonNullable<FullProseValidationInput['knowledge']> = {
      proseContent,
      presentCharacterIds: context.presentCharacterIds ?? [],
      facts: context.knowledgeFacts,
    };
    if (context.povCharacterId) {
      knowledge.povCharacterId = context.povCharacterId;
    }
    input.knowledge = knowledge;
  }

  if (context.existingCanonTruths) {
    input.canon = {
      proseContent,
      existingFacts: context.existingCanonTruths,
      proposals: (context.approvedSensitiveCategories ?? []).map((category) => ({
        claim: category,
        category: category as
          | 'family_relation'
          | 'death'
          | 'pregnancy'
          | 'child'
          | 'marriage_status'
          | 'important_object'
          | 'world_rule',
        hasApprovedProposal: true,
      })),
    };
  }

  if (repairOriginalProse != null) {
    input.safeRepair = {
      originalProse: repairOriginalProse,
      repairedProse: proseContent,
      constraints: {
        originalBeatGoal: context.beatContract?.beatGoal ?? '',
        existingCanonTruths: (context.existingCanonTruths ?? []).map(
          (f) => f.truth,
        ),
        forbiddenTruths: context.forbiddenTruths ?? [],
        targetFindings: [],
      },
    };
  }

  return input;
}

/**
 * Run deterministic validators and persist a ValidationReport bound to
 * content + context snapshot + validator version.
 */
export async function runAndPersistProseValidation(
  validationReportRepo: ValidationReportRepo,
  input: RunProseValidationInput,
): Promise<RunProseValidationResult> {
  const contextSnapshotHash = computeContextSnapshotHash(input.context);
  const bindingHash = computeValidationBindingHash(
    input.proseContent,
    contextSnapshotHash,
  );

  const full = buildFullValidationInput(
    input.proseContent,
    input.context,
    input.repairOriginalProse,
  );
  const result = validateProseDeterministic(full);

  // Infer full/complete when beat contract + forbidden array present (P2 paths)
  const inferredFull =
    Boolean(input.context.beatContract) &&
    Array.isArray(input.context.forbiddenTruths);
  const validationMode =
    input.context.validationMode ??
    (inferredFull ? 'full' : 'structural_only');
  const contextCompleteness =
    input.context.contextCompleteness ??
    (validationMode === 'full' && inferredFull ? 'complete' : 'incomplete');

  // Embed audit meta as info finding (schema has no extra columns)
  const findings: CreateValidationReportInput['findings'] = [
    {
      code: 'META_VALIDATOR_CONTEXT',
      severity: 'info',
      source: 'deterministic',
      message: JSON.stringify({
        validatorVersion: PROSE_VALIDATOR_VERSION,
        contextSnapshotHash: input.context.contextSnapshotHash ?? contextSnapshotHash,
        contextCompilerVersion: input.context.contextCompilerVersion ?? null,
        chapterNumber: input.context.chapterNumber,
        beatId: input.context.beatId,
        validationMode,
        contextCompleteness,
      }),
      publicMessageCode: 'meta.validator.context',
      deterministic: true,
    },
    ...result.findings.map((f) => ({
      code: f.code,
      severity: f.severity,
      source: f.source,
      message: f.message,
      publicMessageCode: f.publicMessageCode,
      deterministic: f.deterministic,
    })),
  ];

  const report = await validationReportRepo.create({
    proseVersionId: input.proseVersionId,
    candidateId: input.candidateId ?? null,
    passed: result.passed,
    findings,
    contentHash: bindingHash,
  });

  return {
    report,
    findings: result.findings,
    passed: result.passed,
    hasBlockers: result.hasBlockers,
    bindingHash,
    contextSnapshotHash,
    validatorVersion: PROSE_VALIDATOR_VERSION,
  };
}

export interface AssertProseAcceptEligibleInput {
  /** Latest report for prose version (if any) */
  report: ValidationReportEntry | null | undefined;
  /** Expected binding hash for current content+context */
  expectedBindingHash: string;
  /** Optional override codes for allowlisted warnings/blockers */
  overrides?: string[] | undefined;
  /** When true, missing report is fatal (prose_accept paths) */
  requireReport: boolean;
}

/**
 * Backend enforcement: blockers without override cannot be accepted.
 * Missing or stale report fails closed for prose_accept.
 */
export function assertProseAcceptEligible(
  input: AssertProseAcceptEligibleInput,
): void {
  if (!input.report) {
    if (input.requireReport) {
      throw new InternalUseCaseError(
        'VALIDATION',
        'Prose accept requires a current validation report',
      );
    }
    return;
  }

  // Stale binding: content or context changed
  if (input.report.contentHash !== input.expectedBindingHash) {
    throw new InternalUseCaseError(
      'VALIDATION',
      'Validation report is stale (content or context changed). Re-validate before accept.',
    );
  }

  if (input.report.passed) return;

  const blockers = input.report.findings.filter((f) => f.severity === 'blocker');
  // Ignore meta info entries
  const realBlockers = blockers.filter(
    (b) => b.code !== 'META_VALIDATOR_CONTEXT',
  );
  if (realBlockers.length === 0) return;

  const overrideSet = new Set(input.overrides ?? []);
  const unresolved = realBlockers.filter((b) => {
    if (!isOverridable(b.code) && !isOverridable(b.publicMessageCode)) {
      return true;
    }
    return !overrideSet.has(b.code) && !overrideSet.has(b.publicMessageCode);
  });

  if (unresolved.length > 0) {
    throw new InternalUseCaseError(
      'VALIDATION',
      `Proposal not eligible: ${unresolved.length} blocking finding(s) without override`,
    );
  }
}

/**
 * Extract prose_accept payload from change-set operations if present.
 */
export function extractProseAcceptPayload(
  operations: Array<{
    opType: string;
    targetType: string;
    targetId: string | null;
    payload: unknown;
  }>,
): {
  beatId: string;
  content: string;
  contentHash: string;
  proseVersionId?: string;
  chapterId?: string;
  chapterNumber?: number;
  validationContext?: ProseValidationContext;
  /** Binding hash stored at validation time (preferred over recomputing) */
  validationBindingHash?: string;
} | null {
  for (const op of operations) {
    const opType = op.opType;
    if (opType !== 'prose_accept' && opType !== 'prose.accept') continue;
    const payload = (op.payload ?? {}) as Record<string, unknown>;
    const content =
      typeof payload.content === 'string'
        ? payload.content
        : typeof payload.prose === 'string'
          ? payload.prose
          : null;
    if (!content || !op.targetId) continue;
    const contentHash =
      typeof payload.contentHash === 'string'
        ? payload.contentHash
        : createHash('sha256').update(content).digest('hex');
    const result: {
      beatId: string;
      content: string;
      contentHash: string;
      proseVersionId?: string;
      chapterId?: string;
      chapterNumber?: number;
      validationContext?: ProseValidationContext;
      validationBindingHash?: string;
    } = {
      beatId: op.targetId,
      content,
      contentHash,
    };
    if (typeof payload.proseVersionId === 'string') {
      result.proseVersionId = payload.proseVersionId;
    }
    if (typeof payload.chapterId === 'string') {
      result.chapterId = payload.chapterId;
    }
    if (typeof payload.chapterNumber === 'number') {
      result.chapterNumber = payload.chapterNumber;
    }
    if (
      payload.validationContext &&
      typeof payload.validationContext === 'object'
    ) {
      result.validationContext =
        payload.validationContext as ProseValidationContext;
    }
    if (typeof payload.validationBindingHash === 'string') {
      result.validationBindingHash = payload.validationBindingHash;
    }
    return result;
  }
  return null;
}
