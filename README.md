# Narraza v2

**AI Serial Fiction Production OS** — modular monolith (Next.js + Postgres + workers).

## Project status

**Production-shaped vertical slice — not production-ready.**

Trust gate (P0) focus: real CI on `master`, hard quality gates, no silent mock AI in production, real Reveal Policy, root docs.

Safe writing pipeline (P1) expands readiness + deterministic validators before prose accept.

Known limitations: see [Known limitations](#known-limitations).

## Architecture (short)

```
apps/
  web/              Next.js UI + Server Actions (composition root: app/lib/server)
  worker-gen/       Generation job worker (lease, heartbeat, dispatch)
  worker-outbox/    Outbox delivery worker
packages/
  core/             Pure domain policies + validators (no AI/DB/HTTP)
  application/      Use cases, authz, job executors
  ai/               AIExecutionPort + prompt contracts (mock | production)
  db/               Prisma unit-of-work + repositories
  shared/           Env parsers, public errors
prisma/             Schema + migrations
e2e/                Playwright
```

Domain rules: accepted prose is continuation source; canon changes only via controlled change sets; writer receives **allowlist** context (`writer-packet`), never raw restricted truth.

## Prerequisites

- Node.js **≥ 22**
- npm (workspaces)
- Docker (Postgres via `docker-compose.yml`)
- Git

## Environment variables

Copy `.env.example` → `.env`.

| Variable | Used by | Notes |
| --- | --- | --- |
| `DATABASE_URL_WEB` | web | Postgres URL |
| `DATABASE_URL_WORKER` | worker-gen | Postgres URL |
| `DATABASE_URL_OUTBOX` | worker-outbox | Postgres URL |
| `DATABASE_URL` | Prisma CLI / CI | Same DB OK for local |
| `AUTH_SECRET` | web | Session signing (≥32 chars) |
| `AUTH_URL` | web | e.g. `http://localhost:3000` |
| `EMAIL_FROM` | web | Magic-link sender |
| `EMAIL_CHALLENGE_PEPPER` | web | Challenge hashing |
| `RATE_LIMIT_PEPPER` | web | Rate limit hashing |
| `SIGNUP_GRANT_MICRO_IDR` | web | New-user credit grant |
| `MAIL_TRANSPORT` | web | `file` for local |
| `MAIL_FILE_DIR` | web | Default `.data/mail` |
| `ARTIFACT_STORAGE_PATH` | worker-gen | Default `.data/artifacts` |
| `AI_ENABLE_MOCK` | web + worker-gen | `true` only for dev/test/CI |
| `OPENROUTER_API_KEY` | worker-gen (prod AI) | **Required** when mock off |
| `GEMINI_API_KEY` | optional | Alternate routing |
| `NODE_ENV` | all | `production` forbids `AI_ENABLE_MOCK=true` |

### Mock AI vs production AI

- **Mock:** `AI_ENABLE_MOCK=true` and `NODE_ENV` ≠ `production`. Deterministic contract-shaped JSON. Used in CI and local vertical slice.
- **Production:** `AI_ENABLE_MOCK` unset/false + valid `OPENROUTER_API_KEY`. Factory `createAIExecutionPort()` **fail-fast** — no silent mock fallback.
- Composition: web uses `apps/web/app/lib/server/ai.ts`; worker-gen uses `createAIExecutionPort()` in `apps/worker-gen/src/main.ts`.

## Database setup

```bash
# Start Postgres (host port 5433 → container 5432)
docker compose up -d

# Generate client + apply migrations
npm run db:generate
npx prisma migrate deploy --schema prisma/schema.prisma
# or interactive:
# npm run db:migrate
```

Default URL in `.env.example`:

`postgresql://narraza:narraza@localhost:5433/narraza`

## Install

```bash
npm ci
npm run db:generate
```

## Run web

```bash
# Ensure .env has AI_ENABLE_MOCK=true for local mock AI
npm run dev
# → http://localhost:3000
```

## Run workers

```bash
# Terminal A — generation worker
npx tsx apps/worker-gen/src/main.ts

# Terminal B — outbox worker
npx tsx apps/worker-outbox/src/main.ts
```

Worker-gen reads `AI_ENABLE_MOCK` / `OPENROUTER_API_KEY` / `NODE_ENV` and builds the AI port via fail-fast factory.

## Test, build, E2E

```bash
# Unit + package tests
npm test

# Typecheck all workspaces
npm run typecheck

# Architecture boundaries
npm run architecture

# Build all workspaces (incl. Next)
npm run build

# E2E (Postgres up, migrations applied, mock AI)
npm run test:e2e
```

CI (`.github/workflows/ci.yml`) on **push/PR to `master`**: lint-typecheck, unit, integration, architecture, migration, security-smoke, contract, e2e. **No soft-fail** (`continue-on-error` / `|| true` removed from release gates).

## Branch protection (GitHub settings)

Documented recommendation (apply in GitHub repo settings if you have admin access):

1. Protect branch **`master`**.
2. Require pull request before merge (at least 1 review recommended).
3. Require status checks to pass before merge — mark required:
   - `Lint & Typecheck`
   - `Unit Tests`
   - `Integration Tests`
   - `Architecture Boundaries`
   - `Migration (empty + drift)`
   - `Security Smoke`
   - `Contract Tests`
   - `E2E (Playwright)`
4. Do **not** allow bypass of required checks for administrators in production repos.
5. Disallow force-push to `master`.

If settings access is unavailable, keep this checklist in PRs until an admin applies it.

## Known limitations

- Outbox delivery handler still mock-success (not production event delivery).
- Foundation readiness expanded in P1; older callers may only supply partial foundation body fields.
- Real AI provider path exists but needs live keys + contract-aligned model output to pass production jobs.
- E2E historically green locally; CI must prove it on `master` after this trust gate.
- No root production deploy proof from this README alone — use `deploy/` scripts + staging workflow.

## Docs

- PRD: `docs/Narraza_v2_PRD_Rilis_1.md`
- Design: `docs/superpowers/specs/`
- Audits: `docs/audits/`
