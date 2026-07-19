/**
 * P3.5 — Writer Context Firewall.
 *
 * Builds writer-safe packets server-side and asserts no hidden truth / future
 * outline / raw reveal schedule enters the provider request.
 */

import {
  applyRevealPolicy,
  buildWriterPacket,
  type RevealPolicyFact,
  type WriterPacket,
} from '@narraza/core';
import type { ValidationContextSnapshot } from './validation-context-snapshot.js';
import { createHash } from 'node:crypto';

export const WRITER_CONTEXT_COMPILER_VERSION = 'p3-writer-context-v1';

export interface WriterProviderPayload {
  kind: 'writer_safe';
  projectId: string;
  beatId: string;
  chapterNumber: number;
  writerPacket: WriterPacket;
  beatGoal: string | null;
  mustInclude: string[];
  mustNotInclude: string[];
  expectedEndState: string | null;
  stopCondition: string | null;
  safeBreadcrumbs: string[];
  speechRules: string[];
  previousProseExcerpt: string | null;
  promptContractVersion: string;
  contextCompilerVersion: string;
  /** Hash of payload for audit — no hidden fields included */
  payloadHash: string;
}

const FORBIDDEN_PAYLOAD_KEYS = [
  'restrictedFacts',
  'hiddenTruth',
  'futureOutline',
  'revealSchedule',
  'service_restricted',
  'rawCanon',
  'plannerPacket',
];

/**
 * Compile reveal-policy facts from snapshot (server-owned lists only).
 */
export function compileWriterProviderPayload(
  snapshot: ValidationContextSnapshot,
  opts?: {
    promptContractVersion?: string;
    previousProseExcerpt?: string | null;
  },
): WriterProviderPayload {
  const facts: RevealPolicyFact[] = [];

  for (const f of snapshot.confirmedCanonFacts) {
    const isForbidden = snapshot.forbiddenReveals.some(
      (t) => t === f.truth || t.includes(f.truth) || f.truth.includes(t),
    );
    facts.push({
      id: f.factKey,
      truth: f.truth,
      surface: f.truth,
      factKey: f.factKey,
      category: f.category ?? 'canon',
      revealStatus: isForbidden ? 'hidden' : 'revealed',
    });
  }

  for (const t of snapshot.forbiddenReveals) {
    if (!facts.some((f) => f.truth === t)) {
      facts.push({
        id: `forbidden:${createHash('sha256').update(t).digest('hex').slice(0, 12)}`,
        truth: t,
        surface: t,
        factKey: `forbidden.${createHash('sha256').update(t).digest('hex').slice(0, 8)}`,
        category: 'reveal',
        revealStatus: 'hidden',
      });
    }
  }

  // Safe breadcrumbs as revealed surfaces without truth
  for (const bc of snapshot.safeBreadcrumbs) {
    facts.push({
      id: `bc:${createHash('sha256').update(bc).digest('hex').slice(0, 12)}`,
      truth: `__withheld__${bc}`,
      surface: bc,
      breadcrumbSurface: bc,
      factKey: `breadcrumb.${createHash('sha256').update(bc).digest('hex').slice(0, 8)}`,
      category: 'breadcrumb',
      revealStatus: 'scheduled',
      scheduledChapter: snapshot.chapterNumber + 1000, // not yet revealed as full truth
    });
  }

  const policy = applyRevealPolicy({
    facts,
    currentChapter: snapshot.chapterNumber,
    beatId: snapshot.beatId,
  });

  const writerPacket = buildWriterPacket({
    projectId: snapshot.projectId,
    beatId: snapshot.beatId,
    restrictedFacts: policy.restrictedFacts,
    writerSafeFacts: policy.writerSafeFacts,
    forbiddenConcepts: policy.forbiddenConcepts,
  });

  const contract = snapshot.beatContract;
  // Never send raw forbidden truths in mustNotInclude — use opaque tokens
  const forbiddenSet = new Set(
    [...snapshot.forbiddenReveals, ...snapshot.forbiddenConcepts.map((c) => c.truth)].filter(
      Boolean,
    ),
  );
  const safeMustNot = (contract?.mustNotInclude ?? []).map((phrase) => {
    if (forbiddenSet.has(phrase)) {
      return `[withheld:${createHash('sha256').update(phrase).digest('hex').slice(0, 8)}]`;
    }
    for (const t of forbiddenSet) {
      if (t && phrase.includes(t)) {
        return `[withheld:${createHash('sha256').update(t).digest('hex').slice(0, 8)}]`;
      }
    }
    return phrase;
  });

  const payload: WriterProviderPayload = {
    kind: 'writer_safe',
    projectId: snapshot.projectId,
    beatId: snapshot.beatId,
    chapterNumber: snapshot.chapterNumber,
    writerPacket,
    beatGoal: contract?.beatGoal ?? null,
    mustInclude: contract?.mustInclude ?? [],
    mustNotInclude: safeMustNot,
    expectedEndState: contract?.expectedEndState ?? null,
    stopCondition: contract?.stopCondition ?? null,
    safeBreadcrumbs: snapshot.safeBreadcrumbs,
    speechRules: snapshot.speechRules,
    previousProseExcerpt: opts?.previousProseExcerpt ?? null,
    promptContractVersion: opts?.promptContractVersion ?? 'beat.write.v1',
    contextCompilerVersion: WRITER_CONTEXT_COMPILER_VERSION,
    payloadHash: '',
  };

  payload.payloadHash = createHash('sha256')
    .update(JSON.stringify({ ...payload, payloadHash: undefined }))
    .digest('hex');

  return payload;
}

export interface FirewallAssertionResult {
  ok: boolean;
  violations: string[];
}

/**
 * Pre-provider assertion: payload must not contain hidden truths / forbidden keys.
 */
export function assertWriterFirewall(
  payload: WriterProviderPayload,
  snapshot: ValidationContextSnapshot,
): FirewallAssertionResult {
  const violations: string[] = [];
  const json = JSON.stringify(payload);

  for (const key of FORBIDDEN_PAYLOAD_KEYS) {
    if (json.includes(`"${key}"`)) {
      violations.push(`forbidden field present: ${key}`);
    }
  }

  for (const truth of snapshot.forbiddenReveals) {
    if (truth && json.includes(truth)) {
      violations.push(`hidden truth leaked into writer payload`);
    }
  }

  for (const fc of snapshot.forbiddenConcepts) {
    if (fc.truth && json.includes(fc.truth)) {
      violations.push(`forbidden concept truth leaked: ${fc.factId}`);
    }
  }

  // Future outline markers
  if (/futureOutline|chapter\s*2[5-9]|revealSchedule/i.test(json)) {
    // only flag if raw schedule structure present
    if (json.includes('revealSchedule') || json.includes('futureOutline')) {
      violations.push('future outline / reveal schedule in writer payload');
    }
  }

  if (payload.kind !== 'writer_safe') {
    violations.push('payload kind is not writer_safe');
  }

  if (snapshot.contextCompleteness !== 'complete') {
    violations.push('validation context incomplete');
  }

  return { ok: violations.length === 0, violations };
}

/**
 * Throw if firewall fails — never call provider when this throws.
 */
export function enforceWriterFirewallOrThrow(
  payload: WriterProviderPayload,
  snapshot: ValidationContextSnapshot,
): void {
  const result = assertWriterFirewall(payload, snapshot);
  if (!result.ok) {
    throw new Error(
      `WRITER_CONTEXT_FIREWALL: ${result.violations.join('; ')}`,
    );
  }
}
