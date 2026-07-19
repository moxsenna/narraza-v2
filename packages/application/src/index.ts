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
export type { TransactionPorts, UnitOfWork, UnitOfWorkOptions } from './unit-of-work.js';
