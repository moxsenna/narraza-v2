# Narraza Implementation Progress

## Current milestone
Post-M8 hardening — vertical slice e2e partial

## Last completed task
Auth e2e + core security e2e green (6/6)

## Current task
Optional: job-recovery + full vertical-slice e2e with worker-gen running

## Tests currently green
### Unit/integration (Postgres :5433)
- `@narraza/shared` 5
- `@narraza/core` 67
- `@narraza/ai` 28
- `@narraza/application` 154 (incl. vertical-slice-backend)
- `@narraza/db` 27
- `deploy` 35
- architecture: no violations

### E2E Playwright (web on :3000)
- auth-magic-link (2)
- foundation-lock (1)
- idor (1)
- no-internal-strings (1)
- credit-summary (1)
- **6 passed**

## Not green yet
- job-recovery e2e — needs write-room + worker-gen processing jobs
- vertical-slice e2e full path — needs worker-gen concurrent with web for intake/outline/beat jobs

## Auth flow (locked)
```
POST issue challenge + file mail
→ GET /auth/email/prepare?token=RAW (sets pending_login Path=/)
→ 303 /auth/email/confirm (page only)
→ POST /auth/email/consume (session cookie)
→ /dashboard
```

## How to resume full vertical-slice e2e
```bash
cd "D:/Coding/Narraza Fix/narraza v2"
docker compose up -d
# terminal 1
npm run dev -w @narraza/web
# terminal 2
npm run dev -w @narraza/worker-gen   # or tsx apps/worker-gen/src/main.ts
# terminal 3
npx playwright test --config e2e/playwright.config.ts
```

## Git tip
Recent: fix(auth,e2e) prepare/consume split; vertical slice backend wire; M0–M8
