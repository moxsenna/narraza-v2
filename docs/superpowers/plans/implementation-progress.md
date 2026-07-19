# Narraza Implementation Progress

## Current milestone
M1 — Schema splits + core pure domain

## Last completed task
M0.5 — dashboard + create project (8 tests)

## Current task
M1.1a/b migrations + M1.2–M1.5 core domain (parallel)

## Tests currently green
- `@narraza/shared` env parsers (5) — `env-boundary`
- `@narraza/application` auth-challenge (12) — `challenge-cap`, magic-link prepare/consume
- `@narraza/application` create-project (8)
- Total: 25 tests

## Known failures
- none
- Note: web tsc has pre-existing workspace import path noise; Next runtime OK

## Decisions made
- Workspace: `D:/Coding/Narraza Fix/narraza v2`
- Postgres host port **5433** (5432 taken by alie-postgres)
- Jobs/leases → M3.0 only
- foundation.propose always available after concept
- Signup grant on first consume provisioning
- Env pick-then-parse
- Node engines `>=22` (host Node 24)
- Auth Secure cookie flag deferred (local HTTP); production must set Secure
- Max-3 challenge cap race accepted for M0; tighten with txn later if needed

## Next exact command
Continue M1: canon migration + packages/core writer-packet TDD

## Git status
```
b91f607 feat(web): start paths and dashboard project list
d23a085 feat(auth): two-step magic link with challenge cap and signup grant
6e9bcdc feat(db): m0 identity session challenge project
adc60cd feat(shared): explicit env pick parsers and public errors
33fc9ab chore: init monorepo workspace
d19c22e docs(spec): add locked design S1-S10, verification matrix, PRD
f9defe2 docs(plan): make Narraza implementation plan executable
```
Working tree clean after progress journal commit.

## M0 gate
✅ shared env, challenge suite, create+list project — all green. M0 closed.
