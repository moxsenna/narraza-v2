// Proposal integrity: operationsHash + payloadHash.
// Protects proposal immutability — hash mismatch = reject.

import { createHash } from 'node:crypto';
import type { CanonicalChangeOperation, ExtractionError } from './types.js';

/**
 * Compute operationsHash from canonical operations.
 *
 * Serialization format (deterministic):
 *   opType|targetType|targetId|JSON-sorted-payload-keys
 * Concatenated with newline, then SHA-256.
 */
export function computeOperationsHash(ops: CanonicalChangeOperation[]): string {
  const lines = ops.map((op) => {
    const payloadStr = JSON.stringify(op.payload, Object.keys(op.payload).sort());
    return `${op.opType}|${op.targetType}|${op.targetId ?? ''}|${payloadStr}`;
  });
  return createHash('sha256').update(lines.join('\n'), 'utf8').digest('hex');
}

/**
 * Compute payloadHash from the raw prose + all normalized operations.
 */
export function computePayloadHash(
  proseContentHash: string,
  prose: string,
  ops: Array<{ targetType: string; payload: Record<string, unknown> }>,
): string {
  const parts: string[] = [proseContentHash];
  for (const op of ops) {
    parts.push(
      `${op.targetType}:${JSON.stringify(op.payload, Object.keys(op.payload).sort())}`,
    );
  }
  return createHash('sha256').update(parts.join('\n'), 'utf8').digest('hex');
}

/**
 * Verify that a computed hash matches the expected hash.
 */
export function verifyHash(
  label: string,
  computed: string,
  expected: string,
): ExtractionError[] {
  if (computed !== expected) {
    return [
      {
        code: 'HASH_MISMATCH',
        message: `${label} mismatch: expected ${expected.slice(0, 16)}..., got ${computed.slice(0, 16)}...`,
      },
    ];
  }
  return [];
}

/**
 * Check that prose_accept operation is the last one in the sorted sequence.
 */
export function verifyProseAcceptOrder(
  sortedOpIds: string[],
  opIntentMap: Map<string, string>,
  opTypeMap: Map<string, string>,
): ExtractionError[] {
  const errors: ExtractionError[] = [];

  const acceptOps: string[] = [];
  for (const id of sortedOpIds) {
    const intent = opIntentMap.get(id) ?? '';
    const opType = opTypeMap.get(id) ?? '';
    if (intent === 'prose_accept' || opType === 'prose.accept') {
      acceptOps.push(id);
    }
  }

  if (acceptOps.length > 1) {
    errors.push({
      code: 'MULTIPLE_PROSE_ACCEPT',
      message: `Multiple prose_accept operations found: ${acceptOps.join(', ')}. Only one allowed.`,
    });
  }

  if (acceptOps.length === 1 && sortedOpIds[sortedOpIds.length - 1] !== acceptOps[0]) {
    errors.push({
      code: 'PROSE_ACCEPT_NOT_LAST',
      message: `prose_accept operation ${acceptOps[0]} is not the last in the DAG sequence`,
    });
  }

  return errors;
}
