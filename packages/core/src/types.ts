// Domain core types — pure, no AI/DB/HTTP dependencies

// -- Facts ----------------------------------------------------------------

export interface Fact {
  id: string;
  truth: string;
  factKey: string;
  status: FactCanonStatus;
  category: string;
}

export type FactCanonStatus = 'confirmed' | 'deprecated' | 'contradicted';

export interface RestrictedFact {
  id: string;
  truth: string;
  factKey: string;
  category: string;
}

export interface WriterSafeFact {
  id: string;
  surface: string;
  factKey: string;
  category: string;
}

export interface ForbiddenConcept {
  factId: string;
  truth: string;
}

// -- Reveal policy --------------------------------------------------------

export interface RevealPolicyResult {
  restrictedFacts: RestrictedFact[];
  writerSafeFacts: WriterSafeFact[];
  forbiddenConcepts: ForbiddenConcept[];
}

// -- Writer packet ---------------------------------------------------------

export interface WriterPacket {
  kind: 'writer_safe';
  projectId: string;
  beatId: string;
  facts: WriterSafeFact[];
  writerGuidance: string[];
}

// -- Character -------------------------------------------------------------

export type NarrativePointOfView = 'POV' | 'non_POV' | 'observer';

export interface CharacterContext {
  characterId: string;
  name: string;
  pov: NarrativePointOfView;
}

// -- Belief ----------------------------------------------------------------

export interface Belief {
  characterId: string;
  beliefKey: string;
  content: string;
  confidence: number; // 0-1
  source: string;
  allowedTransitionReasons: string[];
}

export type BeliefTransitionReason = 'direct_experience' | 'trusted_report' | 'logical_deduction' | 'discovery';

export interface BeliefTransition {
  from: Belief;
  to: Belief;
  reason: BeliefTransitionReason;
}

export interface BeliefTransitionResult {
  accepted: boolean;
  reason: BeliefTransitionReason | null;
  violations: string[];
}

// -- Disclosure ------------------------------------------------------------

export interface DisclosureEvent {
  factId: string;
  target: string;
  createdAt: string; // ISO timestamp
  id: string;
  sequence: number;
}

export interface DisclosureFoldResult {
  disclosures: DisclosureEvent[];
  retractionTarget: string | null;
}

// -- Dependency manifest ---------------------------------------------------

export const DEPENDENCY_SCHEMA_VERSION = 'v1';

export interface DependencyEntry {
  entityType: string;
  entityId: string;
  revision: number;
}

export interface DependencyManifest {
  schemaVersion: string;
  entries: DependencyEntry[];
  hash: string;
}

// -- Stale policy ----------------------------------------------------------

export type ProposalStaleStatus = 'valid' | 'stale' | 'needs_revalidation';

export interface StalePolicyInput {
  currentDependencyHash: string;
  proposalDependencyHash: string;
  proposalVersion: number;
  currentCanonicalVersion: number;
  depRevisionsChanged: boolean;
  regenerable: boolean;
}

export interface StalePolicyResult {
  status: ProposalStaleStatus;
  reason: string;
}

// -- Validation findings ---------------------------------------------------

export type FindingSeverity = 'blocker' | 'warning' | 'info';

export type FindingSource = 'deterministic' | 'ai';

export interface Finding {
  code: string;
  severity: FindingSeverity;
  source: FindingSource;
  message: string;
  publicMessageCode: string;
  deterministic: boolean;
}

// -- Merge findings --------------------------------------------------------

export interface MergeFindingsInput {
  deterministicFindings: Finding[];
  aiFindings: Finding[];
}

export interface MergeFindingsResult {
  findings: Finding[];
  passed: boolean;
  conflicts: string[];
}

// -- Repair policy ---------------------------------------------------------

export interface RepairState {
  attempts: number;
  maxAttempts: number;
  findingsHistory: Finding[][];
  blockingResolved: boolean;
}

export type RepairStopReason =
  | 'all_blocking_resolved'
  | 'attempt_limit'
  | 'no_progress'
  | 'same_findings_repeated'
  | 'regression';

export interface RepairDecision {
  shouldStop: boolean;
  reason: RepairStopReason | null;
}

// -- Prose policy ----------------------------------------------------------

export type ProseStatus = 'draft' | 'validated' | 'rejected' | 'superseded';

export interface ProseVersionMetadata {
  proseVersionId: string;
  beatId: string;
  version: number;
  status: ProseStatus;
  contentHash: string;
}

// -- Readiness policy ------------------------------------------------------

export interface FoundationReadinessInput {
  premise: string;
  title: string;
  genre: string;
  targetAudience: string;
  pov: string;
  tone: string;
}

export interface ReadinessCheckResult {
  ready: boolean;
  reasons: string[];
}

export type FoundationStatus = 'none' | 'draft' | 'locked';
