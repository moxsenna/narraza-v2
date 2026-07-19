/**
 * apps/worker-gen/src/heartbeat.ts
 *
 * WorkerInstance heartbeat subsystem.
 *
 * ## Design
 *
 * Each worker instance (gen, outbox) registers itself in the `WorkerInstance`
 * table on startup and periodically upserts a heartbeat timestamp. The readiness
 * endpoint (`/ready`) can detect dead workers by checking for stale heartbeats.
 *
 * ## Flow
 *
 * 1. **Register** — On startup, `workerRepo.create({ instanceId, role })` registers
 *    the instance. If it already exists (duplicate instanceId), `heartbeat()` is called
 *    instead to update the timestamp.
 * 2. **Heartbeat loop** — A `setInterval` calls `workerRepo.heartbeat(instanceId)` every
 *    `WORKER_{ROLE}_HEARTBEAT_MS` (default 15 seconds).
 * 3. **Drain on shutdown** — `SIGTERM`/`SIGINT` calls `workerRepo.setDraining(instanceId, true)`
 *    before the worker exits.
 * 4. **Stale detection** — `workerRepo.listStaleHeartbeats(threshold, limit)` returns
 *    instances whose `lastHeartbeatAt` is older than the threshold. The readiness
 *    endpoint can use this to report degraded state.
 *
 * ## Configuration (env vars)
 *
 * | Variable | Default | Description |
 * |---|---|---|
 * | `WORKER_GEN_HEARTBEAT_MS` | 15000 | Heartbeat interval for worker-gen |
 * | `WORKER_OUTBOX_HEARTBEAT_MS` | 15000 | Heartbeat interval for worker-outbox |
 * | `WORKER_STALE_THRESHOLD_MS` | 45000 | Threshold for considering a worker stale (3x heartbeat interval) |
 *
 * ## Monitoring
 *
 * - Query `SELECT * FROM "WorkerInstance" WHERE "lastHeartbeatAt" < NOW() - INTERVAL '45 seconds'`
 *   to find workers that have stopped heartbeating.
 * - `/ready` reports degraded readiness if any worker instance is past the stale threshold.
 *
 * ## Testing
 *
 * The heartbeat is testable via the injectable `_sleep` export. Tests can replace
 * the sleep function to fast-forward the poll loop.
 *
 * ### Existing coverage
 *
 * - worker-gen `main.ts`: heartbeat on startup, periodic heartbeat in main loop,
 *   clear heartbeat on shutdown
 * - worker-outbox `main.ts`: same pattern
 * - `worker-instance-repo.ts`: heartbeat upsert, setDraining, listStaleHeartbeats
 * - `tx-worker-instance-repo.ts`: transaction-aware versions
 */
export {};
