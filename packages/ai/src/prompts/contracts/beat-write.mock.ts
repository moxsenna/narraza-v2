// beat.write.v1 prompt contract
// Model emits ModelSuggestionDraft shape (NOT CanonicalChangeOperation)
import { z } from 'zod';

export const BeatWriteContract = z.object({
  candidates: z.array(
    z.object({
      candidateIndex: z.number().int().min(1).max(5),
      prose: z.string().min(10).max(10000),
      suggestions: z.array(
        z.object({
          tempRef: z.string().min(1).max(100),
          opIntent: z.enum([
            'upsert_fact',
            'upsert_character_state',
            'upsert_belief',
            'record_disclosure',
            'prose_accept',
          ]),
          targetType: z.string().min(1).max(100),
          payload: z.record(z.unknown()),
        }),
      ).max(30),
    }),
  ).min(1).max(3),
}).strict();

export type BeatWriteOutput = z.infer<typeof BeatWriteContract>;

export function mockBeatWriteOutput(): BeatWriteOutput {
  return {
    candidates: [
      {
        candidateIndex: 1,
        prose:
          'The chair hummed beneath Kael. Another extraction. Her fingers pressed against Marcus\'s temples, feeling the familiar buzz of neural transfer begin. His debts — three missed payments — meant a core memory extraction today. The Guild called it "balance restoration." Kael called it Tuesday.\n\nThe transfer started smoothly. Marcus\'s eyes fluttered closed. The memory bloomed in Kael\'s awareness: a beach at sunset, a woman\'s laughter, the smell of salt. Standard commodity. Easy to sell.\n\nThen — fire.\n\nNot the memory. Something else. A child screaming. A house burning. A name. Her name. "Kaelynn." No one called her that anymore.\n\nKael\'s concentration broke. The transfer wobbled. Marcus groaned.\n\n"Collector?" Marcus\'s voice was slurred. "You okay?"\n\nShe forced her breathing steady. "Fine. Stay still."\n\nThe extraction completed. The memory was catalogued. But the fire — the name — lingered behind her eyes like smoke.',
        suggestions: [
          {
            tempRef: 'r1',
            opIntent: 'upsert_fact',
            targetType: 'fact',
            payload: {
              factKey: 'neural-transfer-trigger',
              truth: 'Physical contact during memory extraction can trigger suppressed memories in the collector',
              category: 'world_rules',
            },
          },
          {
            tempRef: 'r2',
            opIntent: 'upsert_fact',
            targetType: 'fact',
            payload: {
              factKey: 'kael-childhood-name',
              truth: 'Kael was called "Kaelynn" as a child, a name she has not used since her memory erasure',
              category: 'character',
            },
          },
          {
            tempRef: 'r3',
            opIntent: 'record_disclosure',
            targetType: 'disclosure',
            payload: {
              factKey: 'neural-transfer-trigger',
              method: 'direct_experience',
              evidenceOffsetStart: 378,
              evidenceOffsetEnd: 612,
            },
          },
          {
            tempRef: 'r4',
            opIntent: 'prose_accept',
            targetType: 'prose',
            payload: {},
          },
        ],
      },
      {
        candidateIndex: 2,
        prose:
          'Marcus trembled under Kael\'s fingertips. Third default. Core extraction mandatory.\n\n"Relax," she said, her voice flat. "This goes easier if you don\'t fight it."\n\nThe transfer room was sterile white, humming with the Guild\'s proprietary tech. Kael had done this a thousand times. A thousand lives skimmed. A thousand memories bottled and sold.\n\nThe memory surfaced — a wedding, a kiss, a promise. Beautiful. Valuable. She began the cataloguing sequence.\n\nAnd then her own mind betrayed her.\n\nA flash. Burning. A boy screaming her name. Not "Kael" — "Kaelynn." She hadn\'t heard that voice in fifteen years. She hadn\'t been allowed to.\n\nHer fingers convulsed. Marcus seized. The monitors shrieked.\n\n"Abort!" she shouted, and the system disengaged automatically. Marcus slumped, unconscious but alive.\n\nKael stared at her trembling hands. What was that?',
        suggestions: [
          {
            tempRef: 'r1',
            opIntent: 'upsert_fact',
            targetType: 'fact',
            payload: {
              factKey: 'extraction-failure-risk',
              truth: 'Memory extraction can fail if the collector experiences psychological disruption, risking harm to both parties',
              category: 'world_rules',
            },
          },
          {
            tempRef: 'r2',
            opIntent: 'upsert_character_state',
            targetType: 'character_state',
            payload: {
              characterName: 'Kael',
              stateKey: 'emotional',
              value: { primary: 'disturbed', intensity: 0.8, trigger: 'memory_flash' },
            },
          },
          {
            tempRef: 'r3',
            opIntent: 'prose_accept',
            targetType: 'prose',
            payload: {},
          },
        ],
      },
    ],
  };
}
