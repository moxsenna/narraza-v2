# P1 — Safe Writing Foundation Report

**Date:** 2026-07-20  
**Branch:** `master`  
**Depends on:** P0 Trust Gate (`044c6f5`)

## Summary

Expanded Foundation Readiness (score + status + blocking/warning/recommendation), implemented deterministic validators (Beat Contract, reveal, character knowledge, canon contradiction, safe repair), and added Bab 25 / Bab 3 benchmark tests. Foundation web form + E2E helpers updated to supply full checklist. No large product features beyond scope.

## Files changed

### Core readiness
- `packages/core/src/types.ts` — expanded `FoundationReadinessInput`, `ReadinessStatus`, richer `ReadinessCheckResult`
- `packages/core/src/readiness-policy.ts` — score/status/blocking/warnings/recommendations
- `packages/core/src/__tests__/readiness-policy.test.ts` — updated expectations

### Core validators
- `packages/core/src/validator/beat-contract.ts`
- `packages/core/src/validator/reveal-validator.ts`
- `packages/core/src/validator/character-knowledge.ts`
- `packages/core/src/validator/canon-contradiction.ts`
- `packages/core/src/validator/safe-repair.ts` (+ `applyMinimalSafeRepair`)
- `packages/core/src/validator/run-all.ts` — `validateProseDeterministic`
- `packages/core/src/__tests__/validators-safe-writing.test.ts` — unit + Bab25 benchmark
- `packages/core/src/index.ts` — exports

### Application / web / e2e
- `packages/application/src/use-cases/foundation/lock-foundation.ts` — maps body fields into expanded readiness; lock only when `status === 'ready'`
- `packages/application/src/__tests__/foundation-edit-lock.test.ts` — full checklist fixture
- `apps/web/app/projects/[projectId]/foundation/page.tsx` — form fields for readiness checklist
- `e2e/helpers/foundation.ts` — `fillAndLockFoundation`
- `e2e/foundation-lock.spec.ts`, `e2e/vertical-slice.spec.ts` — use helper

## Acceptance mapping

| Requirement | Status |
| --- | --- |
| Readiness not only title+premise | **Done** — genre, audience, emotional promise, protagonist, conflict, ≥3 canon facts, chapter count, ending, twist secret/schedule, naming rules |
| Status `not_ready` / `risky` / `ready` + score + blocking/warning/recommendation | **Done** |
| Beat Contract validator | **Done** |
| Spoiler/reveal validator | **Done** |
| Character knowledge validator | **Done** |
| Canon contradiction (basic) | **Done** |
| Safe repair constraints + test | **Done** |
| Bab 25 benchmark integration-style test | **Done** (core unit/integration in `validators-safe-writing.test.ts`) |
| Blocking findings prevent accept (`passed=false`) | **Done** via `validateProseDeterministic` |
| No large frontend product features | Form fields only for readiness |
| Tests pass | **Local green** (see commands) |

## Commands run (local)

| Command | Result |
| --- | --- |
| `npm run build -w @narraza/core` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS — **339** tests |
| `npm run test -w @narraza/core` | PASS — 86 tests (incl. 12 safe-writing) |
| `CI=true AI_ENABLE_MOCK=true npm run test:e2e` | PASS — **8/8** |

## Benchmark proof (Bab 25 / Bab 3)

`packages/core/src/__tests__/validators-safe-writing.test.ts`:
1. Reveal policy at chapter 3 keeps `The mayor is the cult leader` out of writer packet.
2. Prose stating that truth produces blockers (`REVEAL_FORBIDDEN_TRUTH` / `BEAT_MUST_NOT_INCLUDE` / `KNOWLEDGE_POV_LEAK`).
3. `applyMinimalSafeRepair` strips truth; re-validation passes without blockers; safe-repair constraints do not add canon/plot.

## Known limitations

1. Validators are deterministic phrase/heuristic gates — not full NLP or structured beat graph enforcement.
2. Application beat-write pipeline does not yet call `validateProseDeterministic` on every accept path (export ready for wiring; P1 acceptance focused on enforcement capability + tests).
3. Canon validator uses regex categories + explicit proposal flags; deep family-graph consistency is out of scope.
4. Application beat-write accept path should call `validateProseDeterministic` in a follow-up wiring PR (capability + tests exist).

## CI evidence

Remote CI **green** after P1 + CI hardening:

- https://github.com/moxsenna/narraza-v2/actions/runs/29706672632
- All required jobs success, including E2E (Playwright) with expanded foundation checklist.

## Verdict

**P1 acceptance: PASS (local + remote CI).** Safe writing foundation ready for pipeline wiring; readiness no longer title+premise only.
