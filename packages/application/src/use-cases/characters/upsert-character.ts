import type { CharacterRepo } from '../../ports/character-ports.js';
import type { ProjectRepo } from '../../ports/project-ports.js';
import type { CanonicalChangeSetRepo } from '../../ports/canonical-change-set-ports.js';
import type { UserRepo } from '../../ports/auth-ports.js';
import { authorizeActiveUser } from '../../authz/authorize-active-user.js';
import { lockOwnedProject } from '../../authz/lock-owned-project.js';
import { PublicUseCaseError } from '@narraza/shared';

export interface UpsertCharacterInput {
  userId: string;
  projectId: string;
  name: string;
  /** If provided, update this character; otherwise create new */
  characterId?: string;
}

export interface UpsertCharacterOutput {
  id: string;
  projectId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CharacterUpsertPorts {
  userRepo: UserRepo;
  projectRepo: ProjectRepo;
  characterRepo: CharacterRepo;
  changeSetRepo: CanonicalChangeSetRepo;
}

/**
 * Create or update a character via user-origin (no AI involvement).
 *
 * - User must be active
 * - User must own the project
 * - Foundation must not be `none` (project must be set up)
 * - Create: inserts new character; name must be unique among active characters
 * - Update: updates name; new name must be unique among active characters (soft-delete unique)
 * - All operations go through a change set audit trail
 */
export async function upsertCharacter(
  ports: CharacterUpsertPorts,
  input: UpsertCharacterInput,
): Promise<UpsertCharacterOutput> {
  // Authorize
  await authorizeActiveUser(ports.userRepo, input.userId);
  const project = await lockOwnedProject(
    ports.projectRepo,
    input.projectId,
    input.userId,
  );

  // Validate project is set up
  if (project.foundationStatus === 'none') {
    throw new PublicUseCaseError(
      'VALIDATION',
      'Project foundation must be set up before adding characters',
    );
  }

  const isUpdate = !!input.characterId;
  let character;

  if (isUpdate) {
    // Update existing character
    const existing = await ports.characterRepo.findById(input.characterId!);
    if (!existing) {
      throw new PublicUseCaseError('NOT_FOUND', 'Character not found');
    }
    if (existing.projectId !== input.projectId) {
      throw new PublicUseCaseError('NOT_FOUND', 'Character not found');
    }
    if (existing.deletedAt) {
      throw new PublicUseCaseError('NOT_FOUND', 'Character not found');
    }

    const updated = await ports.characterRepo.updateName(existing.id, input.name);
    if (!updated) {
      // Name conflict (soft-delete unique constraint violation)
      throw new PublicUseCaseError(
        'CONFLICT',
        'A character with that name already exists in this project',
      );
    }
    character = updated;
  } else {
    // Create new character
    try {
      character = await ports.characterRepo.create({
        projectId: input.projectId,
        name: input.name,
      });
    } catch {
      // Name conflict (soft-delete unique constraint violation)
      throw new PublicUseCaseError(
        'CONFLICT',
        'A character with that name already exists in this project',
      );
    }
  }

  // Audit trail: create change set + operation
  const changeSet = await ports.changeSetRepo.create({
    projectId: input.projectId,
    status: 'applied',
  });

  await ports.changeSetRepo.createOperation({
    changeSetId: changeSet.id,
    sequence: 1,
    opType: isUpdate ? 'update' : 'create',
    targetType: 'character',
    targetId: character.id,
    payload: { name: input.name },
  });

  // Bump canonical version
  await ports.projectRepo.bumpCanonicalVersion(input.projectId, 1);

  return {
    id: character.id,
    projectId: character.projectId,
    name: character.name,
    createdAt: character.createdAt,
    updatedAt: character.updatedAt,
    deletedAt: character.deletedAt,
  };
}
