export interface CanonicalChangeSet {
  id: string;
  projectId: string;
  proposalId: string | null;
  status: string;
  appliedAt: Date | null;
  rejectedAt: Date | null;
  createdAt: Date;
}

export interface CanonicalChangeOperation {
  id: string;
  changeSetId: string;
  sequence: number;
  opType: string;
  targetType: string;
  targetId: string | null;
  payload: Record<string, unknown>;
  createdAt: Date;
}

export interface CreateChangeSetInput {
  projectId: string;
  status?: string;
}

export interface CreateChangeOperationInput {
  changeSetId: string;
  sequence: number;
  opType: string;
  targetType: string;
  targetId?: string | null;
  payload: Record<string, unknown>;
}

export interface CanonicalChangeSetRepo {
  create(input: CreateChangeSetInput): Promise<CanonicalChangeSet>;
  createOperation(input: CreateChangeOperationInput): Promise<CanonicalChangeOperation>;
  findById(id: string): Promise<CanonicalChangeSet | null>;
  /** Find all operations for a change set, ordered by sequence. */
  findOperationsByChangeSetId(changeSetId: string): Promise<CanonicalChangeOperation[]>;
  /** CAS: apply a change set (set appliedAt = NOW(), status = 'applied'). */
  applyChangeSet(id: string): Promise<CanonicalChangeSet | null>;
  /** CAS: reject a change set (set rejectedAt = NOW(), status = 'rejected'). */
  rejectChangeSet(id: string): Promise<CanonicalChangeSet | null>;
  /** Find change sets by project ID. */
  findByProjectId(projectId: string): Promise<CanonicalChangeSet[]>;
  /** Create a canonical entity revision record. */
  createEntityRevision(input: {
    projectId: string;
    entityType: string;
    entityId: string;
    changeSetId: string;
    revision: number;
    previousHash?: string | null;
    newHash: string;
    operationCount?: number;
  }): Promise<unknown>;
}
