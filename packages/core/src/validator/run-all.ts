import type { Finding } from '../types.js';
import { structuralValidate, type StructuralValidationInput } from './structural.js';
import {
  validateBeatContract,
  type BeatContractValidationInput,
} from './beat-contract.js';
import {
  validateRevealLeak,
  type RevealValidationInput,
} from './reveal-validator.js';
import {
  validateCharacterKnowledge,
  type CharacterKnowledgeValidationInput,
} from './character-knowledge.js';
import {
  validateCanonContradiction,
  type CanonContradictionInput,
} from './canon-contradiction.js';
import {
  validateSafeRepair,
  type SafeRepairValidationInput,
} from './safe-repair.js';
import { mergeFindings } from './merge-findings.js';

export interface FullProseValidationInput {
  structural: StructuralValidationInput;
  beatContract?: BeatContractValidationInput;
  reveal?: RevealValidationInput;
  knowledge?: CharacterKnowledgeValidationInput;
  canon?: CanonContradictionInput;
  safeRepair?: SafeRepairValidationInput;
}

export interface FullProseValidationResult {
  findings: Finding[];
  passed: boolean;
  hasBlockers: boolean;
}

/**
 * Run all deterministic validators and merge findings.
 * Blocking findings prevent prose acceptance (passed=false).
 */
export function validateProseDeterministic(
  input: FullProseValidationInput,
): FullProseValidationResult {
  const deterministic: Finding[] = [];

  deterministic.push(...structuralValidate(input.structural));

  if (input.beatContract) {
    deterministic.push(...validateBeatContract(input.beatContract));
  }
  if (input.reveal) {
    deterministic.push(...validateRevealLeak(input.reveal));
  }
  if (input.knowledge) {
    deterministic.push(...validateCharacterKnowledge(input.knowledge));
  }
  if (input.canon) {
    deterministic.push(...validateCanonContradiction(input.canon));
  }
  if (input.safeRepair) {
    deterministic.push(...validateSafeRepair(input.safeRepair));
  }

  const merged = mergeFindings({
    deterministicFindings: deterministic,
    aiFindings: [],
  });

  const hasBlockers = merged.findings.some((f) => f.severity === 'blocker');

  return {
    findings: merged.findings,
    passed: merged.passed && !hasBlockers,
    hasBlockers,
  };
}
