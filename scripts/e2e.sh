#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# e2e.sh — Playwright contre la pile RÉELLE (12 specs F1->F12, Q-FON-01).
# Orchestration : Postgres -> migrate -> seed -> backend :8000 -> frontend :3001
#                 -> attendre healthchecks -> playwright test -> teardown.
# -----------------------------------------------------------------------------
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3001}"
E2E_BASE_URL="${E2E_BASE_URL:-http://localhost:${FRONTEND_PORT}}"
E2E_API_URL="${E2E_API_URL:-http://localhost:${BACKEND_PORT}/api/v1}"

log() { printf '\033[34m[e2e]\033[0m %s\n' "$*"; }
err() { printf '\033[31m[e2e][ERR]\033[0m %s\n' "$*" >&2; }

PIDS=()
STARTED_STACK=0
cleanup() {
  if [[ "$STARTED_STACK" -eq 1 ]]; then
    log "Teardown : arrêt backend/frontend…"
    for pid in "${PIDS[@]:-}"; do [[ -n "${pid:-}" ]] && kill "$pid" 2>/dev/null || true; done
  fi
}
trap cleanup EXIT INT TERM

wait_http() {  # wait_http <url> <label> <retries>
  local url="$1" label="$2" retries="${3:-60}"
  log "Attente de $label ($url)…"
  for _ in $(seq 1 "$retries"); do
    if curl -fsS "$url" >/dev/null 2>&1; then log "$label prêt."; return 0; fi
    sleep 2
  done
  err "$label indisponible après $((retries*2))s."; return 1
}

# Si la pile est déjà up (CI lance les services à part), on ne fait que les tests.
if curl -fsS "${E2E_API_URL}/" >/dev/null 2>&1 && curl -fsS "${E2E_BASE_URL}/" >/dev/null 2>&1; then
  log "Pile déjà disponible — lancement direct des tests Playwright."
else
  STARTED_STACK=1
  log "Démarrage de la pile pour l'E2E…"
  docker compose up -d postgres
  for i in $(seq 1 30); do docker compose exec -T postgres pg_isready >/dev/null 2>&1 && break; sleep 1; done

  make -C "$ROOT_DIR" migrate
  bash "$ROOT_DIR/scripts/seed_all.sh"

  log "Backend…"
  ( cd backend && make run ) >/tmp/claire-e2e-backend.log 2>&1 &
  PIDS+=($!)
  log "Frontend…"
  ( cd frontend && npm run dev ) >/tmp/claire-e2e-frontend.log 2>&1 &
  PIDS+=($!)

  wait_http "${E2E_API_URL}/" "backend" 60
  wait_http "${E2E_BASE_URL}/" "frontend" 60
fi

# --- Playwright --------------------------------------------------------------
log "Exécution des 12 specs Playwright (F1->F12)…"
( cd frontend && E2E_BASE_URL="$E2E_BASE_URL" E2E_API_URL="$E2E_API_URL" npm run e2e )
RC=$?

if [[ "$RC" -ne 0 ]]; then
  err "Échec E2E (code $RC). Rapport : frontend/playwright-report/"
  exit "$RC"
fi
log "Tous les scénarios E2E sont verts (Q-FON-01)."
