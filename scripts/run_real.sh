#!/usr/bin/env bash
# Lance CLAIRE Studio en MODE DONNÉES RÉELLES : backend Django (API + vraies données)
# + frontend Next.js pointant sur cette API. Ctrl-C arrête les deux.
#
# Usage:  bash scripts/run_real.sh [--all | --max-docs N]
#   (par défaut : 12 documents CLAUDETTE chargés)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FEED_ARGS="${*:---max-docs 12}"

echo "▶ Backend : dépendances, migrations, feed des données réelles…"
(
  cd "$ROOT/backend"
  python -m pip install -q -r requirements.txt
  python manage.py migrate
  # shellcheck disable=SC2086
  python manage.py feed_db $FEED_ARGS
  echo "▶ Backend prêt sur http://localhost:8000  (admin/alice/bob/rita — mdp 'claire-demo')"
  python manage.py runserver 0.0.0.0:8000
) &
BACK=$!

echo "▶ Frontend : env mode réel, dépendances, dev server…"
(
  cd "$ROOT/frontend"
  [ -f .env.local ] || cp .env.local.example .env.local
  [ -d node_modules ] || npm install
  echo "▶ Frontend sur http://localhost:3000  → se connecter alice / claire-demo"
  npm run dev
) &
FRONT=$!

trap 'echo; echo "⏹ Arrêt…"; kill $BACK $FRONT 2>/dev/null || true' EXIT INT TERM
wait
