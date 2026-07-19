import type { Finding } from '../types.js';

export interface StructuralValidationInput {
  proseContent: string;
  beatId: string;
  chapterId: string;
}

/**
 * Structural validation ensures the prose meets minimum formatting
 * and content requirements. This is a deterministic check.
 */
export function structuralValidate(
  input: StructuralValidationInput,
): Finding[] {
  const findings: Finding[] = [];

  if (input.proseContent.trim().length === 0) {
    findings.push({
      code: 'STRUCT_EMPTY_PROSE',
      severity: 'blocker',
      source: 'deterministic',
      message: 'Prose content is empty',
      publicMessageCode: 'empty.prose',
      deterministic: true,
    });
  }

  if (input.proseContent.length > 100_000) {
    findings.push({
      code: 'STRUCT_PROSE_TOO_LONG',
      severity: 'warning',
      source: 'deterministic',
      message: `Prose is ${input.proseContent.length} chars; exceeds recommended 100k`,
      publicMessageCode: 'prose.too.long',
      deterministic: true,
    });
  }

  return findings;
}
