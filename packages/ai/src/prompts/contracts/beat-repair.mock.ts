// beat.repair.v1 prompt contract
// Repair = full re-extraction: new prose + new suggestions
import { z } from 'zod';

export const BeatRepairContract = z.object({
  repairedProse: z.string().min(10).max(10000),
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
  /** Which findings from the judge report are addressed */
  addressedFindings: z.array(z.string().min(1).max(100)).max(20),
}).strict();

export type BeatRepairOutput = z.infer<typeof BeatRepairContract>;

export function mockBeatRepairOutput(): BeatRepairOutput {
  return {
    repairedProse:
      'The chair hummed beneath Kael, a low-frequency vibration she\'d long since stopped noticing. Another extraction. Her calloused fingers pressed against Marcus\'s temples, the familiar buzz of neural transfer beginning like static crawling up her wrists. Three missed payments meant a core memory extraction today. The Guild called it "balance restoration." Kael called it Tuesday.\n\nThe transfer started smoothly. Marcus\'s eyes fluttered closed, his jaw going slack. The memory bloomed in Kael\'s awareness: a beach at sunset, the taste of salt spray, a woman\'s laughter ringing across the sand. Standard commodity. Easy to price, easy to sell. She began the mental cataloguing — sensory index first, then emotional valence, then market tier. All automatic, after a thousand extractions.\n\nThen — fire.\n\nNot the memory. Something beneath it. Uninvited.\n\nThe beach dissolved into orange light. A child screaming. Wood cracking. A house collapsing inward like a dying star. And a name, called out in a voice she had not heard in fifteen years. "Kaelynn! Kaelynn, run!"\n\nKael\'s breath caught. Her concentration wobbled. The transfer flickered. Marcus groaned, a wet, animal sound.\n\n"Collector?" His voice came out slurred, distant. "You okay?"\n\nThe room snapped back into focus. White walls. Humming chair. The Guild\'s logo glowing soft blue on the monitor.\n\n"Fine," Kael said. Her voice was steady — years of practice. "Stay still."\n\nShe forced the extraction to completion. The memory was catalogued, appraised, filed. But behind her eyes, the fire still burned. And the name — Kaelynn — lodged itself in her chest like a splinter.',
    suggestions: [
      {
        tempRef: 'r1',
        opIntent: 'upsert_fact',
        targetType: 'fact',
        payload: {
          factKey: 'neural-transfer-trigger',
          truth: 'Physical contact during memory extraction can trigger suppressed memories in the collector, especially under emotional stress',
          category: 'world_rules',
        },
      },
      {
        tempRef: 'r2',
        opIntent: 'upsert_fact',
        targetType: 'fact',
        payload: {
          factKey: 'kael-childhood-name',
          truth: 'Kael was called "Kaelynn" as a child, a name she has not used since her memory erasure at age 7',
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
          evidenceOffsetStart: 395,
          evidenceOffsetEnd: 830,
        },
      },
      {
        tempRef: 'r4',
        opIntent: 'prose_accept',
        targetType: 'prose',
        payload: {},
      },
    ],
    addressedFindings: ['struct-002'],
  };
}
