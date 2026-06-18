#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# seed_all.sh — Peuple la base de façon déterministe et IDEMPOTENTE (Q-ROB-02).
# Chaîne : attend Postgres -> migrate -> (cd backend && make seed).
# Voir dossier/15_runbook/seeding.md.
# -----------------------------------------------------------------------------
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

log() { printf '\033[35m[seed]\033[0m %s\n' "$*"; }
err() { printf '\033[31m[seed][ERR]\033[0m %s\n' "$*" >&2; }

if [[ ! -f .env ]]; then
  err "Fichier .env manquant. Lancez : cp .env.example .env"
  exit 1
fi

# --- 1. S'assurer que Postgres tourne ----------------------------------------
if ! docker compose ps postgres 2>/dev/null | grep -q "Up\|running"; then
  log "Postgres non démarré : docker compose up -d postgres"
  docker compose up -d postgres
fi

log "Attente du healthcheck Postgres…"
for i in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready >/dev/null 2>&1; then break; fi
  sleep 1
  if [[ "$i" == "30" ]]; then err "Postgres non prêt après 30s."; exit 1; fi
done

# --- 2. Migrations (le schéma doit exister avant le seed) ---------------------
log "Migrations…"
make -C "$ROOT_DIR" migrate

# --- 3. Seed (délégué au backend) --------------------------------------------
log "Seed du backend (idempotent)…"
make -C "$ROOT_DIR/backend" seed

log "Seed terminé. Re-exécuter ce script ne doit produire AUCUNE mutation (idempotence)."
