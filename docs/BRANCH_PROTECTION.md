# Branch protection — Narraza v2

Default branch: **`master`**.

## Required settings (GitHub → Settings → Branches → Branch protection rules)

| Setting | Value |
| --- | --- |
| Branch name pattern | `master` |
| Require a pull request before merging | On |
| Required approving reviews | ≥ 1 (recommended) |
| Require status checks to pass before merging | On |
| Require branches to be up to date before merging | On (recommended) |
| Do not allow bypassing the above settings | On for production |
| Allow force pushes | Off |
| Allow deletions | Off |

## Required status checks (job names from `ci.yml`)

1. `Lint & Typecheck`
2. `Unit Tests`
3. `Integration Tests`
4. `Architecture Boundaries`
5. `Migration (empty + drift)`
6. `Security Smoke`
7. `Contract Tests`
8. `E2E (Playwright)`

After the first green CI run on `master`, these check names appear in the branch protection UI and can be marked required.

## Notes

- CI triggers: `push` and `pull_request` targeting `master`.
- Soft-fail gates (`continue-on-error`, `|| true` on builds) are forbidden on release paths.
- Mock AI is allowed only in CI/dev via `AI_ENABLE_MOCK=true` with non-production `NODE_ENV`.
