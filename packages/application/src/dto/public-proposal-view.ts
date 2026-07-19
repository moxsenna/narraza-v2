/**
 * PublicProposalView — server-driven DTO for client-facing proposal display.
 *
 * Rules:
 * - No raw operations exposed
 * - No service_restricted fields
 * - availableActions computed server-side
 * - Override only for server-listed findings
 * - Finding publicMessageCode only (no internal detail)
 *
 * Matrix: proposal-dto, override-allowlist
 */

import type { Proposal, ProposalGroup, ValidationReportEntry } from '../ports/proposal-ports.js';
import type { CanonicalChangeSet } from '../ports/canonical-change-set-ports.js';

// =============================================================================
// Input / output types
// =============================================================================

export interface PublicProposalViewInput {
  proposal: Proposal;
  group: ProposalGroup;
  changeSet?: CanonicalChangeSet | null;
  /** Latest validation report for the candidate/prose, if any. */
  validationReport?: ValidationReportEntry | null;
  /** The current project's canonical version for staleness check. */
  projectCanonicalVersion: number;
  /** The current dependency hash computed from canon. */
  currentDependencyHash: string;
}

export interface PublicFinding {
  /** Public message code for i18n. */
  code: string;
  /** Display severity. */
  severity: 'blocker' | 'warning' | 'info';
  /** Whether this finding may be overridden by the user on accept. */
  overridable: boolean;
}

export type AvailableAction =
  | 'accept'
  | 'reject'
  | 'override_accept'
  | 'revalidate'
  | 'view_details';

export interface PublicProposalView {
  /** Public proposal ID. */
  id: string;
  /** Group ID for grouping alternatives. */
  groupId: string;
  /** Source: ai, user, or system. */
  source: 'ai' | 'user' | 'system';
  /** Current status. */
  status: string;
  /** When created. */
  createdAt: string;
  /** Summary text (derived from operations). */
  summary: string;
  /** Operation count. */
  operationCount: number;
  /** Sanitized public findings list. */
  findings: PublicFinding[];
  /** Whether proposal passed validation. */
  passedValidation: boolean;
  /** Whether proposal is stale (dependency mismatch). */
  isStale: boolean;
  /** Actions available to the current user. */
  availableActions: AvailableAction[];
  /** Overridable finding codes (server allowlist). */
  overridableFindingCodes: string[];
}

// =============================================================================
// Override allowlist — server-controlled list of finding codes users may override
// =============================================================================

/**
 * Server-controlled override allowlist.
 * Only findings with codes in this list may be overridden by users.
 */
const OVERRIDE_ALLOWLIST = new Set<string>([
  'structural.repetition',
  'structural.minor_grammar',
  'semantic.unclear_pronoun',
  'continuity.minor_character_detail',
]);

/**
 * Check if a finding code is on the server override allowlist.
 */
export function isOverridable(findingCode: string): boolean {
  return OVERRIDE_ALLOWLIST.has(findingCode);
}

// =============================================================================
// Mapper
// =============================================================================

/**
 * Map domain proposal data to a public-facing view.
 *
 * Strips all service_restricted fields and internal detail.
 * Computes availableActions based on current state.
 */
export function mapToPublicProposalView(
  input: PublicProposalViewInput,
): PublicProposalView {
  const { proposal, group, changeSet, validationReport, projectCanonicalVersion, currentDependencyHash } = input;

  // Extract findings from validation report
  const rawFindings = validationReport?.findings ?? [];

  // Sanitize: only expose publicMessageCode, severity, and whether overridable.
  const publicFindings: PublicFinding[] = rawFindings.map((f) => ({
    code: f.publicMessageCode,
    severity: f.severity,
    overridable: isOverridable(f.code),
  }));

  const passedValidation = validationReport?.passed ?? true;
  const isStale = proposal.dependencyHash !== currentDependencyHash;

  // Compute available actions
  const availableActions = computeAvailableActions({
    status: proposal.status,
    isStale,
    passedValidation,
    hasBlockers: publicFindings.some((f) => f.severity === 'blocker'),
    hasOverridableBlockers: publicFindings.some(
      (f) => f.severity === 'blocker' && f.overridable,
    ),
  });

  // Compute overridable finding codes
  const overridableFindingCodes = rawFindings
    .filter((f) => f.severity === 'blocker' && isOverridable(f.code))
    .map((f) => f.publicMessageCode);

  return {
    id: proposal.id,
    groupId: group.id,
    source: proposal.source,
    status: proposal.status,
    createdAt: proposal.createdAt.toISOString(),
    summary: computeSummary(changeSet),
    operationCount: 0, // populated by caller if needed
    findings: publicFindings,
    passedValidation,
    isStale,
    availableActions,
    overridableFindingCodes,
  };
}

// =============================================================================
// Helpers
// =============================================================================

function computeAvailableActions(state: {
  status: Proposal['status'];
  isStale: boolean;
  passedValidation: boolean;
  hasBlockers: boolean;
  hasOverridableBlockers: boolean;
}): AvailableAction[] {
  const actions: AvailableAction[] = ['view_details'];

  if (state.status !== 'pending') {
    // Terminal states: only view_details
    return actions;
  }

  if (state.isStale) {
    actions.push('revalidate');
    return actions;
  }

  if (state.passedValidation) {
    actions.push('accept', 'reject');
  } else if (state.hasOverridableBlockers) {
    actions.push('override_accept', 'reject', 'revalidate');
  } else {
    actions.push('reject', 'revalidate');
  }

  return actions;
}

function computeSummary(changeSet?: CanonicalChangeSet | null): string {
  if (!changeSet) return 'Proposal without change set';
  if (changeSet.appliedAt) return 'Change set applied';
  if (changeSet.rejectedAt) return 'Change set rejected';
  return 'Pending change set';
}
