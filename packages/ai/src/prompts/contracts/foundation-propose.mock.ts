// foundation.propose.v1 prompt contract
import { z } from 'zod';

export const FoundationProposeContract = z.object({
  proposals: z.array(
    z.object({
      section: z.string().min(1).max(200),
      field: z.string().min(1).max(200),
      proposedValue: z.string().min(1).max(2000),
      rationale: z.string().min(1).max(1000),
      confidence: z.number().min(0).max(1),
    }),
  ).min(1).max(20),
}).strict();

export type FoundationProposeOutput = z.infer<typeof FoundationProposeContract>;

export function mockFoundationProposeOutput(): FoundationProposeOutput {
  return {
    proposals: [
      {
        section: 'premise',
        field: 'concept',
        proposedValue: 'Reinforce the emotional stakes by grounding the memory-trade system in personal tragedy.',
        rationale: 'The foundation currently lacks personal stakes for the protagonist. Adding a lost sibling who was "memory-wiped" creates emotional urgency.',
        confidence: 0.85,
      },
      {
        section: 'setting',
        field: 'world-rules',
        proposedValue: 'Memories can only be traded once — they degrade after transfer, creating scarcity.',
        rationale: 'A degradation rule prevents infinite memory trading and raises the stakes for the Guild.',
        confidence: 0.9,
      },
      {
        section: 'characters',
        field: 'antagonist-motivation',
        proposedValue: 'The Memory Guild founder believes she is preserving humanity from painful truths — a well-intentioned extremist.',
        rationale: 'A layered antagonist with noble intentions creates richer conflict than pure villainy.',
        confidence: 0.75,
      },
    ],
  };
}
