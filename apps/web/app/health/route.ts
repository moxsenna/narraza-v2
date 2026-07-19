/**
 * GET /health
 *
 * Lightweight health check — no database call.
 * Returns 200 OK if the web server is running.
 *
 * Used by: load balancers, nginx upstream health checks.
 */
export const dynamic = 'force-dynamic';

export function GET(): Response {
  return Response.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    },
    {
      status: 200,
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
    },
  );
}
