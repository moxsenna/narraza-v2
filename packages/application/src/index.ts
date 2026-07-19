export type { AuthPorts, ChallengeRepo, UserRepo, SessionRepo, LedgerRepo } from './ports/auth-ports.js';
export type {
  EmailLoginChallenge,
  Session,
  User,
  CreditLedgerEntry,
  CreateChallengeInput,
} from './ports/auth-ports.js';
export { issueChallenge, type IssueChallengeInput, type IssueChallengeResult } from './use-cases/auth/issue-challenge.js';
export { prepareConfirm, type PrepareConfirmInput, type PrepareConfirmResult } from './use-cases/auth/prepare-confirm.js';
export { consumeChallenge, type ConsumeChallengeInput, type ConsumeChallengeResult } from './use-cases/auth/consume-challenge.js';
export { ensureSignupGrant } from './use-cases/auth/ensure-signup-grant.js';
export { hashToken, generateRawToken, generateNonce } from './use-cases/auth/hash-token.js';
export { sendDevMail, type MailMessage } from './use-cases/auth/dev-mail-transport.js';
export {
  signPendingCookie,
  verifyPendingCookie,
  formatPendingCookie,
  formatClearPendingCookie,
  type PendingCookiePayload,
} from './use-cases/auth/pending-login-cookie.js';

// Project ports and use cases
export type { Project, CreateProjectInput, ProjectRepo } from './ports/project-ports.js';
export { createProject, type CreateProjectInput as CreateProjectUCInput, type CreateProjectOutput, type ProjectPorts } from './use-cases/projects/create-project.js';
export { listProjects, type ListProjectsOutput, type ListProjectsPorts } from './use-cases/projects/list-projects.js';
export { softDeleteProject, type SoftDeleteProjectOutput, type SoftDeleteProjectPorts } from './use-cases/projects/soft-delete-project.js';

// Foundation ports
export type { Foundation, UpsertFoundationInput, FoundationRepo } from './ports/foundation-ports.js';

// Character ports
export type { Character, CreateCharacterInput, CharacterRepo } from './ports/character-ports.js';

// Canonical change set ports
export type {
  CanonicalChangeSet,
  CanonicalChangeOperation,
  CreateChangeSetInput,
  CreateChangeOperationInput,
  CanonicalChangeSetRepo,
  EntityRevisionRecord,
  Fact,
  FactRepo,
  Beat,
  BeatRepo,
  ProseVersion,
  ProseVersionRepo,
} from './ports/canonical-change-set-ports.js';

// Unit of Work
export type { TransactionPorts, UnitOfWork, OperationalUnitOfWork, UnitOfWorkOptions } from './unit-of-work.js';

// Authorization
export { authorizeActiveUser } from './authz/authorize-active-user.js';
export { lockOwnedProject } from './authz/lock-owned-project.js';

// Foundation use cases
export { editFoundation } from './use-cases/foundation/edit-foundation.js';
export { lockFoundation } from './use-cases/foundation/lock-foundation.js';
export type { EditFoundationInput, EditFoundationOutput, FoundationEditPorts } from './use-cases/foundation/edit-foundation.js';
export type { LockFoundationInput, LockFoundationOutput, FoundationLockPorts } from './use-cases/foundation/lock-foundation.js';

// Character use cases
export { upsertCharacter } from './use-cases/characters/upsert-character.js';
export type { UpsertCharacterInput, UpsertCharacterOutput, CharacterUpsertPorts } from './use-cases/characters/upsert-character.js';

// =============================================================================
// M3 Operational ports
// =============================================================================
export type {
  CreditQuote, CreditQuoteInput, CreditQuoteRepo,
  GenerationJob, CreateGenerationJobInput, GenerationJobRepo,
  GenerationAttempt, CreateGenerationAttemptInput, GenerationAttemptRepo,
  WorkflowInvocation, CreateWorkflowInvocationInput, WorkflowInvocationRepo,
  CreditReservation, CreateCreditReservationInput, CreditReservationRepo,
  AttemptCostExposure, CreateAttemptCostExposureInput, AttemptCostExposureRepo,
  UserConcurrencySlot, CreateUserConcurrencySlotInput, UserConcurrencySlotRepo,
  OperationalTxPorts, FullTxPorts,
} from './ports/operational-ports.js';

// M3.1 CreditQuote
export { issueQuote } from './use-cases/credit/issue-quote.js';
export type { IssueQuoteInput, IssueQuoteOutput } from './use-cases/credit/issue-quote.js';
export { confirmAndEnqueue } from './use-cases/credit/confirm-and-enqueue.js';
export type { ConfirmAndEnqueueInput, ConfirmAndEnqueueOutput } from './use-cases/credit/confirm-and-enqueue.js';

// M3.2 Job transitions
export { transitionJobStatus, executionRetry } from './workflows/job-transitions.js';
export type { TransitionOptions, JobStatus } from './workflows/job-transitions.js';

// M3.3 Lease + fencing
export {
  claimJob, reclaimExpiredLease, assertLease,
  publishUnderLease, renewLease, generateLeaseToken,
} from './workflows/lease.js';
export type { LeaseInfo } from './workflows/lease.js';

// M3.4 Invocation winner
export {
  selectInvocationWinner, recordLateAttempt,
} from './workflows/invocation-reducer.js';
export type { InvocationWinnerResult } from './workflows/invocation-reducer.js';

// M3.5 Attempt reconciliation
export {
  reconcileAttempt, reconcileJobAttempts,
} from './reconciliation/attempt-reconcile.js';
export type { ReconciliationResult } from './reconciliation/attempt-reconcile.js';

// M3.6 Reservation closing
export {
  closeReservation, assertReservationCapacity,
  createExposure, settleExposure, releaseExposure,
} from './reconciliation/reservation-closing.js';

// M3.7 Cancel job
export { cancelJob, tombstoneMidAttempt } from './use-cases/jobs/cancel-job.js';
export type { CancelJobInput, CancelJobOutput } from './use-cases/jobs/cancel-job.js';

// M3.8 Retry job
export { retryJob } from './use-cases/jobs/retry-job.js';
export type { RetryJobInput, RetryJobOutput } from './use-cases/jobs/retry-job.js';

// M3.9 Outbox
export {
  publishOutboxEvent, processOutboxEvent, replayOutboxEvent,
} from './workflows/outbox.js';
export type {
  PublishOutboxInput, PublishOutboxOutput,
  ProcessOutboxInput, ProcessOutboxOutput,
  ReplayOutboxInput, ReplayOutboxOutput,
} from './workflows/outbox.js';
export type {
  OutboxEvent, CreateOutboxEventInput, OutboxEventRepo,
  OutboxConsumerReceipt, CreateOutboxConsumerReceiptInput, OutboxConsumerReceiptRepo,
  WorkerInstance, CreateWorkerInstanceInput, WorkerInstanceRepo,
} from './ports/operational-ports.js';

// M3.10 Reaper
export { reap, fullReaperCycle } from './reconciliation/reaper.js';
export type { ReaperResult } from './reconciliation/reaper.js';

// =============================================================================
// M4 Extraction layer (S7)
// =============================================================================
export type {
  ModelSuggestionDraft,
  NormalizedOperationDraft,
  CanonicalChangeOperation as ExtractionCanonicalChangeOp,
  OpIntent,
  ProseEvidence,
  ExtractionResult,
  ExtractionError,
  TempRefScope,
  OperationAllowlist,
  DAGNode,
  PromptContractVersion,
} from './extraction/types.js';

export { resolveTempRefs } from './extraction/temp-ref-resolver.js';
export {
  buildOperationDAG,
  deterministicTopoSort,
  assignSequences,
} from './extraction/operation-dag.js';
export {
  getAllowlist,
  validateAgainstAllowlist,
  validateBeatContractOps,
} from './extraction/operation-policy.js';
export {
  computeProseContentHash,
  extractProseEvidence,
  validateDisclosureEvidence,
} from './extraction/prose-evidence.js';
export {
  computeOperationsHash,
  computePayloadHash,
  verifyHash,
  verifyProseAcceptOrder,
} from './extraction/proposal-integrity.js';

// =============================================================================
// M4 Pipeline use cases
// =============================================================================

// M4.4 intake.extract
export {
  requestIntake,
  executeIntakeJob,
} from './use-cases/intake/request-intake.js';
export type {
  RequestIntakeInput,
  RequestIntakeOutput,
} from './use-cases/intake/request-intake.js';

// M4.5 concept accept
export { acceptConcept } from './use-cases/concepts/accept-concept.js';
export type {
  AcceptConceptInput,
  AcceptConceptOutput,
} from './use-cases/concepts/accept-concept.js';

// M4.6 foundation.propose
export {
  requestFoundationPropose,
  executeFoundationProposeJob,
} from './use-cases/foundation/request-foundation-propose.js';
export type {
  RequestFoundationProposeInput,
  RequestFoundationProposeOutput,
} from './use-cases/foundation/request-foundation-propose.js';

// M4.7 character.propose
export {
  requestCharacterPropose,
  executeCharacterProposeJob,
} from './use-cases/characters/request-character-propose.js';
export type {
  RequestCharacterProposeInput,
  RequestCharacterProposeOutput,
} from './use-cases/characters/request-character-propose.js';

// M4.8 outline.generate
export {
  requestOutlineGenerate,
  executeOutlineGenerateJob,
  acceptOutlineBatch,
} from './use-cases/outline/request-outline.js';
export type {
  RequestOutlineInput,
  RequestOutlineOutput,
  AcceptOutlineBatchInput,
  AcceptOutlineBatchOutput,
} from './use-cases/outline/request-outline.js';

// M4.9-M4.10 beat.write + judge + repair
export {
  requestBeatWrite,
  executeBeatWriteStage,
  executeBeatJudgeStage,
  executeBeatRepairStage,
  executeBeatJob,
  requestBeatRepair,
} from './use-cases/jobs/request-beat-write.js';
export type {
  RequestBeatWriteInput,
  RequestBeatWriteOutput,
  RequestBeatRepairInput,
} from './use-cases/jobs/request-beat-write.js';

// M4.11 proposal revalidation
export { revalidateProposal } from './use-cases/proposals/revalidate-proposal.js';
export type {
  RevalidateProposalInput,
  RevalidateProposalOutput,
} from './use-cases/proposals/revalidate-proposal.js';

// M4.12 publish.package
export {
  requestPublishPackage,
  executePublishPackageJob,
} from './use-cases/publish/request-publish-package.js';
export type {
  RequestPublishPackageInput,
  RequestPublishPackageOutput,
} from './use-cases/publish/request-publish-package.js';

// =============================================================================
// M5 Accept, working draft, DTOs, progress, credit
// =============================================================================

// Proposal ports
export type {
  ProposalGroup,
  Proposal,
  CreateProposalGroupInput,
  CreateProposalInput,
  ProseWorkingDraft,
  SaveWorkingDraftInput,
  ValidationReportEntry,
  CreateValidationReportInput,
  ProposalGroupRepo,
  ProposalRepo,
  ProseWorkingDraftRepo,
  ValidationReportRepo,
  ProposalTxPorts,
} from './ports/proposal-ports.js';

// M5.1 commitCanonicalChangeSet + acceptProposal
export { commitCanonicalChangeSet } from './use-cases/proposals/commit-canonical-change-set.js';
export type {
  CommitChangeSetInput,
  CommitChangeSetOutput,
  CommitChangeSetPorts,
} from './use-cases/proposals/commit-canonical-change-set.js';
export {
  acceptProposal,
  markProposalStaleOnCasFail,
} from './use-cases/proposals/accept-proposal.js';
export type {
  AcceptProposalInput,
  AcceptProposalOutput,
  AcceptProposalPorts,
  AcceptRecoveryPorts,
} from './use-cases/proposals/accept-proposal.js';

// M5.2 ProseWorkingDraft autosave CAS
export { saveWorkingDraft } from './use-cases/prose/save-working-draft.js';
export type {
  SaveWorkingDraftInput as SaveDraftInput,
  SaveWorkingDraftOutput as SaveDraftOutput,
  SaveWorkingDraftPorts as SaveDraftPorts,
} from './use-cases/prose/save-working-draft.js';

// M5.3 Validation hash binding
export {
  checkValidationStaleness,
  createValidationReport,
} from './use-cases/proposals/validation-hash.js';
export type {
  CheckValidationStalenessInput,
  CheckValidationStalenessOutput,
  ValidationHashPorts,
} from './use-cases/proposals/validation-hash.js';

// M5.4 User-origin prose proposal
export { submitUserProse } from './use-cases/proposals/submit-user-prose.js';
export type {
  SubmitUserProseInput,
  SubmitUserProseOutput,
  SubmitUserProsePorts,
} from './use-cases/proposals/submit-user-prose.js';

// M5.5 PublicProposalView DTO
export {
  mapToPublicProposalView,
  isOverridable,
} from './dto/public-proposal-view.js';
export type {
  PublicProposalView,
  PublicProposalViewInput,
  PublicFinding,
  AvailableAction,
} from './dto/public-proposal-view.js';

// M5.6 ProjectProgressView reducer
export { computeProjectProgress } from './progress/project-progress.js';
export type {
  ProjectProgressView,
  ProjectProgressViewInput,
  ProjectPhase,
  ProgressChip,
  DashboardCta,
} from './progress/project-progress.js';

// M5.7 CreditSummary read model
export { getCreditSummary } from './use-cases/credit/get-credit-summary.js';
export type {
  CreditSummary,
  GetCreditSummaryInput,
  CreditSummaryPorts,
  CreditLedgerSummaryEntry,
  ReservationSummary,
} from './use-cases/credit/get-credit-summary.js';
