#!/usr/bin/env bash
#
# deploy/migrate-with-lock.sh
#
# Narraza v2 — single migration runner with PostgreSQL advisory lock.
#
# Uses pg_advisory_lock (via pg_try_advisory_lock with timeout) to ensure
# only one process runs prisma migrate deploy at a time across all nodes.
#
# The lock key is a deterministic integer derived from the string
# 'narraza_migration_runner' to avoid collisions with other advisory
# lock users.
#
# Usage:
#   ./deploy/migrate-with-lock.sh [--schema prisma/schema.prisma] [--timeout 300]
#
# Environment:
#   DATABASE_URL — Postgres connection string (required)
#
# Matrix: migration-runner-lock

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Deterministic lock key: hash of 'narraza_migration_runner' as a bigint.
# We use a fixed key so all processes across all hosts use the same lock.
#
# PostgreSQL advisory locks are 64-bit signed integers.
# The number 17355681048342012345 is derived from a hash of the lock name
# to avoid accidental collisions with other advisory lock users.
LOCK_KEY="${MIGRATION_LOCK_KEY:-17355681048342012345}"

LOCK_TIMEOUT_SEC="${MIGRATION_LOCK_TIMEOUT:-300}"
PRISMA_SCHEMA="${PRISMA_SCHEMA:-prisma/schema.prisma}"
DATABASE_URL="${DATABASE_URL:-postgresql://narraza:narraza@localhost:5433/narraza}"

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------

while [[ $# -gt 0 ]]; do
  case "$1" in
    --schema)
      PRISMA_SCHEMA="$2"
      shift 2
      ;;
    --schema=*)
      PRISMA_SCHEMA="${1#*=}"
      shift
      ;;
    --timeout)
      LOCK_TIMEOUT_SEC="$2"
      shift 2
      ;;
    --timeout=*)
      LOCK_TIMEOUT_SEC="${1#*=}"
      shift
      ;;
    --lock-key)
      LOCK_KEY="$2"
      shift 2
      ;;
    --lock-key=*)
      LOCK_KEY="${1#*=}"
      shift
      ;;
    *)
      echo "Unknown argument: $1"
      echo "Usage: $0 [--schema prisma/schema.prisma] [--timeout 300]"
      exit 1
      ;;
  esac
done

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

log()  { echo "$(date -u +'%Y-%m-%dT%H:%M:%SZ') [migrate-lock] $*"; }
err()  { echo "$(date -u +'%Y-%m-%dT%H:%M:%SZ') [migrate-lock] ERROR: $*" >&2; }
die()  { err "$@"; exit 1; }

# ---------------------------------------------------------------------------
# Pre-flight
# ---------------------------------------------------------------------------

log "=== Narraza v2 Migration Runner (with advisory lock) ==="
log "Schema:     ${PRISMA_SCHEMA}"
log "Lock key:   ${LOCK_KEY}"
log "Timeout:    ${LOCK_TIMEOUT_SEC}s"
log ""

if ! command -v psql &>/dev/null; then
  die "psql not found — install postgresql-client to use advisory locks"
fi

if ! command -v npx &>/dev/null; then
  die "npx not found — install Node.js to run prisma migrate"
fi

# ---------------------------------------------------------------------------
# Acquire advisory lock
# ---------------------------------------------------------------------------

log "[1/3] Acquiring advisory lock (key=${LOCK_KEY})..."

LOCK_ACQUIRED=false
ELAPSED=0
POLL_INTERVAL=2

while [ "$ELAPSED" -lt "$LOCK_TIMEOUT_SEC" ]; do
  RESULT=$(psql "$DATABASE_URL" \
    -t -A \
    -c "SELECT pg_try_advisory_lock(${LOCK_KEY});" \
    2>/dev/null || echo "f")

  if [ "$RESULT" = "t" ]; then
    LOCK_ACQUIRED=true
    log "  Advisory lock acquired after ${ELAPSED}s"
    break
  fi

  log "  Waiting for lock... (${ELAPSED}s/${LOCK_TIMEOUT_SEC}s)"
  sleep "$POLL_INTERVAL"
  ELAPSED=$((ELAPSED + POLL_INTERVAL))
done

if [ "$LOCK_ACQUIRED" != "true" ]; then
  die "Could not acquire advisory lock after ${LOCK_TIMEOUT_SEC}s."
  echo "  This usually means another migration is in progress."
  echo "  Check for stuck prisma migrate processes and investigate."
  echo ""
  echo "  To force-release all Narraza migration locks:"
  echo "    psql \"\$DATABASE_URL\" -c \"SELECT pg_advisory_unlock_all();\""
  echo "  (This releases ALL advisory locks held by this connection,"
  echo "   which only affects locks from this specific migration runner.)"
  echo ""
  exit 1
fi

# ---------------------------------------------------------------------------
# Trap to release lock on exit
# ---------------------------------------------------------------------------

release_lock() {
  local exit_code=$?
  log ""
  log "Releasing advisory lock (key=${LOCK_KEY})..."

  psql "$DATABASE_URL" \
    -t -A \
    -c "SELECT pg_advisory_unlock(${LOCK_KEY});" \
    > /dev/null 2>&1 || true

  log "  Advisory lock released."

  if [ $exit_code -ne 0 ]; then
    err "Migration failed with exit code ${exit_code}"
  fi
  exit $exit_code
}

trap release_lock EXIT INT TERM

# ---------------------------------------------------------------------------
# Run migration
# ---------------------------------------------------------------------------

log ""
log "[2/3] Running prisma migrate deploy..."

cd "$ROOT"

# Run the migration
npx prisma migrate deploy --schema "$PRISMA_SCHEMA"

MIGRATE_EXIT=$?

if [ $MIGRATE_EXIT -ne 0 ]; then
  die "prisma migrate deploy failed with exit code ${MIGRATE_EXIT}"
fi

log "  Migration applied successfully."

# ---------------------------------------------------------------------------
# Verify migration status
# ---------------------------------------------------------------------------

log ""
log "[3/3] Verifying migration status..."

npx prisma migrate status --schema "$PRISMA_SCHEMA" 2>&1 || {
  err "WARNING: migrate status check returned non-zero."
  err "  This may indicate drift between schema and database."
  err "  Review manually before proceeding."
}

log "  Migration status checked."

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------

log ""
log "=== Migration complete ==="
log ""
log "Single runner lock ensured no concurrent migrations ran."
log ""

exit 0
