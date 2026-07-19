// character.propose.v1 prompt contract
import { z } from 'zod';

export const CharacterProposeContract = z.object({
  characters: z.array(
    z.object({
      name: z.string().min(1).max(100),
      role: z.string().min(1).max(200),
      description: z.string().min(1).max(2000),
      traits: z.array(z.string().min(1).max(100)).max(10),
      suggestedFacts: z.array(
        z.object({
          factKey: z.string().min(1).max(200),
          truth: z.string().min(1).max(2000),
        }),
      ).max(10),
    }),
  ).min(1).max(10),
}).strict();

export type CharacterProposeOutput = z.infer<typeof CharacterProposeContract>;

export function mockCharacterProposeOutput(): CharacterProposeOutput {
  return {
    characters: [
      {
        name: 'Kael',
        role: 'Protagonist — debt collector turned investigator',
        description:
          'Kael is 28, sharp-edged and cynical from years of collecting memory-debts. She keeps people at arm\'s length because every touch triggers fragments of their traded memories. Beneath the armor, she yearns for connection but fears what her own erased past might contain.',
        traits: ['Cynical', 'Determined', 'Resourceful', 'Emotionally guarded'],
        suggestedFacts: [
          { factKey: 'kael-memory-trigger', truth: 'Kael experiences memory flashes through physical touch with memory-debtors' },
          { factKey: 'kael-erased-past', truth: 'Kael\'s childhood memories from ages 7-14 were erased by the Guild' },
          { factKey: 'kael-sibling', truth: 'Kael had an older brother named Finn who was memory-wiped when she was 7' },
        ],
      },
      {
        name: 'Tess',
        role: 'Ally — underground memory archivist',
        description:
          'Tess runs a black-market archive of "unwiped" memories. She is cheerful, surprisingly well-adjusted, and believes that memories belong to the people, not the Guild. She becomes Kael\'s guide through the underground.',
        traits: ['Optimistic', 'Secretive', 'Loyal', 'Brilliant'],
        suggestedFacts: [
          { factKey: 'tess-archive', truth: 'Tess maintains a hidden archive of copies of traded memories' },
          { factKey: 'tess-guild-past', truth: 'Tess was a Guild archivist before she defected' },
        ],
      },
      {
        name: 'Soren',
        role: 'Antagonist — Memory Guild Director',
        description:
          'Soren founded the Memory Guild after witnessing her own mother driven mad by traumatic war memories. She genuinely believes memory trading is a mercy. Her methods, however, have grown ruthless.',
        traits: ['Charismatic', 'Ruthless', 'Conviction-driven', 'Wounded'],
        suggestedFacts: [
          { factKey: 'soren-origin', truth: 'Soren founded the Guild after her mother\'s traumatic death during the Memory Wars' },
          { factKey: 'soren-erased', truth: 'Soren has erased her own guilt-related memories to maintain her conviction' },
        ],
      },
    ],
  };
}
