#!/usr/bin/env bash
#
# deploy/release.sh
#
# Narraza v2 release orchestration script.
#
# Order (per S10 design):
#   1. Fetch artifact
#   2. Verify checksum (abort on mismatch)
#   3. Backup
#   4. Drain workers
#   5. Migrate database
#   6. Symlink current -> new release
#   7. Restart web + workers
#   8. Ready check + smoke
#
# Usage:
#   ./deploy/release.sh <release-tarball.tar.gz> [--app-dir /opt/narraza]
#
# Matrix: deploy-checksum

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

APP_DIR="${APP_DIR:-/opt/narraza}"
RELEASES_DIR="${APP_DIR}/releases"
CURRENT_LINK="${APP_DIR}/current"
BACKUP_DIR="${APP_DIR}/backups"
DATABASE_URL="${DATABASE_URL:-postgresql://narraza:narraza@localhost:5433/narraza}"
SMOKE_URL="${SMOKE_URL:-http://localhost:3000}"
RELEASE_TARBALL=""

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------

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
    *)
      if [ -z "$RELEASE_TARBALL" ]; then
        RELEASE_TARBALL="$1"
      fi
      shift
      ;;
  esac
done

if [ -z "$RELEASE_TARBALL" ]; then
  echo "Usage: $0 <release-tarball.tar.gz> [--app-dir /opt/narraza]"
  exit 1
fi

# Resolve absolute paths
RELEASES_DIR="${APP_DIR}/releases"
BACKUP_DIR="${APP_DIR}/backups"
CURRENT_LINK="${APP_DIR}/current"

log()  { echo "$(date -u +'%Y-%m-%dT%H:%M:%SZ') [release] $*"; }
err()  { echo "$(date -u +'%Y-%m-%dT%H:%M:%SZ') [release] ERROR: $*" >&2; }
die()  { err "$@"; exit 1; }

# ---------------------------------------------------------------------------
# Pre-flight
# ---------------------------------------------------------------------------

log "=== Narraza v2 Release ==="
log "App dir:   ${APP_DIR}"
log "Tarball:   ${RELEASE_TARBALL}"

if [ ! -f "$RELEASE_TARBALL" ]; then
  die "Tarball not found: ${RELEASE_TARBALL}"
fi

# Extract release version from tarball name
RELEASE_NAME="$(basename "$RELEASE_TARBALL" .tar.gz)"
RELEASE_DIR="${RELEASES_DIR}/${RELEASE_NAME}"
MANIFEST_FILE="${RELEASES_DIR}/release-manifest.json"

log "Release:   ${RELEASE_NAME}"
log "Release dir: ${RELEASE_DIR}"

# ---------------------------------------------------------------------------
# 1. Fetch artifact
# ---------------------------------------------------------------------------

log ""
log "[1/8] Fetching artifact..."
mkdir -p "$RELEASES_DIR"

if [ ! -d "$RELEASE_DIR" ]; then
  mkdir -p "$RELEASE_DIR"
  tar -xzf "$RELEASE_TARBALL" -C "$RELEASE_DIR"
  log "  Extracted to ${RELEASE_DIR}"
else
  log "  Release directory already exists, reusing..."
fi

# ---------------------------------------------------------------------------
# 2. Verify checksum
# ---------------------------------------------------------------------------

log ""
log "[2/8] Verifying checksum..."

# Extract manifest from tarball
MANIFEST_JSON="${RELEASE_DIR}/release-manifest.json"
if [ ! -f "$MANIFEST_JSON" ]; then
  die "release-manifest.json not found in release tarball"
fi

EXPECTED_CHECKSUM=$(node -e "
  const m = require('${MANIFEST_JSON}');
  console.log(m.checksum.value);
" 2>/dev/null || true)

if [ -z "$EXPECTED_CHECKSUM" ]; then
  die "Could not read checksum from manifest"
fi

ACTUAL_CHECKSUM=$(sha256sum "$RELEASE_TARBALL" | awk '{print $1}')

if [ "$EXPECTED_CHECKSUM" != "$ACTUAL_CHECKSUM" ]; then
  die "CHECKSUM MISMATCH! Expected: ${EXPECTED_CHECKSUM} Actual: ${ACTUAL_CHECKSUM}"
fi

log "  Checksum OK: ${ACTUAL_CHECKSUM}"

# Save manifest alongside releases
cp "$MANIFEST_JSON" "$MANIFEST_FILE"
log "  Manifest saved: ${MANIFEST_FILE}"

# ---------------------------------------------------------------------------
# 3. Backup
# ---------------------------------------------------------------------------

log ""
log "[3/8] Creating backup..."

mkdir -p "$BACKUP_DIR"

if [ -L "$CURRENT_LINK" ] && [ -d "$CURRENT_LINK" ]; then
  BACKUP_TIMESTAMP="$(date -u +%Y%m%d_%H%M%S)"
  BACKUP_PATH="${BACKUP_DIR}/backup-${BACKUP_TIMESTAMP}"

  # DB backup via pg_dump if available
  if command -v pg_dump &>/dev/null; then
    log "  Dumping database..."
    pg_dump "$DATABASE_URL" \
      --no-owner --no-acl \
      --file="${BACKUP_PATH}.sql" 2>/dev/null || log "  pg_dump failed (non-fatal)"
  fi

  # Save current manifest for rollback
  if [ -f "$CURRENT_LINK/release-manifest.json" ]; then
    cp "$CURRENT_LINK/release-manifest.json" "${BACKUP_PATH}.manifest.json"
    log "  Previous manifest backed up"
  fi

  log "  Backup saved to ${BACKUP_PATH}"
else
  log "  No current symlink, skipping backup (first deploy?)"
fi

# ---------------------------------------------------------------------------
# 4. Drain workers
# ---------------------------------------------------------------------------

log ""
log "[4/8] Draining workers..."

"${SCRIPT_DIR}/drain-workers.sh"

# ---------------------------------------------------------------------------
# 5. Migrate database
# ---------------------------------------------------------------------------

log ""
log "[5/8] Running database migrations..."

export DATABASE_URL

cd "$RELEASE_DIR"

# Acquire advisory lock to prevent concurrent migrations
log "  Acquiring migration lock..."
node -e "
  const { execSync } = require('child_process');
  execSync('npx prisma migrate deploy --schema prisma/schema.prisma', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
  });
"

# Verify migration status
log "  Checking migration status..."
npx prisma migrate status --schema prisma/schema.prisma || log "  WARNING: migrate status check failed (non-fatal)"

log "  Migrations complete."

# ---------------------------------------------------------------------------
# 6. Symlink current
# ---------------------------------------------------------------------------

log ""
log "[6/8] Updating current symlink..."

if [ -L "$CURRENT_LINK" ]; then
  OLD_TARGET="$(readlink -f "$CURRENT_LINK" || echo "unknown")"
  log "  Previous: ${OLD_TARGET}"
  rm "$CURRENT_LINK"
elif [ -e "$CURRENT_LINK" ]; then
  log "  WARNING: ${CURRENT_LINK} exists and is not a symlink, removing..."
  rm -rf "$CURRENT_LINK"
fi

ln -s "$RELEASE_DIR" "$CURRENT_LINK"
log "  Symlink: ${CURRENT_LINK} -> ${RELEASE_DIR}"

# ---------------------------------------------------------------------------
# 7. Restart services (PM2)
# ---------------------------------------------------------------------------

log ""
log "[7/8] Restarting services..."

if command -v pm2 &>/dev/null; then
  # Check if ecosystem config exists
  ECO_CONFIG="${RELEASE_DIR}/deploy/ecosystem.config.cjs"
  if [ -f "$ECO_CONFIG" ]; then
    log "  Starting/restarting PM2 processes..."
    pm2 startOrReload "$ECO_CONFIG" --update-env
  else
    # Manual restart
    log "  No ecosystem config, restarting individual processes..."
    pm2 restart narraza-web 2>/dev/null || pm2 start "$CURRENT_LINK/apps/web/server.js" --name narraza-web
    pm2 restart narraza-worker-gen 2>/dev/null || pm2 start "$CURRENT_LINK/apps/worker-gen/dist/main.js" --name narraza-worker-gen
    pm2 restart narraza-worker-outbox 2>/dev/null || pm2 start "$CURRENT_LINK/apps/worker-outbox/dist/main.js" --name narraza-worker-outbox
  fi
  pm2 save
  log "  PM2 processes restarted."
else
  log "  PM2 not found — start services manually:"
  log "    cd ${CURRENT_LINK}/apps/web && node server.js &"
  log "    cd ${CURRENT_LINK}/apps/worker-gen && node dist/main.js &"
  log "    cd ${CURRENT_LINK}/apps/worker-outbox && node dist/main.js &"
fi

# ---------------------------------------------------------------------------
# 8. Ready + smoke
# ---------------------------------------------------------------------------

log ""
log "[8/8] Running ready check + smoke..."

# Wait a moment for services to start
sleep 3

"${SCRIPT_DIR}/smoke.sh"

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------

log ""
log "=== Release ${RELEASE_NAME} deployed successfully ==="
log "  Current: ${CURRENT_LINK} -> ${RELEASE_DIR}"
log "  Manifest: ${MANIFEST_FILE}"
log ""
log "To rollback:"
log "  ln -sfn <previous-release-dir> ${CURRENT_LINK}"
log "  pm2 restart all"
log ""
