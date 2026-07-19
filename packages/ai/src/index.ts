// @narraza/ai — AI execution port, prompt contracts, and mock provider
// No ledger, no artifact storage, no @narraza/db, no @prisma/client

export * from './types.js';
export { createMockAIExecutionPort } from './execution-port.js';
export { createProductionAIExecutionPort } from './production-execution-port.js';
export {
  createAIExecutionPort,
  type CreateAIExecutionPortOptions,
} from './create-ai-execution-port.js';

// Prompt contracts
export {
  IntakeExtractContract,
  FoundationProposeContract,
  CharacterProposeContract,
  OutlineGenerateContract,
  BeatWriteContract,
  BeatJudgeContract,
  BeatRepairContract,
  JudgeOutputRepairContract,
  PublishPackageContract,
  PublicMessageCode,
} from './prompts/contracts/index.js';

export type {
  IntakeExtractOutput,
  FoundationProposeOutput,
  CharacterProposeOutput,
  OutlineGenerateOutput,
  BeatWriteOutput,
  BeatJudgeOutput,
  BeatRepairOutput,
  JudgeOutputRepairOutput,
  PublishPackageOutput,
} from './prompts/contracts/index.js';
