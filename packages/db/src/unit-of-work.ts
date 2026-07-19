import type { PrismaClient } from '@prisma/client';
import type {
  UnitOfWork,
  TransactionPorts,
  UnitOfWorkOptions,
} from '@narraza/application';
import { createTxProjectRepo } from './repositories/tx-project-repo.js';
import { createTxFoundationRepo } from './repositories/tx-foundation-repo.js';
import { createTxCharacterRepo } from './repositories/tx-character-repo.js';
import { createTxChangeSetRepo } from './repositories/tx-change-set-repo.js';
import { Prisma } from '@prisma/client';

const DEFAULT_MAX_RETRIES = 3;

export function createPrismaUnitOfWork(prisma: PrismaClient): UnitOfWork {
  return {
    async execute<T>(
      fn: (ports: TransactionPorts) => Promise<T>,
      options?: UnitOfWorkOptions,
    ): Promise<T> {
      const isolation = options?.isolation ?? 'read committed';
      const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;

      let attempt = 0;
      let lastError: unknown;

      while (attempt < maxRetries) {
        try {
          return await prisma.$transaction(
            async (tx) => {
              const ports: TransactionPorts = {
                projectRepo: createTxProjectRepo(tx),
                foundationRepo: createTxFoundationRepo(tx),
                characterRepo: createTxCharacterRepo(tx),
                changeSetRepo: createTxChangeSetRepo(tx),
              };
              return fn(ports);
            },
            {
              isolationLevel:
                isolation === 'serializable'
                  ? Prisma.TransactionIsolationLevel.Serializable
                  : isolation === 'repeatable read'
                    ? Prisma.TransactionIsolationLevel.RepeatableRead
                    : Prisma.TransactionIsolationLevel.ReadCommitted,
            },
          );
        } catch (err) {
          lastError = err;
          // Prisma throws P2034 for serialization failures / write conflicts
          const isRetryable =
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === 'P2034';
          if (!isRetryable) {
            throw err;
          }
          attempt++;
        }
      }

      throw lastError;
    },
  };
}
