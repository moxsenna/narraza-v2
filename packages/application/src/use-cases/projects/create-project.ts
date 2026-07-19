import type { ProjectRepo } from '../../ports/project-ports.js';
import type { UserRepo } from '../../ports/auth-ports.js';
import {
  PublicUseCaseError,
} from '@narraza/shared';

export interface CreateProjectInput {
  userId: string;
  title: string;
  startMode: 'guided' | 'advanced';
  requestId: string;
}

export interface CreateProjectOutput {
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

export interface ProjectPorts {
  projectRepo: ProjectRepo;
  userRepo: UserRepo;
}

export async function createProject(
  ports: ProjectPorts,
  input: CreateProjectInput,
): Promise<CreateProjectOutput> {
  // Authorize: user must exist and be active
  const user = await ports.userRepo.findById(input.userId);
  if (!user) {
    throw new PublicUseCaseError('NOT_FOUND', 'User not found');
  }
  if (user.status !== 'active') {
    throw new PublicUseCaseError('FORBIDDEN', 'Account is not active');
  }

  // Idempotent on requestId per owner
  if (input.requestId) {
    const existing = await ports.projectRepo.findByOwnerUserIdAndRequestId(
      input.userId,
      input.requestId,
    );
    if (existing) {
      // Return existing project; do not change title
      return {
        id: existing.id,
        ownerUserId: existing.ownerUserId,
        title: existing.title,
        startMode: existing.startMode,
        foundationStatus: existing.foundationStatus,
        currentCanonicalVersion: existing.currentCanonicalVersion,
        createRequestId: existing.createRequestId,
        createdAt: existing.createdAt,
        updatedAt: existing.updatedAt,
        deletedAt: existing.deletedAt,
      };
    }
  }

  const project = await ports.projectRepo.create({
    ownerUserId: input.userId,
    title: input.title,
    startMode: input.startMode,
    createRequestId: input.requestId,
  });

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
