# Narraza Implementation Progress

## Current milestone
M7 — Staging CI + deploy scripts + readiness endpoints

## Last completed task
M7.8 — Smoke vertical slice script + ecosystem.config.cjs + nginx.conf.example + backup.sh

## Current task
M8.1 — Production deploy workflow with manual approval

## Tests currently green
- `@narraza/shared` (5)
- `@narraza/core` (67)
- `@narraza/db` (27) — including migrate-upgrade (16 tests)
- `@narraza/application` (148) — M0–M5 including accept, extraction, reliability
- `@narraza/ai` (28)
- `deploy` (22) — checksum verification (8) + readiness checks (14)
- architecture: no violations
- **297 tests**

## M7 additions
- `.github/workflows/ci.yml` — lint, typecheck, unit, integration, architecture, migration, security-smoke, contract, e2e
- `.github/workflows/deploy-staging.yml` — manual dispatch with environment approval
- `deploy/build-release.mjs` — immutable tarball + sha256 manifest
- `deploy/drain-workers.sh` — graceful drain with timeout
- `deploy/release.sh` — fetch → checksum → backup → drain → migrate → symlink → restart → smoke
- `deploy/smoke.sh` — curl health, ready, web pages, APIs
- `deploy/ecosystem.config.cjs` — PM2 with least-privilege secrets
- `deploy/nginx.conf.example` — TLS reverse proxy with health checks
- `deploy/backup.sh` — pg_dump + manifest retention
- `/health` — no DB, returns ok + uptime
- `/ready` — env + DB + migration version + draining; 503 if not ready
- Worker draining persistence on SIGTERM/SIGINT

## Failure tests (new)
- Checksum mismatch → abort (verified in deploy/__tests__/build-release.test.ts)
- Readiness fails without DATABASE_URL (verified in deploy/__tests__/readiness.test.ts)
- Migration folder must be non-empty, naming convention enforced
- Prisma CLI available check

## Known failures
- none open
- Vitest Node 24: `--pool=forks --poolOptions.forks.singleFork=true`
- Postgres host port 5433

## Decisions made
- Workspace: `D:/Coding/Narraza Fix/narraza v2`
- Mock AI full production pipeline
- UI must call real application commands (no UI shortcut mocks)

## Next exact command
Implement M8 production readiness: deploy-production.yml, migration advisory lock, backup restore-verify

## Milestone gates
- M0 ✅
- M1 ✅
- M2 ✅
- M3 ✅
- M4 ✅
- M5 ✅
- M6 ✅
- M7 ✅

## Git tip
```
72c5037 feat(workers): instance heartbeat and draining persistence
e633dc9 test(staging): smoke vertical slice script
377661b ci: staging deploy workflow
d3be2a8 test(db): migrate empty N-1 and drift detection
7d8b668 feat(web): health and readiness endpoints
9c530cb feat(deploy): release drain backup scripts
f382571 feat(deploy): build release artifact and manifest
748cdf6 ci: pull request workflow with full gates
```
