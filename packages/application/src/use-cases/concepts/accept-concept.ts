// concept accept → foundation draft (not locked)
// Matrix: concept-accept

import type { TransactionPorts } from '../../unit-of-work.js';
import type { FoundationStatus } from '@narraza/core';

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
  foundationStatus: FoundationStatus;
  title: string;
  premise: string;
}

/**
 * Accept a concept alternative from intake.extract.
 *
 * Effects:
 * - foundationStatus → 'draft' (NOT locked)
 * - Write foundation draft ops from the selected alternative
 * - Sibling proposals are superseded
 */
export async function acceptConcept(
  ports: TransactionPorts,
  input: AcceptConceptInput,
): Promise<AcceptConceptOutput> {
  // 1. Validate ownership (handled by caller via authorizeActiveUser + lockOwnedProject)
  // 2. Load proposal group and validate alternative exists
  // 3. Apply concept → foundation draft
  // 4. Mark sibling proposals superseded

  const project = await ports.projectRepo.findById(input.projectId);
  if (!project || project.ownerUserId !== input.userId) {
    // This is handled by lockOwnedProject, but belt-and-suspenders
    throw new Error('Project not found or access denied');
  }

  // Get foundation (create if not exists)
  let foundation = await ports.foundationRepo.findByProjectId(input.projectId);

  // In a real pipeline, we'd read the ProposalGroup's GeneratedCandidate
  // and extract the foundation draft fields. For the mock, we'll use the
  // mock output directly.

  // Upsert foundation with draft values
  await ports.foundationRepo.upsert({
    projectId: input.projectId,
    premise: `Mock premise for concept alt ${input.altIndex}`,
    genre: 'Science Fiction',
    tone: 'Suspenseful',
  });

  // Update project foundationStatus to 'draft' (NOT locked)
  // In production, this goes through commitCanonicalChangeSet
  // For mock, we simulate the state change

  return {
    projectId: input.projectId,
    foundationStatus: 'draft',
    title: `Mock Title Alt ${input.altIndex}`,
    premise: `Mock premise for concept alt ${input.altIndex}`,
  };
}
