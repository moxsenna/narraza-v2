# Narraza v2 — Production Secrets (Least Privilege)

> **IMPORTANT:** This file documents the **names** of required environment variables per process.
> **No real secret values are stored here.** Actual secrets are managed via
> GitHub Environment secrets, VPS env files, or a secrets manager.

## Principle (Design S6.3, M8.4)

Each process receives **only** the secrets it needs to function.
If a single process is compromised, the blast radius is limited to its scope.
No process receives the full secret set.

---

## Process: narraza-web

**What it does:** Next.js server — handles HTTP, auth, user-facing pages, Server Actions.

**Required environment variables:**

| Variable | Purpose | Sensitivity |
|---|---|---|
| `DATABASE_URL_WEB` | PostgreSQL connection (web-only DB user) | HIGH |
| `AUTH_SECRET` | Auth.js session signing key (min 32 chars) | CRITICAL |
| `AUTH_URL` | Public base URL of the web app | LOW |
| `EMAIL_FROM` | From header for magic link emails | LOW |
| `EMAIL_CHALLENGE_PEPPER` | HMAC pepper for email challenge tokens (min 32 chars) | CRITICAL |
| `RATE_LIMIT_PEPPER` | HMAC pepper for rate limit tokens (min 32 chars) | CRITICAL |
| `SIGNUP_GRANT_MICRO_IDR` | Initial credit grant in micro-IDR (e.g., 5000000000) | LOW |
| `MAIL_TRANSPORT` | Email transport: `file` (dev) or `smtp` (prod) | LOW |
| `MAIL_FILE_DIR` | Directory for file-based mail transport | LOW |

**Must NOT have access to:**
- `DATABASE_URL_WORKER` (worker-gen DB)
- `DATABASE_URL_OUTBOX` (outbox worker DB)
- `OPENROUTER_API_KEY` (AI provider)
- `GEMINI_API_KEY` (AI provider)
- `ARTIFACT_STORAGE_PATH` (worker storage)

---

## Process: narraza-worker-gen

**What it does:** Generation job worker — picks up jobs from `generation_jobs`,
calls AI providers (OpenRouter/Gemini), processes results.

**Required environment variables:**

| Variable | Purpose | Sensitivity |
|---|---|---|
| `DATABASE_URL_WORKER` | PostgreSQL connection (worker-gen DB user) | HIGH |
| `ARTIFACT_STORAGE_PATH` | Directory for storing generated artifacts | MEDIUM |
| `AI_ENABLE_MOCK` | `true` to use mock provider (dev only; forbidden in production) | LOW |
| `OPENROUTER_API_KEY` | OpenRouter API key | CRITICAL |
| `GEMINI_API_KEY` | Google Gemini API key | CRITICAL |
| `WORKER_GEN_POLL_MS` | Poll interval in ms (default: 1000) | LOW |
| `WORKER_GEN_LEASE_MS` | Job lease duration in ms (default: 60000) | LOW |
| `WORKER_GEN_HEARTBEAT_MS` | Heartbeat interval in ms (default: 15000) | LOW |

**Must NOT have access to:**
- `DATABASE_URL_WEB` (web DB)
- `DATABASE_URL_OUTBOX` (outbox worker DB)
- `AUTH_SECRET` (session signing)
- `EMAIL_CHALLENGE_PEPPER` (magic link tokens)
- `RATE_LIMIT_PEPPER` (rate limiting)
- `EMAIL_FROM`, `MAIL_TRANSPORT`, `MAIL_FILE_DIR` (email)
- `SIGNUP_GRANT_MICRO_IDR` (credit grants)

---

## Process: narraza-worker-outbox

**What it does:** Outbox consumer — processes `outbox_events` and delivers them
to external systems.

**Required environment variables:**

| Variable | Purpose | Sensitivity |
|---|---|---|
| `DATABASE_URL_OUTBOX` | PostgreSQL connection (outbox-only DB user) | HIGH |
| `WORKER_OUTBOX_POLL_MS` | Poll interval in ms (default: 1000) | LOW |
| `WORKER_OUTBOX_HEARTBEAT_MS` | Heartbeat interval in ms (default: 15000) | LOW |

**Must NOT have access to:**
- `DATABASE_URL_WEB` (web DB)
- `DATABASE_URL_WORKER` (worker-gen DB)
- `AUTH_SECRET` (session signing)
- `OPENROUTER_API_KEY` (AI provider)
- `GEMINI_API_KEY` (AI provider)
- `EMAIL_CHALLENGE_PEPPER`, `RATE_LIMIT_PEPPER` (peppers)
- `EMAIL_FROM`, `MAIL_TRANSPORT`, `MAIL_FILE_DIR` (email)
- `SIGNUP_GRANT_MICRO_IDR` (credit grants)
- `ARTIFACT_STORAGE_PATH` (worker storage)

---

## Database Users (Recommended)

For true least-privilege at the database level, use separate Postgres roles:

| Role | Access | Used By |
|---|---|---|
| `narraza_web` | SELECT/INSERT/UPDATE/DELETE on user-facing tables | narraza-web |
| `narraza_worker` | SELECT/INSERT/UPDATE on job/attempt/workflow tables | narraza-worker-gen |
| `narraza_outbox` | SELECT/UPDATE on outbox_events only | narraza-worker-outbox |
| `narraza_migrator` | Full DDL (migrations only, never running process) | Release script |

If separate DB users are not configured, the `DATABASE_URL_WEB`,
`DATABASE_URL_WORKER`, and `DATABASE_URL_OUTBOX` environment variables
can point to the same database but with different connection strings
to enable future separation.

---

## Deployment Checklist

Before deploying to production, verify:

- [ ] `AUTH_SECRET` is a unique random string (min 32 chars), not shared with staging
- [ ] `EMAIL_CHALLENGE_PEPPER` is distinct from `AUTH_SECRET`
- [ ] `RATE_LIMIT_PEPPER` is distinct from both `AUTH_SECRET` and `EMAIL_CHALLENGE_PEPPER`
- [ ] `OPENROUTER_API_KEY` and `GEMINI_API_KEY` are valid and have usage limits set
- [ ] `AI_ENABLE_MOCK` is NOT set to `true` (enforced by env parser in production)
- [ ] Web process env does NOT contain AI keys
- [ ] Worker-gen process env does NOT contain AUTH_SECRET
- [ ] Outbox process env does NOT contain anything except DATABASE_URL_OUTBOX
- [ ] All database URLs use separate credentials or are scoped appropriately
- [ ] Secrets are never committed to the repository (verified by CI security smoke)

---

## Secret Rotation

| Secret | Rotation Impact | Procedure |
|---|---|---|
| `AUTH_SECRET` | Invalidates all existing sessions — requires all users to re-login | Deploy during low-traffic window |
| `EMAIL_CHALLENGE_PEPPER` | Invalidates pending magic link challenges | Rotate during low-traffic; pending challenges expire within 10 min |
| `RATE_LIMIT_PEPPER` | Invalidates rate limit tracking — resets counters | Low impact; rotate anytime |
| `OPENROUTER_API_KEY` | AI calls fail until new key is deployed | Deploy new key before revoking old |
| `GEMINI_API_KEY` | AI fallback may fail | Deploy new key before revoking old |
| Database URLs | App restart required (PM2 reads env at start) | Deploy during maintenance window |
