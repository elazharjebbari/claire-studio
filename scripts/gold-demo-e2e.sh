#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# gold-demo-e2e.sh — DÉMONSTRATION de bout en bout du module de résolution GOLD,
# contre la pile RÉELLE (backend Django + frontend Next, sans mock).
#
# Rejoue par l'INTERFACE la chaîne complète : blocage diagnostiqué → déblocage par
# le studio → politique des secondaires appliquée → arbitrage d'une égalité → gold figé.
# Base SQLite jetable, ports dédiés : ne touche NI la base de développement, NI la
# production. Captures de preuve dans frontend/test-results/gold-demo/.
#
# Usage : bash scripts/gold-demo-e2e.sh
# -----------------------------------------------------------------------------
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BACK_PORT="${DEMO_BACK_PORT:-8002}"
FRONT_PORT="${DEMO_FRONT_PORT:-3002}"
DB_PATH="$ROOT_DIR/backend/demo_gold.sqlite3"
export DJANGO_SETTINGS_MODULE=config.settings.dev
export DJANGO_SECRET_KEY="${DJANGO_SECRET_KEY:-demo}"
export DATABASE_URL="sqlite:///${DB_PATH}"
export CORS_ALLOWED_ORIGINS="http://localhost:${FRONT_PORT},http://127.0.0.1:${FRONT_PORT}"
export PYTHONPATH="$ROOT_DIR/backend"

log() { printf '\033[34m[demo-gold]\033[0m %s\n' "$*"; }

PIDS=()
cleanup() {
  log "Arrêt de la pile de démonstration…"
  for pid in "${PIDS[@]:-}"; do [[ -n "${pid:-}" ]] && kill "$pid" 2>/dev/null || true; done
}
trap cleanup EXIT INT TERM

wait_http() {
  local url="$1" label="$2"
  for _ in $(seq 1 45); do
    curl -fsS -o /dev/null "$url" 2>/dev/null && { log "$label prêt."; return 0; }
    # 401 = serveur debout mais protégé : c'est bon signe.
    [[ "$(curl -s -o /dev/null -w '%{http_code}' "$url" 2>/dev/null)" != "000" ]] && { log "$label prêt."; return 0; }
    sleep 2
  done
  log "ERREUR : $label indisponible."; return 1
}

log "Base de démonstration : ${DB_PATH}"
( cd backend && .venv/bin/python manage.py migrate --noinput >/tmp/demo-migrate.log 2>&1 )
( cd backend && .venv/bin/python "$ROOT_DIR/scripts/seed_gold_demo.py" | tail -1 )

log "Backend :${BACK_PORT}…"
( cd backend && .venv/bin/python manage.py runserver "${BACK_PORT}" --noreload ) >/tmp/demo-backend.log 2>&1 &
PIDS+=($!)

log "Frontend :${FRONT_PORT} (branché sur le backend, mocks DÉSACTIVÉS)…"
( cd frontend && NEXT_PUBLIC_ENABLE_MOCKS=false \
    NEXT_PUBLIC_API_BASE="http://localhost:${BACK_PORT}/api/v1" \
    npx next dev -p "${FRONT_PORT}" ) >/tmp/demo-frontend.log 2>&1 &
PIDS+=($!)

wait_http "http://localhost:${BACK_PORT}/api/v1/" "backend"
wait_http "http://localhost:${FRONT_PORT}/" "frontend"

log "Playwright — scénario complet par l'interface…"
( cd frontend && DEMO_API_URL="http://localhost:${BACK_PORT}/api/v1" \
    DEMO_BASE_URL="http://localhost:${FRONT_PORT}" \
    npx playwright test --config=playwright.demo.config.ts )

log "Démonstration réussie. Captures : frontend/test-results/gold-demo/"
