import type {
  RestrictedFact,
  WriterSafeFact,
  ForbiddenConcept,
  WriterPacket,
} from '../types.js';

export interface BuildWriterPacketInput {
  projectId: string;
  beatId: string;
  restrictedFacts: RestrictedFact[];
  writerSafeFacts: WriterSafeFact[];
  forbiddenConcepts: ForbiddenConcept[];
}

/**
 * Build writer packet via ALLOWLIST only (never redact-from-planner).
 *
 * - Only writerSafeFacts are included (never restrictedFacts)
 * - Writer guidance is generated from safe facts only — raw forbidden
 *   truth phrases are never embedded
 * - No restrictedFacts or restrictedGuardSet fields exist on the packet
 */
export function buildWriterPacket(input: BuildWriterPacketInput): WriterPacket {
  const writerGuidance: string[] = input.writerSafeFacts.map(
    (f) => `Use: ${f.surface} (${f.factKey})`,
  );

  // Add behavioral guidance from safe facts only — never from forbidden concepts
  const safeKeys = new Set(input.writerSafeFacts.map((f) => f.factKey));
  for (const fc of input.forbiddenConcepts) {
    // If the forbidden concept has NO safe counterpart, add a generic directive
    // without exposing the raw truth
    if (input.writerSafeFacts.some((sf) => sf.factKey === fc.factId)) {
      continue; // already covered by the safe fact
    }
    // Emit a behavioral directive that does NOT contain the forbidden truth
    writerGuidance.push(`Avoid: plot point related to ${fc.factId}`);
  }

  // Clean all guidance to ensure no forbidden truth leaks
  const forbiddenPhrases = new Set(
    input.forbiddenConcepts.map((fc) => fc.truth),
  );
  const filteredGuidance = writerGuidance.filter(
    (g) => ![...forbiddenPhrases].some((fp) => g.includes(fp)),
  );

  return {
    kind: 'writer_safe',
    projectId: input.projectId,
    beatId: input.beatId,
    facts: input.writerSafeFacts,
    writerGuidance: filteredGuidance,
  };
}
