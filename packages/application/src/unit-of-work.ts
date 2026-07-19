import type { ProjectRepo } from './ports/project-ports.js';
import type { FoundationRepo } from './ports/foundation-ports.js';
import type { CharacterRepo } from './ports/character-ports.js';
import type { CanonicalChangeSetRepo } from './ports/canonical-change-set-ports.js';

/**
 * Transaction-scoped ports: repos available only within a running transaction.
 * These are NOT the same as global (non-tx) port registries.
 */
export interface TransactionPorts {
  projectRepo: ProjectRepo;
  foundationRepo: FoundationRepo;
  characterRepo: CharacterRepo;
  changeSetRepo: CanonicalChangeSetRepo;
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
