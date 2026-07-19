import type { ProjectRepo } from '../../ports/project-ports.js';

export interface SoftDeleteProjectOutput {
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

export interface SoftDeleteProjectPorts {
  projectRepo: ProjectRepo;
}

export async function softDeleteProject(
  ports: SoftDeleteProjectPorts,
  projectId: string,
): Promise<SoftDeleteProjectOutput | null> {
  const project = await ports.projectRepo.softDelete(projectId);
  if (!project) return null;
  return {
    id: project.id,
    ownerUserId: project.ownerUserId,
    title: project.title,
    startMode: project.startMode,
    foundationStatus: project.foundationStatus,
    currentCanonicalVersion: project.currentCanonicalVersion,
    createRequestId: project.createRequestId,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    deletedAt: project.deletedAt,
  };
}
