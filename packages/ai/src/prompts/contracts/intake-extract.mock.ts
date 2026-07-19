// intake.extract.v1 prompt contract
import { z } from 'zod';

export const IntakeExtractContract = z.object({
  alternatives: z.array(
    z.object({
      altIndex: z.number().int().min(1).max(3),
      title: z.string().min(1).max(200),
      premise: z.string().min(10).max(2000),
      genre: z.string().min(1).max(100),
      targetAudience: z.string().min(1).max(200),
      tone: z.string().min(1).max(200),
      pov: z.string().min(1).max(200),
      suggestedCharacterNames: z.array(z.string().min(1).max(100)).max(10),
      summary: z.string().min(10).max(2000),
    }),
  ).min(1).max(3),
}).strict();

export type IntakeExtractOutput = z.infer<typeof IntakeExtractContract>;

export function mockIntakeExtractOutput(): IntakeExtractOutput {
  return {
    alternatives: [
      {
        altIndex: 1,
        title: 'The Last Ember',
        premise:
          'In a world where memories can be traded as currency, a debt collector discovers her own erased past holds the key to toppling the Memory Guild.',
        genre: 'Science Fiction / Thriller',
        targetAudience: 'Adult readers who enjoy thoughtful dystopian fiction',
        tone: 'Moody, suspenseful, with moments of intimate reflection',
        pov: 'First person, present tense',
        suggestedCharacterNames: ['Kael', 'Tess', 'Soren', 'Mira'],
        summary:
          'Kael collects memory-debts for the Guild. When a routine extraction triggers a flash of her own erased childhood, she begins a dangerous investigation into what the Guild took from her — and why.',
      },
      {
        altIndex: 2,
        title: 'Beneath the Verdant Sky',
        premise:
          'When a young cartographer maps a forest that rearranges itself, she must ally with its ancient guardian to prevent an industrial empire from burning it all down.',
        genre: 'Fantasy / Eco-Fiction',
        targetAudience: 'Young adult and adult crossover, fans of rich worldbuilding',
        tone: 'Lush and evocative, with threads of urgency and wonder',
        pov: 'Third person limited, dual perspective',
        suggestedCharacterNames: ['Lira', 'The Rooted', 'Aldric', 'Nyssa'],
        summary:
          'Lira\'s enchanted map keeps redrawing itself. The forest is alive, and it has chosen her. But the Iron Consortium has other plans — plans that involve clear-cutting and a mysterious mineral beneath the roots.',
      },
      {
        altIndex: 3,
        title: 'A Cipher of Salt and Bone',
        premise:
          'A forensic linguist is recruited by Interpol to decode messages left by a serial killer who only communicates in dead languages — but the killer seems to know her better than she knows herself.',
        genre: 'Crime / Psychological Thriller',
        targetAudience: 'Adult readers of literary crime fiction',
        tone: 'Tense, cerebral, atmospheric, with dark undercurrents',
        pov: 'First person, past tense',
        suggestedCharacterNames: ['Dr. Elara Voss', 'Inspector Calder', 'The Aramaic Killer'],
        summary:
          'Dr. Elara Voss can read twelve dead languages. When the Aramaic Killer leaves a message in Etruscan — with personal details about her late father — Elara realizes this case is not about murder. It is about her.',
      },
    ],
  };
}
