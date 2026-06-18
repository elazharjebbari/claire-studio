#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# test_all.sh — Lance lint + tests unitaires/intégration back & front (sans navigateur).
# Backend : pytest (Postgres requis). Frontend : Vitest + MSW (hermétique, aucun réseau).
# E2E exclu ici (voir e2e.sh / make e2e).
# -----------------------------------------------------------------------------
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

log() { printf '\033[32m[test]\033[0m %s\n' "$*"; }
err() { printf '\033[31m[test][ERR]\033[0m %s\n' "$*" >&2; }

FAILED=0
run() {
  local label="$1"; shift
  log "▶ $label"
  if ! "$@"; then err "✗ $label a échoué"; FAILED=1; else log "✓ $label"; fi
}

# --- 1. Lint -----------------------------------------------------------------
run "lint backend"  make -C "$ROOT_DIR/backend" lint
run "lint frontend" bash -c "cd '$ROOT_DIR/frontend' && pnpm lint && pnpm typecheck"

# --- 2. Backend (pytest) — Postgres requis -----------------------------------
if ! docker compose exec -T postgres pg_isready >/dev/null 2>&1; then
  log "Postgres non prêt : docker compose up -d postgres"
  docker compose up -d postgres
  for i in $(seq 1 30); do
    docker compose exec -T postgres pg_isready >/dev/null 2>&1 && break
    sleep 1
  done
fi
run "pytest backend" make -C "$ROOT_DIR/backend" test

# --- 3. Frontend (Vitest + MSW) ----------------------------------------------
run "vitest frontend" bash -c "cd '$ROOT_DIR/frontend' && pnpm test"

# --- Bilan -------------------------------------------------------------------
if [[ "$FAILED" -ne 0 ]]; then
  err "Au moins une étape a échoué."
  exit 1
fi
log "Toutes les étapes de test (hors e2e) sont vertes."
