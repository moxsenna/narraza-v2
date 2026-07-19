/**
 * commitCanonicalChangeSet — the single write door to canon.
 *
 * Applies a CanonicalChangeSet's operations in topological order,
 * bumping entity revisions and project.currentCanonicalVersion +1 once.
 *
 * Rules:
 * - Operations are applied in sequence order
 * - Entity revisions are bumped via CanonicalEntityRevision records
 * - project.currentCanonicalVersion is incremented by 1 per change set
 * - CAS fail / unique violation → caller must handle stale marking
 * - No direct canon writes outside this door
 *
 * Matrix: fact-lifecycle
 */

import type { CanonicalChangeSetRepo, CanonicalChangeOperation } from '../../ports/canonical-change-set-ports.js';
import type { ProjectRepo } from '../../ports/project-ports.js';
import { InternalUseCaseError } from '@narraza/shared';
import { createHash } from 'node:crypto';

export interface CommitChangeSetInput {
  changeSetId: string;
  projectId: string;
  userId: string;
}

export interface CommitChangeSetOutput {
  changeSetId: string;
  appliedAt: Date;
  operationsApplied: number;
  entitiesRevised: number;
  newCanonicalVersion: number;
}

export interface CommitChangeSetPorts {
  projectRepo: ProjectRepo;
  changeSetRepo: CanonicalChangeSetRepo;
}

function hashPayload(payload: Record<string, unknown>): string {
  return createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');
}

/**
 * Apply all operations in a CanonicalChangeSet to canon.
 *
 * This is the ONLY place where canonical data is written. All other
 * use cases (editFoundation, upsertCharacter, etc.) create change sets
 * and call this function.
 */
export async function commitCanonicalChangeSet(
  ports: CommitChangeSetPorts,
  input: CommitChangeSetInput,
): Promise<CommitChangeSetOutput> {
  // Lock the change set
  const changeSet = await ports.changeSetRepo.findById(input.changeSetId);
  if (!changeSet) {
    throw new InternalUseCaseError('NOT_FOUND', 'Change set not found');
  }
  if (changeSet.projectId !== input.projectId) {
    throw new InternalUseCaseError('NOT_FOUND', 'Change set not found');
  }
  if (changeSet.status !== 'pending') {
    throw new InternalUseCaseError(
      'TERMINAL_STATE_CONFLICT',
      `Change set status is ${changeSet.status}, expected pending`,
    );
  }

  // Load operations in sequence order
  const operations = await ports.changeSetRepo.findOperationsByChangeSetId(
    input.changeSetId,
  );

  if (operations.length === 0) {
    throw new InternalUseCaseError(
      'VALIDATION',
      'Change set has no operations to apply',
    );
  }

  // Track entity revisions
  const entityRevisionTracker = new Map<string, {
    entityType: string;
    entityId: string;
    currentRevision: number;
    previousHash: string | null;
  }>();

  // Apply each operation in sequence order
  for (const op of operations) {
    const newHash = hashPayload(op.payload);
    const key = `${op.targetType}:${op.targetId ?? op.id}`;

    let tracker = entityRevisionTracker.get(key);
    if (!tracker) {
      tracker = {
        entityType: op.targetType,
        entityId: op.targetId ?? op.id,
        currentRevision: 0,
        previousHash: null,
      };
      entityRevisionTracker.set(key, tracker);
    }

    // Bump revision for this entity
    tracker.currentRevision += 1;

    const prevHash = tracker.previousHash;
    tracker.previousHash = newHash;

    // Create entity revision record
    await ports.changeSetRepo.createEntityRevision({
      projectId: input.projectId,
      entityType: op.targetType,
      entityId: op.targetId ?? op.id,
      changeSetId: input.changeSetId,
      revision: tracker.currentRevision,
      previousHash: prevHash,
      newHash,
      operationCount: 1,
    });
  }

  // Apply the change set (CAS: set appliedAt, status = 'applied')
  const applied = await ports.changeSetRepo.applyChangeSet(input.changeSetId);
  if (!applied) {
    throw new InternalUseCaseError(
      'CAS_CONFLICT',
      'Failed to apply change set — concurrent modification',
    );
  }

  // Bump project version exactly once per change set
  await ports.projectRepo.bumpCanonicalVersion(input.projectId, 1);

  const project = await ports.projectRepo.findById(input.projectId);

  return {
    changeSetId: input.changeSetId,
    appliedAt: applied.appliedAt ?? new Date(),
    operationsApplied: operations.length,
    entitiesRevised: entityRevisionTracker.size,
    newCanonicalVersion: project?.currentCanonicalVersion ?? 0,
  };
}
