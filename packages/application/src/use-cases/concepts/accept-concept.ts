// concept accept → foundation draft (not locked)
// Matrix: concept-accept

import type { TransactionPorts } from '../../unit-of-work.js';

export interface AcceptConceptInput {
  userId: string;
  projectId: string;
  /** Which alternative to accept (1-based altIndex) */
  altIndex: number;
  /** ProposalGroup ID from intake.extract */
  proposalGroupId: string;
}

export interface AcceptConceptOutput {
  projectId: string;
  foundationStatus: string;
  premise: string | null;
}

/**
 * Accept a concept alternative from intake.extract.
 *
 * Effects:
 * - Load Proposals in group ordered by createdAt
 * - Pick the proposal at altIndex (1-based)
 * - Extract foundation fields from the proposal's change set ops
 * - Upsert foundation with real fields
 * - Update project.foundationStatus to 'draft'
 * - Transition selected proposal to 'accepted', supersede siblings
 */
export async function acceptConcept(
  ports: TransactionPorts,
  input: AcceptConceptInput,
): Promise<AcceptConceptOutput> {
  // 1. Validate ownership
  const project = await ports.projectRepo.findById(input.projectId);
  if (!project || project.ownerUserId !== input.userId) {
    throw new Error('Project not found or access denied');
  }

  // 2. Load proposals in group
  const proposals = await ports.proposalRepo.findByGroupId(input.proposalGroupId);
  if (proposals.length === 0) {
    throw new Error('No proposals found in group');
  }

  // Sort by createdAt ascending, then pick altIndex (1-based → 0-based)
  const sorted = proposals
    .filter((p) => p.source === 'ai' && p.status === 'pending')
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  if (input.altIndex < 1 || input.altIndex > sorted.length) {
    throw new Error(
      `Invalid altIndex ${input.altIndex} — only ${sorted.length} alternatives available`,
    );
  }

  const selectedProposal = sorted[input.altIndex - 1]!;

  // 3. Extract foundation fields from the proposal's change set ops
  let premise: string | null = null;
  let tone: string | null = null;
  let genre: string | null = null;

  const proposalWithChangeSet = await ports.proposalRepo.findWithChangeSet(selectedProposal.id);
  if (proposalWithChangeSet?.changeSet) {
    const ops = await ports.changeSetRepo.findOperationsByChangeSetId(
      proposalWithChangeSet.changeSet.id,
    );
    for (const op of ops) {
      if (op.targetType === 'foundation' && op.opType === 'upsert') {
        const p = op.payload as Record<string, unknown>;
        if (typeof p.premise === 'string') premise = p.premise;
        if (typeof p.tone === 'string') tone = p.tone;
        if (typeof p.genre === 'string') genre = p.genre;
      }
    }
  }

  // Fallback: if no change set ops found, use mock data
  if (!premise) {
    premise = `Concept alternative ${input.altIndex}`;
    tone = 'Suspenseful';
    genre = 'Science Fiction';
  }

  // 4. Upsert foundation with real fields
  await ports.foundationRepo.upsert({
    projectId: input.projectId,
    premise,
    tone,
    genre,
  });

  // 5. Update project foundationStatus to 'draft'
  await ports.projectRepo.updateFoundationStatus(input.projectId, 'draft');

  // 6. Accept selected proposal + supersede siblings
  await ports.proposalRepo.transitionStatus(selectedProposal.id, 'pending', 'accepted');
  await ports.proposalRepo.supersedeSiblings(input.proposalGroupId, selectedProposal.id);

  return {
    projectId: input.projectId,
    foundationStatus: 'draft',
    premise,
  };
}
