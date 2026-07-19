// beat.judge.v1 prompt contract
// Judge uses publicMessageCode enum only
import { z } from 'zod';

export const PublicMessageCode = z.enum([
  'continuity_breach',
  'character_voice_inconsistent',
  'outline_deviation',
  'fact_contradiction',
  'pacing_issue',
  'prose_quality_low',
  'missing_sensory_detail',
  'dialogue_unnatural',
  'tone_inconsistent',
  'reveal_premature',
  'reveal_missing',
  'description_overload',
  'emotional_beat_weak',
  'transition_abrupt',
  'generic_passable',
]);

export type PublicMessageCode = z.infer<typeof PublicMessageCode>;

export const BeatJudgeContract = z.object({
  candidateIndex: z.number().int().min(1),
  passed: z.boolean(),
  findings: z.array(
    z.object({
      code: z.string().min(1).max(100),
      severity: z.enum(['blocker', 'warning', 'info']),
      publicMessageCode: PublicMessageCode,
      internalRationale: z.string().min(1).max(2000).optional(),
    }),
  ).max(20),
  overallScore: z.number().min(0).max(100).optional(),
}).strict();

export type BeatJudgeOutput = z.infer<typeof BeatJudgeContract>;

export function mockBeatJudgeOutput(): BeatJudgeOutput {
  return {
    candidateIndex: 1,
    passed: true,
    findings: [
      {
        code: 'struct-001',
        severity: 'info',
        publicMessageCode: 'generic_passable',
        internalRationale: 'Prose is competent, follows outline beats correctly, and maintains consistent character voice.',
      },
      {
        code: 'struct-002',
        severity: 'warning',
        publicMessageCode: 'emotional_beat_weak',
        internalRationale: 'The moment of Kael\'s flashback could use more sensory grounding — the transition from memory extraction to personal flashback is slightly abrupt.',
      },
    ],
    overallScore: 78,
  };
}
