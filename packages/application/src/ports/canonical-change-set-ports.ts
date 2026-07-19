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
}
