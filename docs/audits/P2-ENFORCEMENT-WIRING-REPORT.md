# P2 — Enforcement Wiring Report

**Date:** 2026-07-20  
**Branch:** `master`  
**Depends on:** P0 Trust Gate + P1 Safe Writing

## Summary

Deterministic validators are now **enforcement**, not optional helpers.

- Every `prose_accept` path requires a current ValidationReport.
- Blockers without server allowlist override → accept rejected by backend.
- Reports bind content + context snapshot + validator version.
- Safe repair creates a **new** ProseVersion (original preserved).
- Integration test proves leak → block → repair → accept → original intact.

## Files changed

| File | Role |
| --- | --- |
| `packages/application/src/use-cases/proposals/prose-validation-gate.ts` | Run validators, persist report, binding hash, accept eligibility assert |
| `packages/application/src/use-cases/proposals/create-repair-prose-version.ts` | Repair as new ProseVersion + re-validate |
| `packages/application/src/use-cases/proposals/accept-proposal.ts` | Fail-closed gate on all `prose_accept` ops |
| `packages/application/src/use-cases/proposals/submit-user-prose.ts` | Snapshot draft → ProseVersion → validate → proposal payload with binding |
| `packages/application/src/use-cases/jobs/request-beat-write.ts` | Validate generated/repaired prose on job complete |
| `packages/application/src/index.ts` | Export P2 APIs |
| `packages/application/src/__tests__/p2-enforcement-wiring.test.ts` | Unit + integration enforcement |
| `packages/application/src/__tests__/m5-accept-working-draft-progress.test.ts` | In-mem ports + accept fixtures for validation |

## Accept path coverage

| Path | Enforcement |
| --- | --- |
| Accept AI-generated prose (via `prose_accept` change set) | Report required; blockers block |
| Accept regenerate (same op type) | Same gate |
| Accept repair version | New version + new report; gate on accept |
| Accept user-edited prose (`submitUserProse`) | Validate at submit; gate at accept |
| Accept imported / version history prose | Must go through `prose_accept` + report (no bypass) |
| Structure-only proposals (no prose content) | Gate skipped (no `prose_accept` content) |

Chapter close is not a separate accept API in this repo; chapter outline updates already reject when beats have accepted prose (`outline-downstream`).

## Validation report fields (persisted)

Schema `ValidationReport` (existing):

- `proseVersionId`
- `candidateId`
- `passed`
- `findings` (JSON) — includes meta finding `META_VALIDATOR_CONTEXT` with:
  - `validatorVersion` (`p2-deterministic-v1`)
  - `contextSnapshotHash`
  - `chapterNumber`, `beatId`
- `contentHash` — **binding hash** = sha256(content + contextSnapshot + validatorVersion)
- `createdAt` (= validatedAt)

Override: caller passes `overrides[]` of allowlisted codes; non-overridable blockers always block.

## Blocking rules

```
blocker → accept rejected (unless allowlisted + listed in overrides)
warning → accept allowed (user review is product UX; backend does not require override for warnings)
info    → no block
missing/stale report on prose_accept → reject
```

## Repair as new version

`createRepairProseVersion`:

1. Load original ProseVersion
2. Apply `applyMinimalSafeRepair` (or explicit repaired content)
3. `proseVersionRepo.nextVersion` + `create` — **never overwrite**
4. `runAndPersistProseValidation` on repair
5. Return both IDs for comparison UI

## Stale validation

Report invalid when binding hash mismatches:

- prose content changed
- context snapshot changed (forbidden truths, beat contract, knowledge, canon, chapter number)
- validator version bumped (`PROSE_VALIDATOR_VERSION`)

## Tests

| Suite | Result |
| --- | --- |
| `p2-enforcement-wiring.test.ts` | 4/4 pass |
| `m5-accept-working-draft-progress.test.ts` | 29/29 pass |
| Full `@narraza/application` | run in commit verification |

### Mandatory scenario (proved)

```
Leaky generated/user prose with major reveal
→ validateProseDeterministic blockers
→ ValidationReport.passed=false
→ acceptProposal throws VALIDATION
→ createRepairProseVersion → new version without truth
→ re-validation passed
→ accept repaired proposal
→ original ProseVersion content still contains truth (preserved)
```

## Known limitations

1. Beat job validation uses payload `forbiddenTruths` / `validationContext` when present; empty context still runs structural validators only.
2. No new Prisma migration — binding meta stored in findings JSON + contentHash reuse (documented).
3. Frontend Write Room does not yet surface override UX; backend already enforces.
4. Full Playwright E2E for accept/repair flow not added (integration covers backend enforcement).

## Verdict

**P2 local acceptance: PASS.** Validators cannot be skipped on prose accept. Safe writing is now an enforcement path, not a folder of unused policies.
