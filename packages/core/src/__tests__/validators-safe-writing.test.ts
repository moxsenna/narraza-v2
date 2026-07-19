import { describe, expect, it } from 'vitest';
import { validateBeatContract } from '../validator/beat-contract.js';
import { validateRevealLeak } from '../validator/reveal-validator.js';
import { validateCharacterKnowledge } from '../validator/character-knowledge.js';
import { validateCanonContradiction } from '../validator/canon-contradiction.js';
import {
  applyMinimalSafeRepair,
  validateSafeRepair,
} from '../validator/safe-repair.js';
import { validateProseDeterministic } from '../validator/run-all.js';
import { applyRevealPolicy } from '../reveal-policy.js';
import { buildWriterPacket } from '../context/writer-packet.js';

const HIDDEN_TRUTH = 'The mayor is the cult leader';

describe('beat-contract validator', () => {
  it('blocks missing mustInclude and present mustNotInclude', () => {
    const findings = validateBeatContract({
      proseContent: 'She walked to the market and bought bread.',
      contract: {
        beatGoal: 'Show Alya distrust the mayor',
        mustInclude: ['harbor fog'],
        mustNotInclude: ['cult leader'],
        expectedEndState: 'Alya leaves uneasy',
        stopCondition: 'Alya exits the square',
        wordBudget: 200,
      },
    });
    expect(findings.some((f) => f.code === 'BEAT_MUST_INCLUDE_MISSING')).toBe(
      true,
    );
  });

  it('blocks forbidden mustNotInclude phrase', () => {
    const findings = validateBeatContract({
      proseContent: `Everyone whispered that the ${HIDDEN_TRUTH.toLowerCase()}.`,
      contract: {
        beatGoal: 'Market scene',
        mustInclude: [],
        mustNotInclude: [HIDDEN_TRUTH],
        expectedEndState: 'tension',
        stopCondition: 'leave',
      },
    });
    expect(findings.some((f) => f.code === 'BEAT_MUST_NOT_INCLUDE')).toBe(true);
    expect(findings.every((f) => f.severity === 'blocker' || f.severity === 'warning')).toBe(
      true,
    );
  });
});

describe('reveal validator', () => {
  it('blocks forbidden reveal truth in prose', () => {
    const findings = validateRevealLeak({
      proseContent: `At last she knew: ${HIDDEN_TRUTH}.`,
      forbiddenConcepts: [{ factId: 'f1', truth: HIDDEN_TRUTH }],
    });
    expect(findings.some((f) => f.code === 'REVEAL_FORBIDDEN_TRUTH' && f.severity === 'blocker')).toBe(
      true,
    );
  });

  it('blocks early future event', () => {
    const findings = validateRevealLeak({
      proseContent: 'The coronation of the emperor heir shook the capital.',
      forbiddenConcepts: [],
      futureEventPhrases: ['coronation of the emperor heir'],
    });
    expect(findings.some((f) => f.code === 'REVEAL_FUTURE_EVENT_EARLY')).toBe(
      true,
    );
  });
});

describe('character knowledge validator', () => {
  it('blocks POV using unknown fact', () => {
    const findings = validateCharacterKnowledge({
      proseContent: `Alya thought: ${HIDDEN_TRUTH}.`,
      povCharacterId: 'alya',
      presentCharacterIds: ['alya'],
      facts: [
        {
          factId: 'f1',
          truth: HIDDEN_TRUTH,
          knownByCharacterIds: [], // nobody knows yet
        },
      ],
    });
    expect(findings.some((f) => f.code === 'KNOWLEDGE_POV_LEAK')).toBe(true);
  });

  it('allows knower to state fact', () => {
    const findings = validateCharacterKnowledge({
      proseContent: `Raka whispered: ${HIDDEN_TRUTH}.`,
      povCharacterId: 'raka',
      presentCharacterIds: ['raka'],
      facts: [
        {
          factId: 'f1',
          truth: HIDDEN_TRUTH,
          knownByCharacterIds: ['raka'],
        },
      ],
    });
    expect(findings.filter((f) => f.severity === 'blocker')).toHaveLength(0);
  });
});

describe('canon contradiction validator', () => {
  it('blocks sensitive family relation without proposal', () => {
    const findings = validateCanonContradiction({
      proseContent: 'He said, my father is the emperor.',
      existingFacts: [],
      proposals: [],
    });
    expect(
      findings.some((f) => f.code === 'CANON_SENSITIVE_IN_PROSE'),
    ).toBe(true);
  });

  it('blocks death without proposal', () => {
    const findings = validateCanonContradiction({
      proseContent: 'That night the general was killed.',
      existingFacts: [],
      proposals: [],
    });
    expect(findings.some((f) => f.severity === 'blocker')).toBe(true);
  });

  it('allows sensitive claim with approved proposal', () => {
    const findings = validateCanonContradiction({
      proseContent: 'That night the general was killed.',
      existingFacts: [],
      proposals: [
        {
          claim: 'General dies in ch3',
          category: 'death',
          hasApprovedProposal: true,
        },
      ],
    });
    expect(findings.filter((f) => f.code === 'CANON_SENSITIVE_IN_PROSE')).toHaveLength(
      0,
    );
  });
});

describe('safe repair', () => {
  it('strips forbidden truth without adding plot', () => {
    const original = `She walked the foggy harbor. ${HIDDEN_TRUTH}. She bought bread.`;
    const repaired = applyMinimalSafeRepair(original, [HIDDEN_TRUTH]);
    expect(repaired).not.toContain(HIDDEN_TRUTH);
    expect(repaired.toLowerCase()).toContain('harbor');

    const findings = validateSafeRepair({
      originalProse: original,
      repairedProse: repaired,
      constraints: {
        originalBeatGoal: 'Market unease',
        existingCanonTruths: ['Harbor exists'],
        forbiddenTruths: [HIDDEN_TRUTH],
        targetFindings: [
          {
            code: 'BEAT_MUST_NOT_INCLUDE',
            severity: 'blocker',
            source: 'deterministic',
            message: `Prose contains forbidden phrase: ${HIDDEN_TRUTH}`,
            publicMessageCode: 'beat.must_not_include.present',
            deterministic: true,
          },
        ],
      },
    });
    expect(findings.filter((f) => f.severity === 'blocker')).toHaveLength(0);
  });

  it('blocks repair that adds new canon', () => {
    const findings = validateSafeRepair({
      originalProse: 'She walked the harbor.',
      repairedProse: 'She walked the harbor. Alya is orphan.',
      constraints: {
        originalBeatGoal: 'Harbor walk',
        existingCanonTruths: ['Alya is orphan'],
        forbiddenTruths: [],
        targetFindings: [],
      },
    });
    expect(findings.some((f) => f.code === 'REPAIR_ADDS_CANON')).toBe(true);
  });
});

describe('benchmark: major reveal Bab 25 / prose Bab 3', () => {
  it('context packet + validators block early truth; repair removes it', () => {
    const policy = applyRevealPolicy({
      currentChapter: 3,
      facts: [
        {
          id: 'f-major',
          truth: HIDDEN_TRUTH,
          surface: HIDDEN_TRUTH,
          factKey: 'mayor.cult',
          category: 'identity',
          revealStatus: 'scheduled',
          scheduledChapter: 25,
          breadcrumbSurface: 'The mayor avoids certain questions',
        },
        {
          id: 'f-public',
          truth: 'The town has a harbor',
          surface: 'The town has a harbor',
          factKey: 'setting.harbor',
          category: 'setting',
          revealStatus: 'revealed',
        },
      ],
    });

    const packet = buildWriterPacket({
      projectId: 'p1',
      beatId: 'b-ch3',
      restrictedFacts: policy.restrictedFacts,
      writerSafeFacts: policy.writerSafeFacts,
      forbiddenConcepts: policy.forbiddenConcepts,
    });

    const packetJson = JSON.stringify(packet);
    expect(packetJson).not.toContain(HIDDEN_TRUTH);
    expect(packetJson).toContain('harbor');

    const badProse = `Alya watched the mayor. She realized ${HIDDEN_TRUTH}. Fog rolled in.`;

    const result = validateProseDeterministic({
      structural: {
        proseContent: badProse,
        beatId: 'b-ch3',
        chapterId: 'ch-3',
      },
      beatContract: {
        proseContent: badProse,
        contract: {
          beatGoal: 'Harbor unease',
          mustInclude: ['fog'],
          mustNotInclude: [HIDDEN_TRUTH],
          expectedEndState: 'Alya leaves',
          stopCondition: 'exits dock',
          wordBudget: 120,
        },
      },
      reveal: {
        proseContent: badProse,
        forbiddenConcepts: policy.forbiddenConcepts,
        futureEventPhrases: ['cult leader is crowned'],
      },
      knowledge: {
        proseContent: badProse,
        povCharacterId: 'alya',
        presentCharacterIds: ['alya'],
        facts: [
          {
            factId: 'f-major',
            truth: HIDDEN_TRUTH,
            knownByCharacterIds: [],
          },
        ],
      },
    });

    expect(result.hasBlockers).toBe(true);
    expect(result.passed).toBe(false);
    expect(
      result.findings.some(
        (f) =>
          f.code === 'REVEAL_FORBIDDEN_TRUTH' ||
          f.code === 'BEAT_MUST_NOT_INCLUDE' ||
          f.code === 'KNOWLEDGE_POV_LEAK',
      ),
    ).toBe(true);

    const repaired = applyMinimalSafeRepair(badProse, [HIDDEN_TRUTH]);
    expect(repaired).not.toContain(HIDDEN_TRUTH);

    const after = validateProseDeterministic({
      structural: {
        proseContent: repaired,
        beatId: 'b-ch3',
        chapterId: 'ch-3',
      },
      beatContract: {
        proseContent: repaired,
        contract: {
          beatGoal: 'Harbor unease',
          mustInclude: ['fog'],
          mustNotInclude: [HIDDEN_TRUTH],
          expectedEndState: 'Alya leaves',
          stopCondition: 'exits dock',
        },
      },
      reveal: {
        proseContent: repaired,
        forbiddenConcepts: policy.forbiddenConcepts,
      },
      knowledge: {
        proseContent: repaired,
        povCharacterId: 'alya',
        presentCharacterIds: ['alya'],
        facts: [
          {
            factId: 'f-major',
            truth: HIDDEN_TRUTH,
            knownByCharacterIds: [],
          },
        ],
      },
      safeRepair: {
        originalProse: badProse,
        repairedProse: repaired,
        constraints: {
          originalBeatGoal: 'Harbor unease',
          existingCanonTruths: ['The town has a harbor'],
          forbiddenTruths: [HIDDEN_TRUTH],
          targetFindings: result.findings,
        },
      },
    });

    expect(after.hasBlockers).toBe(false);
    expect(after.passed).toBe(true);
  });
});
