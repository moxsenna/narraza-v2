/**
 * GET /ready
 *
 * Deep readiness probe.
 * Checks:
 *  - Environment variables (DATABASE_URL present)
 *  - Database connectivity (can query _prisma_migrations)
 *  - Migration status (at least one migration applied)
 *  - Not in draining mode
 *
 * Returns 200 OK with details if ready.
 * Returns 503 Service Unavailable if not ready.
 *
 * Used by: deploy scripts, monitoring, load balancer health.
 *
 * Matrix: readiness-migration-version
 */
export const dynamic = 'force-dynamic';

interface ReadyCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  detail?: string;
}

interface ReadyResponse {
  status: 'ready' | 'not-ready';
  checks: ReadyCheck[];
  timestamp: string;
}

async function runChecks(): Promise<ReadyCheck[]> {
  const checks: ReadyCheck[] = [];

  // -------------------------------------------------------------------------
  // 1. Environment variables
  // -------------------------------------------------------------------------
  {
    const url = process.env.DATABASE_URL_WEB || process.env.DATABASE_URL;
    if (!url) {
      checks.push({
        name: 'env:DATABASE_URL',
        status: 'fail',
        detail: 'DATABASE_URL_WEB or DATABASE_URL must be set',
      });
    } else if (!url.startsWith('postgresql://') && !url.startsWith('postgres://')) {
      checks.push({
        name: 'env:DATABASE_URL',
        status: 'fail',
        detail: 'DATABASE_URL must start with postgresql:// or postgres://',
      });
    } else {
      checks.push({ name: 'env:DATABASE_URL', status: 'pass' });
    }
  }

  {
    if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
      checks.push({
        name: 'env:AUTH_SECRET',
        status: 'fail',
        detail: 'AUTH_SECRET must be at least 32 characters',
      });
    } else {
      checks.push({ name: 'env:AUTH_SECRET', status: 'pass' });
    }
  }

  // -------------------------------------------------------------------------
  // 2. Database connectivity
  // -------------------------------------------------------------------------
  try {
    // Dynamic import to keep server-only Prisma in server context
    const { getPrisma } = await import('@narraza/db');
    const prisma = getPrisma();

    // Can we reach the database?
    const dbResult = await prisma.$queryRawUnsafe<Array<{ result: number }>>(
      'SELECT 1 AS result',
    );
    if (dbResult?.[0]?.result === 1) {
      checks.push({ name: 'db:connectivity', status: 'pass' });
    } else {
      checks.push({ name: 'db:connectivity', status: 'fail', detail: 'Unexpected query result' });
    }
  } catch (err) {
    checks.push({
      name: 'db:connectivity',
      status: 'fail',
      detail: `Database query failed: ${err instanceof Error ? err.message : 'unknown error'}`,
    });
    // If DB is completely down, skip remaining DB checks
    return checks;
  }

  // -------------------------------------------------------------------------
  // 3. Migration version
  // -------------------------------------------------------------------------
  try {
    const { getPrisma } = await import('@narraza/db');
    const prisma = getPrisma();

    // Query Prisma's internal migrations table
    interface MigrationRow {
      migration_name: string;
      started_at: string;
      finished_at: string | null;
      rolled_back_at: string | null;
      logs: string | null;
    }

    const migrations = await prisma.$queryRawUnsafe<MigrationRow[]>(
      `SELECT migration_name, started_at, finished_at, rolled_back_at, logs
       FROM _prisma_migrations
       WHERE rolled_back_at IS NULL
       ORDER BY finished_at DESC
       LIMIT 1`,
    );

    if (migrations.length === 0) {
      checks.push({
        name: 'migration:version',
        status: 'fail',
        detail: 'No migrations found in _prisma_migrations table',
      });
    } else {
      const latest = migrations[0]!;
      const hasFailures = latest.logs?.toLowerCase().includes('error');
      checks.push({
        name: 'migration:version',
        status: hasFailures ? 'warn' : 'pass',
        detail: hasFailures
          ? `Latest migration ${latest.migration_name} has errors in logs`
          : `Latest: ${latest.migration_name} (${latest.finished_at ?? 'unknown'})`,
      });
    }
  } catch (err) {
    checks.push({
      name: 'migration:version',
      status: 'fail',
      detail: `Could not query migration status: ${err instanceof Error ? err.message : 'unknown'}`,
    });
  }

  // -------------------------------------------------------------------------
  // 4. Not draining
  // -------------------------------------------------------------------------
  {
    const draining = process.env.NARRAZA_DRAINING === 'true';
    checks.push({
      name: 'operational:draining',
      status: draining ? 'fail' : 'pass',
      detail: draining ? 'Server is in draining mode — reject new traffic' : undefined,
    });
  }

  return checks;
}

export async function GET(): Promise<Response> {
  const checks = await runChecks();

  const hasFail = checks.some((c) => c.status === 'fail');
  const httpStatus = hasFail ? 503 : 200;
  const readyStatus: ReadyResponse['status'] = hasFail ? 'not-ready' : 'ready';

  const body: ReadyResponse = {
    status: readyStatus,
    checks,
    timestamp: new Date().toISOString(),
  };

  return Response.json(body, {
    status: httpStatus,
    headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
  });
}
