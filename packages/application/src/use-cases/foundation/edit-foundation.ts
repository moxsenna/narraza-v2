import type { ProjectRepo } from '../../ports/project-ports.js';
import type { FoundationRepo } from '../../ports/foundation-ports.js';
import type { CanonicalChangeSetRepo } from '../../ports/canonical-change-set-ports.js';
import { authorizeActiveUser } from '../../authz/authorize-active-user.js';
import { lockOwnedProject } from '../../authz/lock-owned-project.js';
import { PublicUseCaseError } from '@narraza/shared';
import type { UserRepo } from '../../ports/auth-ports.js';

export interface EditFoundationInput {
  userId: string;
  projectId: string;
  premise?: string | null;
  tone?: string | null;
  genre?: string | null;
  body?: Record<string, unknown> | null;
}

export interface EditFoundationOutput {
  id: string;
  projectId: string;
  premise: string | null;
  tone: string | null;
  genre: string | null;
  body: Record<string, unknown> | null;
  foundationStatus: 'none' | 'draft' | 'locked';
  currentCanonicalVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface FoundationEditPorts {
  userRepo: UserRepo;
  projectRepo: ProjectRepo;
  foundationRepo: FoundationRepo;
  changeSetRepo: CanonicalChangeSetRepo;
}

/**
 * Edit foundation for a project.
 *
 * This is a minimal commitUserFoundationChange that:
 * 1. Authorizes the user is active and owns the project
 * 2. Locks the project row within the change-set transaction
 * 3. Writes foundation
 * 4. Creates CanonicalChangeSet + ops audit trail
 * 5. Bumps project.currentCanonicalVersion by 1
 * 6. Sets foundationStatus to `draft` if was `none`
 */
export async function editFoundation(
  ports: FoundationEditPorts,
  input: EditFoundationInput,
): Promise<EditFoundationOutput> {
  // 1. Authorize
  await authorizeActiveUser(ports.userRepo, input.userId);
  const project = await lockOwnedProject(
    ports.projectRepo,
    input.projectId,
    input.userId,
  );

  // 2. Upsert foundation
  const upsertInput: Parameters<typeof ports.foundationRepo.upsert>[0] = {
    projectId: input.projectId,
  };
  if (input.premise !== undefined) upsertInput.premise = input.premise;
  if (input.tone !== undefined) upsertInput.tone = input.tone;
  if (input.genre !== undefined) upsertInput.genre = input.genre;
  if (input.body !== undefined) upsertInput.body = input.body;
  const foundation = await ports.foundationRepo.upsert(upsertInput);

  // 3. Create a change set for audit trail
  const changeSet = await ports.changeSetRepo.create({
    projectId: input.projectId,
    status: 'applied',
  });

  // 4. Create an audit operation
  await ports.changeSetRepo.createOperation({
    changeSetId: changeSet.id,
    sequence: 1,
    opType: 'upsert',
    targetType: 'foundation',
    targetId: foundation.id,
    payload: {
      premise: input.premise ?? null,
      tone: input.tone ?? null,
      genre: input.genre ?? null,
    },
  });

  // 5. Bump canonical version
  await ports.projectRepo.bumpCanonicalVersion(input.projectId, 1);

  // 6. Set foundationStatus to draft if was none
  let newStatus: 'none' | 'draft' | 'locked' = project.foundationStatus;
  if (project.foundationStatus === 'none') {
    await ports.projectRepo.updateFoundationStatus(input.projectId, 'draft');
    newStatus = 'draft';
  }

  const currentCanonicalVersion = project.currentCanonicalVersion + 1;

  return {
    id: foundation.id,
    projectId: foundation.projectId,
    premise: foundation.premise,
    tone: foundation.tone,
    genre: foundation.genre,
    body: foundation.body,
    foundationStatus: newStatus,
    currentCanonicalVersion,
    createdAt: foundation.createdAt,
    updatedAt: foundation.updatedAt,
  };
}
