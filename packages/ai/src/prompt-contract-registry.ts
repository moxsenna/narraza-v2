/**
 * P3.4 — Central prompt contract registry (no raw prompts in pages/workers).
 */

import { z } from 'zod';
import {
  IntakeExtractContract,
  FoundationProposeContract,
  CharacterProposeContract,
  OutlineGenerateContract,
  BeatWriteContract,
  BeatJudgeContract,
  BeatRepairContract,
  PublishPackageContract,
} from './prompts/contracts/index.js';

export type PromptTaskType =
  | 'intake.extract'
  | 'foundation.propose'
  | 'character.propose'
  | 'outline.generate'
  | 'beat.write'
  | 'beat.judge'
  | 'beat.repair'
  | 'publish.package';

export interface PromptContractDefinition {
  version: string;
  taskType: PromptTaskType;
  /** Zod output schema */
  outputSchema: z.ZodType<unknown>;
  systemInstruction: string;
  /** Context policy label for auditors */
  contextPolicy: 'writer_safe' | 'planner_restricted' | 'service';
  allowedInvention: 'none' | 'bounded' | 'free_within_genre';
  maxOutputTokens: number;
  /** structured JSON vs free prose-in-JSON */
  outputMode: 'structured' | 'prose_candidates';
  compatibleModelCapabilities: string[];
}

const REGISTRY: Record<string, PromptContractDefinition> = {
  'intake.extract.v1': {
    version: 'intake.extract.v1',
    taskType: 'intake.extract',
    outputSchema: IntakeExtractContract,
    systemInstruction:
      'Extract story intake fields as JSON only. No markdown. Follow schema exactly.',
    contextPolicy: 'service',
    allowedInvention: 'bounded',
    maxOutputTokens: 2048,
    outputMode: 'structured',
    compatibleModelCapabilities: ['json', 'structured'],
  },
  'foundation.propose.v1': {
    version: 'foundation.propose.v1',
    taskType: 'foundation.propose',
    outputSchema: FoundationProposeContract,
    systemInstruction:
      'Propose foundation fields as JSON only. Do not invent hidden future reveals.',
    contextPolicy: 'planner_restricted',
    allowedInvention: 'bounded',
    maxOutputTokens: 2048,
    outputMode: 'structured',
    compatibleModelCapabilities: ['json', 'structured'],
  },
  'character.propose.v1': {
    version: 'character.propose.v1',
    taskType: 'character.propose',
    outputSchema: CharacterProposeContract,
    systemInstruction: 'Propose characters as JSON only matching schema.',
    contextPolicy: 'planner_restricted',
    allowedInvention: 'bounded',
    maxOutputTokens: 2048,
    outputMode: 'structured',
    compatibleModelCapabilities: ['json', 'structured'],
  },
  'outline.generate.v1': {
    version: 'outline.generate.v1',
    taskType: 'outline.generate',
    outputSchema: OutlineGenerateContract,
    systemInstruction: 'Generate chapter outline as JSON only matching schema.',
    contextPolicy: 'planner_restricted',
    allowedInvention: 'bounded',
    maxOutputTokens: 4096,
    outputMode: 'structured',
    compatibleModelCapabilities: ['json', 'structured'],
  },
  'beat.write.v1': {
    version: 'beat.write.v1',
    taskType: 'beat.write',
    outputSchema: BeatWriteContract,
    systemInstruction: [
      'You are a fiction writer for a single beat.',
      'Use ONLY the writer-safe facts and guidance provided.',
      'Do not reveal hidden truths, future plot, or restricted facts.',
      'Output JSON matching schema: candidates[].prose is story prose only — no reasoning, no markdown fences, no meta.',
    ].join(' '),
    contextPolicy: 'writer_safe',
    allowedInvention: 'free_within_genre',
    maxOutputTokens: 4096,
    outputMode: 'prose_candidates',
    compatibleModelCapabilities: ['json', 'creative_writing'],
  },
  'beat.judge.v1': {
    version: 'beat.judge.v1',
    taskType: 'beat.judge',
    outputSchema: BeatJudgeContract,
    systemInstruction: 'Judge beat prose against contract. JSON only.',
    contextPolicy: 'service',
    allowedInvention: 'none',
    maxOutputTokens: 1024,
    outputMode: 'structured',
    compatibleModelCapabilities: ['json'],
  },
  'beat.repair.v1': {
    version: 'beat.repair.v1',
    taskType: 'beat.repair',
    outputSchema: BeatRepairContract,
    systemInstruction: [
      'Repair prose to fix listed violations only.',
      'Do not add plot, canon facts, or forbidden reveals.',
      'Output JSON with repairedProse as pure prose.',
    ].join(' '),
    contextPolicy: 'writer_safe',
    allowedInvention: 'none',
    maxOutputTokens: 4096,
    outputMode: 'prose_candidates',
    compatibleModelCapabilities: ['json', 'creative_writing'],
  },
  'publish.package.v1': {
    version: 'publish.package.v1',
    taskType: 'publish.package',
    outputSchema: PublishPackageContract,
    systemInstruction: 'Package publish metadata as JSON only.',
    contextPolicy: 'service',
    allowedInvention: 'none',
    maxOutputTokens: 1024,
    outputMode: 'structured',
    compatibleModelCapabilities: ['json'],
  },
};

export function getPromptContract(
  version: string,
): PromptContractDefinition | undefined {
  return REGISTRY[version];
}

export function requirePromptContract(version: string): PromptContractDefinition {
  const c = REGISTRY[version];
  if (!c) {
    throw new Error(`Unknown prompt contract version: ${version}`);
  }
  return c;
}

export function listPromptContracts(): PromptContractDefinition[] {
  return Object.values(REGISTRY);
}

/**
 * Validate provider raw body against contract schema. Throws on invalid.
 */
export function validateContractOutput(
  version: string,
  rawBody: string,
): unknown {
  const contract = requirePromptContract(version);
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new Error(`MALFORMED_OUTPUT: invalid JSON for ${version}`);
  }
  return contract.outputSchema.parse(parsed);
}
