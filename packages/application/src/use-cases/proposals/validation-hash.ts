/**
 * ValidationReport hash binding.
 *
 * A ValidationReport binds to a specific proseVersionId + contentHash.
 * After a prose edit, the content hash changes, which makes the old
 * validation report stale.
 *
 * Matrix: validation-hash
 */

import type {
  ValidationReportRepo,
  ValidationReportEntry,
  ProseWorkingDraftRepo,
} from '../../ports/proposal-ports.js';
import type { UserRepo } from '../../ports/auth-ports.js';
import { authorizeActiveUser } from '../../authz/authorize-active-user.js';
import { InternalUseCaseError } from '@narraza/shared';
import { createHash } from 'node:crypto';

export interface CheckValidationStalenessInput {
  userId: string;
  /** The ProseVersion ID the validation report was created for. */
  proseVersionId: string;
  /** The current content hash to check against. */
  currentContentHash: string;
}

export interface CheckValidationStalenessOutput {
  /** Whether the existing validation report is stale. */
  isStale: boolean;
  /** The validated content hash (if report exists). */
  validatedContentHash: string | null;
  /** The report ID (if exists). */
  reportId: string | null;
}

export interface ValidationHashPorts {
  userRepo: UserRepo;
  validationReportRepo: ValidationReportRepo;
  workingDraftRepo: ProseWorkingDraftRepo;
}

/**
 * Check if the validation report for a given prose version is still valid
 * against the current content hash.
 *
 * When a prose draft is edited after validation, the content hash changes,
 * making the old validation report stale. A new validation must be run.
 */
export async function checkValidationStaleness(
  ports: ValidationHashPorts,
  input: CheckValidationStalenessInput,
): Promise<CheckValidationStalenessOutput> {
  await authorizeActiveUser(ports.userRepo, input.userId);

  const report = await ports.validationReportRepo.findLatestByProseVersionId(
    input.proseVersionId,
  );

  if (!report) {
    return {
      isStale: true,
      validatedContentHash: null,
      reportId: null,
    };
  }

  const isStale = report.contentHash !== input.currentContentHash;

  return {
    isStale,
    validatedContentHash: report.contentHash,
    reportId: report.id,
  };
}

/**
 * Bind a validation report to a prose version and content hash.
 * If the content hash changes, any new validation creates a new report;
 * the old report is implicitly stale via hash mismatch.
 */
export async function createValidationReport(
  ports: ValidationHashPorts,
  input: {
    proseVersionId: string;
    candidateId?: string | null;
    findings: Array<{
      code: string;
      severity: 'blocker' | 'warning' | 'info';
      source: 'deterministic' | 'ai';
      message: string;
      publicMessageCode: string;
      deterministic: boolean;
    }>;
    content: string;
  },
): Promise<ValidationReportEntry> {
  const contentHash = createHash('sha256').update(input.content).digest('hex');

  const passed = !input.findings.some((f) => f.severity === 'blocker');

  return ports.validationReportRepo.create({
    proseVersionId: input.proseVersionId,
    candidateId: input.candidateId ?? null,
    passed,
    findings: input.findings,
    contentHash,
  });
}
