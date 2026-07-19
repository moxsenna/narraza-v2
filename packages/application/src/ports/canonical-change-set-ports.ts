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

export interface EntityRevisionRecord {
  projectId: string;
  entityType: string;
  entityId: string;
  revision: number;
  previousHash: string | null;
  newHash: string;
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
  /** Latest revision for an entity in a project, or null if none. */
  findLatestEntityRevision(
    projectId: string,
    entityType: string,
    entityId: string,
  ): Promise<EntityRevisionRecord | null>;
}

export interface Fact {
  id: string;
  projectId: string;
  factKey: string;
  truth: string;
  canonStatus: 'confirmed' | 'deprecated' | 'contradicted';
  revision: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface FactRepo {
  findById(id: string): Promise<Fact | null>;
  findActiveByProjectAndKey(projectId: string, factKey: string): Promise<Fact | null>;
  upsert(input: {
    id?: string;
    projectId: string;
    factKey: string;
    truth: string;
    canonStatus?: 'confirmed' | 'deprecated' | 'contradicted';
  }): Promise<Fact>;
  softDelete(id: string): Promise<Fact | null>;
}

export interface ProseVersion {
  id: string;
  beatId: string;
  version: number;
  content: string;
  contentHash: string;
  status: string;
  createdAt: Date;
}

export interface Beat {
  id: string;
  chapterId: string;
  beatNumber: number;
  acceptedProseVersionId: string | null;
  title: string | null;
  summary: string | null;
}

export interface BeatRepo {
  findById(id: string): Promise<Beat | null>;
  /** Set accepted prose pointer. Must satisfy composite FK (beat_id, prose_version_id). */
  setAcceptedProseVersion(
    beatId: string,
    proseVersionId: string,
  ): Promise<Beat | null>;
}

export interface ProseVersionRepo {
  findById(id: string): Promise<ProseVersion | null>;
  create(input: {
    beatId: string;
    version: number;
    content: string;
    contentHash: string;
    status?: string;
  }): Promise<ProseVersion>;
  /** Next version number for a beat (max+1 or 1). */
  nextVersion(beatId: string): Promise<number>;
}
