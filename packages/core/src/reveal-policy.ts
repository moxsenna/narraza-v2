// reveal-policy.ts — Stub for M1 phase.
// Full implementation in M4 when AI contracts and prompt projectors
// need to classify facts into restricted / writer-safe / forbidden.
//
// For M1 tests, the writer-packet builder uses these types directly
// from types.ts without needing reveal-policy logic.
export {};

// Re-export types for convenience
export type {
  RevealPolicyResult,
  RestrictedFact,
  WriterSafeFact,
  ForbiddenConcept,
} from './types.js';
