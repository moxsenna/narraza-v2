# Narraza Implementation Progress

## Current milestone
M3 — Jobs, credit, S8 reliability

## Last completed task
M2.4 — user-origin character upsert

## Current task
M3.0 — Migration jobs/credits/outbox

## Tests currently green
- `@narraza/shared` (5)
- `@narraza/core` (67) — writer-packet, dependency-hash, stale-policy, expression, belief, disclosure, repair, merge-findings, readiness
- `@narraza/db` (11) — m1-schema, unit-of-work
- `@narraza/application` (46) — auth, project, active-user, foundation, character
- architecture: no violations
- **Total: 129 tests**

## Known failures
- none
- Vitest Node 24: use `--pool=forks --poolOptions.forks.singleFork=true`
- Postgres host port 5433

## Decisions made
- Workspace: `D:/Coding/Narraza Fix/narraza v2`
- M1 migrations combined into single `m1_all_canon_prose`
- M2 minimal `commitUserFoundationChange` path (full commitCanonicalChangeSet expands M5)
- Jobs/leases start M3.0
- foundation.propose always available after concept
- Signup grant on first consume provisioning
- Env pick-then-parse

## Next exact command
Implement M3.0 schema migration for jobs/credits/outbox, then reliability suite.

## Git status (tip)
```
129636f feat(application): user-origin character upsert
724d9e3 feat(application): foundation edit and lock
c224740 feat(application): active user guard and owned locks
1d8f8fd feat(db): serializable unit of work
```

## Milestone gates
- M0 ✅
- M1 ✅
- M2 ✅ (create project → edit foundation → lock confirm → add character)
- M3 in progress
