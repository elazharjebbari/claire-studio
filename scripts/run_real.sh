#!/usr/bin/env bash
# Lance CLAIRE Studio en MODE DONNÉES RÉELLES : backend Django (API + vraies données)
# + frontend Next.js pointant sur cette API. Ctrl-C arrête les deux.
#
# Usage:  bash scripts/run_real.sh [--all | --max-docs N]
#   (par défaut : 12 documents CLAUDETTE chargés)
#
# Le backend a besoin de Python >= 3.10 (Django 5). Le script crée un venv dédié
# backend/.venv avec le 1er interpréteur compatible trouvé — il N'utilise PAS le
# `python` courant (souvent conda base en 3.9).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FEED_ARGS="${*:---max-docs 12}"
VENV="$ROOT/backend/.venv"

# 1) Trouver un Python >= 3.10
pick_python() {
  for c in python3.13 python3.12 python3.11 python3.10 python3 python; do
    if command -v "$c" >/dev/null 2>&1; then
      if "$c" -c 'import sys; raise SystemExit(0 if sys.version_info[:2] >= (3,10) else 1)' 2>/dev/null; then
        echo "$c"; return 0
      fi
    fi
  done
  return 1
}

if [ ! -x "$VENV/bin/python" ]; then
  PY="$(pick_python)" || {
    echo "✖ Aucun Python >= 3.10 trouvé (Django 5 l'exige). Ton 'base' conda est probablement en 3.9."
    echo "  Installe/active un Python >= 3.10 (ex. 'conda create -n claire python=3.12' puis relance),"
    echo "  ou crée le venv toi-même : <python3.12> -m venv backend/.venv"
    exit 1
  }
  echo "▶ Création du venv backend avec $("$PY" --version) …"
  "$PY" -m venv "$VENV"
fi
BPY="$VENV/bin/python"

echo "▶ Backend : dépendances, migrations, feed des données réelles…"
(
  cd "$ROOT/backend"
  "$BPY" -m pip install -q --upgrade pip
  "$BPY" -m pip install -q -r requirements.txt
  "$BPY" manage.py migrate
  # shellcheck disable=SC2086
  "$BPY" manage.py feed_db $FEED_ARGS
  echo "▶ Backend prêt sur http://localhost:8000  (admin/alice/bob/rita — mdp 'claire-demo')"
  "$BPY" manage.py runserver 0.0.0.0:8000
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
