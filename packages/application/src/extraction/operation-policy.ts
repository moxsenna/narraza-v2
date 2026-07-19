// Operation allowlist policy: per-contract allowed ops + max counts.
// Protects against model emitting wrong op types for a contract.

import type { OpIntent, OperationAllowlist, PromptContractVersion, ExtractionError } from './types.js';
import type { ModelSuggestionDraft } from './types.js';

/**
 * Per-contract operation allowlists.
 *
 * These define which opIntents are valid for each prompt contract,
 * and maximum counts per op type and total.
 */
const ALLOWLISTS: Record<PromptContractVersion, OperationAllowlist> = {
  'intake.extract.v1': {
    allowedOpIntents: ['upsert_foundation', 'upsert_character'],
    maxCounts: { upsert_foundation: 3, upsert_character: 10 },
    maxTotalOps: 15,
  },
  'foundation.propose.v1': {
    allowedOpIntents: ['upsert_foundation'],
    maxCounts: { upsert_foundation: 20 },
    maxTotalOps: 20,
  },
  'character.propose.v1': {
    allowedOpIntents: ['upsert_character', 'upsert_fact', 'upsert_belief'],
    maxCounts: { upsert_character: 10, upsert_fact: 10, upsert_belief: 10 },
    maxTotalOps: 30,
  },
  'outline.generate.v1': {
    allowedOpIntents: ['upsert_outline', 'upsert_chapter', 'upsert_beat'],
    maxCounts: { upsert_outline: 1, upsert_chapter: 50, upsert_beat: 200 },
    maxTotalOps: 250,
  },
  'beat.write.v1': {
    allowedOpIntents: ['upsert_fact', 'upsert_character_state', 'upsert_belief', 'record_disclosure', 'prose_accept'],
    maxCounts: {
      upsert_fact: 20,
      upsert_character_state: 10,
      upsert_belief: 10,
      record_disclosure: 20,
      prose_accept: 1,
    },
    maxTotalOps: 50,
  },
  'beat.judge.v1': {
    allowedOpIntents: [],
    maxCounts: {},
    maxTotalOps: 0,
  },
  'beat.repair.v1': {
    allowedOpIntents: ['upsert_fact', 'upsert_character_state', 'upsert_belief', 'record_disclosure', 'prose_accept'],
    maxCounts: {
      upsert_fact: 20,
      upsert_character_state: 10,
      upsert_belief: 10,
      record_disclosure: 20,
      prose_accept: 1,
    },
    maxTotalOps: 50,
  },
  'judge-output.repair.v1': {
    allowedOpIntents: [],
    maxCounts: {},
    maxTotalOps: 0,
  },
  'publish.package.v1': {
    allowedOpIntents: ['create_artifact'],
    maxCounts: { create_artifact: 1 },
    maxTotalOps: 1,
  },
};

/**
 * Get the operation allowlist for a prompt contract.
 */
export function getAllowlist(contract: PromptContractVersion): OperationAllowlist {
  return ALLOWLISTS[contract];
}

/**
 * Validate model suggestions against the contract's allowlist.
 * Returns errors for any disallowed op types or count violations.
 */
export function validateAgainstAllowlist(
  suggestions: ModelSuggestionDraft[],
  contract: PromptContractVersion,
): ExtractionError[] {
  const errors: ExtractionError[] = [];
  const allowlist = getAllowlist(contract);

  if (!allowlist) {
    errors.push({
      code: 'UNKNOWN_CONTRACT',
      message: `No allowlist defined for contract: ${contract}`,
    });
    return errors;
  }

  // Check total count
  if (suggestions.length > allowlist.maxTotalOps) {
    errors.push({
      code: 'MAX_TOTAL_OPS_EXCEEDED',
      message: `Total operations ${suggestions.length} exceeds max ${allowlist.maxTotalOps} for contract ${contract}`,
    });
  }

  // Count per opIntent
  const counts = new Map<OpIntent, number>();
  for (const s of suggestions) {
    counts.set(s.opIntent, (counts.get(s.opIntent) ?? 0) + 1);

    // Check allowed
    if (!allowlist.allowedOpIntents.includes(s.opIntent)) {
      errors.push({
        code: 'DISALLOWED_OP_TYPE',
        message: `Operation type '${s.opIntent}' is not allowed for contract '${contract}'. Allowed: ${allowlist.allowedOpIntents.join(', ')}`,
        tempRef: s.tempRef,
      });
    }
  }

  // Check max per type
  for (const [opIntent, count] of counts) {
    const max = allowlist.maxCounts[opIntent];
    if (max !== undefined && count > max) {
      errors.push({
        code: 'OP_COUNT_EXCEEDED',
        message: `Operation type '${opIntent}' count ${count} exceeds max ${max} for contract ${contract}`,
      });
    }
  }

  return errors;
}

/**
 * Validate that beat.write contract does not emit outline/foundation ops.
 * This is specifically called out in the spec as an op-allowlist test.
 */
export function validateBeatContractOps(suggestions: ModelSuggestionDraft[]): ExtractionError[] {
  const forbiddenIntents: OpIntent[] = ['upsert_outline', 'upsert_foundation', 'upsert_chapter', 'upsert_character'];
  const errors: ExtractionError[] = [];

  for (const s of suggestions) {
    if (forbiddenIntents.includes(s.opIntent)) {
      errors.push({
        code: 'BEAT_DISALLOWED_OP_TYPE',
        message: `Beat contract cannot emit '${s.opIntent}' operations. Only fact, state, belief, disclosure, and prose_accept are allowed.`,
        tempRef: s.tempRef,
      });
    }
  }

  return errors;
}
