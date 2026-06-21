#!/usr/bin/env bash
# =============================================================================
# Envoi + import des pré-annotations LLM (Claude/Codex) en PROD.
#
# `data/preannotations/` est gitignoré → non déployé par git pull. Ce script
# l'envoie par rsync au VPS puis lance l'import idempotent côté prod.
#
# Accès VPS : clé ~/.ssh/corolle_deploy. Commande réseau → dangerouslyDisableSandbox.
#
# Usage :
#   ./deploy/push-preannotations.sh                 # projet campagne-pactiva
#   ./deploy/push-preannotations.sh <project-slug>
# =============================================================================
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; cd "$ROOT"

APP="claire-studio"
HOST="${DEPLOY_HOST:-root@46.202.128.168}"
KEY="${DEPLOY_KEY:-$HOME/.ssh/corolle_deploy}"
VPS_DIR="/var/www/${APP}"
PROJECT="${1:-campagne-pactiva}"
SSH_OPTS=(-i "${KEY}" -o IdentitiesOnly=yes -o BatchMode=yes)
SRC="$ROOT/data/preannotations/"

[ -d "$SRC" ] || { echo "✗ Dossier local introuvable : $SRC" >&2; exit 1; }

echo "▶ [1/3] Préparation du dossier distant…"
ssh "${SSH_OPTS[@]}" "${HOST}" "mkdir -p ${VPS_DIR}/data/preannotations"

echo "▶ [2/3] Envoi (rsync) data/preannotations → ${HOST}:${VPS_DIR}/data/preannotations …"
rsync -az --delete -e "ssh ${SSH_OPTS[*]}" "$SRC" "${HOST}:${VPS_DIR}/data/preannotations/"

echo "▶ [3/3] Import idempotent en prod (projet ${PROJECT})…"
ssh "${SSH_OPTS[@]}" "${HOST}" \
  "cd ${VPS_DIR}/backend && DJANGO_SETTINGS_MODULE=config.settings.prod \
   .venv/bin/python manage.py import_preannotations --project ${PROJECT}"

echo "✓ Pré-annotations envoyées et importées (projet ${PROJECT})."
