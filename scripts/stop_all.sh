#!/usr/bin/env bash
# =============================================================================
# stop_all.sh — Libère TOUS les ports prédéfinis de la pile CLAIRE Studio et
# arrête le conteneur Redis docker éventuel. Idempotent.
# =============================================================================
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/ports.env"

log() { printf '\033[36m[stop_all]\033[0m %s\n' "$*"; }

for entry in "backend:${BACKEND_PORT:-8000}" "asgi:${ASGI_PORT:-8001}" \
             "frontend:${FRONTEND_PORT:-3000}" "redis:${REDIS_PORT:-6379}"; do
  name="${entry%%:*}"; port="${entry##*:}"
  if command -v lsof >/dev/null 2>&1; then
    pids="$(lsof -ti tcp:"$port" 2>/dev/null || true)"
    if [[ -n "$pids" ]]; then
      log "Libération $name (:$port) — PID $pids"
      kill -9 $pids 2>/dev/null || true
    fi
  fi
done

docker rm -f claire-redis >/dev/null 2>&1 && log "Conteneur claire-redis arrêté." || true
log "Terminé."
