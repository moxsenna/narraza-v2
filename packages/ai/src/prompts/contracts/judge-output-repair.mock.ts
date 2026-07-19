// judge-output.repair.v1 prompt contract
import { z } from 'zod';
import { PublicMessageCode } from './beat-judge.mock.js';

export const JudgeOutputRepairContract = z.object({
  revisedFindings: z.array(
    z.object({
      code: z.string().min(1).max(100),
      severity: z.enum(['blocker', 'warning', 'info']),
      publicMessageCode: PublicMessageCode,
      internalRationale: z.string().min(1).max(2000).optional(),
    }),
  ).max(20),
  passed: z.boolean(),
  overallScore: z.number().min(0).max(100).optional(),
}).strict();

export type JudgeOutputRepairOutput = z.infer<typeof JudgeOutputRepairContract>;

export function mockJudgeOutputRepairOutput(): JudgeOutputRepairOutput {
  return {
    revisedFindings: [
      {
        code: 'struct-001',
        severity: 'info',
        publicMessageCode: 'generic_passable',
        internalRationale: 'Revised prose addresses previous weaknesses, with stronger sensory grounding during the flashback sequence.',
      },
      {
        code: 'struct-002',
        severity: 'info',
        publicMessageCode: 'emotional_beat_weak',
        internalRationale: 'The emotional weight of the flashback is significantly improved with the added sensory detail and the brother\'s voice calling her name.',
      },
    ],
    passed: true,
    overallScore: 85,
  };
}
