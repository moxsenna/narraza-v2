/**
 * saveWorkingDraft — CAS autosave for prose working drafts.
 *
 * Creates or updates a ProseWorkingDraft with CAS on version/contentHash.
 *
 * Rules:
 * - UNIQUE (user_id, beat_id) WHERE deleted_at IS NULL
 * - CAS: update only if expectedVersion matches current stored version
 * - Insert: if no existing draft, create with version=1
 * - Update: bump version, set new content + contentHash
 *
 * Matrix: working-draft
 */

import type { ProseWorkingDraftRepo, ProseWorkingDraft } from '../../ports/proposal-ports.js';
import type { UserRepo } from '../../ports/auth-ports.js';
import type { ProjectRepo } from '../../ports/project-ports.js';
import { authorizeActiveUser } from '../../authz/authorize-active-user.js';
import { InternalUseCaseError } from '@narraza/shared';
import { createHash } from 'node:crypto';

export interface SaveWorkingDraftInput {
  userId: string;
  beatId: string;
  content: string;
  /** If provided, CAS guard: only save if current version matches. */
  expectedVersion?: number;
}

export interface SaveWorkingDraftOutput {
  id: string;
  userId: string;
  beatId: string;
  content: string;
  contentHash: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SaveWorkingDraftPorts {
  userRepo: UserRepo;
  projectRepo: ProjectRepo;
  workingDraftRepo: ProseWorkingDraftRepo;
}

function computeContentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Save (insert or update) a prose working draft with CAS version guard.
 *
 * If no existing draft for this (user, beat), creates one at version 1.
 * If an existing draft exists:
 *   - If expectedVersion is provided but doesn't match → CONFLICT (CAS fail)
 *   - Otherwise bumps version, updates content and hash
 *
 * Does NOT validate that the user owns the project that contains the beat —
 * beat ownership is checked by the caller or UI layer.
 */
export async function saveWorkingDraft(
  ports: SaveWorkingDraftPorts,
  input: SaveWorkingDraftInput,
): Promise<SaveWorkingDraftOutput> {
  // Authorize
  await authorizeActiveUser(ports.userRepo, input.userId);

  const contentHash = computeContentHash(input.content);

  const existing = await ports.workingDraftRepo.findByUserAndBeat(
    input.userId,
    input.beatId,
  );

  if (!existing) {
    // Insert new draft
    const draft = await ports.workingDraftRepo.save({
      userId: input.userId,
      beatId: input.beatId,
      content: input.content,
      contentHash,
    });

    return {
      id: draft.id,
      userId: draft.userId,
      beatId: draft.beatId,
      content: draft.content,
      contentHash: draft.contentHash,
      version: draft.version,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
    };
  }

  // Update existing draft with CAS
  if (
    input.expectedVersion !== undefined &&
    existing.version !== input.expectedVersion
  ) {
    throw new InternalUseCaseError(
      'CAS_CONFLICT',
      `Draft version mismatch: expected ${input.expectedVersion}, got ${existing.version}`,
    );
  }

  // No-op if content hasn't changed
  if (existing.contentHash === contentHash) {
    return {
      id: existing.id,
      userId: existing.userId,
      beatId: existing.beatId,
      content: existing.content,
      contentHash: existing.contentHash,
      version: existing.version,
      createdAt: existing.createdAt,
      updatedAt: existing.updatedAt,
    };
  }

  const draft = await ports.workingDraftRepo.save({
    userId: input.userId,
    beatId: input.beatId,
    content: input.content,
    contentHash,
    expectedVersion: existing.version,
  });

  return {
    id: draft.id,
    userId: draft.userId,
    beatId: draft.beatId,
    content: draft.content,
    contentHash: draft.contentHash,
    version: draft.version,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
  };
}
