#!/usr/bin/env bash
# =============================================================================
# dev_all.sh — ORCHESTRATION GLOBALE (exécution de TOUS les serveurs en parallèle)
#
# Lance, sur des PORTS PRÉDÉFINIS (scripts/ports.env), et en parallèle :
#   • Redis        (:REDIS_PORT)     — channel layer Channels + présence  [optionnel]
#   • Backend REST (:BACKEND_PORT)   — Django/DRF (API, données)
#   • ASGI/WS      (:ASGI_PORT)      — Django Channels (temps réel)        [si dispo]
#   • Frontend     (:FRONTEND_PORT)  — Next.js
#
# - Détecte ce qui est disponible (redis-server / daphne / channels) et démarre
#   ce qui peut l'être ; n'échoue pas si le temps réel n'est pas encore configuré.
# - Health-check chaque service ; logs unifiés et préfixés ; arrêt PROPRE de toute
#   la pile à Ctrl-C (teardown des PID + libération des ports).
#
# Usage :
#   bash scripts/dev_all.sh                  # mode données réelles (backend SQLite)
#   MOCKS=1 bash scripts/dev_all.sh          # frontend en mode MSW (sans backend requis)
#   FEED_ARGS="--all" bash scripts/dev_all.sh
# =============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# --- Ports prédéfinis --------------------------------------------------------
# shellcheck disable=SC1091
source "$ROOT/scripts/ports.env"
BACKEND_PORT="${BACKEND_PORT:-8000}"
ASGI_PORT="${ASGI_PORT:-8001}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
REDIS_PORT="${REDIS_PORT:-6379}"
FEED_ARGS="${FEED_ARGS:---max-docs 12}"
MOCKS="${MOCKS:-0}"

c() { printf '\033[%sm%s\033[0m' "$1" "$2"; }
log()  { printf '%s %s\n' "$(c 36 "[dev_all]")" "$*"; }
warn() { printf '%s %s\n' "$(c 33 "[dev_all][warn]")" "$*"; }
err()  { printf '%s %s\n' "$(c 31 "[dev_all][ERR]")" "$*" >&2; }

PIDS=()
LABELS=()

cleanup() {
  printf '\n'; log "Arrêt de la pile…"
  for i in "${!PIDS[@]}"; do
    local pid="${PIDS[$i]}"
    if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  # Laisse les enfants se fermer puis force.
  sleep 1
  for pid in "${PIDS[@]:-}"; do kill -9 "$pid" 2>/dev/null || true; done
  log "Pile arrêtée."
}
trap cleanup EXIT INT TERM

free_port() { # libère un port si déjà occupé (best-effort)
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    local held; held="$(lsof -ti tcp:"$port" 2>/dev/null || true)"
    [[ -n "$held" ]] && { warn "Port $port occupé — libération (PID $held)"; kill -9 $held 2>/dev/null || true; }
  fi
}

wait_http() { # wait_http <url> <label> <timeout_s>
  local url="$1" label="$2" timeout="${3:-40}"
  for ((i=0; i<timeout; i++)); do
    if curl -fsS -o /dev/null "$url" 2>/dev/null; then
      log "$(c 32 "✓") $label prêt ($url)"; return 0
    fi
    sleep 1
  done
  warn "$label pas encore prêt après ${timeout}s ($url) — on continue."
  return 1
}

spawn() { # spawn <label> <command...>
  local label="$1"; shift
  ( "$@" ) > >(sed "s/^/$(c 35 "[$label]") /") 2>&1 &
  PIDS+=($!); LABELS+=("$label")
  log "→ $label démarré (PID $!)"
}

# Choix d'un Python >= 3.10 (Django 5) + venv dédié.
pick_python() {
  for cmd in python3.13 python3.12 python3.11 python3.10 python3 python; do
    command -v "$cmd" >/dev/null 2>&1 || continue
    "$cmd" -c 'import sys; raise SystemExit(0 if sys.version_info[:2]>=(3,10) else 1)' 2>/dev/null && { echo "$cmd"; return 0; }
  done
  return 1
}

log "Ports : backend=$BACKEND_PORT asgi=$ASGI_PORT frontend=$FRONTEND_PORT redis=$REDIS_PORT (MOCKS=$MOCKS)"
for p in "$BACKEND_PORT" "$ASGI_PORT" "$FRONTEND_PORT"; do free_port "$p"; done

# --- 1. Redis (optionnel) ----------------------------------------------------
if command -v redis-server >/dev/null 2>&1; then
  free_port "$REDIS_PORT"
  spawn redis redis-server --port "$REDIS_PORT" --save "" --appendonly no
elif docker info >/dev/null 2>&1; then
  warn "redis-server absent — démarrage de Redis via docker."
  docker run --rm -d --name claire-redis -p "${REDIS_PORT}:6379" redis:7-alpine >/dev/null 2>&1 \
    && log "→ redis (docker) sur :$REDIS_PORT" || warn "Redis docker indisponible (temps réel dégradé)."
else
  warn "Redis indisponible — la collaboration temps réel tournera en mode dégradé (REST)."
fi

# --- 2. Backend (REST + éventuellement ASGI) --------------------------------
if [[ "$MOCKS" != "1" ]]; then
  VENV="$ROOT/backend/.venv"
  if [[ ! -x "$VENV/bin/python" ]]; then
    PY="$(pick_python)" || { err "Python >= 3.10 introuvable (Django 5)."; PY=""; }
    [[ -n "$PY" ]] && { log "Création du venv backend ($("$PY" --version))…"; "$PY" -m venv "$VENV"; }
  fi
  if [[ -x "$VENV/bin/python" ]]; then
    BPY="$VENV/bin/python"
    # Mode LOCAL (hors docker) : on force SQLite + le module de settings dev, en
    # IGNORANT un éventuel DATABASE_URL orienté docker (@postgres) hérité du .env.
    LOCAL_ENV="DJANGO_SETTINGS_MODULE=config.settings.dev DATABASE_URL=sqlite:///$ROOT/backend/db.sqlite3 POSTGRES_HOST=localhost"
    log "Backend : install + migrate + feed ($FEED_ARGS)… (SQLite local)"
    ( cd backend && export $LOCAL_ENV \
        && "$BPY" -m pip install -q --upgrade pip \
        && "$BPY" -m pip install -q -r requirements.txt \
        && "$BPY" manage.py migrate \
        && "$BPY" manage.py feed_db $FEED_ARGS ) || warn "Préparation backend incomplète."

    spawn backend bash -c "cd '$ROOT/backend' && export $LOCAL_ENV && '$BPY' manage.py runserver 0.0.0.0:$BACKEND_PORT"

    # ASGI / Channels : seulement si daphne + app channels présents.
    if "$BPY" -c 'import daphne' 2>/dev/null && [[ -f "$ROOT/backend/config/asgi.py" ]]; then
      spawn asgi bash -c "cd '$ROOT/backend' && '$BPY' -m daphne -b 0.0.0.0 -p $ASGI_PORT config.asgi:application"
    else
      warn "ASGI/Channels non configuré (daphne ou config/asgi.py absent) — WS désactivé. Voir dossier 06_realtime_collaboration.md."
    fi
  else
    warn "Backend non démarré (pas de Python compatible). Conseil : MOCKS=1 pour le front seul."
  fi
else
  log "MOCKS=1 → backend non démarré (le frontend utilise MSW)."
fi

# --- 3. Frontend -------------------------------------------------------------
log "Frontend : préparation…"
( cd frontend && { [[ -f .env.local ]] || cp .env.local.example .env.local; } \
   && { [[ -d node_modules ]] || npm install; } ) || warn "Préparation frontend incomplète."
FE_ENV=""
[[ "$MOCKS" == "1" ]] && FE_ENV="NEXT_PUBLIC_ENABLE_MOCKS=true"
spawn frontend bash -c "cd '$ROOT/frontend' && $FE_ENV PORT=$FRONTEND_PORT npm run dev -- -p $FRONTEND_PORT"

# --- 4. Health-checks --------------------------------------------------------
[[ "$MOCKS" != "1" ]] && wait_http "http://localhost:$BACKEND_PORT/api/v1/health" "backend REST" 60 || true
wait_http "http://localhost:$FRONTEND_PORT" "frontend" 90 || true

log "$(c 32 "Pile lancée :")"
[[ "$MOCKS" != "1" ]] && log "  REST     → http://localhost:$BACKEND_PORT/api/v1/"
[[ "$MOCKS" != "1" ]] && log "  WS/ASGI  → ws://localhost:$ASGI_PORT/ws/  (si Channels configuré)"
log "  Frontend → http://localhost:$FRONTEND_PORT"
log "Ctrl-C pour tout arrêter."

wait
