import type { ProjectRepo } from './ports/project-ports.js';
import type { FoundationRepo } from './ports/foundation-ports.js';
import type { CharacterRepo } from './ports/character-ports.js';
import type {
  CanonicalChangeSetRepo,
  FactRepo,
  BeatRepo,
  ProseVersionRepo,
} from './ports/canonical-change-set-ports.js';
import type { FullTxPorts } from './ports/operational-ports.js';
export type { FullTxPorts } from './ports/operational-ports.js';
import type {
  ProposalGroupRepo,
  ProposalRepo,
  ProseWorkingDraftRepo,
  ValidationReportRepo,
} from './ports/proposal-ports.js';
import type { ChapterOutlineRepo, ChapterRepo } from './ports/outline-ports.js';

/**
 * Transaction-scoped ports: repos available only within a running transaction.
 * These are NOT the same as global (non-tx) port registries.
 */
export interface TransactionPorts {
  projectRepo: ProjectRepo;
  foundationRepo: FoundationRepo;
  characterRepo: CharacterRepo;
  changeSetRepo: CanonicalChangeSetRepo;
  proposalGroupRepo: ProposalGroupRepo;
  proposalRepo: ProposalRepo;
  workingDraftRepo: ProseWorkingDraftRepo;
  validationReportRepo: ValidationReportRepo;
  /** Domain write ports for commitCanonicalChangeSet single write door. */
  factRepo: FactRepo;
  beatRepo: BeatRepo;
  proseVersionRepo: ProseVersionRepo;
  chapterOutlineRepo: ChapterOutlineRepo;
  chapterRepo: ChapterRepo;
}

export interface UnitOfWorkOptions {
  /** Transaction isolation level */
  isolation?: 'serializable' | 'read committed' | 'repeatable read';
  /** Maximum retries for serialization failures */
  maxRetries?: number;
}

/**
 * UnitOfWork provides a serializable transaction boundary.
 *
 * The callback receives TransactionPorts that are scoped to the
 * transaction. Any error thrown inside the callback rolls back.
 */
export interface UnitOfWork {
  execute<T>(
    fn: (ports: TransactionPorts) => Promise<T>,
    options?: UnitOfWorkOptions,
  ): Promise<T>;
}

/**
 * OperationalUnitOfWork provides a transaction boundary with full ports
 * including operational (jobs, credit, attempts, etc.).
 */
export interface OperationalUnitOfWork {
  execute<T>(
    fn: (ports: FullTxPorts) => Promise<T>,
    options?: UnitOfWorkOptions,
  ): Promise<T>;
}
