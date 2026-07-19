# P0 — Trust Gate Report

**Date:** 2026-07-20  
**Branch:** `master`  
**Repo:** narraza-v2  

## Summary

P0 trust gate implemented: CI targets `master` with hard gates, mock AI removed from production composition paths, Reveal Policy implemented with unit tests, root README + branch protection docs added.

## Files changed

### CI / docs
- `.github/workflows/ci.yml` — triggers `master`; removed `continue-on-error` and `|| true` soft-fails; E2E runs on push+PR
- `README.md` — root project status, architecture, env, runbooks, mock vs production AI, known limitations
- `docs/BRANCH_PROTECTION.md` — required checks + protection settings
- `.env.example` — AI mock/production notes
- `e2e/playwright.config.ts` — force `AI_ENABLE_MOCK=true` for webServer; clean server under CI

### AI composition
- `packages/ai/src/create-ai-execution-port.ts` — fail-fast factory
- `packages/ai/src/production-execution-port.ts` — OpenRouter production port
- `packages/ai/src/index.ts` — exports factory + production port
- `packages/ai/src/__tests__/create-ai-execution-port.test.ts`
- `apps/worker-gen/src/main.ts` — uses `createAIExecutionPort`; requires `DATABASE_URL_WORKER`
- `apps/worker-outbox/src/main.ts` — requires `DATABASE_URL_OUTBOX` (type fix)
- `apps/web/app/lib/server/ai.ts` — web composition root for AI
- `apps/web/app/projects/[projectId]/intake/page.tsx`
- `apps/web/app/projects/[projectId]/outline/page.tsx`
- `apps/web/app/projects/[projectId]/write/page.tsx`
- `apps/web/package.json` — add `@narraza/ai` dependency
- `apps/web/tsconfig.json` — Bundler resolution (Next-compatible)

### Reveal policy
- `packages/core/src/reveal-policy.ts` — real classification (revealed/scheduled/hidden)
- `packages/core/src/__tests__/reveal-policy.test.ts` — ch3 vs ch25 + writer packet leak proof
- `packages/core/src/index.ts` — export `applyRevealPolicy` / `classifyFactsForWriter`

### Web type gate fixes (needed once soft-fail removed)
- `apps/web/app/lib/server/project-reads.ts` — `proposalGroup` relation
- `apps/web/app/projects/[projectId]/concepts|proposals|outline|write/page.tsx` — UoW arity + beat write input
- `apps/web/app/ready/route.ts` — exactOptionalPropertyTypes for draining check

## Problems fixed

| Issue | Fix |
| --- | --- |
| CI only on `main` while default branch is `master` | Trigger `push`/`pull_request` on `master` |
| Soft-fail gates (`continue-on-error`, `next build \|\| true`) | Removed; gates fail hard |
| Hardcoded `createMockAIExecutionPort()` in worker-gen + web pages | `createAIExecutionPort` / `createWebAIExecutionPort` with env fail-fast |
| Production silent mock risk | `NODE_ENV=production` + mock → throw; mock off without key → throw |
| `reveal-policy.ts` stub | Full `applyRevealPolicy` with schedule/breadcrumb rules |
| Missing root README | Added |
| Branch protection undocumented | `docs/BRANCH_PROTECTION.md` |

## Commands run (local)

| Command | Result |
| --- | --- |
| `npm run typecheck` | **PASS** (exit 0) |
| `npm test` | **PASS** — 326 tests, 30 files |
| `npm run architecture` | **PASS** — 0 violations |
| `npm run build -w @narraza/web` | **PASS** — Next.js production build |
| `npm run test -w @narraza/core` | **PASS** — includes 6 reveal-policy tests |
| `npm run test -w @narraza/ai` | **PASS** — includes factory fail-fast tests |
| `npm run test -w @narraza/shared` | **PASS** — env boundary |
| `CI=true AI_ENABLE_MOCK=true npm run test:e2e` | **PASS** — **8/8** Playwright |

### Soft-fail invariant

- `continue-on-error` absent from `ci.yml`
- `|| true` absent from release-gate steps in `ci.yml`
- Hardcoded mock AI absent from apps (only factory + tests)

### Reveal / writer safety proof

`packages/core/src/__tests__/reveal-policy.test.ts`:
- Chapter 3 + major reveal scheduled chapter 25 → truth not in writer-safe surfaces
- Writer packet JSON never contains hidden future truth
- Chapter 25 → full surface becomes writer-safe

## CI evidence

Workflow is configured for `master`. Local gates green.

**Remote CI run:** push this commit to `origin/master` to materialize Actions runs. After first green run, mark required checks per `docs/BRANCH_PROTECTION.md`.

If this report is committed before push, CI status will be filled in after Actions completes:

- Actions URL: `https://github.com/moxsenna/narraza-v2/actions`
- Expected jobs: Lint & Typecheck, Unit Tests, Integration Tests, Architecture Boundaries, Migration, Security Smoke, Contract Tests, E2E (Playwright)

## Known limitations remaining

1. Outbox delivery still mock-success (not real external delivery).
2. Production AI port calls OpenRouter; live contract-shaped model output not proven end-to-end without keys.
3. Foundation readiness still shallow until P1 (title/premise-centric path remains until P1 expands).
4. Branch protection must be applied by a GitHub admin (documented only).
5. E2E historically sensitive to stale `.next` (vendor-chunks); CI uses clean checkout so this is mitigated on runners.

## Verdict

**P0 local acceptance: PASS** (typecheck, unit, architecture, build, contract/shared, E2E 8/8, no soft-fail, no production mock hardcode, reveal policy real + tested, README present).

Remote CI appearance depends on push to `master`.
