/**
 * P3.0 — Server-side ValidationContextSnapshot for production prose jobs.
 *
 * Client-supplied forbiddenTruths / knowledge MUST NOT be trusted.
 * Snapshots are compiled from canonical state (or explicit server test fixtures).
 */

import { createHash } from 'node:crypto';
import type { BeatContract } from '@narraza/core';
import type { ProseValidationContext } from '../use-cases/proposals/prose-validation-gate.js';
import { PROSE_VALIDATOR_VERSION } from '../use-cases/proposals/prose-validation-gate.js';

export const CONTEXT_COMPILER_VERSION = 'p3-context-compiler-v1';

export type ValidationMode = 'full' | 'structural_only';
export type ContextCompleteness = 'complete' | 'incomplete';

export interface ValidationContextSnapshot {
  projectId: string;
  projectRevision: number;
  chapterId: string;
  chapterNumber: number;
  beatId: string;
  beatContract: BeatContract | null;
  readerKnownFacts: Array<{ factKey: string; surface: string }>;
  povKnownFacts: Array<{ factKey: string; truth: string }>;
  characterKnowledge: Array<{
    factId: string;
    truth: string;
    knownByCharacterIds: string[];
  }>;
  confirmedCanonFacts: Array<{ factKey: string; truth: string; category?: string }>;
  forbiddenReveals: string[];
  forbiddenConcepts: Array<{ factId: string; truth: string }>;
  safeBreadcrumbs: string[];
  speechRules: string[];
  previousAcceptedProseVersionId: string | null;
  previousAcceptedProseHash: string | null;
  validatorVersion: string;
  contextCompilerVersion: string;
  validationMode: ValidationMode;
  contextCompleteness: ContextCompleteness;
  /** Hash of full snapshot body (stable) */
  snapshotHash: string;
}

export interface BuildValidationContextInput {
  projectId: string;
  projectRevision: number;
  chapterId: string;
  chapterNumber: number;
  beatId: string;
  beatContract?: BeatContract | null;
  readerKnownFacts?: Array<{ factKey: string; surface: string }>;
  povKnownFacts?: Array<{ factKey: string; truth: string }>;
  characterKnowledge?: ValidationContextSnapshot['characterKnowledge'];
  confirmedCanonFacts?: Array<{ factKey: string; truth: string; category?: string }>;
  forbiddenReveals?: string[];
  forbiddenConcepts?: Array<{ factId: string; truth: string }>;
  safeBreadcrumbs?: string[];
  speechRules?: string[];
  previousAcceptedProseVersionId?: string | null;
  previousAcceptedProseHash?: string | null;
  /**
   * Only tests/tools may request structural_only.
   * Production prose jobs must leave this unset (defaults to full).
   */
  allowStructuralOnly?: boolean;
}

function hashSnapshotBody(body: Omit<ValidationContextSnapshot, 'snapshotHash'>): string {
  return createHash('sha256').update(JSON.stringify(body)).digest('hex');
}

/**
 * Assess completeness for production prose validation.
 * Structural-only is incomplete by definition for accept.
 */
export function assessContextCompleteness(
  input: BuildValidationContextInput,
): ContextCompleteness {
  if (input.allowStructuralOnly) return 'incomplete';

  const hasBeat = Boolean(input.beatId && input.chapterId);
  const hasChapter = typeof input.chapterNumber === 'number' && input.chapterNumber >= 1;
  const hasContract =
    input.beatContract != null &&
    Boolean(input.beatContract.beatGoal?.trim()) &&
    Boolean(input.beatContract.expectedEndState?.trim()) &&
    Boolean(input.beatContract.stopCondition?.trim());
  // Forbidden list may be empty (no secrets yet) but must be present as array
  const hasForbiddenArray = Array.isArray(input.forbiddenReveals);
  const hasCanonArray = Array.isArray(input.confirmedCanonFacts);

  if (hasBeat && hasChapter && hasContract && hasForbiddenArray && hasCanonArray) {
    return 'complete';
  }
  return 'incomplete';
}

/**
 * Build a frozen validation context snapshot (server-side only).
 */
export function buildValidationContextSnapshot(
  input: BuildValidationContextInput,
): ValidationContextSnapshot {
  const completeness = assessContextCompleteness(input);
  const validationMode: ValidationMode = input.allowStructuralOnly
    ? 'structural_only'
    : 'full';

  if (validationMode === 'full' && completeness === 'incomplete') {
    // Still return snapshot marked incomplete — callers fail the job
  }

  const body: Omit<ValidationContextSnapshot, 'snapshotHash'> = {
    projectId: input.projectId,
    projectRevision: input.projectRevision,
    chapterId: input.chapterId,
    chapterNumber: input.chapterNumber,
    beatId: input.beatId,
    beatContract: input.beatContract ?? null,
    readerKnownFacts: input.readerKnownFacts ?? [],
    povKnownFacts: input.povKnownFacts ?? [],
    characterKnowledge: input.characterKnowledge ?? [],
    confirmedCanonFacts: input.confirmedCanonFacts ?? [],
    forbiddenReveals: input.forbiddenReveals ?? [],
    forbiddenConcepts: input.forbiddenConcepts ?? [],
    safeBreadcrumbs: input.safeBreadcrumbs ?? [],
    speechRules: input.speechRules ?? [],
    previousAcceptedProseVersionId: input.previousAcceptedProseVersionId ?? null,
    previousAcceptedProseHash: input.previousAcceptedProseHash ?? null,
    validatorVersion: PROSE_VALIDATOR_VERSION,
    contextCompilerVersion: CONTEXT_COMPILER_VERSION,
    validationMode,
    contextCompleteness: completeness,
  };

  return {
    ...body,
    snapshotHash: hashSnapshotBody(body),
  };
}

/**
 * Map snapshot → ProseValidationContext for P2 validators.
 */
export function snapshotToProseValidationContext(
  snapshot: ValidationContextSnapshot,
): ProseValidationContext {
  const ctx: ProseValidationContext = {
    projectId: snapshot.projectId,
    beatId: snapshot.beatId,
    chapterId: snapshot.chapterId,
    chapterNumber: snapshot.chapterNumber,
    forbiddenTruths: snapshot.forbiddenReveals,
    existingCanonTruths: snapshot.confirmedCanonFacts,
    knowledgeFacts: snapshot.characterKnowledge,
  };
  if (snapshot.beatContract) {
    ctx.beatContract = snapshot.beatContract;
  }
  return ctx;
}

/**
 * Production prose jobs MUST have complete full-mode snapshot.
 */
export function assertProductionProseContextReady(
  snapshot: ValidationContextSnapshot,
): void {
  if (snapshot.validationMode !== 'full') {
    throw new Error(
      'INCOMPLETE_VALIDATION_CONTEXT: structural_only is forbidden for production prose',
    );
  }
  if (snapshot.contextCompleteness !== 'complete') {
    throw new Error(
      'INCOMPLETE_VALIDATION_CONTEXT: ValidationContextSnapshot is incomplete; refuse provider call',
    );
  }
}

/**
 * Accept path: reject reports that were structural_only or incomplete.
 */
export function assertReportContextAcceptable(meta: {
  validationMode?: string;
  contextCompleteness?: string;
} | null): void {
  if (!meta) {
    // Legacy pre-P3 reports without meta — still allowed if binding matches
    // (P2 path). Production new reports always embed meta.
    return;
  }
  if (meta.validationMode === 'structural_only') {
    throw new Error(
      'STRUCTURAL_ONLY_REPORT: cannot accept production prose with structural_only validation',
    );
  }
  if (meta.contextCompleteness === 'incomplete') {
    throw new Error(
      'INCOMPLETE_CONTEXT_REPORT: cannot accept prose validated with incomplete context',
    );
  }
}

export function parseValidationMetaFromFindings(
  findings: Array<{ code: string; message: string }>,
): {
  validationMode?: string;
  contextCompleteness?: string;
  contextSnapshotHash?: string;
  validatorVersion?: string;
  contextCompilerVersion?: string;
} | null {
  const meta = findings.find((f) => f.code === 'META_VALIDATOR_CONTEXT');
  if (!meta) return null;
  try {
    return JSON.parse(meta.message) as {
      validationMode?: string;
      contextCompleteness?: string;
      contextSnapshotHash?: string;
      validatorVersion?: string;
      contextCompilerVersion?: string;
    };
  } catch {
    return null;
  }
}
