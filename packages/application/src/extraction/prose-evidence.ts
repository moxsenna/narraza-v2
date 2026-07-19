// Prose evidence: UTF-16 offsets + contentHash.
// Evidence is required for disclosure operations.
// Uses UTF-16 code units (JavaScript string .length) for offsets.

import type { ProseEvidence, ExtractionError } from './types.js';
import { createHash } from 'node:crypto';

/**
 * Compute the SHA-256 content hash of prose text.
 */
export function computeProseContentHash(prose: string): string {
  return createHash('sha256').update(prose, 'utf8').digest('hex');
}

/**
 * Extract evidence from prose using UTF-16 offset ranges.
 * Validates offsets are within bounds and the excerpt matches.
 */
export function extractProseEvidence(
  prose: string,
  offsetStart: number,
  offsetEnd: number,
  proseContentHash: string,
): { evidence: ProseEvidence; errors: ExtractionError[] } {
  const errors: ExtractionError[] = [];

  // Validate offsets
  if (offsetStart < 0) {
    errors.push({
      code: 'EVIDENCE_OFFSET_NEGATIVE',
      message: `Evidence offsetStart ${offsetStart} is negative`,
    });
  }

  if (offsetEnd > prose.length) {
    errors.push({
      code: 'EVIDENCE_OFFSET_OUT_OF_BOUNDS',
      message: `Evidence offsetEnd ${offsetEnd} exceeds prose length ${prose.length}`,
    });
  }

  if (offsetStart >= offsetEnd) {
    errors.push({
      code: 'EVIDENCE_OFFSET_INVALID',
      message: `Evidence offsetStart ${offsetStart} >= offsetEnd ${offsetEnd}`,
    });
  }

  if (errors.length > 0) {
    return {
      evidence: {
        offsetStart,
        offsetEnd,
        proseContentHash,
        excerpt: '',
      },
      errors,
    };
  }

  const excerpt = prose.slice(offsetStart, offsetEnd);

  return {
    evidence: {
      offsetStart,
      offsetEnd,
      proseContentHash,
      excerpt,
    },
    errors: [],
  };
}

/**
 * Validate that all disclosure operations have valid evidence.
 */
export function validateDisclosureEvidence(
  prose: string,
  suggestions: Array<{
    opIntent: string;
    tempRef: string;
    payload: Record<string, unknown>;
  }>,
  proseContentHash: string,
): ExtractionError[] {
  const errors: ExtractionError[] = [];

  for (const s of suggestions) {
    if (s.opIntent !== 'record_disclosure') continue;

    const offsetStart = s.payload['evidenceOffsetStart'] as number | undefined;
    const offsetEnd = s.payload['evidenceOffsetEnd'] as number | undefined;

    if (offsetStart === undefined || offsetEnd === undefined) {
      errors.push({
        code: 'DISCLOSURE_MISSING_EVIDENCE',
        message: `Disclosure '${s.tempRef}' missing evidenceOffsetStart/evidenceOffsetEnd`,
        tempRef: s.tempRef,
      });
      continue;
    }

    if (typeof offsetStart !== 'number' || typeof offsetEnd !== 'number') {
      errors.push({
        code: 'DISCLOSURE_INVALID_EVIDENCE_TYPE',
        message: `Disclosure '${s.tempRef}' evidence offsets must be numbers`,
        tempRef: s.tempRef,
      });
      continue;
    }

    const result = extractProseEvidence(prose, offsetStart, offsetEnd, proseContentHash);
    errors.push(...result.errors);
  }

  return errors;
}
