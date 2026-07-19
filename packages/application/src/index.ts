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
