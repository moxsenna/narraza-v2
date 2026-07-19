import type { MergeFindingsInput, MergeFindingsResult, Finding } from '../types.js';
export type { MergeFindingsInput, MergeFindingsResult };

/**
 * Merge deterministic and AI findings.
 *
 * Rules:
 * - AI findings can only ADD; they cannot remove or downgrade deterministic blockers
 * - Deterministic blockers are preserved regardless of AI output
 * - passed = no blocking findings in the merged set
 */
export function mergeFindings(input: MergeFindingsInput): MergeFindingsResult {
  const conflicts: string[] = [];

  // Build merged set: deterministic findings always take precedence
  const findingsMap = new Map<string, Finding>();

  // First add AI findings
  for (const f of input.aiFindings) {
    findingsMap.set(f.code, { ...f });
  }

  // Then overlay deterministic findings (they override AI findings with same code)
  for (const df of input.deterministicFindings) {
    findingsMap.set(df.code, { ...df });
  }

  // Check that AI findings didn't try to remove or downgrade deterministic blockers
  const deterministicBlockerCodes = new Set(
    input.deterministicFindings
      .filter((f) => f.severity === 'blocker')
      .map((f) => f.code),
  );

  for (const df of input.deterministicFindings) {
    if (df.severity === 'blocker') {
      // Check if AI tried to suppress this code
      const aiMatching = input.aiFindings.find((af) => af.code === df.code);
      if (aiMatching) {
        if (aiMatching.severity !== 'blocker') {
          conflicts.push(
            `AI finding for '${df.code}' attempted to downgrade severity from blocker to ${aiMatching.severity}. Deterministic blocker preserved.`,
          );
        }
      }
    }
  }

  const findings = [...findingsMap.values()];

  // If any deterministic blocker is not in AI findings, note it
  for (const df of input.deterministicFindings) {
    if (df.severity === 'blocker') {
      const aiHas = input.aiFindings.some((af) => af.code === df.code);
      if (!aiHas) {
        conflicts.push(
          `Deterministic blocker '${df.code}' was not present in AI findings. Added.`,
        );
      }
    }
  }

  const passed = findings.every((f) => f.severity !== 'blocker');

  return { findings, passed, conflicts };
}
