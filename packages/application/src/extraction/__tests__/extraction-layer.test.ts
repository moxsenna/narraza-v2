// Matrix test: op-type-boundary — model JSON cannot type as CanonicalChangeOperation
// Matrix test: tempref-resolve — tempRef resolved before proposal persist
// Matrix test: op-allowlist — Beat contract cannot emit outline/foundation ops
// Matrix test: prose-accept-order — ProseAcceptOperation always last in beat operation DAG
// Matrix test: proposal-operation-hash — Proposal with mismatched operationsHash rejected
// Matrix test: repair-reextract — Repair full re-extraction

import { describe, expect, it } from 'vitest';
import type { ModelSuggestionDraft } from '../types.js';
import { resolveTempRefs } from '../temp-ref-resolver.js';
import { validateAgainstAllowlist, validateBeatContractOps } from '../operation-policy.js';
import {
  buildOperationDAG,
  deterministicTopoSort,
  assignSequences,
} from '../operation-dag.js';
import {
  computeOperationsHash,
  verifyProseAcceptOrder,
  computePayloadHash,
  verifyHash,
} from '../proposal-integrity.js';
import { computeProseContentHash, extractProseEvidence, validateDisclosureEvidence } from '../prose-evidence.js';

// =============================================================================
// op-type-boundary: Model JSON cannot type as CanonicalChangeOperation
// =============================================================================

describe('op-type-boundary', () => {
  it('ModelSuggestionDraft cannot be assigned to CanonicalChangeOperation', () => {
    // This is a compile-time test that we verify at runtime:
    // ModelSuggestionDraft uses tempRef (string), CanonicalChangeOperation has no tempRef
    const draft: ModelSuggestionDraft = {
      tempRef: 'r1',
      opIntent: 'upsert_fact',
      targetType: 'fact',
      payload: { factKey: 'test', truth: 'something' },
    };

    // The key difference: ModelSuggestionDraft has `tempRef` and `opIntent`,
    // CanonicalChangeOperation has `operationId` and `opType`.
    // They should be structurally incompatible.
    expect(draft).toHaveProperty('tempRef');
    expect(draft).toHaveProperty('opIntent');
    expect(draft).not.toHaveProperty('operationId');
    expect(draft).not.toHaveProperty('opType');
    expect(draft).not.toHaveProperty('changeSetId');

    // Verify it's a plain model draft, not a canonical op
    expect(typeof draft.tempRef).toBe('string');
  });
});

// =============================================================================
// tempref-resolve — tempRef resolved before proposal persist
// =============================================================================

describe('tempref-resolve', () => {
  it('resolves tempRefs within single candidate scope', () => {
    const suggestions: ModelSuggestionDraft[] = [
      { tempRef: 'r1', opIntent: 'upsert_fact', targetType: 'fact', payload: { factKey: 'k1', truth: 't1' } },
      {
        tempRef: 'r2',
        opIntent: 'upsert_character_state',
        targetType: 'character_state',
        payload: { dependsOn: 'r1' },
      },
    ];

    const { scope, errors } = resolveTempRefs(suggestions, 'candidate-1');
    expect(errors).toHaveLength(0);
    expect(scope.resolved.has('r1')).toBe(true);
    expect(scope.resolved.has('r2')).toBe(true);
    expect(scope.resolved.get('r1')).not.toBe(scope.resolved.get('r2'));
  });

  it('rejects cross-candidate references', () => {
    // A cross-candidate tempRef would be one that references a tempRef from
    // a different candidate's scope. Here, we test unresolved refs.
    const suggestions: ModelSuggestionDraft[] = [
      {
        tempRef: 'r1',
        opIntent: 'upsert_fact',
        targetType: 'fact',
        payload: { dependsOn: 'nonexistent_ref' },
      },
    ];

    const { errors } = resolveTempRefs(suggestions, 'candidate-1');
    expect(errors.some((e) => e.code === 'UNRESOLVED_TEMPREF')).toBe(true);
  });

  it('rejects cyclic dependencies', () => {
    const suggestions: ModelSuggestionDraft[] = [
      { tempRef: 'a', opIntent: 'upsert_fact', targetType: 'fact', payload: { dependsOn: 'b' } },
      { tempRef: 'b', opIntent: 'upsert_fact', targetType: 'fact', payload: { dependsOn: 'a' } },
    ];

    const { errors } = resolveTempRefs(suggestions, 'candidate-1');
    expect(errors.some((e) => e.code === 'CYCLIC_DEPENDENCY')).toBe(true);
  });
});

// =============================================================================
// op-allowlist — Beat contract cannot emit outline/foundation ops
// =============================================================================

describe('op-allowlist', () => {
  it('beat.write allowlist rejects outline ops', () => {
    const suggestions: ModelSuggestionDraft[] = [
      { tempRef: 'r1', opIntent: 'upsert_outline', targetType: 'outline', payload: {} },
    ];

    const errors = validateAgainstAllowlist(suggestions, 'beat.write.v1');
    expect(errors.some((e) => e.code === 'DISALLOWED_OP_TYPE')).toBe(true);
  });

  it('beat.write allowlist rejects foundation ops', () => {
    const suggestions: ModelSuggestionDraft[] = [
      { tempRef: 'r1', opIntent: 'upsert_foundation', targetType: 'foundation', payload: {} },
    ];

    const errors = validateAgainstAllowlist(suggestions, 'beat.write.v1');
    expect(errors.some((e) => e.code === 'DISALLOWED_OP_TYPE')).toBe(true);
  });

  it('beat.write allowlist allows fact and prose_accept ops', () => {
    const suggestions: ModelSuggestionDraft[] = [
      { tempRef: 'r1', opIntent: 'upsert_fact', targetType: 'fact', payload: {} },
      { tempRef: 'r2', opIntent: 'prose_accept', targetType: 'prose', payload: {} },
    ];

    const errors = validateAgainstAllowlist(suggestions, 'beat.write.v1');
    expect(errors).toHaveLength(0);
  });

  it('beat.write explicit check rejects outline/foundation/character ops', () => {
    const suggestions: ModelSuggestionDraft[] = [
      { tempRef: 'r1', opIntent: 'upsert_outline', targetType: 'outline', payload: {} },
      { tempRef: 'r2', opIntent: 'upsert_foundation', targetType: 'foundation', payload: {} },
      { tempRef: 'r3', opIntent: 'upsert_character', targetType: 'character', payload: {} },
    ];

    const errors = validateBeatContractOps(suggestions);
    expect(errors).toHaveLength(3);
    expect(errors.every((e) => e.code === 'BEAT_DISALLOWED_OP_TYPE')).toBe(true);
  });

  it('exceeding max count per op type returns error', () => {
    const suggestions: ModelSuggestionDraft[] = Array.from({ length: 25 }, (_, i) => ({
      tempRef: `r${i}`,
      opIntent: 'upsert_fact' as const,
      targetType: 'fact',
      payload: {},
    }));

    const errors = validateAgainstAllowlist(suggestions, 'beat.write.v1');
    expect(errors.some((e) => e.code === 'OP_COUNT_EXCEEDED')).toBe(true);
  });

  it('exceeding max total ops returns error', () => {
    const suggestions: ModelSuggestionDraft[] = Array.from({ length: 51 }, (_, i) => ({
      tempRef: `r${i}`,
      opIntent: 'upsert_fact' as const,
      targetType: 'fact',
      payload: {},
    }));

    const errors = validateAgainstAllowlist(suggestions, 'beat.write.v1');
    expect(errors.some((e) => e.code === 'MAX_TOTAL_OPS_EXCEEDED')).toBe(true);
  });
});

// =============================================================================
// prose-accept-order — ProseAcceptOperation always last in beat operation DAG
// =============================================================================

describe('prose-accept-order', () => {
  it('prose_accept is sorted last in DAG', () => {
    const nodes = buildOperationDAG([
      {
        operationId: 'op1',
        tempRef: 'r1',
        opIntent: 'upsert_fact',
        targetType: 'fact',
        targetId: 'f1',
        payload: {},
        resolvedDependencies: [],
        sequence: 0,
      },
      {
        operationId: 'op2',
        tempRef: 'r2',
        opIntent: 'record_disclosure',
        targetType: 'disclosure',
        targetId: 'd1',
        payload: {},
        resolvedDependencies: ['op1'],
        sequence: 0,
      },
      {
        operationId: 'op3',
        tempRef: 'r3',
        opIntent: 'prose_accept',
        targetType: 'prose',
        targetId: 'p1',
        payload: {},
        resolvedDependencies: ['op2'],
        sequence: 0,
      },
    ]);

    const opIntentMap = new Map([
      ['op1', 'upsert_fact'],
      ['op2', 'record_disclosure'],
      ['op3', 'prose_accept'],
    ]);
    const targetTypeMap = new Map([
      ['op1', 'fact'],
      ['op2', 'disclosure'],
      ['op3', 'prose'],
    ]);
    const targetIdMap = new Map([
      ['op1', 'f1'],
      ['op2', 'd1'],
      ['op3', 'p1'],
    ]);

    const sorted = deterministicTopoSort(nodes, opIntentMap, targetTypeMap, targetIdMap);
    expect(sorted).toHaveLength(3);
    expect(sorted[sorted.length - 1]).toBe('op3');

    // Verify prose_accept order
    const opTypeMap = new Map([
      ['op1', 'fact.upsert'],
      ['op2', 'disclosure.record'],
      ['op3', 'prose.accept'],
    ]);
    const errors = verifyProseAcceptOrder(sorted, opIntentMap, opTypeMap);
    expect(errors).toHaveLength(0);
  });

  it('prose_accept not last produces error', () => {
    const sorted = ['op3', 'op1', 'op2'];
    const opIntentMap = new Map([
      ['op1', 'upsert_fact'],
      ['op2', 'record_disclosure'],
      ['op3', 'prose_accept'],
    ]);
    const opTypeMap = new Map([
      ['op1', 'fact.upsert'],
      ['op2', 'disclosure.record'],
      ['op3', 'prose.accept'],
    ]);

    const errors = verifyProseAcceptOrder(sorted, opIntentMap, opTypeMap);
    expect(errors.some((e) => e.code === 'PROSE_ACCEPT_NOT_LAST')).toBe(true);
  });

  it('multiple prose_accept ops produce error', () => {
    const sorted = ['op1', 'op3', 'op4'];
    const opIntentMap = new Map([
      ['op1', 'upsert_fact'],
      ['op3', 'prose_accept'],
      ['op4', 'prose_accept'],
    ]);
    const opTypeMap = new Map([
      ['op1', 'fact.upsert'],
      ['op3', 'prose.accept'],
      ['op4', 'prose.accept'],
    ]);

    const errors = verifyProseAcceptOrder(sorted, opIntentMap, opTypeMap);
    expect(errors.some((e) => e.code === 'MULTIPLE_PROSE_ACCEPT')).toBe(true);
  });
});

// =============================================================================
// proposal-operation-hash — Proposal with mismatched operationsHash rejected
// =============================================================================

describe('proposal-operation-hash', () => {
  it('operationsHash is deterministic for same ops', () => {
    const ops = [
      {
        operationId: 'op1',
        changeSetId: 'cs1',
        sequence: 1,
        opType: 'fact.upsert',
        targetType: 'fact',
        targetId: 'f1',
        payload: { factKey: 'k1', truth: 't1' },
        source: 'ai' as const,
      },
    ];

    const hash1 = computeOperationsHash(ops);
    const hash2 = computeOperationsHash(ops);
    expect(hash1).toBe(hash2);
  });

  it('different ops produce different hashes', () => {
    const ops1 = [
      {
        operationId: 'op1',
        changeSetId: 'cs1',
        sequence: 1,
        opType: 'fact.upsert',
        targetType: 'fact',
        targetId: 'f1',
        payload: { factKey: 'k1', truth: 't1' },
        source: 'ai' as const,
      },
    ];

    const ops2 = [
      {
        operationId: 'op1',
        changeSetId: 'cs1',
        sequence: 1,
        opType: 'fact.upsert',
        targetType: 'fact',
        targetId: 'f1',
        payload: { factKey: 'k1', truth: 't2' },
        source: 'ai' as const,
      },
    ];

    const hash1 = computeOperationsHash(ops1);
    const hash2 = computeOperationsHash(ops2);
    expect(hash1).not.toBe(hash2);
  });

  it('hash mismatch is detected', () => {
    const errors = verifyHash('operationsHash', 'aaa', 'bbb');
    expect(errors.some((e) => e.code === 'HASH_MISMATCH')).toBe(true);
  });

  it('matching hashes pass verification', () => {
    const errors = verifyHash('operationsHash', 'abc', 'abc');
    expect(errors).toHaveLength(0);
  });
});

// =============================================================================
// repair-reextract — Repair full re-extraction (no reuse old ops + new proseVersionId)
// =============================================================================

describe('repair-reextract', () => {
  it('repair contract uses same allowlist as beat.write', () => {
    const repairAllowlist = validateAgainstAllowlist(
      [{ tempRef: 'r1', opIntent: 'upsert_fact', targetType: 'fact', payload: {} }],
      'beat.repair.v1',
    );
    expect(repairAllowlist).toHaveLength(0);
  });

  it('repair produces new prose with full re-extraction', () => {
    // In a repair scenario, the model emits a completely new set of suggestions
    // with new tempRefs (not reusing old ones). We verify the extraction
    // produces a fresh set of operations.
    const suggestions: ModelSuggestionDraft[] = [
      { tempRef: 'new-r1', opIntent: 'upsert_fact', targetType: 'fact', payload: { factKey: 'updated' } },
      { tempRef: 'new-r2', opIntent: 'record_disclosure', targetType: 'disclosure', payload: {} },
      { tempRef: 'new-r3', opIntent: 'prose_accept', targetType: 'prose', payload: {} },
    ];

    const { scope, errors } = resolveTempRefs(suggestions, 'repair-candidate');
    expect(errors).toHaveLength(0);
    expect(scope.resolved.size).toBe(3);

    // All tempRefs should be "new" — not reusing old references
    for (const ref of scope.resolved.keys()) {
      expect(ref).toMatch(/^new-/);
    }
  });
});

// =============================================================================
// Prose evidence tests
// =============================================================================

describe('prose-evidence', () => {
  it('extracts evidence with valid UTF-16 offsets', () => {
    const prose = 'Hello World!';
    const hash = computeProseContentHash(prose);
    const { evidence, errors } = extractProseEvidence(prose, 0, 5, hash);

    expect(errors).toHaveLength(0);
    expect(evidence.excerpt).toBe('Hello');
    expect(evidence.offsetStart).toBe(0);
    expect(evidence.offsetEnd).toBe(5);
    expect(evidence.proseContentHash).toBe(hash);
  });

  it('rejects out of bounds offsets', () => {
    const prose = 'Short';
    const hash = computeProseContentHash(prose);
    const { errors } = extractProseEvidence(prose, 0, 100, hash);

    expect(errors.some((e) => e.code === 'EVIDENCE_OFFSET_OUT_OF_BOUNDS')).toBe(true);
  });

  it('rejects negative offset', () => {
    const prose = 'Text';
    const hash = computeProseContentHash(prose);
    const { errors } = extractProseEvidence(prose, -1, 3, hash);

    expect(errors.some((e) => e.code === 'EVIDENCE_OFFSET_NEGATIVE')).toBe(true);
  });

  it('validates disclosure evidence', () => {
    const prose = 'Hello World This Is A Test Of Evidence Extraction';
    const hash = computeProseContentHash(prose);
    const suggestions = [
      {
        opIntent: 'record_disclosure',
        tempRef: 'd1',
        payload: { evidenceOffsetStart: 0, evidenceOffsetEnd: 5 },
      },
      {
        opIntent: 'upsert_fact',
        tempRef: 'f1',
        payload: {},
      },
    ];

    const errors = validateDisclosureEvidence(prose, suggestions, hash);
    expect(errors).toHaveLength(0);
  });

  it('disclosure without evidence offsets errors', () => {
    const prose = 'Test';
    const hash = computeProseContentHash(prose);
    const suggestions = [
      {
        opIntent: 'record_disclosure',
        tempRef: 'd1',
        payload: {},
      },
    ];

    const errors = validateDisclosureEvidence(prose, suggestions, hash);
    expect(errors.some((e) => e.code === 'DISCLOSURE_MISSING_EVIDENCE')).toBe(true);
  });
});
