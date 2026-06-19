#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# dev_up.sh — Lance la pile de dev : Postgres (docker) + backend :8000 + frontend :3001.
# Mode local : Postgres en conteneur, backend & frontend en processus locaux.
# Arrête proprement les deux à Ctrl-C.
# -----------------------------------------------------------------------------
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3001}"

log() { printf '\033[36m[dev_up]\033[0m %s\n' "$*"; }
err() { printf '\033[31m[dev_up][ERR]\033[0m %s\n' "$*" >&2; }

# --- 1. .env -----------------------------------------------------------------
if [[ ! -f .env ]]; then
  err "Fichier .env manquant. Lancez : cp .env.example .env"
  exit 1
fi

# --- 2. Postgres (docker) ----------------------------------------------------
log "Démarrage de Postgres (docker compose)…"
docker compose up -d postgres

log "Attente du healthcheck Postgres…"
for i in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready >/dev/null 2>&1; then
    log "Postgres prêt."
    break
  fi
  sleep 1
  if [[ "$i" == "30" ]]; then err "Postgres non prêt après 30s."; exit 1; fi
done

# --- 3. Migrations -----------------------------------------------------------
log "Application des migrations…"
make -C "$ROOT_DIR" migrate

# --- 4. Backend + frontend ---------------------------------------------------
PIDS=()
cleanup() {
  log "Arrêt des processus de dev…"
  for pid in "${PIDS[@]:-}"; do
    [[ -n "${pid:-}" ]] && kill "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT INT TERM

log "Démarrage du backend sur :$BACKEND_PORT…"
( cd backend && make run ) &
PIDS+=($!)

log "Démarrage du frontend sur :$FRONTEND_PORT…"
( cd frontend && pnpm dev ) &
PIDS+=($!)

log "Pile de dev lancée :"
log "  backend  -> http://localhost:$BACKEND_PORT/api/v1/"
log "  frontend -> http://localhost:$FRONTEND_PORT"
log "Ctrl-C pour tout arrêter."

wait
