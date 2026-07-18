# Narraza v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Narraza v2 greenfield so a user completes the full vertical slice: magic-link login → project → intake.extract → concept pick → foundation propose/confirm/lock → character.propose → outline.generate/accept → beat write/judge/repair → proposal accept → consistent credits — with production pipelines (mock AI only swaps provider), domain firewall, and S8 operational reliability.

**Architecture:** Modular monolith at `D:/Coding/Narraza Fix/narraza v2`. Adapters: `apps/web`, `apps/worker-gen`, `apps/worker-outbox`. Packages: `core` (pure), `application` (use cases + UnitOfWork + extraction + workflows + reconciliation), `ai` (single-attempt only), `db` (Prisma ports + raw SQL), `shared` (types/env). Canon only via `commitCanonicalChangeSet`. Spec: `docs/superpowers/specs/2026-07-18-narraza-v2-design.md`. Matrix: `docs/superpowers/specs/verification-matrix.md`.

**Tech Stack:** Node 22, npm workspaces, TypeScript strict, Next.js 15, React 19, Tailwind + shadcn, Postgres 16, Prisma 5, Auth.js sessions + Narraza EmailLoginChallenge, Vitest, testcontainers, Playwright, PM2, nginx, GitHub Actions.

**Task metadata required on every task:** Purpose | Prerequisites | Files | Matrix rows | CI job | Failing test first | Implement steps | Run command | Expected | Acceptance | Commit.

**Root path:** `D:/Coding/Narraza Fix/narraza v2`

**Execution policy (from autonomous goal):** Do not stop for small implementation choices deducible from design. After plan self-review passes, auto-start M0. Prefer subagent-driven-development: one task → implement → test → review → commit → next.

---

## File map

```
package.json
tsconfig.base.json
.gitignore
.env.example
docker-compose.yml
eslint.config.mjs
dependency-cruiser.config.cjs
vitest.workspace.ts
.github/workflows/
  ci.yml
  deploy-staging.yml
  deploy-production.yml
apps/
  web/                    # Next.js 15 App Router adapter only
  worker-gen/             # generation job worker process
  worker-outbox/          # outbox consumer process
packages/
  shared/src/
    index.ts
    errors.ts
    env/{web,worker-gen,worker-outbox}-env.ts
    types/
  core/src/
    reveal-policy.ts
    expression-policy.ts
    knowledge-policy.ts
    readiness-policy.ts
    dependency-manifest.ts
    stale-policy.ts
    prose-policy.ts
    disclosure-policy.ts
    repair-policy.ts
    context/{planner,writer,validator,repair,extraction}-packet.ts
    validator/{structural,restricted-representation,merge-findings,scoring,contracts}.ts
    __tests__/
  application/src/
    ports.ts
    unit-of-work.ts
    use-cases/{auth,projects,foundation,intake,concepts,characters,outline,jobs,proposals,credit}/
    extraction/
    workflows/
    reconciliation/
    progress/project-progress.ts
    __tests__/
  ai/src/
    registry/ providers/ routing/ prompts/ output/ security/
  db/src/
    client.ts
    unit-of-work.ts
    repositories/
    queries/
    sql/
prisma/
  schema.prisma
  migrations/
deploy/
  nginx.conf.example
  ecosystem.config.cjs
  build-release.mjs
  release.sh
  drain-workers.sh
  backup.sh
  restore-verify.sh
e2e/
docs/superpowers/specs/
docs/superpowers/plans/
  2026-07-18-narraza-v2-implementation.md
  implementation-progress.md
```

---

## Locked decisions (do not reopen)

| Topic | Decision |
|---|---|
| Jobs/leases migration | **M3.0 only** (not M1). Proposals may FK job later; M1b uses nullable `generationJobId` without job table until M3.0 |
| foundation.propose after concept | **Always available.** Concept accept writes foundation draft ops from selected alt. User may re-run `foundation.propose` job to refine; lock is separate confirm gate |
| Signup grant | Trigger in first successful consume that provisions user/session, not dashboard read. Dedupe `grant:signup:{userId}` |
| Env parse | Pick named keys into plain object, then zod-parse. Never `schema.strict().parse(process.env)` |
| Conflict uniqueness | `UNIQUE (owner_user_id, conflict_key) WHERE status IN ('queued','running')` — never global `UNIQUE(conflict_key)` |
| ValidationReport | Own artifact table, never JSON blob on ProseVersion |
| Model ops | Model never emits `CanonicalChangeOperation`. Three layers: ModelSuggestionDraft → NormalizedOperationDraft → CanonicalChangeOperation |
| Mock AI | Same production pipeline; mock only swaps provider adapter |

---

# Phase M0 — Scaffold, env, auth, project shell

## Task M0.1: Git + root workspace

**Purpose:** Initialize monorepo workspace so packages and apps can be added.  
**Prerequisites:** None. Root is `D:/Coding/Narraza Fix/narraza v2`.  
**Files:** Create `package.json`, `tsconfig.base.json`, `.gitignore`, `.env.example`, `docker-compose.yml`, `vitest.workspace.ts`  
**Matrix:** —  
**CI:** lint-typecheck  

- [ ] **Step 1:** Ensure git repo exists (`git init` if needed). Branch `master` OK for greenfield; later work may use feature branches.
- [ ] **Step 2:** Write root `package.json`:

```json
{
  "name": "narraza",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "engines": { "node": ">=22 <23" },
  "scripts": {
    "build": "npm run build --workspaces --if-present",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint .",
    "dev": "npm run dev -w @narraza/web",
    "db:migrate": "prisma migrate dev --schema prisma/schema.prisma",
    "db:generate": "prisma generate --schema prisma/schema.prisma",
    "architecture": "depcruise --config dependency-cruiser.config.cjs apps packages"
  },
  "devDependencies": {
    "typescript": "^5.7.3",
    "vitest": "^3.0.5",
    "eslint": "^9.19.0",
    "prisma": "^5.22.0",
    "dependency-cruiser": "^16.9.0"
  }
}
```

- [ ] **Step 3:** Write `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 4:** Write `.gitignore`:

```
node_modules/
.next/
dist/
build/
.env
.env.*
!.env.example
.data/
coverage/
playwright-report/
test-results/
*.tsbuildinfo
.DS_Store
```

- [ ] **Step 5:** Write `docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: narraza
      POSTGRES_PASSWORD: narraza
      POSTGRES_DB: narraza
    ports:
      - "5432:5432"
    volumes:
      - narraza_pg:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U narraza -d narraza"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  narraza_pg:
```

- [ ] **Step 6:** Write `.env.example` (names only, no secret values):

```
# web
DATABASE_URL_WEB=postgresql://narraza:narraza@localhost:5432/narraza
AUTH_SECRET=
AUTH_URL=http://localhost:3000
EMAIL_FROM=Narraza <noreply@localhost>
EMAIL_CHALLENGE_PEPPER=
RATE_LIMIT_PEPPER=
SIGNUP_GRANT_MICRO_IDR=5000000000
MAIL_TRANSPORT=file
MAIL_FILE_DIR=.data/mail

# worker-gen
DATABASE_URL_WORKER=postgresql://narraza:narraza@localhost:5432/narraza
ARTIFACT_STORAGE_PATH=.data/artifacts
AI_ENABLE_MOCK=true
OPENROUTER_API_KEY=
GEMINI_API_KEY=

# worker-outbox
DATABASE_URL_OUTBOX=postgresql://narraza:narraza@localhost:5432/narraza
```

- [ ] **Step 7:** Write `vitest.workspace.ts`:

```ts
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/*/vitest.config.ts',
  'apps/*/vitest.config.ts',
]);
```

- [ ] **Step 8:** Commit

```bash
git add package.json tsconfig.base.json .gitignore .env.example docker-compose.yml vitest.workspace.ts
git commit -m "chore: init monorepo workspace"
```

**Acceptance:** `package.json` workspaces present; docker-compose defines postgres:16; `.env.example` has no real secrets.

---

## Task M0.2: packages/shared env + errors

**Purpose:** Explicit per-process env parsers and public error types.  
**Prerequisites:** M0.1  
**Files:**  
- Create: `packages/shared/package.json`, `tsconfig.json`, `vitest.config.ts`, `src/index.ts`, `src/errors.ts`  
- Create: `packages/shared/src/env/web-env.ts`, `worker-gen-env.ts`, `worker-outbox-env.ts`  
- Test: `packages/shared/src/env/env.test.ts`  
**Matrix:** `env-boundary`  
**CI:** unit  

- [ ] **Step 1: Failing test** — write first, run, confirm FAIL (module missing):

```ts
// packages/shared/src/env/env.test.ts
import { describe, expect, it } from 'vitest';
import { parseWorkerGenEnv } from './worker-gen-env.js';
import { parseWebEnv } from './web-env.js';
import { parseWorkerOutboxEnv } from './worker-outbox-env.js';

describe('env parsers', () => {
  it('worker-gen rejects missing keys when mock off', () => {
    expect(() =>
      parseWorkerGenEnv({
        DATABASE_URL_WORKER: 'postgresql://x',
        ARTIFACT_STORAGE_PATH: '.data/artifacts',
        AI_ENABLE_MOCK: 'false',
      } as NodeJS.ProcessEnv),
    ).toThrow();
  });

  it('worker-gen allows mock without provider keys', () => {
    const env = parseWorkerGenEnv({
      DATABASE_URL_WORKER: 'postgresql://x',
      ARTIFACT_STORAGE_PATH: '.data/artifacts',
      AI_ENABLE_MOCK: 'true',
    } as NodeJS.ProcessEnv);
    expect(env.AI_ENABLE_MOCK).toBe(true);
    expect(env.OPENROUTER_API_KEY).toBeUndefined();
  });

  it('web env schema does not expose provider keys', () => {
    const env = parseWebEnv({
      DATABASE_URL_WEB: 'postgresql://x',
      AUTH_SECRET: 'a'.repeat(32),
      AUTH_URL: 'http://localhost:3000',
      EMAIL_FROM: 'Narraza <n@localhost>',
      EMAIL_CHALLENGE_PEPPER: 'b'.repeat(32),
      RATE_LIMIT_PEPPER: 'c'.repeat(32),
      SIGNUP_GRANT_MICRO_IDR: '5000000000',
    } as NodeJS.ProcessEnv);
    expect(env).not.toHaveProperty('OPENROUTER_API_KEY');
    expect(env).not.toHaveProperty('GEMINI_API_KEY');
    expect(env).not.toHaveProperty('AUTH_SECRET'.replace('AUTH', 'AI'));
  });

  it('worker-outbox only requires DATABASE_URL_OUTBOX', () => {
    const env = parseWorkerOutboxEnv({
      DATABASE_URL_OUTBOX: 'postgresql://x',
    } as NodeJS.ProcessEnv);
    expect(env.DATABASE_URL_OUTBOX).toBe('postgresql://x');
    expect(env).not.toHaveProperty('AUTH_SECRET');
    expect(env).not.toHaveProperty('OPENROUTER_API_KEY');
  });

  it('worker-gen production rejects AI_ENABLE_MOCK=true when NODE_ENV=production', () => {
    expect(() =>
      parseWorkerGenEnv(
        {
          DATABASE_URL_WORKER: 'postgresql://x',
          ARTIFACT_STORAGE_PATH: '.data/artifacts',
          AI_ENABLE_MOCK: 'true',
          NODE_ENV: 'production',
        } as NodeJS.ProcessEnv,
      ),
    ).toThrow(/mock/i);
  });
});
```

- [ ] **Step 2: Run fail**

```bash
cd "D:/Coding/Narraza Fix/narraza v2"
npm install
npm run test -w @narraza/shared
```

Expected: FAIL — cannot find modules / package missing.

- [ ] **Step 3: Implement package skeleton + pick-then-parse**

`packages/shared/package.json`:

```json
{
  "name": "@narraza/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "vitest": "^3.0.5",
    "typescript": "^5.7.3"
  }
}
```

`packages/shared/src/env/worker-gen-env.ts`:

```ts
import { z } from 'zod';

const schema = z
  .object({
    DATABASE_URL_WORKER: z.string().min(1),
    ARTIFACT_STORAGE_PATH: z.string().min(1),
    AI_ENABLE_MOCK: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
    OPENROUTER_API_KEY: z.string().min(20).optional(),
    GEMINI_API_KEY: z.string().min(20).optional(),
    NODE_ENV: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.NODE_ENV === 'production' && val.AI_ENABLE_MOCK) {
      ctx.addIssue({
        code: 'custom',
        path: ['AI_ENABLE_MOCK'],
        message: 'AI_ENABLE_MOCK=true forbidden in production',
      });
    }
    if (!val.AI_ENABLE_MOCK && !val.OPENROUTER_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['OPENROUTER_API_KEY'],
        message: 'required when mock off',
      });
    }
  });

export function parseWorkerGenEnv(raw: NodeJS.ProcessEnv) {
  return schema.parse({
    DATABASE_URL_WORKER: raw.DATABASE_URL_WORKER,
    ARTIFACT_STORAGE_PATH: raw.ARTIFACT_STORAGE_PATH,
    AI_ENABLE_MOCK: raw.AI_ENABLE_MOCK,
    OPENROUTER_API_KEY: raw.OPENROUTER_API_KEY,
    GEMINI_API_KEY: raw.GEMINI_API_KEY,
    NODE_ENV: raw.NODE_ENV,
  });
}
```

Mirror:
- `web-env.ts`: `DATABASE_URL_WEB`, `AUTH_SECRET` min 32, `AUTH_URL`, `EMAIL_FROM`, `EMAIL_CHALLENGE_PEPPER` min 32, `RATE_LIMIT_PEPPER` min 32, `SIGNUP_GRANT_MICRO_IDR` coerce bigint/number, `MAIL_TRANSPORT` enum `file|smtp` default `file`, `MAIL_FILE_DIR` default `.data/mail`. **No** AI keys in schema.
- `worker-outbox-env.ts`: `DATABASE_URL_OUTBOX` only (+ `NODE_ENV` optional). **No** AUTH_SECRET, **no** AI keys.

- [ ] **Step 4: `errors.ts`**

```ts
export type UseCaseErrorCode =
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'VALIDATION'
  | 'CONFLICT'
  | 'JOB_ALREADY_ACTIVE'
  | 'INSUFFICIENT_CREDIT'
  | 'QUOTE_EXPIRED'
  | 'QUOTE_CONSUMED'
  | 'TERMINAL_STATE_CONFLICT'
  | 'STALE_PROPOSAL'
  | 'CAS_CONFLICT'
  | 'RESERVATION_EXPOSURE_EXCEEDED'
  | 'INTERNAL';

export class InternalUseCaseError extends Error {
  constructor(
    public readonly code: UseCaseErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'InternalUseCaseError';
  }
}

export class PublicUseCaseError extends Error {
  constructor(
    public readonly code: Exclude<UseCaseErrorCode, 'INTERNAL'>,
    message: string,
  ) {
    super(message);
    this.name = 'PublicUseCaseError';
  }
}

export function toPublicError(err: unknown): PublicUseCaseError {
  if (err instanceof PublicUseCaseError) return err;
  if (err instanceof InternalUseCaseError) {
    if (err.code === 'INTERNAL') {
      return new PublicUseCaseError('NOT_FOUND', 'Not found');
    }
    return new PublicUseCaseError(
      err.code as Exclude<UseCaseErrorCode, 'INTERNAL'>,
      err.message,
    );
  }
  return new PublicUseCaseError('NOT_FOUND', 'Not found');
}
```

- [ ] **Step 5: Export from `src/index.ts`**, configure `tsconfig.json` + `vitest.config.ts` for NodeNext ESM.

- [ ] **Step 6: Run**

```bash
npm install
npm run test -w @narraza/shared
npm run typecheck -w @narraza/shared
```

Expected: PASS all env tests; typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add packages/shared package-lock.json package.json
git commit -m "feat(shared): explicit env pick parsers and public errors"
```

**Acceptance:** web schema has no provider keys; worker-gen requires provider keys only when mock off; production mock rejected; outbox has no AUTH_SECRET.

---

## Task M0.3: Prisma identity baseline

**Purpose:** Identity tables only for auth + project shell.  
**Prerequisites:** M0.2, Docker available  
**Files:** `prisma/schema.prisma`, `prisma/migrations/*_m0_identity/`  
**Matrix:** —  
**CI:** migration  

Tables: `User`, `Account`, `Session` (`lastActiveAt`, `expiresAt`, `revokedAt`), `EmailLoginChallenge` (`tokenHash`, `identifierNormalized`, `expiresAt`, `consumedAt`, `revokedAt`, `nonce`), `Project` (`ownerUserId`, `title`, `startMode`, `foundationStatus` enum `none|draft|locked`, `currentCanonicalVersion` default 0, `deletedAt`).

- [ ] **Step 1:** `docker compose up -d` and wait healthy.
- [ ] **Step 2:** Write minimal `prisma/schema.prisma` provider postgresql, generator client output usable by `packages/db` later (`../node_modules/.prisma/client` or package path — prefer default `@prisma/client` root).
- [ ] **Step 3:**

```bash
npx prisma migrate dev --name m0_identity --schema prisma/schema.prisma
```

Expected: migration applied; tables exist.

- [ ] **Step 4:** Commit `feat(db): m0 identity session challenge project`

**Acceptance:** migrate empty DB succeeds; no jobs/credit tables yet.

---

## Task M0.4: Passwordless two-step magic link (S6)

**Purpose:** Secure email magic-link login with challenge cap, two-step consume, signup grant.  
**Prerequisites:** M0.3  
**Files:**  
- Create: `packages/application/package.json`, `tsconfig.json`, `vitest.config.ts`  
- Create: `packages/application/src/use-cases/auth/issue-challenge.ts`  
- Create: `packages/application/src/use-cases/auth/prepare-confirm.ts`  
- Create: `packages/application/src/use-cases/auth/consume-challenge.ts`  
- Create: `packages/application/src/use-cases/auth/ensure-signup-grant.ts`  
- Create: `packages/application/src/use-cases/auth/dev-mail-transport.ts`  
- Create: `packages/application/src/use-cases/auth/pending-login-cookie.ts`  
- Create: `packages/db/package.json`, `src/client.ts`, `src/repositories/challenge-repo.ts`, `src/repositories/session-repo.ts`, `src/repositories/user-repo.ts`, `src/repositories/ledger-repo.ts` (grant stub table or credit_ledger minimal if not yet — for M0 use `SignupGrantRecord` table or insert into future ledger via simple `credit_ledger` table added in same migration if needed; prefer minimal `credit_ledger` with dedupe_key only for grant)  
- Create: `apps/web/` Next.js shell with routes  
  - `app/auth/email/page.tsx` (request form)  
  - `app/auth/email/confirm/route.ts` (GET prepare + POST consume)  
  - `app/auth/email/confirm/page.tsx` (confirm UI posts to route)  
- Test: `packages/application/src/__tests__/auth-challenge.test.ts`  
**Matrix:** `auth-magic-link`, `challenge-cap`, `active-user-guard`  
**CI:** integration (unit-with-db), e2e later M6  

**Rules (must implement exactly):**
1. `rawToken` ≥ 32 bytes random (`randomBytes(32)`); store only `HMAC-SHA256(EMAIL_CHALLENGE_PEPPER, rawToken)` as `tokenHash`.
2. Max **3** active challenges per `identifierNormalized`; at cap revoke **oldest** only; new issue does **not** revoke all under cap.
3. GET `/auth/email/confirm?token=RAW`: hash lookup → validate not consumed/revoked/expired → **do not consume** → set HttpOnly cookie `pending_login` = signed payload `{ challengeId, nonce, exp }` (HMAC AUTH_SECRET), Path=`/auth/email`, Max-Age=600, Secure in prod, SameSite=Lax → **303** to `/auth/email/confirm` (clean URL, no token query).
4. POST `/auth/email/confirm`: verify cookie signature + nonce match challenge → CAS consume (`WHERE consumed_at IS NULL AND revoked_at IS NULL AND expires_at > NOW()`) → create Session → revoke sibling actives → clear cookie → set session cookie → redirect `/dashboard`.
5. `ensureSignupGrant` in **same transaction** as first successful consume that creates new user (or first session provision). Dedupe: `grant:signup:{userId}`. **Not** on dashboard read.
6. Dev mail: write to `.data/mail/{id}.txt` when `MAIL_TRANSPORT=file`. Never log raw token. Never default console token path as primary.
7. Concurrent consume: only one succeeds; second gets invalid/consumed error.
8. Expired/revoked rejected.

- [ ] **Step 1: Failing tests** (integration with test DB or in-memory ports; prefer real Postgres via DATABASE_URL):

```ts
// packages/application/src/__tests__/auth-challenge.test.ts
import { describe, expect, it, beforeEach } from 'vitest';
// wire real repos + UoW or fakes that mirror CAS semantics

describe('EmailLoginChallenge', () => {
  it('GET prepare does not set consumedAt', async () => {
    const { rawToken, challengeId } = await issue('user@example.com');
    const prepared = await prepareConfirm(rawToken);
    expect(prepared.challengeId).toBe(challengeId);
    const row = await loadChallenge(challengeId);
    expect(row.consumedAt).toBeNull();
  });

  it('only one of two concurrent consumes succeeds', async () => {
    const { rawToken } = await issue('user@example.com');
    await prepareConfirm(rawToken);
    const results = await Promise.allSettled([
      consumeFromPending(),
      consumeFromPending(),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    const fail = results.filter((r) => r.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(fail).toHaveLength(1);
  });

  it('successful consume revokes sibling active challenges', async () => {
    const a = await issue('user@example.com');
    const b = await issue('user@example.com');
    await prepareConfirm(a.rawToken);
    await consumeFromPending();
    const bRow = await loadChallenge(b.challengeId);
    expect(bRow.revokedAt).not.toBeNull();
  });

  it('max 3 active; fourth issue revokes oldest only', async () => {
    const c1 = await issue('cap@example.com');
    const c2 = await issue('cap@example.com');
    const c3 = await issue('cap@example.com');
    const c4 = await issue('cap@example.com');
    expect((await loadChallenge(c1.challengeId)).revokedAt).not.toBeNull();
    expect((await loadChallenge(c2.challengeId)).revokedAt).toBeNull();
    expect((await loadChallenge(c3.challengeId)).revokedAt).toBeNull();
    expect((await loadChallenge(c4.challengeId)).revokedAt).toBeNull();
  });

  it('new issue does not revoke all active when under cap', async () => {
    const c1 = await issue('under@example.com');
    const c2 = await issue('under@example.com');
    expect((await loadChallenge(c1.challengeId)).revokedAt).toBeNull();
    expect((await loadChallenge(c2.challengeId)).revokedAt).toBeNull();
  });

  it('expired challenge rejected', async () => {
    const { rawToken, challengeId } = await issue('exp@example.com');
    await forceExpire(challengeId);
    await expect(prepareConfirm(rawToken)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('revoked challenge rejected', async () => {
    const { rawToken, challengeId } = await issue('rev@example.com');
    await revoke(challengeId);
    await expect(prepareConfirm(rawToken)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('pending cookie does not contain raw token', async () => {
    const { rawToken } = await issue('cookie@example.com');
    const { setCookieHeader } = await prepareConfirm(rawToken);
    expect(setCookieHeader).not.toContain(rawToken);
    expect(setCookieHeader).toMatch(/pending_login=/);
    expect(setCookieHeader).toMatch(/HttpOnly/i);
  });

  it('ensureSignupGrant is idempotent', async () => {
    const { rawToken } = await issue('grant@example.com');
    await prepareConfirm(rawToken);
    const userId = await consumeFromPending();
    await ensureSignupGrant(userId);
    await ensureSignupGrant(userId);
    const grants = await listLedgerByDedupe(`grant:signup:${userId}`);
    expect(grants).toHaveLength(1);
  });

  it('raw token never appears in application logs during issue', async () => {
    const logs: string[] = [];
    const restore = captureLogs(logs);
    const { rawToken } = await issue('log@example.com');
    restore();
    expect(logs.join('\n')).not.toContain(rawToken);
  });
});
```

- [ ] **Step 2: Run** — expect FAIL (missing modules).

- [ ] **Step 3: Implement** issue / prepare / consume / grant / cookie / file mail transport / repos.

Cookie signing: `base64url(payload).base64url(hmac)` or iron-session style; payload must include `challengeId`, `nonce` (from challenge row), `exp`. Verify constant-time HMAC.

- [ ] **Step 4: Wire Next.js routes** — GET does prepare + 303; POST does consume. Confirm page has button that POSTs (no token in URL after redirect).

- [ ] **Step 5: Run tests**

```bash
npm run test -w @narraza/application
```

Expected: all auth-challenge tests PASS.

- [ ] **Step 6: Commit** `feat(auth): two-step magic link with challenge cap and signup grant`

**Acceptance:** All listed tests green; raw token only in email file content, never cookie/logs/DB.

---

## Task M0.5: Dashboard + create project

**Purpose:** Authenticated user can create and list projects.  
**Prerequisites:** M0.4  
**Files:**  
- Create: `packages/application/src/use-cases/projects/create-project.ts`  
- Create: `packages/application/src/use-cases/projects/list-projects.ts`  
- Create: `packages/db/src/repositories/project-repo.ts`  
- Create: `apps/web/app/dashboard/page.tsx`, `apps/web/app/start/page.tsx`  
- Test: `packages/application/src/__tests__/create-project.test.ts`  
**Matrix:** —  
**CI:** unit  

- [ ] **Step 1: Failing test**

```ts
describe('createProject', () => {
  it('creates project owned by user with foundationStatus none', async () => {
    const p = await createProject({
      userId,
      title: 'My Novel',
      startMode: 'guided',
      requestId: 'req-1',
    });
    expect(p.foundationStatus).toBe('none');
    expect(p.ownerUserId).toBe(userId);
    expect(p.currentCanonicalVersion).toBe(0);
  });

  it('is idempotent on requestId', async () => {
    const a = await createProject({ userId, title: 'A', startMode: 'guided', requestId: 'same' });
    const b = await createProject({ userId, title: 'B', startMode: 'guided', requestId: 'same' });
    expect(a.id).toBe(b.id);
    expect(b.title).toBe('A');
  });

  it('list excludes soft-deleted', async () => {
    const p = await createProject({ userId, title: 'X', startMode: 'guided', requestId: 'x1' });
    await softDelete(p.id);
    const list = await listProjects(userId);
    expect(list.map((x) => x.id)).not.toContain(p.id);
  });
});
```

- [ ] **Step 2: Implement** `createProject` with dedupe key `createProject:{userId}:{requestId}` stored on project or idempotency table. `listProjects` filters `ownerUserId=user AND deletedAt IS NULL`.
- [ ] **Step 3:** Dashboard RSC lists projects; Start form posts Server Action → `createProject` → redirect project home.
- [ ] **Step 4:** Tests PASS → commit `feat(web): start paths and dashboard project list`

### M0 verification gate

Must pass:
- `@narraza/shared` env tests (`env-boundary`)
- auth challenge suite (`challenge-cap` + prepare/consume)
- create+list project tests

Do not start M1 until gate green and working tree committed.

---

# Phase M1 — Schema splits + core pure domain

## Task M1.1a: Migration — canon entities

**Purpose:** Canon tables with partial uniques and CHECKs.  
**Prerequisites:** M0 gate  
**Files:** `prisma/schema.prisma`, `prisma/migrations/*_m1a_canon/migration.sql`  
**Matrix:** `soft-delete-unique` (test in M1.1a integration)  
**CI:** migration, integration  

**Tables:** Foundation, Character, Fact, CanonicalEntityRevision, CharacterBelief, CharacterState, Reveal, RevealBreadcrumb, ChapterOutline, Chapter, Beat, BeatAllowedFact, BeatForbiddenFact

**Raw SQL (all required in migration):**

```sql
CREATE UNIQUE INDEX facts_active_key_unique
  ON facts (project_id, fact_key) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX characters_active_name_unique
  ON characters (project_id, name) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX reveals_active_key_unique
  ON reveals (project_id, reveal_key) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX chapter_outlines_project_number
  ON chapter_outlines (project_id, chapter_number);
CREATE UNIQUE INDEX chapters_project_number
  ON chapters (project_id, number);
CREATE UNIQUE INDEX beats_chapter_beat_number
  ON beats (chapter_id, beat_number);
CREATE UNIQUE INDEX character_beliefs_stream
  ON character_beliefs (character_id, belief_key, effective_sequence);
ALTER TABLE character_beliefs
  ADD CONSTRAINT character_beliefs_confidence_range
  CHECK (confidence >= 0 AND confidence <= 1);
```

- [ ] **Step 1:** Write schema + SQL migration.
- [ ] **Step 2:** `npx prisma migrate dev --name m1a_canon`
- [ ] **Step 3:** Integration test soft-delete unique: insert fact key, soft-delete, re-insert same key → success; second active same key → fail.
- [ ] **Step 4:** Commit `feat(db): m1a canon entities and partial uniques`

---

## Task M1.1b: Migration — prose, proposals, validation artifacts

**Purpose:** Proposal/prose/validation tables; ValidationReport is own table.  
**Prerequisites:** M1.1a  
**Files:** schema + `*_m1b_prose_proposals/migration.sql`  
**Matrix:** `prose-fk`  
**CI:** migration, integration  

**Tables:** ProseVersion, ValidationReport (FK proseVersionId + candidateId nullable), GeneratedCandidate (`generationAttemptId` nullable until M3), ProposalGroup, Proposal (`source` ai|user|system, `revalidatedFromProposalId`, `dependencyHash`, `operationsHash`), CanonicalChangeSet, CanonicalChangeOperation, ContextSnapshot, GenerationContextBundle, PublishPackageArtifact

**Raw SQL:**

```sql
ALTER TABLE prose_versions
  ADD CONSTRAINT prose_versions_beat_id_id_unique UNIQUE (beat_id, id);

ALTER TABLE beats
  ADD CONSTRAINT beats_accepted_prose_belongs
  FOREIGN KEY (id, accepted_prose_version_id)
  REFERENCES prose_versions (beat_id, id)
  DEFERRABLE INITIALLY DEFERRED;

CREATE UNIQUE INDEX one_accepted_proposal_per_group
  ON proposals (proposal_group_id) WHERE status = 'accepted';

CREATE UNIQUE INDEX prose_versions_beat_version
  ON prose_versions (beat_id, version);

CREATE UNIQUE INDEX generated_candidates_attempt_index
  ON generated_candidates (generation_attempt_id, candidate_index)
  WHERE generation_attempt_id IS NOT NULL;

CREATE UNIQUE INDEX proposal_revalidation_unique
  ON proposals (revalidated_from_proposal_id, dependency_hash)
  WHERE revalidated_from_proposal_id IS NOT NULL;
```

**Note:** No `ValidationReport` JSON column on `ProseVersion`.

- [ ] migrate + integration prose FK test → commit `feat(db): m1b prose proposals validation artifacts`

---

## Task M1.1c: Decision record — jobs deferred

**Purpose:** Explicitly document jobs/lease tables live in M3.0 (no stubs).  
**Prerequisites:** M1.1b  
**Files:** Modify this plan only if needed; add one-line comment in `prisma/schema.prisma` top: `// GenerationJob* tables land in M3.0`  
**Matrix:** —  

- [ ] Commit `docs(db): defer jobs workflow tables to M3.0` only if schema comment added; otherwise skip empty commit.

---

## Task M1.2: core writer-packet-leak (TDD)

**Purpose:** Writer packet cannot carry restricted truth.  
**Prerequisites:** M0.1 packages structure for core  
**Files:**  
- Create: `packages/core/package.json`, `tsconfig.json`, `vitest.config.ts`  
- Create: `packages/core/src/reveal-policy.ts`, `packages/core/src/context/writer-packet.ts`  
- Test: `packages/core/src/__tests__/writer-packet-leak.test.ts`  
**Matrix:** `writer-packet-leak`, `writer-guidance-safe`  
**CI:** unit  

- [ ] **Step 1: Failing test**

```ts
import { describe, expect, it } from 'vitest';
import { buildWriterPacket } from '../context/writer-packet.js';

describe('writer-packet-leak', () => {
  it('serialized writer packet has no restricted truth fields', () => {
    const packet = buildWriterPacket({
      projectId: 'p1',
      beatId: 'b1',
      restrictedFacts: [{ id: 'f1', truth: 'The killer is Andi', factKey: 'killer' }],
      writerSafeFacts: [{ id: 'f2', surface: 'Someone is dead', factKey: 'death' }],
      forbiddenConcepts: [{ factId: 'f1', truth: 'The killer is Andi' }],
    });
    const json = JSON.stringify(packet);
    expect(json).not.toContain('The killer is Andi');
    expect(json).not.toContain('restrictedFacts');
    expect(json).not.toContain('restrictedGuardSet');
    expect(packet.kind).toBe('writer_safe');
  });
});

describe('writer-guidance-safe', () => {
  it('writer guidance never embeds raw forbidden truth phrases', () => {
    const packet = buildWriterPacket({
      projectId: 'p1',
      beatId: 'b1',
      restrictedFacts: [{ id: 'f1', truth: 'SECRET_TRUTH_XYZ', factKey: 'k' }],
      writerSafeFacts: [],
      forbiddenConcepts: [{ factId: 'f1', truth: 'SECRET_TRUTH_XYZ' }],
    });
    for (const g of packet.writerGuidance ?? []) {
      expect(g).not.toContain('SECRET_TRUTH_XYZ');
    }
  });
});
```

- [ ] Implement allowlist builder (never redact-from-planner). FAIL → implement → PASS.
- [ ] Commit `test(core): writer packet leak firewall`

---

## Task M1.3: dependency-manifest

**Purpose:** Order-stable dependency hash.  
**Prerequisites:** M1.2 package exists  
**Files:** `packages/core/src/dependency-manifest.ts`, `__tests__/dependency-hash.test.ts`  
**Matrix:** `dependency-hash`  
**CI:** unit  

- [ ] Test: same entities different key order → same SHA-256; duplicate `(entityType, entityId)` → throw; hash prefixed with schema version.
- [ ] Commit `feat(core): dependency manifest hash`

---

## Task M1.4: stale-policy dependency-based

**Purpose:** Proposal validity from dependencies, not global version alone.  
**Prerequisites:** M1.3  
**Files:** `packages/core/src/stale-policy.ts`, `__tests__/proposal-unrelated-version-bump.test.ts`  
**Matrix:** `proposal-unrelated-version-bump`  
**CI:** unit (integration later when accept wired)  

- [ ] Test: global version bump, same dep hash → `valid`; dep revision change → `stale` or `needs_revalidation` per policy class.
- [ ] Commit `feat(core): dependency-based stale policy`

---

## Task M1.5a: expression-policy

**Files:** `expression-policy.ts`, `__tests__/expression-policy.test.ts`  
**Matrix:** `expression-policy`  
- [ ] Non-POV gets behavioral directives not raw beliefs. Commit `feat(core): expression policy`

## Task M1.5b: knowledge-policy / belief-transition

**Files:** `knowledge-policy.ts`, `__tests__/belief-transition.test.ts`  
**Matrix:** `belief-transition`  
- [ ] Belief downgrade without allowed reason rejected. Commit `feat(core): belief transition policy`

## Task M1.5c: disclosure-policy

**Files:** `disclosure-policy.ts`, `__tests__/disclosure-fold.test.ts`  
**Matrix:** `disclosure-fold`  
- [ ] Fold + retraction target deterministic. Commit `feat(core): disclosure fold`

## Task M1.5d: repair-policy

**Files:** `repair-policy.ts`, `__tests__/repair-policy.test.ts`  
**Matrix:** `repair-policy`  
- [ ] Stop on no-progress / repeated findings / attempt limit / regression (OR). Commit `feat(core): repair stop policy`

## Task M1.5e: merge-findings + structural validator

**Files:** `validator/merge-findings.ts`, `validator/structural.ts`, tests  
**Matrix:** `merge-findings`  
- [ ] AI findings cannot remove deterministic blockers. Commit `feat(core): merge findings and structural validator`

## Task M1.5f: readiness-policy

**Files:** `readiness-policy.ts`, tests  
**Matrix:** foundation readiness (feeds M2 lock)  
- [ ] Foundation lock readiness requires required fields present. Commit `feat(core): readiness policy`

---

## Task M1.6: architecture boundaries

**Purpose:** Enforce package dependency direction in CI.  
**Prerequisites:** packages exist  
**Files:** `dependency-cruiser.config.cjs`  
**Matrix:** `web-boundary`, `core-boundary`, `application-boundary`, `ai-boundary`, `worker-boundary`  
**CI:** architecture  

Rules:
- `packages/core` ↛ `db|ai|next|@prisma`
- `packages/application` ↛ `@prisma/client` (ports only)
- `apps/web` ↛ `@prisma/client`, ↛ `packages/ai` execute path
- `packages/ai` ↛ ledger, artifact storage, `@narraza/db`
- `apps/worker-*` ↛ domain internals beyond application public API

- [ ] Commit `ci: dependency-cruiser architecture boundaries`

### M1 verification gate

Green:
- `writer-packet-leak`, `writer-guidance-safe`, `expression-policy`, `belief-transition`, `dependency-hash`, `merge-findings`, `repair-policy`, `disclosure-fold`
- m1a+m1b `migrate-empty`
- architecture rules present (may be vacuously green until apps grow)

---

# Phase M2 — UnitOfWork, foundation, characters user path

## Task M2.1: UnitOfWork + TransactionPorts

**Purpose:** Serializable UoW with transaction-scoped ports.  
**Prerequisites:** M1 gate  
**Files:** `packages/application/src/ports.ts`, `packages/application/src/unit-of-work.ts`, `packages/db/src/unit-of-work.ts`  
**Test:** `packages/db/src/__tests__/unit-of-work.test.ts`  
**Matrix:** —  
**CI:** integration  

- [ ] Test: write then throw → rolled back; serialization failure retries with same requestId up to N.
- [ ] Commit `feat(db): serializable unit of work`

---

## Task M2.2: authorizeActiveUser + lockOwned helpers

**Purpose:** Active user guard + tenant scope.  
**Prerequisites:** M2.1  
**Files:** `packages/application/src/authz/authorize-active-user.ts`, `lock-owned-project.ts`  
**Test:** `active-user-guard.test.ts`  
**Matrix:** `active-user-guard`  
**CI:** unit  

- [ ] Suspended/deleted user → FORBIDDEN/UNAUTHORIZED; IDOR prep returns NOT_FOUND at repo layer.
- [ ] Commit `feat(application): active user guard and owned locks`

---

## Task M2.3: editFoundationDirect + lockFoundation

**Purpose:** User-origin foundation edit and confirm/lock.  
**Prerequisites:** M2.2  
**Files:** `use-cases/foundation/edit-foundation.ts`, `lock-foundation.ts`  
**Matrix:** foundation readiness; e2e `foundation-lock` later  
**CI:** integration  

- [ ] Lock requires readiness `ready` + `confirm=true` from server action. Without confirm → reject.
- [ ] Uses `commitCanonicalChangeSet` path even for user origin (or dedicated user change set builder that still goes through single write door).
- [ ] Commit `feat(application): foundation edit and lock`

---

## Task M2.4: character create/update user-origin

**Purpose:** Characters via change sets without AI.  
**Prerequisites:** M2.3  
**Files:** `use-cases/characters/upsert-character.ts`  
**Matrix:** —  
**CI:** integration  

- [ ] Create/update character through change set; soft-delete unique name.
- [ ] Commit `feat(application): user-origin character upsert`

### M2 verification gate

User can: create project → edit foundation → lock with confirm → add character — all without AI. Tests green.

---

# Phase M3 — Jobs, credit, S8 reliability

## Task M3.0: Migration jobs/credits/outbox

**Purpose:** Full operational schema.  
**Prerequisites:** M2 gate  
**Files:** schema + `*_m3_jobs_credits_outbox/migration.sql`  
**Matrix:** —  
**CI:** migration  

**Tables:** GenerationJob, GenerationAttempt, WorkflowInvocation, CreditLedger, CreditReservation (`reserved|closing|closed`), AttemptCostExposure, CreditQuote, UserConcurrencySlot, AIUsageEvent, OutboxEvent, OutboxConsumerReceipt, AuditEvent, WorkerInstance, ModelPriceSnapshot, ProseWorkingDraft

**Required columns on GenerationJob:** `status`, `leaseToken`, `leaseVersion`, `leaseExpiresAt`, `leaseOwner`, `cancelRequestedAt`, `executionRetryCount`, `maxExecutionRetries`, `terminalAt`, `terminalReasonCode`, `conflictKey`, `requestId`, `workflowPlanId`, `contextBundleId`, `reservationId`, `retryOfJobId`, `nextAttemptNumber`, `ownerUserId`, `projectId`, `runAfter`, `priority`, payload schema versions.

**Raw SQL (all required):**

```sql
CREATE UNIQUE INDEX active_job_conflict_unique
  ON generation_jobs (owner_user_id, conflict_key)
  WHERE status IN ('queued', 'running');

CREATE UNIQUE INDEX gen_jobs_request_id
  ON generation_jobs (request_id);

CREATE INDEX generation_jobs_poll_idx
  ON generation_jobs (status, run_after, priority DESC, created_at ASC)
  WHERE status IN ('queued', 'running');

CREATE INDEX generation_jobs_expired_lease_idx
  ON generation_jobs (lease_expires_at)
  WHERE status = 'running';

CREATE UNIQUE INDEX user_concurrency_slot_job
  ON user_concurrency_slots (job_id);

CREATE UNIQUE INDEX credit_ledger_dedupe
  ON credit_ledger (dedupe_key);

ALTER TABLE credit_reservations
  ADD CONSTRAINT credit_reservation_amounts_check
  CHECK (reserved_amount >= settled_amount + released_amount);

CREATE UNIQUE INDEX outbox_dedupe
  ON outbox_events (dedupe_key);

CREATE INDEX outbox_events_poll_idx
  ON outbox_events (status, available_at, created_at)
  WHERE status = 'pending';

CREATE UNIQUE INDEX workflow_invocation_key
  ON workflow_invocations (generation_job_id, routing_stage, invocation_key);

CREATE UNIQUE INDEX ai_usage_attempt
  ON ai_usage_events (generation_attempt_id);

CREATE UNIQUE INDEX outbox_receipt_delivery
  ON outbox_consumer_receipts (consumer_name, event_id, delivery_generation);

CREATE INDEX attempts_reconcile_idx
  ON generation_attempts (generation_job_id, status, deadline_at)
  WHERE status IN ('started', 'unknown');

CREATE UNIQUE INDEX prose_working_draft_user_beat
  ON prose_working_drafts (user_id, beat_id)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX credit_quote_id
  ON credit_quotes (id);
```

- [ ] Commit `feat(db): m3 jobs credits outbox workflow`

---

## Task M3.1: CreditQuote issue/confirm binding

**Purpose:** Two-phase quote then confirm enqueue.  
**Prerequisites:** M3.0  
**Files:** `use-cases/credit/issue-quote.ts`, `confirm-and-enqueue.ts`  
**Test:** `credit-quote-plan-binding`, `credit-quote`  
**Matrix:** `credit-quote`, `credit-quote-plan-binding`, `request-beat-snapshot`  
**CI:** integration  

Order fixed:
1. authorize → readiness → read canon  
2. freeze ContextBundle + AIWorkflowPlan  
3. issue CreditQuote bound to `workflowPlanHash`, `dependencyHash`, `estimatedMaximumMicroIdr`, expiry, owner  
4. confirm `quoteId` + `requestId` → revalidate → create jobId → reserve → create job referencing bundle+plan → enqueue  

- [ ] One-time consume; second confirm → QUOTE_CONSUMED. Expired → QUOTE_EXPIRED.
- [ ] Commit `feat(application): credit quote issue and confirm enqueue`

---

## Task M3.2: Job transition service (CAS)

**Files:** `packages/application/src/workflows/job-transitions.ts`  
**Matrix:** `job-terminal`, `exec-retry`  
**CI:** integration  

Transitions:
- queued → running | failed | dead | cancelled  
- running → queued (exec retry) | succeeded | failed | dead | cancelled  
- terminal immutable; same terminal re-apply idempotent; different terminal → TERMINAL_STATE_CONFLICT  

- [ ] Commit `feat(application): job CAS transitions`

---

## Task M3.3: Claim CTE + fencing + reclaim

**Files:** `packages/db/src/queries/claim-job.sql.ts`, `packages/application/src/workflows/lease.ts`  
**Matrix:** `lease-fence-publish`  
**CI:** integration  

- [ ] `FOR UPDATE SKIP LOCKED` claim; RETURNING old lease; Tx C publish asserts leaseToken+version; expired reclaim only with fencing.
- [ ] Zombie publish after lease loss rejected.
- [ ] Commit `feat(application): job claim lease fence`

---

## Task M3.4: WorkflowInvocation reducer + single winner

**Files:** `packages/application/src/workflows/invocation-reducer.ts`  
**Matrix:** `invocation-winner`, `late-attempt`  
**CI:** integration  

- [ ] CAS select winner attempt; late success records usage/cost, does not replace winner.
- [ ] Commit `feat(application): workflow invocation single winner`

---

## Task M3.5: Attempt reconciliation

**Files:** `packages/application/src/reconciliation/attempt-reconcile.ts`  
**Matrix:** `late-attempt`  
**CI:** integration  

Rules:
- completed + artifact → reuse  
- started + artifact → finalize  
- started + providerRequestId → reconcile with provider if available  
- else → `unknown` + `retryDisposition` set; never blind retry billable unknown  

- [ ] Commit `feat(application): attempt reconciliation`

---

## Task M3.6: AttemptCostExposure + reservation closing

**Files:** `packages/application/src/reconciliation/reservation-closing.ts`  
**Matrix:** `reservation-exposure`  
**CI:** integration  

- [ ] Terminal job releases concurrency slot immediately.  
- [ ] Unresolved attempts → reservation `closing`; only `safeRelease` (≥0); settle/release exposures then `closed`. Excess → RESERVATION_EXPOSURE_EXCEEDED ops incident (no silent clamp below zero).
- [ ] Commit `feat(application): reservation closing and exposures`

---

## Task M3.7: Cancel queued/running + tombstone mid-attempt

**Files:** `use-cases/jobs/cancel-job.ts`  
**Matrix:** `cancel-queued`, `tombstone-mid-attempt`  
**CI:** integration  

- [ ] Cancel queued: release slot + reservation.  
- [ ] Cancel running: set `cancelRequestedAt`; worker checks before each stage; late cost via exposure; no proposal publish after cancel.
- [ ] Commit `feat(application): job cancel and mid-attempt tombstone`

---

## Task M3.8: Manual retry = new job

**Files:** `use-cases/jobs/retry-job.ts`  
**Matrix:** `retry-new-job`  
**CI:** integration  

- [ ] New job row + `retryOfJobId`; never requeue terminal in-place.
- [ ] Commit `feat(application): manual retry creates new job`

---

## Task M3.9: Outbox receipt + replay generation

**Files:** `packages/application/src/workflows/outbox.ts`, worker-outbox handler  
**Matrix:** `outbox-idempotent`, `outbox-uncertain-delivery`, `outbox-replay-generation`  
**CI:** integration  

- [ ] Receipt states: processing | completed | uncertain | dead + `deliveryGeneration`.  
- [ ] Double delivery idempotent.  
- [ ] Uncertain after external side effect retries same dedupeKey.  
- [ ] Dead replay: new deliveryGeneration, same event/dedupeKey/payload.
- [ ] Commit `feat(application): outbox at-least-once receipts`

---

## Task M3.10: Reaper loops (PostgreSQL clock)

**Files:** `packages/application/src/reconciliation/reaper.ts`  
**Matrix:** supports lease/reservation/slot  
**CI:** integration  

- [ ] Lease reclaim candidates; orphan reservation; slot leak repair; stuck attempt → unknown only with strict rules.  
- [ ] All operational timestamps via SQL `NOW()`, never `Date.now()` for lease/expiry decisions.
- [ ] Commit `feat(application): reaper and sweeper loops`

---

## Task M3.11: worker-gen + worker-outbox processes

**Files:** `apps/worker-gen/src/main.ts`, `apps/worker-outbox/src/main.ts`  
**Matrix:** SIGTERM behavior  
**CI:** integration  

- [ ] Poll, heartbeat WorkerInstance, SIGTERM: pre-provider requeue fenced; mid-provider drain then exit (no blind requeue).
- [ ] Commit `feat(workers): gen and outbox processes with graceful drain`

---

## Task M3.12: Mock zero-cost end-to-end job + reliability gate

**Purpose:** Prove mock job through full pipeline AND reliability suite.  
**Prerequisites:** M3.1–M3.11  
**Files:** integration suite `packages/application/src/__tests__/m3-reliability.gate.test.ts`  
**Matrix gate (all required):**

```
lease-fence-publish
job-terminal
exec-retry
reservation-exposure
invocation-winner
late-attempt
outbox-idempotent
outbox-uncertain-delivery
outbox-replay-generation
cancel-queued
retry-new-job
```

- [ ] Enqueue mock → complete → outbox.  
- [ ] Run full gate suite.  
- [ ] Commit `test(m3): reliability gate green with mock job`

### M3 verification gate

All matrix rows above green. **Not done** if only mock zero-cost job passes.

---

# Phase M4 — AI contracts + backend vertical slice + S7 extraction

## Task M4.1: AIExecutionPort + mock provider + buildWorkflowPlan

**Files:** `packages/ai/src/**`  
**Matrix:** single attempt contract  
**CI:** unit  

- [ ] Port: `buildWorkflowPlan`, `executeSingleAttempt`, `parseOutput`, `classifyError`, `decideNextAction`.  
- [ ] `executeSingleAttempt` = exactly one provider call (mock or live). No internal fallback loop.
- [ ] Commit `feat(ai): execution port and mock provider`

---

## Task M4.2: Prompt contracts strict zod

**Files:** `packages/ai/src/prompts/contracts/*.ts`  
**Contracts:**  
`intake.extract.v1`, `foundation.propose.v1`, `character.propose.v1`, `outline.generate.v1`, `beat.write.v1`, `beat.judge.v1`, `beat.repair.v1`, `judge-output.repair.v1`, `publish.package.v1`  

- [ ] All `.strict()`; judge uses `publicMessageCode` enum.  
- [ ] Commit `feat(ai): strict prompt contracts v1`

---

## Task M4.3: Extraction layer (S7 three types)

**Files:**  
- `packages/application/src/extraction/types.ts`  
- `packages/application/src/extraction/extractors/*.ts`  
- `packages/application/src/extraction/temp-ref-resolver.ts`  
- `packages/application/src/extraction/operation-dag.ts`  
- `packages/application/src/extraction/operation-policy.ts`  
- `packages/application/src/extraction/prose-evidence.ts`  
- `packages/application/src/extraction/proposal-integrity.ts`  
**Matrix:** `op-type-boundary`, `tempref-resolve`, `op-allowlist`, `prose-accept-order`, `proposal-operation-hash`, `repair-reextract`  
**CI:** unit  

Pipeline:
```
parseOutput → ModelSuggestionDraft
→ contract-specific extract
→ allocate IDs + resolve tempRef (single GeneratedCandidate scope)
→ reject unresolved/cyclic/cross-candidate refs
→ DAG + deterministic topo sort (tie-break: op type, entity type, target id, operationId)
→ system-derived risk/revisions/sequences
→ allowlist + max counts per contract
→ prose evidence UTF-16 offsets + proseContentHash
→ operationsHash + payloadHash
→ ProseAcceptOperation last for beat
```

Tests required:
- model JSON cannot type as CanonicalChangeOperation  
- cross-candidate tempRef fails  
- beat.write cannot emit outline/foundation ops  
- hash mismatch reject  
- ProseAccept always last  
- repair full re-extraction (no reuse old ops + new proseVersionId)

- [ ] Commit `feat(application): S7 extraction DAG and operation policy`

---

## Task M4.4: Worker handler intake.extract

**Files:** `use-cases/intake/request-intake.ts`, `execute-intake-job.ts`  
**Matrix:** feeds concept flow  
**CI:** integration  

- [ ] Production pipeline: command → job → workflow invocation → attempt → strict parse → extraction → validation → proposal. Mock provider only.
- [ ] Creates ProposalGroup of concept alternatives.
- [ ] Commit `feat(application): intake.extract pipeline`

---

## Task M4.5: concept accept → foundation draft

**Files:** `use-cases/concepts/accept-concept.ts`  
**Matrix:** `concept-accept`  
**CI:** integration  

- [ ] Accept one alt → foundationStatus=`draft`; siblings superseded; **not** locked.
- [ ] Commit `feat(application): concept accept to foundation draft`

---

## Task M4.6: foundation.propose job

**Purpose:** Refine foundation via AI after concept (always available regenerate path).  
**Files:** `use-cases/foundation/request-foundation-propose.ts`, `execute-foundation-propose-job.ts`  
**Matrix:** —  
**CI:** integration  

- [ ] Same production pipeline; ops allowlist foundation only.  
- [ ] Does not auto-lock.
- [ ] Commit `feat(application): foundation.propose pipeline`

---

## Task M4.7: character.propose pipeline

**Files:** `use-cases/characters/request-character-propose.ts`, execute handler  
**CI:** integration  
- [ ] Commit `feat(application): character.propose pipeline`

---

## Task M4.8: outline.generate + batch accept

**Files:** `use-cases/outline/request-outline.ts`, `accept-outline-batch.ts`  
**Matrix:** `outline-downstream`  
**CI:** integration  

- [ ] Generate ~10 chapters; batch accept.  
- [ ] Reject outline.chapter.update if chapter has accepted prose.
- [ ] Commit `feat(application): outline generate and batch accept`

---

## Task M4.9: beat.write + judge per candidate

**Files:** `use-cases/jobs/request-beat-write.ts`, execute stages write+judge  
**Matrix:** `command-no-ai` (web side), request-beat-snapshot  
**CI:** integration  

- [ ] Per-candidate ValidationReport; GeneratedCandidate rows; full Proposal bundle.  
- [ ] Web never calls LLM (architecture test).
- [ ] Commit `feat(application): beat write and judge pipeline`

---

## Task M4.10: beat.repair full re-extraction

**Files:** repair stage handler  
**Matrix:** `repair-reextract`  
**CI:** unit+integration  

- [ ] New ProseVersion + new Proposal; never auto-accept; full re-extract ops.
- [ ] Commit `feat(application): beat repair re-extraction`

---

## Task M4.11: proposal revalidation spawn

**Files:** `use-cases/proposals/revalidate-proposal.ts`  
**CI:** integration  

- [ ] New group + Proposal with `revalidatedFromProposalId`; never reopen old to pending.  
- [ ] UNIQUE(revalidated_from, dependency_hash).
- [ ] Commit `feat(application): proposal revalidation spawn`

---

## Task M4.12: publish.package artifact proposal

**Files:** `use-cases/publish/request-publish-package.ts`  
**Matrix:** `publish-artifact`  
**CI:** integration  

- [ ] ArtifactProposal only — does **not** bump `currentCanonicalVersion`.
- [ ] Commit `feat(application): publish package artifact proposal`

### M4 verification gate

Green: `op-type-boundary`, `tempref-resolve`, `op-allowlist`, `prose-accept-order`, `proposal-operation-hash`, `repair-reextract`, `concept-accept`, `outline-downstream`, `publish-artifact`, `command-no-ai`.  
UI not required — use-case/integration tests sufficient.

---

# Phase M5 — Accept CAS, working draft, DTOs, progress

## Task M5.1: commitCanonicalChangeSet + acceptProposal

**Files:** `use-cases/proposals/commit-canonical-change-set.ts`, `accept-proposal.ts`  
**Matrix:** `accept-proposal`, `accept-cas-stale`, `accept-supersede`, `fact-lifecycle`  
**CI:** integration  

- [ ] Lock proposal + group + project; ownership; status; stale decision; eligibility from ValidationReport; CAS ops; bump entity revisions; project version +1 once; accept + supersede siblings; audit/outbox.  
- [ ] CAS fail / unique violation → **new transaction** mark proposal stale `WHERE status='pending'`.  
- [ ] No direct canon writes elsewhere.
- [ ] Commit `feat(application): accept proposal and commit change set`

---

## Task M5.2: ProseWorkingDraft autosave CAS

**Files:** `use-cases/prose/save-working-draft.ts`  
**Matrix:** `working-draft`  
**CI:** integration  

- [ ] UNIQUE (user_id, beat_id) WHERE deleted_at IS NULL; CAS on version/contentHash.
- [ ] Commit `feat(application): working draft CAS autosave`

---

## Task M5.3: Validation hash binding

**Files:** validation read path  
**Matrix:** `validation-hash`  
**CI:** integration  

- [ ] Report binds proseVersionId + contentHash; edit → stale.
- [ ] Commit `feat(application): validation report hash binding`

---

## Task M5.4: user-origin Proposal from working draft

**Files:** `use-cases/proposals/submit-user-prose.ts`  
**Matrix:** `user-proposal`  
**CI:** integration  

- [ ] `source=user`; snapshot creates new ProseVersion; never fake AI proposal.
- [ ] Commit `feat(application): user-origin prose proposal`

---

## Task M5.5: PublicProposalView mapper

**Files:** `packages/application/src/dto/public-proposal-view.ts`  
**Matrix:** `proposal-dto`, `override-allowlist`  
**CI:** contract  

- [ ] No raw ops; no service_restricted; `availableActions` server-driven; override only server-listed findings.
- [ ] Commit `feat(application): public proposal DTO`

---

## Task M5.6: ProjectProgressView reducer

**Files:** `packages/application/src/progress/project-progress.ts`  
**Matrix:** `progress-view`  
**CI:** unit  

- [ ] Single reducer for dashboard CTA, redirect, chips. No fake writing without job/prose.
- [ ] Commit `feat(application): project progress reducer`

---

## Task M5.7: CreditSummary read model

**Files:** `use-cases/credit/get-credit-summary.ts`  
**Matrix:** `credit-summary` (e2e later)  
**CI:** integration  

- [ ] available / held / reconciling from ledger + reservations.
- [ ] Commit `feat(application): credit summary read model`

### M5 verification gate

Accept path + DTO contract + progress unit tests green.

---

# Phase M6 — Guided UI + Playwright

## Task M6.1: Intake UI

**Files:** `apps/web/app/projects/[id]/intake/page.tsx`  
- [ ] Calls real `requestIntake` command. Commit `feat(web): intake UI`

## Task M6.2: Concepts UI

**Files:** `apps/web/app/projects/[id]/concepts/page.tsx`  
- [ ] Accept concept via real use case. Commit `feat(web): concepts UI`

## Task M6.3: Foundation UI + lock modal

**Files:** foundation pages + confirm modal  
**Matrix:** `foundation-lock`  
- [ ] Lock requires confirm. Commit `feat(web): foundation UI and lock`

## Task M6.4: Characters UI

- [ ] Commit `feat(web): characters UI`

## Task M6.5: Outline UI

- [ ] Commit `feat(web): outline UI`

## Task M6.6: Write room + job phases

**Matrix:** `job-recovery`  
- [ ] PublicJobPhase labels (no fake %). Recover active jobs after refresh.  
- [ ] Commit `feat(web): write room and job phases`

## Task M6.7: Proposals UI

- [ ] Uses PublicProposalView only. Commit `feat(web): proposals UI`

## Task M6.8: Settings credit

**Matrix:** `credit-summary`  
- [ ] Header equals settings snapshot. Commit `feat(web): credit settings`

## Task M6.9: Playwright e2e suite

**Files:**  
- `e2e/vertical-slice.spec.ts`  
- `e2e/auth-magic-link.spec.ts`  
- `e2e/idor.spec.ts`  
- `e2e/job-recovery.spec.ts`  
- `e2e/foundation-lock.spec.ts`  
- `e2e/no-internal-strings.spec.ts`  
**Matrix:** matching e2e rows  
**CI:** e2e  

- [ ] Mail capture transport for magic link — **no** login bypass.  
- [ ] IDOR → NOT_FOUND.  
- [ ] No internal/restricted strings in DOM.  
- [ ] Commit `test(e2e): vertical slice and security e2e`

### M6 verification gate

All e2e matrix rows green with `AI_ENABLE_MOCK=true`.

---

# Phase M7 — CI workflows + staging deploy

## Task M7.1: `.github/workflows/ci.yml`

**Jobs:** lint-typecheck, unit, integration (empty migrate + N-1 fixture), contract, e2e, architecture, migration (drift), security-smoke.  
**PR:** GitHub-hosted, no prod secrets, mock AI only.  
**Files:** `.github/workflows/ci.yml`  
- [ ] Commit `ci: pull request workflow with full gates`

---

## Task M7.2: N-1 migration fixture

**Files:** `packages/db/fixtures/n-1/`, test `migrate-upgrade`  
**Matrix:** `migrate-upgrade`, `migrate-empty`, `prisma-migrate-diff`  
**CI:** migration  
- [ ] Commit `test(db): migrate empty N-1 and drift detection`

---

## Task M7.3: `deploy/build-release.mjs`

- [ ] Immutable artifact + release manifest (`gitSha`, versions, checksum). Build **before** any migrate.  
- [ ] Commit `feat(deploy): build release artifact and manifest`

---

## Task M7.4: `deploy/drain-workers.sh` + `release.sh`

Order: fetch artifact → verify checksum → backup → drain → migrate → symlink current → ready + smoke.  
Checksum mismatch → abort.  
**Matrix:** `deploy-checksum`  
- [ ] Commit `feat(deploy): release and drain scripts`

---

## Task M7.5: readiness endpoints

**Files:** `apps/web/app/health/route.ts`, `apps/web/app/ready/route.ts`  
**Matrix:** `readiness-migration-version`  
- [ ] `/health` no DB; `/ready` env+DB+migration version+artifacts+not draining.  
- [ ] Commit `feat(web): health and readiness endpoints`

---

## Task M7.6: WorkerInstance heartbeat

- [ ] Workers upsert heartbeat; readiness can detect dead workers.  
- [ ] Commit `feat(workers): instance heartbeat`

---

## Task M7.7: deploy-staging.yml

**Files:** `.github/workflows/deploy-staging.yml`  
- [ ] Environment approval; staging secrets only; untrusted PR gets no staging/production secrets.  
- [ ] Commit `ci: staging deploy workflow`

---

## Task M7.8: Staging smoke vertical slice

- [ ] Documented smoke: web→DB→worker→mock job→outbox.  
- [ ] Commit `test(staging): smoke vertical slice script`

### M7 verification gate

CI full green on PR; deploy checksum abort test; readiness migration mismatch fails ready.

---

# Phase M8 — Production readiness

## Task M8.1: deploy-production.yml

**Files:** `.github/workflows/deploy-production.yml`  
- [ ] Manual approval required.  
- [ ] Commit `ci: production deploy workflow with approval`

---

## Task M8.2: backup + restore-verify

**Files:** `deploy/backup.sh`, `deploy/restore-verify.sh`  
- [ ] DB + artifacts + manifest; fail if missing artifact.  
- [ ] Commit `feat(deploy): backup and restore verification`

---

## Task M8.3: migration runner advisory lock

**Matrix:** `migration-runner-lock`  
- [ ] Single PG advisory lock around migrate.  
- [ ] Commit `feat(deploy): migration advisory lock`

---

## Task M8.4: Production secrets least privilege

**Files:** `deploy/ecosystem.config.cjs`, `deploy/nginx.conf.example`  
- [ ] Web: AUTH + DB_WEB + email. Gen: DB_WORKER + AI keys. Outbox: DB_OUTBOX only.  
- [ ] Commit `feat(deploy): pm2 ecosystem and nginx example`

---

## Task M8.5: Final DoD checklist

**Files:** `docs/superpowers/plans/implementation-progress.md` DoD section  
Checklist from design S10.5:
- vertical slice works  
- verification-matrix rows green  
- architecture gates green  
- no service_restricted leak  
- IDOR 404  
- credit consistency  
- job recovery after refresh  
- restore drill documented and verified  

- [ ] Commit `docs: production DoD signed in progress journal`

### M8 verification gate

Production-like smoke complete; restore drill pass; DoD checklist complete in progress journal.

---

## Signup grant (policy lock)

Trigger: first user provisioning transaction (consumeChallenge when creating user) calls `ensureSignupGrant`.  
Dashboard only reads balance. Dedupe `grant:signup:{userId}`.

---

## Env parse policy (lock)

Always pick named keys into plain object, then zod-parse. Never `.strict().parse(process.env)`.

---

## Progress journal

Maintain `docs/superpowers/plans/implementation-progress.md` before/after each task, after commits, before milestone switches, and on blockers.

---

## Milestone completion rule

A milestone is complete only when:
1. All tasks in phase checked  
2. All **M* verification gate** matrix rows pass in named CI jobs  
3. Commit history clean (no uncommitted gate-critical work)  

Not sufficient: “workspace tests mostly green”.

---

## Self-review (vs goal A.1–A.11)

| Gate | Resolution |
|---|---|
| A.1 M3–M8 granular | Each task has purpose, files, matrix, steps, commit |
| A.2 Backend vertical slice | M4.4–M4.12 full pipelines before UI |
| A.3 S7 extraction | M4.3 three-type pipeline + tests |
| A.4 S8 reliability | M3.2–M3.12 + explicit M3 gate list |
| A.5 Auth M0.4 | Full flow + full test bodies |
| A.6 Env pick-parse | M0.2 with production mock reject |
| A.7 Split migrations + SQL | M1.1a/b + M3.0 exhaustive SQL |
| A.8 CI/CD executable | M7–M8 concrete files |
| A.9 Matrix per task | Matrix+CI on every substantive task + milestone gates |
| A.10 Signup grant + folders | Policy lock + file map |
| A.11 No TBD/TODO/etc | Placeholders removed; M1.1c deferred explicitly; M4.6 always available |

**No architecture LOCKED decisions reopened.**

---

## Execution handoff

Plan executable and saved to  
`D:/Coding/Narraza Fix/narraza v2/docs/superpowers/plans/2026-07-18-narraza-v2-implementation.md`.

Per autonomous goal: after this commit, **start Phase B at M0.1** using subagent-driven-development without waiting for re-approval.
