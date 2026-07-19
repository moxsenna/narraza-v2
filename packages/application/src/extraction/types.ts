// S7 Extraction types — three layers from model output to canonical operations
//
// Three type layers:
//   1. ModelSuggestionDraft — what the AI model emits (tempRef, opIntent, payload)
//   2. NormalizedOperationDraft — tempRef resolved, IDs allocated, evidence validated
//   3. CanonicalChangeOperation — final persisted form (model never emits this directly)

/**
 * Layer 1: What the AI model emits.
 * Model NEVER emits CanonicalChangeOperation.
 * Uses tempRef for cross-references within a single GeneratedCandidate.
 */
export interface ModelSuggestionDraft {
  tempRef: string;
  opIntent: OpIntent;
  targetType: string;
  payload: Record<string, unknown>;
}

export type OpIntent =
  | 'upsert_fact'
  | 'upsert_character_state'
  | 'upsert_belief'
  | 'record_disclosure'
  | 'prose_accept'
  | 'upsert_character'
  | 'upsert_foundation'
  | 'upsert_outline'
  | 'upsert_chapter'
  | 'upsert_beat'
  | 'create_artifact';

/**
 * Layer 2: Normalized — tempRef resolved, IDs allocated, evidence validated.
 * Still NOT a CanonicalChangeOperation; model can't emit this either.
 */
export interface NormalizedOperationDraft {
  operationId: string;
  tempRef: string;
  opIntent: OpIntent;
  targetType: string;
  targetId: string;
  payload: Record<string, unknown>;

  /** Resolved tempRef → operationId mapping for dependencies */
  resolvedDependencies: string[];

  /** Deterministic sequence in the DAG */
  sequence: number;

  /** Evidence from prose (UTF-16 offsets) for disclosures */
  evidence?: ProseEvidence;
}

/**
 * Layer 3: Canonical change operation — system-derived, never model-emitted.
 */
export interface CanonicalChangeOperation {
  operationId: string;
  changeSetId: string;
  sequence: number;
  opType: string;
  targetType: string;
  targetId: string | null;
  payload: Record<string, unknown>;

  /** Source of this operation */
  source: 'ai' | 'user' | 'system';

  /** For AI-sourced ops, the tempRef chain for traceability */
  derivationChain?: string[];
}

/**
 * Evidence from prose text using UTF-16 offsets.
 */
export interface ProseEvidence {
  /** Start offset in UTF-16 code units */
  offsetStart: number;
  /** End offset in UTF-16 code units (exclusive) */
  offsetEnd: number;
  /** SHA-256 of the prose content this evidence references */
  proseContentHash: string;
  /** The evidence text excerpt (UTF-16 substring) */
  excerpt: string;
}

/**
 * Result of extracting and normalizing model suggestions.
 */
export interface ExtractionResult {
  /** Original model output (parsed) */
  rawOutput: unknown;
  /** Normalized operations with IDs and resolved refs */
  normalizedOps: NormalizedOperationDraft[];
  /** Canonical operations (layer 3) */
  canonicalOps: CanonicalChangeOperation[];
  /** The prose content hash for evidence validation */
  proseContentHash: string;
  /** The operations hash (SHA-256 of canonicalized ops) */
  operationsHash: string;
  /** Payload hash for proposal integrity */
  payloadHash: string;
  /** Any errors encountered during extraction */
  errors: ExtractionError[];
  /** Warnings (non-fatal) */
  warnings: string[];
}

export interface ExtractionError {
  code: string;
  message: string;
  tempRef?: string;
  path?: string;
}

/**
 * TempRef scope: a single GeneratedCandidate.
 * Cross-candidate references are rejected.
 */
export interface TempRefScope {
  candidateId: string;
  /** Map from tempRef to allocated operationId */
  resolved: Map<string, string>;
  /** Reverse map for cycle detection */
  dependencies: Map<string, string[]>;
}

/**
 * Contract-specific operation allowlists.
 */
export interface OperationAllowlist {
  /** Allowed opIntents for this contract */
  allowedOpIntents: OpIntent[];
  /** Max operations per type */
  maxCounts: Partial<Record<OpIntent, number>>;
  /** Total max operations */
  maxTotalOps: number;
}

/**
 * DAG node for topological sorting.
 */
export interface DAGNode {
  operationId: string;
  tempRef: string;
  dependencies: string[];
}

/**
 * Contract name enum for allowlist lookup.
 */
export type PromptContractVersion =
  | 'intake.extract.v1'
  | 'foundation.propose.v1'
  | 'character.propose.v1'
  | 'outline.generate.v1'
  | 'beat.write.v1'
  | 'beat.judge.v1'
  | 'beat.repair.v1'
  | 'judge-output.repair.v1'
  | 'publish.package.v1';
