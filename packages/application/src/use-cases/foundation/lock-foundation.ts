import type { ProjectRepo } from '../../ports/project-ports.js';
import type { FoundationRepo } from '../../ports/foundation-ports.js';
import type { UserRepo } from '../../ports/auth-ports.js';
import { authorizeActiveUser } from '../../authz/authorize-active-user.js';
import { lockOwnedProject } from '../../authz/lock-owned-project.js';
import { checkFoundationReadiness } from '@narraza/core';
import { PublicUseCaseError } from '@narraza/shared';

export interface LockFoundationInput {
  userId: string;
  projectId: string;
  /** Caller must explicitly confirm intent to lock */
  confirm: boolean;
}

export interface LockFoundationOutput {
  projectId: string;
  foundationStatus: 'locked';
  currentCanonicalVersion: number;
  readinessReasons: string[];
}

export interface FoundationLockPorts {
  userRepo: UserRepo;
  projectRepo: ProjectRepo;
  foundationRepo: FoundationRepo;
}

/**
 * Lock foundation for a project.
 *
 * Requirements:
 * - Readiness from @narraza/core readiness-policy must be `ready`
 * - `confirm: true` from caller — without confirm → VALIDATION reject
 * - On success: foundationStatus = `locked`
 * - Cannot lock if not ready (reasons provided)
 */
export async function lockFoundation(
  ports: FoundationLockPorts,
  input: LockFoundationInput,
): Promise<LockFoundationOutput> {
  // 1. Authorize
  await authorizeActiveUser(ports.userRepo, input.userId);
  const project = await lockOwnedProject(
    ports.projectRepo,
    input.projectId,
    input.userId,
  );

  // 2. Confirm required
  if (!input.confirm) {
    throw new PublicUseCaseError(
      'VALIDATION',
      'Lock requires explicit confirmation',
    );
  }

  // 3. Cannot re-lock
  if (project.foundationStatus === 'locked') {
    throw new PublicUseCaseError(
      'VALIDATION',
      'Foundation is already locked',
    );
  }

  // 4. Load foundation for readiness check
  const foundation = await ports.foundationRepo.findByProjectId(input.projectId);

  // 5. Check readiness
  const body = (foundation?.body ?? {}) as Record<string, unknown>;
  const readiness = checkFoundationReadiness({
    premise: foundation?.premise ?? '',
    title: project.title,
    genre: foundation?.genre ?? '',
    targetAudience: (body['targetAudience'] as string) ?? '',
    pov: (body['pov'] as string) ?? '',
    tone: foundation?.tone ?? '',
  });

  if (!readiness.ready) {
    throw new PublicUseCaseError(
      'VALIDATION',
      `Foundation is not ready to lock: ${readiness.reasons.join('; ')}`,
    );
  }

  // 6. Lock
  await ports.projectRepo.updateFoundationStatus(input.projectId, 'locked');

  return {
    projectId: input.projectId,
    foundationStatus: 'locked',
    currentCanonicalVersion: project.currentCanonicalVersion,
    readinessReasons: readiness.reasons,
  };
}
