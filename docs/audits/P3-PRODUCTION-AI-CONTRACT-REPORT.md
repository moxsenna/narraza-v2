# P3 — Production AI Contract Integration Report

**Date:** 2026-07-20  
**Branch:** `master`  
**Depends on:** P0 Trust Gate + P1 Safe Writing + P2 Enforcement Wiring

## Summary

Production AI is now reachable through a **provider-neutral, fail-fast, firewall-guarded** path. Beat-writing jobs refuse incomplete validation context before any provider call. Writer payloads cannot carry hidden truths. CI uses a **fake provider** (no live API keys).

## What was built

### P3.0 — ValidationContextSnapshot (close P2 gap)

| Item | Detail |
| --- | --- |
| Module | `packages/application/src/context/validation-context-snapshot.ts` |
| Compiler version | `p3-context-compiler-v1` |
| Modes | `full` \| `structural_only` |
| Completeness | `complete` \| `incomplete` |
| Gate | `assertProductionProseContextReady` — throws before provider |
| Accept | `assertReportContextAcceptable` rejects `structural_only` / incomplete meta |

Snapshot fields (minimum): project revision, chapter number, beat ID, Beat Contract, reader/POV facts, character knowledge, confirmed canon, forbidden reveals/concepts, safe breadcrumbs, speech rules, previous accepted prose ref, validator + compiler versions.

`requestBeatWrite` now **server-compiles** a complete snapshot into job payload (`validationContextSnapshot`). Client secrets are not trusted.

### P3.1–P3.2 — Provider contract + production adapter

| Component | Path |
| --- | --- |
| Port | Existing `AIExecutionPort` (`executeSingleAttempt`, plan, parse, classify) |
| Factory | `createAIExecutionPort` — mock forbidden in production; missing key fail-fast |
| Production adapter | `createProductionAIExecutionPort` (OpenRouter HTTP, timeout, abort) |
| Fake adapter (CI) | `createFakeAIExecutionPort` scenarios: success, leak, 429, 500, timeout, auth, malformed, schema_invalid, safety, context_too_large |

Error taxonomy (via `classifyError`):

- `PROVIDER_AUTH` (non-retry)
- `RATE_LIMITED` (retry)
- `PROVIDER_TIMEOUT` (retry)
- `PROVIDER_UNAVAILABLE` (retry)
- `SAFETY_REFUSAL` (non-retry)
- `CONTEXT_TOO_LARGE` (non-retry)
- `MALFORMED_OUTPUT` / schema (non-retry)
- `PROVIDER_ERROR` / `UNKNOWN_ERROR`

### P3.3–P3.4 — Structured output + prompt registry

| Item | Path |
| --- | --- |
| Registry | `packages/ai/src/prompt-contract-registry.ts` |
| Contracts | `intake.extract.v1`, `foundation.propose.v1`, `character.propose.v1`, `outline.generate.v1`, `beat.write.v1`, `beat.judge.v1`, `beat.repair.v1`, `publish.package.v1` |
| Each entry | version, task type, Zod output schema, system instruction, context policy, invention policy, max tokens, capabilities |
| Validate | `validateContractOutput(version, rawBody)` parse + Zod |

### P3.5 — Writer Context Firewall

| Item | Path |
| --- | --- |
| Module | `packages/application/src/context/writer-context-firewall.ts` |
| Compiler | `p3-writer-context-v1` |
| Build | `compileWriterProviderPayload` via `applyRevealPolicy` + `buildWriterPacket` |
| Assert | `enforceWriterFirewallOrThrow` — no hidden truth, no forbidden fields, complete context |
| Sanitization | `mustNotInclude` phrases that equal forbidden truths → opaque `[withheld:…]` tokens |

### P3.6 — Beat vertical slice

`executeBeatJob` order:

```
load job
→ build ValidationContextSnapshot (server)
→ assertProductionProseContextReady  // fail → job failed, no provider
→ compileWriterProviderPayload + firewall
→ write / judge / repair (provider)
→ persist ProseVersion
→ runAndPersistProseValidation (full context meta)
→ job succeeded
```

### P3.7 — Retry / idempotency (policy)

- Single-attempt port: no internal silent retry/fallback (retries remain worker-level via job requeue).
- Auth / malformed / safety / context-too-large → non-retryable classification.
- Timeout / 429 / 5xx → retryable classification for worker policy.
- Job already uses lease + status transitions; cancelled jobs should not re-persist (existing worker cancel fence).

### P3.8 — Observability

| Item | Path |
| --- | --- |
| Logger | `packages/application/src/observability/ai-job-log.ts` |
| Fields | job type, operation ID, trace ID, provider/model internal, prompt contract, context compiler, latency, usage, retry, result status, validation status, blocking count |
| Redaction | API keys, Bearer tokens, authorization headers |

Never logs: API keys, full hidden truths, raw manuscripts by default.

## Tests run

| Command | Result |
| --- | --- |
| `npm run test -w @narraza/ai` | **43** passed |
| `npm run test -w @narraza/application` | **169** passed |
| Includes | `fake-provider-and-registry`, `p3-production-ai-contract`, `p3-beat-slice-fake-provider`, `p2-enforcement-wiring`, vertical-slice beat write |

### Mandatory scenarios

1. **Incomplete context → provider never called** — unit assert + job fails with `incomplete_validation_context`.
2. **Reveal leak (fake provider) → ValidationReport blockers → accept rejected → repair new version → accept** — `p3-beat-slice-fake-provider.test.ts`.
3. **Writer payload excludes hidden truth** — firewall tests.
4. **Production mock / missing key fail-fast** — factory tests.

## CI

CI must stay green **without live provider**. Fake provider + mock AI for E2E.

*(Evidence filled after push: Actions run URL.)*

## How to enable production safely

1. Set `NODE_ENV=production`.
2. Set `AI_ENABLE_MOCK=false` (or unset).
3. Set `OPENROUTER_API_KEY` (≥20 chars) on **worker-gen only** (never web env schema).
4. Optionally `defaultModelId` via production port config.
5. Ensure enqueue path supplies rich `validationContextSnapshot` from canon (forbidden reveals, beat contract, knowledge) for real projects.
6. Monitor `ai_job` structured logs; alert on `firewall_block` / `incomplete_context` spikes.
7. Do **not** enable intake/outline production jobs until beat-write slice is stable in staging.

## Known limitations

1. OpenRouter production adapter returns raw model JSON; live model must honor contracts (CI does not call live).
2. Worker-level exponential backoff not newly parameterized — classification ready for existing retry loop.
3. Playwright UI E2E for accept/repair not expanded; backend integration covers enforcement.
4. Full canon loaders (DB → snapshot) for all fact tables still partial — enqueue compiles minimal complete defaults when fields omitted.
5. Planner-restricted jobs (intake/outline) still use mock plans in most tests; production path is same factory.

## Verdict

**P3 local acceptance: PASS.** Production adapter + contract registry + context firewall + fake-provider CI path. Structural-only / incomplete context cannot accept production prose. Hidden truth cannot enter writer provider payload.

Next (not in P3): Write Room UI, real outbox, full production enablement of intake/outline after beat-write staging.
