export interface Foundation {
  id: string;
  projectId: string;
  premise: string | null;
  tone: string | null;
  genre: string | null;
  body: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertFoundationInput {
  projectId: string;
  premise?: string | null;
  tone?: string | null;
  genre?: string | null;
  body?: Record<string, unknown> | null;
}

export interface FoundationRepo {
  findByProjectId(projectId: string): Promise<Foundation | null>;
  upsert(input: UpsertFoundationInput): Promise<Foundation>;
}
