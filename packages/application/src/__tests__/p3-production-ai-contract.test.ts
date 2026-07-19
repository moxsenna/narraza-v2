/**
 * P3 — Production AI contract integration tests (fake provider, no live API).
 */

import { describe, expect, it } from 'vitest';
import { createFakeAIExecutionPort } from '@narraza/ai';
import { BeatWriteContract } from '@narraza/ai';
import {
  buildValidationContextSnapshot,
  assertProductionProseContextReady,
  snapshotToProseValidationContext,
  compileWriterProviderPayload,
  assertWriterFirewall,
  enforceWriterFirewallOrThrow,
  runAndPersistProseValidation,
  assertProseAcceptEligible,
  parseValidationMetaFromFindings,
  assertReportContextAcceptable,
  redactSensitive,
  CONTEXT_COMPILER_VERSION,
} from '../index.js';

const HIDDEN = 'The mayor is the cult leader';

function completeSnap(over?: Partial<Parameters<typeof buildValidationContextSnapshot>[0]>) {
  return buildValidationContextSnapshot({
    projectId: 'p1',
    projectRevision: 3,
    chapterId: 'ch3',
    chapterNumber: 3,
    beatId: 'b1',
    beatContract: {
      beatGoal: 'Harbor unease',
      mustInclude: ['fog'],
      mustNotInclude: [HIDDEN],
      expectedEndState: 'Alya leaves',
      stopCondition: 'exits dock',
    },
    forbiddenReveals: [HIDDEN],
    confirmedCanonFacts: [
      { factKey: 'setting.harbor', truth: 'The town has a harbor' },
    ],
    safeBreadcrumbs: ['The mayor avoids certain questions'],
    speechRules: ['Use titles for officials'],
    characterKnowledge: [
      {
        factId: 'f-major',
        truth: HIDDEN,
        knownByCharacterIds: [],
      },
    ],
    ...over,
  });
}

describe('P3.0 ValidationContextSnapshot', () => {
  it('complete snapshot is ready for production prose', () => {
    const snap = completeSnap();
    expect(snap.contextCompleteness).toBe('complete');
    expect(snap.validationMode).toBe('full');
    expect(snap.contextCompilerVersion).toBe(CONTEXT_COMPILER_VERSION);
    expect(() => assertProductionProseContextReady(snap)).not.toThrow();
  });

  it('incomplete snapshot fails before provider', () => {
    const snap = buildValidationContextSnapshot({
      projectId: 'p1',
      projectRevision: 0,
      chapterId: '',
      chapterNumber: 0,
      beatId: '',
      forbiddenReveals: [],
      confirmedCanonFacts: [],
    });
    expect(snap.contextCompleteness).toBe('incomplete');
    expect(() => assertProductionProseContextReady(snap)).toThrow(
      /INCOMPLETE_VALIDATION_CONTEXT/,
    );
  });

  it('structural_only forbidden for production', () => {
    const snap = completeSnap({ allowStructuralOnly: true });
    expect(snap.validationMode).toBe('structural_only');
    expect(() => assertProductionProseContextReady(snap)).toThrow(
      /structural_only/,
    );
  });
});

describe('P3.5 Writer Context Firewall', () => {
  it('writer payload does not include hidden truth', () => {
    const snap = completeSnap();
    const payload = compileWriterProviderPayload(snap);
    const json = JSON.stringify(payload);
    expect(json).not.toContain(HIDDEN);
    expect(json).toContain('harbor');
    expect(payload.kind).toBe('writer_safe');
    const fw = assertWriterFirewall(payload, snap);
    expect(fw.ok).toBe(true);
  });

  it('firewall throws when forbidden truth injected', () => {
    const snap = completeSnap();
    const payload = compileWriterProviderPayload(snap);
    // mutate illegally
    (payload as any).leaked = HIDDEN;
    expect(() => enforceWriterFirewallOrThrow(payload, snap)).toThrow(
      /WRITER_CONTEXT_FIREWALL/,
    );
  });

  it('incomplete context fails firewall', () => {
    const snap = buildValidationContextSnapshot({
      projectId: 'p1',
      projectRevision: 0,
      chapterId: 'c',
      chapterNumber: 1,
      beatId: 'b',
      forbiddenReveals: [],
      confirmedCanonFacts: [],
    });
    const payload = compileWriterProviderPayload(snap);
    const fw = assertWriterFirewall(payload, snap);
    expect(fw.ok).toBe(false);
  });
});

describe('P3.9 fake provider + validation pipeline', () => {
  it('incomplete context → provider never called', async () => {
    let calls = 0;
    const port = createFakeAIExecutionPort({
      scenario: 'success',
      onCall: () => {
        calls += 1;
      },
    });
    // Simulate job gate: assert before call
    const snap = buildValidationContextSnapshot({
      projectId: 'p1',
      projectRevision: 0,
      chapterId: '',
      chapterNumber: 0,
      beatId: '',
      forbiddenReveals: [],
      confirmedCanonFacts: [],
    });
    expect(() => assertProductionProseContextReady(snap)).toThrow();
    expect(calls).toBe(0);
    // provider unused
    void port;
  });

  it('reveal leak prose → validation blockers → cannot accept', async () => {
    const port = createFakeAIExecutionPort({ scenario: 'reveal_leak_prose' });
    const plan = port.buildWorkflowPlan({
      jobType: 'beat.write',
      projectId: 'p1',
    });
    const res = await port.executeSingleAttempt({
      workflowPlan: plan,
      stageName: 'write',
      invocationKey: 'write:v1',
      promptContractVersion: 'beat.write.v1',
      promptPayload: {},
    });
    const out = port.parseOutput(BeatWriteContract, res.rawBody);
    const prose = out.candidates[0]!.prose;
    expect(prose).toContain(HIDDEN);

    const snap = completeSnap();
    const ctx = snapshotToProseValidationContext(snap);
    ctx.validationMode = 'full';
    ctx.contextCompleteness = 'complete';
    ctx.contextSnapshotHash = snap.snapshotHash;
    ctx.contextCompilerVersion = snap.contextCompilerVersion;

    // In-memory report repo
    const reports: any[] = [];
    const repo = {
      async create(input: any) {
        const r = { id: 'vr1', createdAt: new Date(), ...input };
        reports.push(r);
        return r;
      },
      async findById() {
        return null;
      },
      async findByProseVersionId() {
        return null;
      },
      async findLatestByProseVersionId() {
        return reports[reports.length - 1] ?? null;
      },
      async findValidReport() {
        return null;
      },
    };

    const validation = await runAndPersistProseValidation(repo as any, {
      proseContent: prose,
      proseVersionId: 'pv-leak',
      context: ctx,
    });

    expect(validation.passed).toBe(false);
    expect(validation.hasBlockers).toBe(true);

    const meta = parseValidationMetaFromFindings(validation.report.findings);
    expect(meta?.validationMode).toBe('full');
    expect(meta?.contextCompleteness).toBe('complete');

    expect(() =>
      assertProseAcceptEligible({
        report: validation.report,
        expectedBindingHash: validation.bindingHash,
        requireReport: true,
      }),
    ).toThrow(/blocking finding/i);
  });

  it('structural_only report rejected for accept', () => {
    expect(() =>
      assertReportContextAcceptable({
        validationMode: 'structural_only',
        contextCompleteness: 'incomplete',
      }),
    ).toThrow(/STRUCTURAL_ONLY/);
  });
});

describe('P3.8 redaction', () => {
  it('redacts api keys and bearer tokens', () => {
    const raw =
      'Authorization: Bearer sk-or-v1-secretkey1234567890 and OPENROUTER_API_KEY=sk-or-v1-abcdefghij';
    const clean = redactSensitive(raw);
    expect(clean).not.toContain('sk-or-v1-secretkey');
    expect(clean).toContain('[REDACTED]');
  });
});
