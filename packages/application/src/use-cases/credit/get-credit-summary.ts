/**
 * CreditSummary read model.
 *
 * Computes available / held / reconciling credit from ledger entries
 * and reservations. This is a read model — it never authorizes domain
 * actions alone.
 *
 * Formula:
 *   bookBalance = grants - settlements + refunds +/- adjustments
 *   heldBalance = SUM(reserved - settled - released) for active reservations
 *   reconciling = SUM(open exposure estimated amounts)
 *   availableCredit = bookBalance - heldBalance - reconciling
 *
 * All values in micro-IDR (integer).
 *
 * Matrix: credit-summary
 */

import type { UserRepo } from '../../ports/auth-ports.js';
import { authorizeActiveUser } from '../../authz/authorize-active-user.js';
import { InternalUseCaseError } from '@narraza/shared';

// =============================================================================
// Ports for credit summary
// =============================================================================

export interface CreditLedgerSummaryEntry {
  entryType: string;
  amountMicro: bigint;
}

export interface ReservationSummary {
  reservedAmount: bigint;
  settledAmount: bigint;
  releasedAmount: bigint;
  /** Sum of open exposure estimated amounts for this reservation. */
  openExposureAmount: bigint;
}

export interface CreditSummaryPorts {
  userRepo: UserRepo;
  ledgerRepo: {
    /** Get all ledger entries for a user. */
    listByUserId(userId: string): Promise<CreditLedgerSummaryEntry[]>;
  };
  reservationRepo: {
    /** Get active (non-closed) reservations for a user with exposure totals. */
    listActiveByUserId(userId: string): Promise<ReservationSummary[]>;
  };
}

// =============================================================================
// Output type
// =============================================================================

export interface CreditSummary {
  /** Total grants received. */
  totalGrants: string;
  /** Total settlements (spent). */
  totalSettlements: string;
  /** Total refunds. */
  totalRefunds: string;
  /** Net adjustments. */
  netAdjustments: string;
  /** Book balance = grants - settlements + refunds +/- adjustments. */
  bookBalance: string;
  /** Held balance = total reserved not yet settled or released. */
  heldBalance: string;
  /** Reconciling = sum of open exposure estimates. */
  reconciling: string;
  /** Available credit = bookBalance - heldBalance - reconciling. */
  availableCredit: string;
}

// =============================================================================
// Input
// =============================================================================

export interface GetCreditSummaryInput {
  userId: string;
}

// =============================================================================
// Use case
// =============================================================================

/**
 * Compute a credit summary for a user.
 *
 * This is a READ-ONLY operation. It does not modify any data.
 */
export async function getCreditSummary(
  ports: CreditSummaryPorts,
  input: GetCreditSummaryInput,
): Promise<CreditSummary> {
  await authorizeActiveUser(ports.userRepo, input.userId);

  // 1. Sum ledger entries by type
  const entries = await ports.ledgerRepo.listByUserId(input.userId);

  let totalGrants = 0n;
  let totalSettlements = 0n;
  let totalRefunds = 0n;
  let netAdjustments = 0n;

  for (const entry of entries) {
    switch (entry.entryType) {
      case 'grant':
        totalGrants += entry.amountMicro;
        break;
      case 'settle':
        totalSettlements += entry.amountMicro;
        break;
      case 'refund':
        totalRefunds += entry.amountMicro;
        break;
      case 'adjustment':
        netAdjustments += entry.amountMicro; // may be positive or negative
        break;
      default:
        // Unknown entry types are ignored (don't fail for future types)
        break;
    }
  }

  // 2. Sum active reservations
  const reservations = await ports.reservationRepo.listActiveByUserId(
    input.userId,
  );

  let heldBalance = 0n;
  let reconciling = 0n;

  for (const res of reservations) {
    // held = reserved - settled - released (the locked but unspent portion)
    const held = res.reservedAmount - res.settledAmount - res.releasedAmount;
    if (held > 0n) {
      heldBalance += held;
    }
    reconciling += res.openExposureAmount;
  }

  // 3. Compute book balance and available
  const bookBalance = totalGrants - totalSettlements + totalRefunds + netAdjustments;
  const availableCredit = bookBalance - heldBalance - reconciling;

  return {
    totalGrants: totalGrants.toString(),
    totalSettlements: totalSettlements.toString(),
    totalRefunds: totalRefunds.toString(),
    netAdjustments: netAdjustments.toString(),
    bookBalance: bookBalance.toString(),
    heldBalance: heldBalance.toString(),
    reconciling: reconciling.toString(),
    availableCredit: availableCredit.toString(),
  };
}
