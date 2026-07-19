# N-1 Migration Fixture

This directory holds the captured state of a database at the **N-1** migration
(revision just before the latest). It is used in CI to verify:

- `prisma migrate deploy` from N-1 to HEAD succeeds cleanly
- Drift detection (`prisma migrate status`) passes
- No migration generates warnings or fails with schema mismatches

## How to capture N-1

1. Start Postgres 16 (e.g. `docker-compose up -d`).
2. Run migrations up to N-1:

```bash
DATABASE_URL=postgresql://narraza:narraza@localhost:5433/narraza \
  npx prisma migrate resolve --applied <n-1-migration-name> --schema prisma/schema.prisma
```

3. Dump schema + data:

```bash
pg_dump -U narraza -h localhost -p 5433 \
  --schema-only --no-owner --no-acl \
  narraza > packages/db/fixtures/n-1/schema.sql
```

4. Verify the dump applies to an empty database before committing.

## CI usage

The `migration` CI job:
1. Applies all migrations from an empty DB
2. Runs `prisma migrate status` to check drift
3. Verifies the migrations folder has at least one file

For a full N-1 upgrade integration test, see `packages/db/src/__tests__/migrate-upgrade.test.ts`.

## Current state

Migrations tracked in `prisma/migrations/`:
- `20260718235916_m0_identity`
- `20260719010924_m1_all_canon_prose`
- `20260719114936_m3_jobs_credits_outbox`

The N-1 fixture is light at this stage. As more migrations accumulate,
a full pg_dump schema SQL can be committed here for regression testing.
