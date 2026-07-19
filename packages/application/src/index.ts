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
export type { CanonicalChangeSet, CanonicalChangeOperation, CreateChangeSetInput, CreateChangeOperationInput, CanonicalChangeSetRepo } from './ports/canonical-change-set-ports.js';

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
