#!/usr/bin/env bash
#
# deploy/backup.sh
#
# Narraza v2 backup script.
# Backs up database (pg_dump) and release artifacts.
#
# RPO: 24h / RTO: 4h (design S10.4)
#
# Usage:
#   ./deploy/backup.sh [--app-dir /opt/narraza] [--backup-dir /opt/narraza/backups]
#
# Called by cron (daily) or manually before risky operations.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"

APP_DIR="${APP_DIR:-/opt/narraza}"
BACKUP_DIR="${APP_DIR}/backups"
DATABASE_URL="${DATABASE_URL:-postgresql://narraza:narraza@localhost:5433/narraza}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --app-dir)
      APP_DIR="$2"
      shift 2
      ;;
    --app-dir=*)
      APP_DIR="${1#*=}"
      shift
      ;;
    --backup-dir)
      BACKUP_DIR="$2"
      shift 2
      ;;
    --backup-dir=*)
      BACKUP_DIR="${1#*=}"
      shift
      ;;
    *)
      shift
      ;;
  esac
done

RELEASES_DIR="${APP_DIR}/releases"
CURRENT_LINK="${APP_DIR}/current"

log()  { echo "$(date -u +'%Y-%m-%dT%H:%M:%SZ') [backup] $*"; }
err()  { echo "$(date -u +'%Y-%m-%dT%H:%M:%SZ') [backup] ERROR: $*" >&2; }

# ---------------------------------------------------------------------------
# Pre-flight
# ---------------------------------------------------------------------------

mkdir -p "$BACKUP_DIR"

BACKUP_TIMESTAMP="$(date -u +%Y%m%d_%H%M%S)"
BACKUP_PREFIX="${BACKUP_DIR}/backup-${BACKUP_TIMESTAMP}"

log "=== Narraza v2 Backup ==="
log "Timestamp:  ${BACKUP_TIMESTAMP}"
log "Backup dir: ${BACKUP_DIR}"

# ---------------------------------------------------------------------------
# 1. Database backup (pg_dump)
# ---------------------------------------------------------------------------

log ""
log "[1/3] Database backup..."

if command -v pg_dump &>/dev/null; then
  DB_BACKUP="${BACKUP_PREFIX}.sql.gz"
  log "  Dumping to ${DB_BACKUP}..."

  pg_dump "$DATABASE_URL" \
    --no-owner \
    --no-acl \
    --format=custom \
    --file="${BACKUP_PREFIX}.dump" 2>/dev/null \
    || pg_dump "$DATABASE_URL" \
      --no-owner \
      --no-acl \
      --file="${BACKUP_PREFIX}.sql" 2>/dev/null \
    || log "  WARNING: pg_dump failed — database may not be accessible"

  # Compress if we have a SQL dump
  if [ -f "${BACKUP_PREFIX}.sql" ]; then
    gzip -f "${BACKUP_PREFIX}.sql"
  fi

  log "  Database backup complete."
else
  log "  WARNING: pg_dump not found — skipping database backup"
  log "  Install postgresql-client to enable database backups"
fi

# ---------------------------------------------------------------------------
# 2. Artifact backup (manifest of current release)
# ---------------------------------------------------------------------------

log ""
log "[2/3] Artifact manifest backup..."

if [ -L "$CURRENT_LINK" ] && [ -d "$CURRENT_LINK" ]; then
  CURRENT_RELEASE="$(readlink -f "$CURRENT_LINK" || echo "unknown")"
  log "  Current release: ${CURRENT_RELEASE}"

  # Save current manifest
  if [ -f "${CURRENT_LINK}/release-manifest.json" ]; then
    cp "${CURRENT_LINK}/release-manifest.json" "${BACKUP_PREFIX}.manifest.json"
    log "  Manifest backed up."
  else
    # Fallback: save a minimal deployment record
    echo "{\"deployedAt\":\"$(date -u +'%Y-%m-%dT%H:%M:%SZ')\",\"releaseDir\":\"${CURRENT_RELEASE}\",\"note\":\"No manifest found in current release\"}" \
      > "${BACKUP_PREFIX}.manifest.json"
    log "  WARNING: No manifest in current release, saved minimal record."
  fi
else
  log "  WARNING: No current symlink found — skipping artifact backup"
fi

# ---------------------------------------------------------------------------
# 3. Retention cleanup
# ---------------------------------------------------------------------------

log ""
log "[3/3] Retention cleanup (keep last 7 days)..."

# Delete backups older than 7 days
find "$BACKUP_DIR" -name "backup-*" -mtime +7 -delete 2>/dev/null || true

# Keep at most 10 backups regardless of age
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/backup-* 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt 10 ]; then
  TO_DELETE=$((BACKUP_COUNT - 10))
  log "  Pruning ${TO_DELETE} oldest backups (count=${BACKUP_COUNT})..."
  ls -1t "$BACKUP_DIR"/backup-* 2>/dev/null | tail -n "$TO_DELETE" | xargs rm -f
fi

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------

log ""
log "=== Backup complete ==="
log "  Prefix: ${BACKUP_PREFIX}"
log ""
log "To restore:"
log "  # Database:"
log "  pg_restore -d \${DATABASE_URL} ${BACKUP_PREFIX}.dump"
log "  # Or if plain SQL:"
log "  gunzip -c ${BACKUP_PREFIX}.sql.gz | psql \${DATABASE_URL}"
log ""
log "  # Artifacts:"
log "  cat ${BACKUP_PREFIX}.manifest.json"
log ""
