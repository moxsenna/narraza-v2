#!/usr/bin/env bash
#
# deploy/restore-verify.sh
#
# Narraza v2 restore verification script.
#
# Takes a backup directory prefix and verifies that all required
# components are present before a restore. Does NOT actually restore
# — this is a verification drill only.
#
# Usage:
#   ./deploy/restore-verify.sh <backup-dir-or-prefix> [--app-dir /opt/narraza] [--database-url ...]
#
# Examples:
#   ./deploy/restore-verify.sh /opt/narraza/backups/backup-20260719_120000
#   ./deploy/restore-verify.sh /opt/narraza/backups/backup-20260719_120000 --dry-run-restore
#
# Exit: 0 if all components verified, non-zero on failure.
#
# Matrix: restore drill

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------

APP_DIR="${APP_DIR:-/opt/narraza}"
BACKUP_PREFIX=""
DATABASE_URL="${DATABASE_URL:-postgresql://narraza:narraza@localhost:5433/narraza}"
DRY_RUN_RESTORE=false

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
    --database-url)
      DATABASE_URL="$2"
      shift 2
      ;;
    --database-url=*)
      DATABASE_URL="${1#*=}"
      shift
      ;;
    --dry-run-restore)
      DRY_RUN_RESTORE=true
      shift
      ;;
    *)
      if [ -z "$BACKUP_PREFIX" ]; then
        BACKUP_PREFIX="$1"
      fi
      shift
      ;;
  esac
done

# ---------------------------------------------------------------------------
# Logging helpers
# ---------------------------------------------------------------------------

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

log()    { echo "$(date -u +'%Y-%m-%dT%H:%M:%SZ') [restore-verify] $*"; }
err()    { echo "$(date -u +'%Y-%m-%dT%H:%M:%SZ') [restore-verify] ERROR: $*" >&2; }
warn()   { echo "$(date -u +'%Y-%m-%dT%H:%M:%SZ') [restore-verify] WARNING: $*" >&2; }

check_pass() {
  echo -e "  ${GREEN}PASS${NC} $*"
  PASS_COUNT=$((PASS_COUNT + 1))
}

check_fail() {
  echo -e "  ${RED}FAIL${NC} $*"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

check_warn() {
  echo -e "  ${YELLOW}WARN${NC} $*"
  WARN_COUNT=$((WARN_COUNT + 1))
}

# ---------------------------------------------------------------------------
# Pre-flight
# ---------------------------------------------------------------------------

if [ -z "$BACKUP_PREFIX" ]; then
  echo "Usage: $0 <backup-dir-or-prefix> [--app-dir /opt/narraza] [--dry-run-restore]"
  echo ""
  echo "Examples:"
  echo "  $0 /opt/narraza/backups/backup-20260719_120000"
  echo "  $0 /opt/narraza/backups/backup-20260719_120000 --dry-run-restore"
  echo ""
  echo "Verifies that backup components exist and are valid for restore."
  echo "Use --dry-run-restore to also attempt pg_restore --schema-only."
  exit 2
fi

log "=== Narraza v2 Restore Verification ==="
log "Backup prefix: ${BACKUP_PREFIX}"
log "App dir:       ${APP_DIR}"
log "DB URL:        ${DATABASE_URL%%@*}@***"  # Mask credentials
log ""

# ---------------------------------------------------------------------------
# 1. Locate backup components
# ---------------------------------------------------------------------------

log "[1/6] Locating backup components..."

# Check if BACKUP_PREFIX is a directory or a prefix
BACKUP_DIR=""
DB_DUMP=""
MANIFEST_FILE=""

# Case 1: BACKUP_PREFIX is a directory
if [ -d "$BACKUP_PREFIX" ]; then
  BACKUP_DIR="$BACKUP_PREFIX"
  log "  Backup is a directory: ${BACKUP_DIR}"

  # Look for DB dump inside directory
  if [ -f "${BACKUP_DIR}/database.dump" ]; then
    DB_DUMP="${BACKUP_DIR}/database.dump"
  elif [ -f "${BACKUP_DIR}/database.sql.gz" ]; then
    DB_DUMP="${BACKUP_DIR}/database.sql.gz"
  elif [ -f "${BACKUP_DIR}/database.sql" ]; then
    DB_DUMP="${BACKUP_DIR}/database.sql"
  fi

  # Look for manifest inside directory
  if [ -f "${BACKUP_DIR}/release-manifest.json" ]; then
    MANIFEST_FILE="${BACKUP_DIR}/release-manifest.json"
  elif [ -f "${BACKUP_DIR}/manifest.json" ]; then
    MANIFEST_FILE="${BACKUP_DIR}/manifest.json"
  fi
else
  # Case 2: BACKUP_PREFIX is a file prefix (backup.sh naming convention)
  log "  Backup prefix pattern: ${BACKUP_PREFIX}"

  # DB dump variants
  if [ -f "${BACKUP_PREFIX}.dump" ]; then
    DB_DUMP="${BACKUP_PREFIX}.dump"
    log "  Found: ${DB_DUMP}"
  elif [ -f "${BACKUP_PREFIX}.sql.gz" ]; then
    DB_DUMP="${BACKUP_PREFIX}.sql.gz"
    log "  Found: ${DB_DUMP}"
  elif [ -f "${BACKUP_PREFIX}.sql" ]; then
    DB_DUMP="${BACKUP_PREFIX}.sql"
    log "  Found: ${DB_DUMP}"
  fi

  # Manifest
  if [ -f "${BACKUP_PREFIX}.manifest.json" ]; then
    MANIFEST_FILE="${BACKUP_PREFIX}.manifest.json"
    log "  Found: ${MANIFEST_FILE}"
  fi
fi

# ---------------------------------------------------------------------------
# 2. Verify DB dump
# ---------------------------------------------------------------------------

log ""
log "[2/6] Verifying database dump..."

if [ -z "$DB_DUMP" ]; then
  check_fail "No database dump found"
  log "  Searched for: ${BACKUP_PREFIX}.dump, .sql.gz, .sql"
  log "  Also checked: ${BACKUP_PREFIX}/ (if directory)"
else
  DUMP_SIZE=$(stat -c%s "$DB_DUMP" 2>/dev/null || stat -f%z "$DB_DUMP" 2>/dev/null || echo "0")

  if [ "$DUMP_SIZE" -gt 0 ]; then
    check_pass "DB dump exists: ${DB_DUMP} (${DUMP_SIZE} bytes)"

    # Check if it's a pg_dump custom format file
    FILE_MAGIC=$(xxd -l 5 -p "$DB_DUMP" 2>/dev/null || head -c 5 "$DB_DUMP" | xxd -p)
    if [ "$FILE_MAGIC" = "5047444d50" ]; then
      log "  Format: pg_dump custom (PGDMP magic detected)"
    else
      log "  Format: plain SQL or compressed"
    fi
  else
    check_fail "DB dump exists but is empty: ${DB_DUMP}"
  fi
fi

# ---------------------------------------------------------------------------
# 3. Verify manifest
# ---------------------------------------------------------------------------

log ""
log "[3/6] Verifying artifact manifest..."

if [ -z "$MANIFEST_FILE" ]; then
  check_fail "No release manifest found"
  log "  Searched for: ${BACKUP_PREFIX}.manifest.json"
  log "  Also checked: ${BACKUP_PREFIX}/ (if directory)"
  log "  A manifest is REQUIRED for restore (contains git SHA, checksum, version)"
else
  MANIFEST_SIZE=$(stat -c%s "$MANIFEST_FILE" 2>/dev/null || stat -f%z "$MANIFEST_FILE" 2>/dev/null || echo "0")

  if [ "$MANIFEST_SIZE" -gt 0 ]; then
    check_pass "Manifest exists: ${MANIFEST_FILE} (${MANIFEST_SIZE} bytes)"

    # Validate JSON structure
    if command -v node &>/dev/null; then
      if node -e "
        const fs = require('fs');
        try {
          const m = JSON.parse(fs.readFileSync('${MANIFEST_FILE}', 'utf-8'));
          if (!m.artifact || !m.checksum || !m.checksum.value) {
            throw new Error('Invalid manifest: missing artifact or checksum');
          }
          console.log(JSON.stringify({
            name: m.name || 'unknown',
            version: m.version || 'unknown',
            artifact: m.artifact,
            checksumAlgo: m.checksum.algorithm || 'unknown',
            gitSha: (m.git && m.git.shortSha) || 'unknown',
          }));
        } catch (e) {
          process.exit(1);
        }
      " 2>/dev/null; then
        MANIFEST_INFO=$(node -e "
          const fs = require('fs');
          const m = JSON.parse(fs.readFileSync('${MANIFEST_FILE}', 'utf-8'));
          console.log('name=' + (m.name||'?') + ' version=' + (m.version||'?') + ' sha=' + ((m.git&&m.git.shortSha)||'?'));
        ")
        log "  Manifest info: ${MANIFEST_INFO}"
      else
        check_warn "Manifest JSON validation failed — file may be corrupted"
      fi
    else
      check_warn "Node not available — skipping JSON validation"
    fi
  else
    check_fail "Manifest exists but is empty: ${MANIFEST_FILE}"
  fi
fi

# ---------------------------------------------------------------------------
# 4. Verify artifact file referenced in manifest
# ---------------------------------------------------------------------------

log ""
log "[4/6] Verifying referenced artifact..."

if [ -n "$MANIFEST_FILE" ] && [ -s "$MANIFEST_FILE" ] && command -v node &>/dev/null; then
  ARTIFACT_NAME=$(node -e "
    const fs = require('fs');
    const m = JSON.parse(fs.readFileSync('${MANIFEST_FILE}', 'utf-8'));
    console.log(m.artifact || '');
  " 2>/dev/null || echo "")

  if [ -n "$ARTIFACT_NAME" ]; then
    RELEASES_DIR="${APP_DIR}/releases"
    ARTIFACT_PATH="${RELEASES_DIR}/${ARTIFACT_NAME}"

    if [ -f "$ARTIFACT_PATH" ]; then
      check_pass "Artifact exists: ${ARTIFACT_PATH}"

      # Verify checksum against manifest
      EXPECTED_CHECKSUM=$(node -e "
        const fs = require('fs');
        const m = JSON.parse(fs.readFileSync('${MANIFEST_FILE}', 'utf-8'));
        console.log(m.checksum.value);
      ")
      ACTUAL_CHECKSUM=$(sha256sum "$ARTIFACT_PATH" | awk '{print $1}')

      if [ "$EXPECTED_CHECKSUM" = "$ACTUAL_CHECKSUM" ]; then
        check_pass "Artifact checksum verified: ${ACTUAL_CHECKSUM}"
      else
        check_fail "Checksum mismatch! Expected: ${EXPECTED_CHECKSUM}"
      fi
    else
      check_fail "Artifact referenced in manifest not found: ${ARTIFACT_PATH}"
      log "  Looked for: ${ARTIFACT_PATH}"
      log "  The artifact tarball is required for a complete restore."
      log "  Without it, you can only restore the database, not the application version."
    fi
  else
    check_warn "Could not extract artifact name from manifest"
  fi
else
  check_warn "Cannot verify artifact — manifest missing or node unavailable"
fi

# ---------------------------------------------------------------------------
# 5. pg_restore dry-run (if requested)
# ---------------------------------------------------------------------------

log ""
log "[5/6] Database restore dry-run..."

if [ "$DRY_RUN_RESTORE" = true ] && [ -n "$DB_DUMP" ]; then
  if command -v pg_restore &>/dev/null; then
    log "  Running pg_restore --list (dry-run)..."

    if pg_restore --list "$DB_DUMP" > /dev/null 2>&1; then
      ITEM_COUNT=$(pg_restore --list "$DB_DUMP" 2>/dev/null | wc -l)
      check_pass "pg_restore can read the dump (${ITEM_COUNT} items)"
    else
      # Try as plain SQL
      if file "$DB_DUMP" | grep -qi "ascii\|utf\|sql\|text"; then
        log "  Dump appears to be plain SQL (not custom format)"
        log "  Plain SQL restores via: gunzip -c ${DB_DUMP} | psql \${DATABASE_URL}"
        check_warn "pg_restore --list not applicable for plain SQL dumps"
      else
        check_fail "pg_restore cannot read the dump — file may be corrupted"
      fi
    fi
  else
    check_warn "pg_restore not found — install postgresql-client to enable dry-run"
  fi
elif [ "$DRY_RUN_RESTORE" = true ] && [ -z "$DB_DUMP" ]; then
  check_fail "Cannot dry-run restore: no DB dump found"
else
  log "  Skipped (use --dry-run-restore to enable)"
fi

# ---------------------------------------------------------------------------
# 6. Restore documentation
# ---------------------------------------------------------------------------

log ""
log "[6/6] Restore procedure documentation"

echo ""
echo "  === RESTORE PROCEDURE ==="
echo ""
echo "  Prerequisites:"
echo "    1. Target Postgres server running"
echo "    2. DATABASE_URL pointing to target database"
echo "    3. The release artifact tarball (matching the manifest)"
echo "    4. Node.js and PM2 installed on target server"
echo ""
echo "  Step 1 — Stop services:"
echo "    pm2 stop all"
echo ""
echo "  Step 2 — Restore database:"
if [ -n "$DB_DUMP" ]; then
  if echo "$DB_DUMP" | grep -q '\.dump$'; then
    echo "    # Custom format:"
    echo "    pg_restore --clean --if-exists --no-owner --no-acl \\"
    echo "      -d \"\${DATABASE_URL}\" \"${DB_DUMP}\""
  elif echo "$DB_DUMP" | grep -q '\.sql\.gz$'; then
    echo "    # Gzipped plain SQL:"
    echo "    gunzip -c \"${DB_DUMP}\" | psql \"\${DATABASE_URL}\""
  else
    echo "    # Plain SQL:"
    echo "    psql \"\${DATABASE_URL}\" < \"${DB_DUMP}\""
  fi
else
  echo "    # No dump found — database restore not possible from this backup"
fi
echo ""
echo "  Step 3 — Extract artifact:"
if [ -n "$ARTIFACT_NAME" ]; then
  echo "    mkdir -p ${APP_DIR}/releases"
  echo "    tar -xzf \"${APP_DIR}/releases/${ARTIFACT_NAME}\" \\"
  echo "      -C \"${APP_DIR}/releases/${ARTIFACT_NAME%.tar.gz}\""
else
  echo "    tar -xzf <release-tarball> -C ${APP_DIR}/releases/<version>"
fi
echo ""
echo "  Step 4 — Run migrations:"
echo "    cd ${APP_DIR}/current"
echo "    node deploy/migrate-with-lock.mjs"
echo ""
echo "  Step 5 — Symlink current:"
echo "    ln -sfn ${APP_DIR}/releases/<version> ${APP_DIR}/current"
echo ""
echo "  Step 6 — Start services:"
echo "    pm2 startOrReload ${APP_DIR}/current/deploy/ecosystem.config.cjs --update-env"
echo "    pm2 save"
echo ""
echo "  Step 7 — Verify:"
echo "    curl http://localhost:3000/health"
echo "    curl http://localhost:3000/ready"
echo "    bash ${APP_DIR}/current/deploy/smoke.sh"
echo ""
echo "  === END RESTORE PROCEDURE ==="
echo ""

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

log ""
log "=== Restore Verification Summary ==="
echo -e "  ${GREEN}Passed:${NC} ${PASS_COUNT}"
echo -e "  ${YELLOW}Warnings:${NC} ${WARN_COUNT}"
echo -e "  ${RED}Failed:${NC} ${FAIL_COUNT}"
echo ""

if [ "$FAIL_COUNT" -gt 0 ]; then
  log "RESTORE VERIFICATION FAILED — do not proceed with restore until all failures are resolved."
  log ""
  log "Common causes:"
  log "  - Backup directory does not exist or has wrong prefix"
  log "  - Database dump is missing or empty"
  log "  - Release manifest is missing (required for traceability)"
  log "  - Artifact tarball is missing (required for complete restore)"
  exit 1
fi

if [ "$WARN_COUNT" -gt 0 ]; then
  log "RESTORE VERIFICATION PASSED WITH WARNINGS — review warnings before proceeding."
else
  log "RESTORE VERIFICATION PASSED — all components present and verified."
fi

log ""
log "This was a VERIFICATION only. No data was modified."
log "To perform an actual restore, follow the procedure documented above."
log ""
exit 0
