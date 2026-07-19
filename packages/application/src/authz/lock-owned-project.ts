import type { ProjectRepo } from '../ports/project-ports.js';
import { PublicUseCaseError } from '@narraza/shared';

/**
 * Load a project and verify the caller owns it.
 *
 * Returns the project on success.
 *
 * Error mapping:
 * - Project missing   -> NOT_FOUND (indistinguishable from IDOR)
 * - Wrong owner       -> NOT_FOUND (indistinguishable from missing)
 */
export async function lockOwnedProject(
  projectRepo: ProjectRepo,
  projectId: string,
  userId: string,
) {
  const project = await projectRepo.findById(projectId);
  if (!project) {
    throw new PublicUseCaseError('NOT_FOUND', 'Project not found');
  }

  if (project.ownerUserId !== userId) {
    // Same error as not-found to prevent IDOR probing
    throw new PublicUseCaseError('NOT_FOUND', 'Project not found');
  }

  if (project.deletedAt) {
    throw new PublicUseCaseError('NOT_FOUND', 'Project not found');
  }

  return project;
}
