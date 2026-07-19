import type { PrismaClient } from '@prisma/client';
import type {
  UnitOfWork,
  OperationalUnitOfWork,
  TransactionPorts,
  UnitOfWorkOptions,
  FullTxPorts,
} from '@narraza/application';
import { createTxProjectRepo } from './repositories/tx-project-repo.js';
import { createTxFoundationRepo } from './repositories/tx-foundation-repo.js';
import { createTxCharacterRepo } from './repositories/tx-character-repo.js';
import { createTxChangeSetRepo } from './repositories/tx-change-set-repo.js';
import { createTxCreditQuoteRepo } from './repositories/tx-credit-quote-repo.js';
import { createTxGenerationJobRepo } from './repositories/tx-generation-job-repo.js';
import { createTxGenerationAttemptRepo } from './repositories/tx-generation-attempt-repo.js';
import { createTxWorkflowInvocationRepo } from './repositories/tx-workflow-invocation-repo.js';
import { createTxCreditReservationRepo } from './repositories/tx-credit-reservation-repo.js';
import { createTxAttemptCostExposureRepo } from './repositories/tx-attempt-cost-exposure-repo.js';
import { createTxUserConcurrencySlotRepo } from './repositories/tx-user-concurrency-slot-repo.js';
import { createTxOutboxEventRepo } from './repositories/tx-outbox-event-repo.js';
import { createTxOutboxConsumerReceiptRepo } from './repositories/tx-outbox-consumer-receipt-repo.js';
import { Prisma } from '@prisma/client';

const DEFAULT_MAX_RETRIES = 3;

function executeTx<T>(
  prisma: PrismaClient,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: UnitOfWorkOptions,
): Promise<T> {
  const isolation = options?.isolation ?? 'read committed';
  const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;

  let attempt = 0;
  let lastError: unknown;

  while (attempt < maxRetries) {
    try {
      return prisma.$transaction(fn, {
        isolationLevel:
          isolation === 'serializable'
            ? Prisma.TransactionIsolationLevel.Serializable
            : isolation === 'repeatable read'
              ? Prisma.TransactionIsolationLevel.RepeatableRead
              : Prisma.TransactionIsolationLevel.ReadCommitted,
      });
    } catch (err) {
      lastError = err;
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
}

export function createPrismaUnitOfWork(prisma: PrismaClient): UnitOfWork {
  return {
    async execute<T>(
      fn: (ports: TransactionPorts) => Promise<T>,
      options?: UnitOfWorkOptions,
    ): Promise<T> {
      return executeTx(prisma, async (tx) => {
        const ports: TransactionPorts = {
          projectRepo: createTxProjectRepo(tx),
          foundationRepo: createTxFoundationRepo(tx),
          characterRepo: createTxCharacterRepo(tx),
          changeSetRepo: createTxChangeSetRepo(tx),
        };
        return fn(ports);
      }, options);
    },
  };
}

export function createPrismaOperationalUnitOfWork(prisma: PrismaClient): OperationalUnitOfWork {
  return {
    async execute<T>(
      fn: (ports: FullTxPorts) => Promise<T>,
      options?: UnitOfWorkOptions,
    ): Promise<T> {
      return executeTx(prisma, async (tx) => {
        const ports: FullTxPorts = {
          projectRepo: createTxProjectRepo(tx),
          foundationRepo: createTxFoundationRepo(tx),
          characterRepo: createTxCharacterRepo(tx),
          changeSetRepo: createTxChangeSetRepo(tx),
          creditQuoteRepo: createTxCreditQuoteRepo(tx),
          generationJobRepo: createTxGenerationJobRepo(tx),
          generationAttemptRepo: createTxGenerationAttemptRepo(tx),
          workflowInvocationRepo: createTxWorkflowInvocationRepo(tx),
          creditReservationRepo: createTxCreditReservationRepo(tx),
          attemptCostExposureRepo: createTxAttemptCostExposureRepo(tx),
          concurrencySlotRepo: createTxUserConcurrencySlotRepo(tx),
          outboxEventRepo: createTxOutboxEventRepo(tx),
          outboxConsumerReceiptRepo: createTxOutboxConsumerReceiptRepo(tx),
        };
        return fn(ports);
      }, options);
    },
  };
}
