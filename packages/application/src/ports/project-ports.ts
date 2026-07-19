export interface Project {
  id: string;
  ownerUserId: string;
  title: string;
  startMode: 'guided' | 'advanced';
  foundationStatus: 'none' | 'draft' | 'locked';
  currentCanonicalVersion: number;
  createRequestId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreateProjectInput {
  ownerUserId: string;
  title: string;
  startMode: 'guided' | 'advanced';
  createRequestId: string;
}

export interface ProjectRepo {
  findById(id: string): Promise<Project | null>;
  findByOwnerUserIdAndRequestId(
    ownerUserId: string,
    requestId: string,
  ): Promise<Project | null>;
  create(input: CreateProjectInput): Promise<Project>;
  listByOwnerUserId(ownerUserId: string): Promise<Project[]>;
  softDelete(id: string): Promise<Project | null>;
  /** Lock a project row for update, returns current state */
  lockForUpdate(id: string): Promise<Project | null>;
  /** Update foundationStatus */
  updateFoundationStatus(
    id: string,
    status: 'none' | 'draft' | 'locked',
  ): Promise<Project | null>;
  /** Bump currentCanonicalVersion by given increment */
  bumpCanonicalVersion(id: string, increment: number): Promise<Project | null>;
}
