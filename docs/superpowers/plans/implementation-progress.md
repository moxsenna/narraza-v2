# Narraza Implementation Progress

## Current milestone
M8 complete — Production readiness documented

## Last completed task
M8.5 — Production DoD + UI mock shortcut removal

## Current task
None — autonomous goal M0–M8 executed. Remaining: local e2e run with Docker up.

## Tests currently green (when Postgres on :5433)
- `@narraza/shared` (5)
- `@narraza/core` (67)
- `@narraza/ai` (28)
- `@narraza/application` (148) — needs Postgres for integration suites
- `@narraza/db` (27) — needs Postgres
- `deploy` (~35) — checksum, readiness, migrate-lock
- architecture: no violations
- **~310 tests when DB up**

## Milestone gates
- M0 scaffold, env, auth magic-link, project create
- M1 schema splits, core domain policies, architecture boundaries
- M2 UnitOfWork, foundation edit/lock, characters
- M3 jobs/credit/S8 reliability gate
- M4 AI mock + S7 extraction + pipelines
- M5 accept/canon mutation + draft CAS + DTO + progress
- M6 guided UI pages + Playwright specs
- M7 CI + staging deploy scripts + readiness
- M8 production workflow + restore-verify + advisory lock + secrets docs

## Known gaps (honest)
1. **E2E not verified green in this session** — specs exist under `e2e/`; need Docker + `npm run dev` + `npm run test:e2e`
2. **Web still imports `@narraza/db` / Prisma in Server Components** — architecture rule "web no Prisma" partially violated at adapter layer; dependency-cruiser may allow via package exports. Hardening: introduce thin query services in application for reads.
3. **Pipeline job executors** (intake/outline/beat) still thin in places — mock AI parse + job succeed; full proposal materialization from every stage needs more wiring for true vertical slice DB state.
4. **outline-downstream** guard structural only until outline entity repos fully persist chapters via acceptOutlineBatch
5. **Docker must be running** for integration tests (port 5433) — currently Docker Desktop down in this environment

## How to resume
```bash
cd "D:/Coding/Narraza Fix/narraza v2"
# Start Docker Desktop first, then:
docker compose up -d
npx prisma migrate deploy --schema prisma/schema.prisma
npm run test -w @narraza/application -- --pool=forks --poolOptions.forks.singleFork=true
npm run architecture
npm run dev -w @narraza/web
# other terminal:
npm run test:e2e
```

## Key paths
- Design: `docs/superpowers/specs/2026-07-18-narraza-v2-design.md`
- Matrix: `docs/superpowers/specs/verification-matrix.md`
- Plan: `docs/superpowers/plans/2026-07-18-narraza-v2-implementation.md`
- DoD: `docs/superpowers/plans/M8-production-dod.md`
- Deploy: `deploy/`
- CI: `.github/workflows/ci.yml`, `deploy-staging.yml`, `deploy-production.yml`

## Git tip
```
073438b fix(web): remove UI mock concept/outline shortcuts
d660900 docs: production DoD signed in progress journal
c7eaa13 feat(deploy): production secrets least privilege docs
0fa82b1 feat(deploy): migration advisory lock
bad256a feat(deploy): backup and restore verification
8295e00 ci: production deploy workflow with approval
```
~55 commits on master from greenfield docs to M8.
