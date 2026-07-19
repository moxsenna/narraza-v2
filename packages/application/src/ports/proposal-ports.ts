/**
 * M5 Proposal ports: Proposal, ProposalGroup, ProseWorkingDraft, ValidationReport.
 *
 * These ports are used by M5 accept-proposal, save-working-draft, validation-hash,
 * submit-user-prose, and PublicProposalView mapper use cases.
 */

// =============================================================================
// DTOs
// =============================================================================

export interface ProposalGroup {
  id: string;
  projectId: string;
  createdAt: Date;
}

export interface Proposal {
  id: string;
  proposalGroupId: string;
  source: 'ai' | 'user' | 'system';
  status: 'pending' | 'accepted' | 'rejected' | 'stale' | 'superseded' | 'needs_revalidation';
  dependencyHash: string;
  operationsHash: string;
  revalidatedFromProposalId: string | null;
  changeSetId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProposalGroupInput {
  projectId: string;
}

export interface CreateProposalInput {
  proposalGroupId: string;
  source: 'ai' | 'user' | 'system';
  dependencyHash: string;
  operationsHash: string;
  revalidatedFromProposalId?: string | null;
  changeSetId?: string | null;
}

export interface ProseWorkingDraft {
  id: string;
  userId: string;
  beatId: string;
  content: string;
  contentHash: string;
  version: number;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SaveWorkingDraftInput {
  userId: string;
  beatId: string;
  content: string;
  contentHash: string;
  /** Expected version for CAS guard. Optional for insert. */
  expectedVersion?: number;
}

export interface ValidationReportEntry {
  id: string;
  proseVersionId: string;
  candidateId: string | null;
  passed: boolean;
  findings: Array<{
    code: string;
    severity: 'blocker' | 'warning' | 'info';
    source: 'deterministic' | 'ai';
    message: string;
    publicMessageCode: string;
    deterministic: boolean;
  }>;
  contentHash: string;
  createdAt: Date;
}

export interface CreateValidationReportInput {
  proseVersionId: string;
  candidateId?: string | null;
  passed: boolean;
  findings: Array<{
    code: string;
    severity: 'blocker' | 'warning' | 'info';
    source: 'deterministic' | 'ai';
    message: string;
    publicMessageCode: string;
    deterministic: boolean;
  }>;
  contentHash: string;
}

// =============================================================================
// Repo interfaces
// =============================================================================

export interface ProposalGroupRepo {
  create(input: CreateProposalGroupInput): Promise<ProposalGroup>;
  findById(id: string): Promise<ProposalGroup | null>;
}

export interface ProposalRepo {
  create(input: CreateProposalInput): Promise<Proposal>;
  findById(id: string): Promise<Proposal | null>;
  findByIdWithGroup(id: string): Promise<(Proposal & { group: ProposalGroup }) | null>;
  findByGroupId(groupId: string): Promise<Proposal[]>;
  findPendingByGroupId(groupId: string): Promise<Proposal[]>;
  /** CAS: update status from expected status. Returns updated row or null. */
  transitionStatus(
    id: string,
    fromStatus: Proposal['status'],
    toStatus: Proposal['status'],
    extra?: Partial<Pick<Proposal, 'changeSetId'>>,
  ): Promise<Proposal | null>;
  /** Mark all pending siblings in the same group as superseded. */
  supersedeSiblings(proposalGroupId: string, exceptProposalId: string): Promise<number>;
  /** Conditional update: set stale WHERE status='pending'. For CAS fail recovery. */
  markStaleIfPending(id: string): Promise<Proposal | null>;
  /** List all proposals for a change set */
  findByChangeSetId(changeSetId: string): Promise<Proposal[]>;
  /** Load with change set data for accept path */
  findWithChangeSet(id: string): Promise<(Proposal & { changeSet: import('./canonical-change-set-ports.js').CanonicalChangeSet | null }) | null>;
}

export interface ProseWorkingDraftRepo {
  /** Upsert with CAS: insert if not exists, update if expectedVersion matches. Returns the draft. */
  save(input: SaveWorkingDraftInput): Promise<ProseWorkingDraft>;
  findById(id: string): Promise<ProseWorkingDraft | null>;
  findByUserAndBeat(userId: string, beatId: string): Promise<ProseWorkingDraft | null>;
  /** Soft-delete (set deletedAt). */
  softDelete(id: string): Promise<ProseWorkingDraft | null>;
}

export interface ValidationReportRepo {
  create(input: CreateValidationReportInput): Promise<ValidationReportEntry>;
  findById(id: string): Promise<ValidationReportEntry | null>;
  findByProseVersionId(proseVersionId: string): Promise<ValidationReportEntry | null>;
  findLatestByProseVersionId(proseVersionId: string): Promise<ValidationReportEntry | null>;
  /** Check if any report still valid for a prose version/content hash combo. */
  findValidReport(proseVersionId: string, contentHash: string): Promise<ValidationReportEntry | null>;
}

// =============================================================================
// Combined proposal transaction ports
// =============================================================================

export interface ProposalTxPorts {
  proposalGroupRepo: ProposalGroupRepo;
  proposalRepo: ProposalRepo;
  workingDraftRepo: ProseWorkingDraftRepo;
  validationReportRepo: ValidationReportRepo;
}
