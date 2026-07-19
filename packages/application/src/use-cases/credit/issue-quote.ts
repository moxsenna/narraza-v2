import type { CreditQuote, CreditQuoteRepo } from '../../ports/operational-ports.js';
import { PublicUseCaseError } from '@narraza/shared';

export interface IssueQuoteInput {
  userId: string;
  workflowPlanHash: string;
  dependencyHash: string;
  estimatedMaximumMicroIdr: bigint;
  /** Quote expiry in seconds from now. Default 300 (5 minutes). */
  ttlSeconds?: number;
}

export interface IssueQuoteOutput {
  quoteId: string;
  expiresAt: Date;
}

/**
 * Issue a CreditQuote bound to workflowPlanHash, dependencyHash, owner, and expiry.
 * Does NOT deduct credit — just freezes metadata for later confirmation.
 */
export async function issueQuote(
  quoteRepo: CreditQuoteRepo,
  input: IssueQuoteInput,
): Promise<IssueQuoteOutput> {
  const ttlSeconds = input.ttlSeconds ?? 300;
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  const quote = await quoteRepo.create({
    ownerUserId: input.userId,
    workflowPlanHash: input.workflowPlanHash,
    dependencyHash: input.dependencyHash,
    estimatedMaximumMicroIdr: input.estimatedMaximumMicroIdr,
    expiresAt,
  });

  return {
    quoteId: quote.id,
    expiresAt: quote.expiresAt,
  };
}
