// @narraza/core — pure domain logic
// No AI, DB, HTTP, or Prisma imports.

export * from './types.js';

// Policies
export { buildWriterPacket, type BuildWriterPacketInput } from './context/writer-packet.js';
export { buildDependencyManifest, dependencyHashesEqual, rehashDependencyManifest } from './dependency-manifest.js';
export { evaluateStalePolicy } from './stale-policy.js';
export { evaluateExpressionPolicy } from './expression-policy.js';
export type { ExpressionPolicyInput, ExpressionPolicyResult, ExpressionDirective } from './expression-policy.js';
export { validateBeliefTransition } from './knowledge-policy.js';
export { foldDisclosures } from './disclosure-policy.js';
export { evaluateRepairPolicy } from './repair-policy.js';
export { checkFoundationReadiness } from './readiness-policy.js';
export {
  applyRevealPolicy,
  classifyFactsForWriter,
  type RevealPolicyFact,
  type ApplyRevealPolicyInput,
} from './reveal-policy.js';

// Validators
export { mergeFindings } from './validator/merge-findings.js';
export type { MergeFindingsInput, MergeFindingsResult } from './validator/merge-findings.js';
export { structuralValidate, type StructuralValidationInput } from './validator/structural.js';
export {
  validateBeatContract,
  type BeatContract,
  type BeatContractValidationInput,
} from './validator/beat-contract.js';
export {
  validateRevealLeak,
  type RevealValidationInput,
} from './validator/reveal-validator.js';
export {
  validateCharacterKnowledge,
  type CharacterKnowledgeFact,
  type CharacterKnowledgeValidationInput,
} from './validator/character-knowledge.js';
export {
  validateCanonContradiction,
  type CanonContradictionInput,
  type CanonProposal,
  type CanonSensitiveCategory,
} from './validator/canon-contradiction.js';
export {
  validateSafeRepair,
  applyMinimalSafeRepair,
  type SafeRepairConstraints,
  type SafeRepairValidationInput,
} from './validator/safe-repair.js';
export {
  validateProseDeterministic,
  type FullProseValidationInput,
  type FullProseValidationResult,
} from './validator/run-all.js';

// Context packets
export type { PlannerPacket } from './context/planner-packet.js';
