import type { ProjectRepo } from '../../ports/project-ports.js';

export interface ListProjectsOutput {
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

export interface ListProjectsPorts {
  projectRepo: ProjectRepo;
}

export async function listProjects(
  ports: ListProjectsPorts,
  userId: string,
): Promise<ListProjectsOutput[]> {
  const projects = await ports.projectRepo.listByOwnerUserId(userId);
  return projects.map((p) => ({
    id: p.id,
    ownerUserId: p.ownerUserId,
    title: p.title,
    startMode: p.startMode,
    foundationStatus: p.foundationStatus,
    currentCanonicalVersion: p.currentCanonicalVersion,
    createRequestId: p.createRequestId,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    deletedAt: p.deletedAt,
  }));
}
