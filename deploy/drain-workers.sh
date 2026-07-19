#!/usr/bin/env bash
#
# deploy/drain-workers.sh
#
# Gracefully drain Narraza worker processes before deploy.
# Sets drain flag on each worker instance so they stop picking up new jobs,
# then waits for in-flight jobs to complete (with timeout).
#
# Usage:
#   ./deploy/drain-workers.sh [--timeout 120]
#
# Expected to be called from deploy/release.sh before symlink swap.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
TIMEOUT_SEC="${DRAIN_TIMEOUT:-120}"

# Parse --timeout argument
for arg in "$@"; do
  case "$arg" in
    --timeout)
      shift
      TIMEOUT_SEC="${1:-$TIMEOUT_SEC}"
      shift
      ;;
    --timeout=*)
      TIMEOUT_SEC="${arg#*=}"
      ;;
  esac
done

echo "=== Narraza Worker Drain ==="
echo "Timeout: ${TIMEOUT_SEC}s"
echo ""

# ---------------------------------------------------------------------------
# 1. Signal workers to drain via PM2
# ---------------------------------------------------------------------------

signal_drain_pm2() {
  if command -v pm2 &>/dev/null; then
    echo "[drain] Sending SIGTERM to worker-gen..."
    pm2 sendSignal SIGTERM narraza-worker-gen 2>/dev/null || echo "  worker-gen not running (ok)"

    echo "[drain] Sending SIGTERM to worker-outbox..."
    pm2 sendSignal SIGTERM narraza-worker-outbox 2>/dev/null || echo "  worker-outbox not running (ok)"
  else
    echo "[drain] PM2 not found — looking for worker PIDs..."
    # Fallback: Find worker processes by name
    local gen_pids
    gen_pids=$(pgrep -f "worker-gen" 2>/dev/null || true)
    if [ -n "$gen_pids" ]; then
      for pid in $gen_pids; do
        echo "  Sending SIGTERM to worker-gen PID $pid"
        kill -TERM "$pid" 2>/dev/null || true
      done
    fi

    local outbox_pids
    outbox_pids=$(pgrep -f "worker-outbox" 2>/dev/null || true)
    if [ -n "$outbox_pids" ]; then
      for pid in $outbox_pids; do
        echo "  Sending SIGTERM to worker-outbox PID $pid"
        kill -TERM "$pid" 2>/dev/null || true
      done
    fi
  fi
}

# ---------------------------------------------------------------------------
# 2. Wait for workers to finish
# ---------------------------------------------------------------------------

wait_for_drain() {
  local elapsed=0
  local interval=2

  while [ "$elapsed" -lt "$TIMEOUT_SEC" ]; do
    local gen_running
    gen_running=$(pgrep -f "worker-gen" 2>/dev/null | wc -l)
    local outbox_running
    outbox_running=$(pgrep -f "worker-outbox" 2>/dev/null | wc -l)

    if [ "$gen_running" -eq 0 ] && [ "$outbox_running" -eq 0 ]; then
      echo "[drain] All workers stopped after ${elapsed}s"
      return 0
    fi

    echo "  Waiting... (gen: ${gen_running}, outbox: ${outbox_running}) [${elapsed}s/${TIMEOUT_SEC}s]"
    sleep "$interval"
    elapsed=$((elapsed + interval))
  done

  echo "[drain] WARNING: Timeout reached after ${TIMEOUT_SEC}s."
  echo "  Force-killing remaining workers..."

  # Force kill remaining workers
  pkill -9 -f "worker-gen" 2>/dev/null || true
  pkill -9 -f "worker-outbox" 2>/dev/null || true

  return 0
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

signal_drain_pm2
wait_for_drain

echo ""
echo "[drain] Drain complete. Ready for deploy."
echo ""
