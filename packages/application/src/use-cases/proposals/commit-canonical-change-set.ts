/**
 * commitCanonicalChangeSet — the single write door to canon.
 *
 * Applies a CanonicalChangeSet's operations in topological/sequence order,
 * mutates domain entities, bumps entity revisions, and increments
 * project.currentCanonicalVersion by 1 once.
 *
 * Rules:
 * - Operations applied in sequence order
 * - Domain entities (fact, character, foundation, beat/prose) written here only
 * - Entity revisions loaded from latest existing revision, then bumped
 * - project.currentCanonicalVersion incremented once per change set
 * - CAS fail / unique violation → throw CAS_CONFLICT for caller recovery
 *
 * Matrix: fact-lifecycle
 */

import type {
  CanonicalChangeSetRepo,
  CanonicalChangeOperation,
  FactRepo,
  BeatRepo,
  ProseVersionRepo,
} from '../../ports/canonical-change-set-ports.js';
import type { ProjectRepo } from '../../ports/project-ports.js';
import type { FoundationRepo } from '../../ports/foundation-ports.js';
import type { CharacterRepo } from '../../ports/character-ports.js';
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
  /** Optional domain repos — when present, ops mutate canon entities. */
  foundationRepo?: FoundationRepo;
  characterRepo?: CharacterRepo;
  factRepo?: FactRepo;
  beatRepo?: BeatRepo;
  proseVersionRepo?: ProseVersionRepo;
}

function hashPayload(payload: Record<string, unknown>): string {
  return createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');
}

/**
 * Apply domain mutation for a single operation.
 * Missing optional repos → skip domain write (revision still recorded).
 */
async function applyDomainOperation(
  ports: CommitChangeSetPorts,
  projectId: string,
  op: CanonicalChangeOperation,
): Promise<void> {
  const targetType = op.targetType.toLowerCase();
  const opType = op.opType.toLowerCase();
  const payload = op.payload;

  if (targetType === 'foundation' && ports.foundationRepo) {
    await ports.foundationRepo.upsert({
      projectId,
      premise:
        typeof payload.premise === 'string' || payload.premise === null
          ? (payload.premise as string | null)
          : undefined,
      tone:
        typeof payload.tone === 'string' || payload.tone === null
          ? (payload.tone as string | null)
          : undefined,
      genre:
        typeof payload.genre === 'string' || payload.genre === null
          ? (payload.genre as string | null)
          : undefined,
      body:
        payload.body !== undefined &&
        (payload.body === null || typeof payload.body === 'object')
          ? (payload.body as Record<string, unknown> | null)
          : undefined,
    });
    return;
  }

  if (targetType === 'character' && ports.characterRepo) {
    if (opType === 'delete' || opType === 'soft_delete') {
      if (op.targetId) await ports.characterRepo.softDelete(op.targetId);
      return;
    }
    if (op.targetId) {
      const existing = await ports.characterRepo.findById(op.targetId);
      if (existing && typeof payload.name === 'string') {
        await ports.characterRepo.updateName(op.targetId, payload.name);
        return;
      }
    }
    if (typeof payload.name === 'string') {
      await ports.characterRepo.create({
        projectId,
        name: payload.name,
      });
    }
    return;
  }

  if (targetType === 'fact' && ports.factRepo) {
    if (opType === 'delete' || opType === 'soft_delete') {
      if (op.targetId) await ports.factRepo.softDelete(op.targetId);
      return;
    }
    const factKey =
      typeof payload.factKey === 'string'
        ? payload.factKey
        : typeof payload.fact_key === 'string'
          ? payload.fact_key
          : null;
    const truth =
      typeof payload.truth === 'string'
        ? payload.truth
        : typeof payload.content === 'string'
          ? payload.content
          : null;
    if (factKey && truth) {
      await ports.factRepo.upsert({
        id: op.targetId ?? undefined,
        projectId,
        factKey,
        truth,
        canonStatus:
          payload.canonStatus === 'deprecated' ||
          payload.canonStatus === 'contradicted' ||
          payload.canonStatus === 'confirmed'
            ? payload.canonStatus
            : 'confirmed',
      });
    }
    return;
  }

  // prose_accept / beat accepted pointer
  if (
    (opType === 'prose_accept' || opType === 'prose.accept' || targetType === 'beat') &&
    ports.beatRepo &&
    ports.proseVersionRepo &&
    op.targetId
  ) {
    const content =
      typeof payload.content === 'string'
        ? payload.content
        : typeof payload.prose === 'string'
          ? payload.prose
          : null;
    const contentHash =
      typeof payload.contentHash === 'string'
        ? payload.contentHash
        : typeof payload.proseContentHash === 'string'
          ? payload.proseContentHash
          : content
            ? createHash('sha256').update(content).digest('hex')
            : null;

    let proseVersionId =
      typeof payload.proseVersionId === 'string'
        ? payload.proseVersionId
        : typeof payload.prose_version_id === 'string'
          ? payload.prose_version_id
          : null;

    if (!proseVersionId && content && contentHash) {
      const version = await ports.proseVersionRepo.nextVersion(op.targetId);
      const prose = await ports.proseVersionRepo.create({
        beatId: op.targetId,
        version,
        content,
        contentHash,
        status: 'validated',
      });
      proseVersionId = prose.id;
    }

    if (proseVersionId) {
      await ports.beatRepo.setAcceptedProseVersion(op.targetId, proseVersionId);
    }
  }
}

/**
 * Apply all operations in a CanonicalChangeSet to canon.
 *
 * This is the ONLY place where canonical data is written.
 */
export async function commitCanonicalChangeSet(
  ports: CommitChangeSetPorts,
  input: CommitChangeSetInput,
): Promise<CommitChangeSetOutput> {
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

  const operations = await ports.changeSetRepo.findOperationsByChangeSetId(
    input.changeSetId,
  );

  if (operations.length === 0) {
    throw new InternalUseCaseError(
      'VALIDATION',
      'Change set has no operations to apply',
    );
  }

  // Track entity revisions, seeding from latest persisted revision
  const entityRevisionTracker = new Map<
    string,
    {
      entityType: string;
      entityId: string;
      currentRevision: number;
      previousHash: string | null;
    }
  >();

  for (const op of operations) {
    const newHash = hashPayload(op.payload);
    const entityId = op.targetId ?? op.id;
    const key = `${op.targetType}:${entityId}`;

    let tracker = entityRevisionTracker.get(key);
    if (!tracker) {
      let startRevision = 0;
      let previousHash: string | null = null;

      if (typeof ports.changeSetRepo.findLatestEntityRevision === 'function') {
        const latest = await ports.changeSetRepo.findLatestEntityRevision(
          input.projectId,
          op.targetType,
          entityId,
        );
        if (latest) {
          startRevision = latest.revision;
          previousHash = latest.newHash;
        }
      }

      tracker = {
        entityType: op.targetType,
        entityId,
        currentRevision: startRevision,
        previousHash,
      };
      entityRevisionTracker.set(key, tracker);
    }

    // Apply domain mutation (single write door)
    await applyDomainOperation(ports, input.projectId, op);

    tracker.currentRevision += 1;
    const prevHash = tracker.previousHash;
    tracker.previousHash = newHash;

    await ports.changeSetRepo.createEntityRevision({
      projectId: input.projectId,
      entityType: op.targetType,
      entityId,
      changeSetId: input.changeSetId,
      revision: tracker.currentRevision,
      previousHash: prevHash,
      newHash,
      operationCount: 1,
    });
  }

  const applied = await ports.changeSetRepo.applyChangeSet(input.changeSetId);
  if (!applied) {
    throw new InternalUseCaseError(
      'CAS_CONFLICT',
      'Failed to apply change set — concurrent modification',
    );
  }

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
