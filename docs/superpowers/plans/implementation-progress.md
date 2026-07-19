# Narraza Implementation Progress

## Current milestone
M4 — AI contracts + backend vertical slice + S7 extraction

## Last completed task
M3.12 — reliability gate green (87 application tests)

## Current task
M4.1 — AIExecutionPort + mock provider + buildWorkflowPlan

## Tests currently green
- `@narraza/shared` (5)
- `@narraza/core` (67)
- `@narraza/db` (11)
- `@narraza/application` (87) including full M3 reliability gate
- architecture: no violations
- **~170 tests**

## M3 gate matrix (all green)
- lease-fence-publish, job-terminal, exec-retry
- reservation-exposure, invocation-winner, late-attempt
- outbox-idempotent, outbox-uncertain-delivery, outbox-replay-generation
- cancel-queued, retry-new-job, tombstone-mid-attempt

## Known failures
- none
- Vitest Node 24: `--pool=forks --poolOptions.forks.singleFork=true`
- Postgres host port 5433

## Decisions made
- Workspace: `D:/Coding/Narraza Fix/narraza v2`
- Outbox receipt can complete from `uncertain` (re-drive after side-effect failure)
- Jobs/leases land M3.0; full reliability M3.1–M3.12
- Mock AI uses full production pipeline (starts M4)

## Next exact command
Implement packages/ai mock provider + M4.3 extraction layer + intake/concept/outline/beat pipelines.

## Milestone gates
- M0 ✅
- M1 ✅
- M2 ✅
- M3 ✅
- M4 in progress

## Git tip
```
fix(m3): outbox re-drive from uncertain...
984e8f0 test(m3): reliability gate green with mock job
17d23f6 feat(workers): gen and outbox processes with graceful drain
```
