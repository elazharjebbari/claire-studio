#!/usr/bin/env bash
# =============================================================================
# Déploiement — CLAIRE Studio (pactiva.legal)
# Calqué sur le runbook commun (corolle docs/09-devops-vps). Le code vit sur
# GitHub → le VPS fait git pull → migrate/collectstatic (backend) + build (front)
# → restart des 2 services → healthz, avec rollback automatique si healthz != 200.
#
# Accès VPS : TA clé ~/.ssh/corolle_deploy (jamais de secret ici). Commandes
# réseau côté agent : dangerouslyDisableSandbox.
#
# Stack : Django ASGI/Channels (daphne) + Next.js (next start) + Postgres + Redis.
# 2 services systemd : claire-studio (backend ASGI), claire-studio-web (front Next).
#
# Usage :
#   ./deploy/deploy-claire.sh                 # tests → push → VPS pull/build/restart/health
#   ./deploy/deploy-claire.sh --no-tests
# =============================================================================
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; cd "$ROOT"
VENV_PY="$ROOT/backend/.venv/bin/python"

APP="claire-studio"
HOST="${DEPLOY_HOST:-root@46.202.128.168}"
KEY="${DEPLOY_KEY:-$HOME/.ssh/corolle_deploy}"
DOMAIN="${DEPLOY_DOMAIN:-pactiva.legal}"
VPS_DIR="/var/www/${APP}"
HEALTH_URL="https://${DOMAIN}/api/v1/health"
SERVICES="${APP} ${APP}-web"
SETTINGS="config.settings.prod"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
SSH="ssh -i ${KEY} -o IdentitiesOnly=yes -o BatchMode=yes ${HOST}"

run_tests=1
for a in "${@:-}"; do case "$a" in
  --no-tests) run_tests=0 ;; "") : ;;
  *) echo "option inconnue: $a" >&2; exit 2 ;;
esac; done

echo "▶ Déploiement ${APP} — ${BRANCH} → ${HOST}:${VPS_DIR} (${DOMAIN})"

if [ "$run_tests" = 1 ]; then
  echo "▶ [1/4] Gate de tests (backend + front)…"
  if [ -x "$VENV_PY" ]; then ( cd backend && "$VENV_PY" -m pytest -p no:warnings -q ); fi
  ( cd frontend && node_modules/.bin/tsc --noEmit && node_modules/.bin/vitest run )
fi

PREV_SHA="$($SSH "cd ${VPS_DIR} && git rev-parse HEAD")"
echo "▶ SHA VPS courant : ${PREV_SHA}"

echo "▶ [2/4] git push origin ${BRANCH}…"
git push origin "${BRANCH}"

echo "▶ [3/4] VPS : pull → backend(migrate/collectstatic) + front(build) → restart…"
$SSH "set -e; cd ${VPS_DIR} && \
  export GIT_SSH_COMMAND='ssh -i /root/.ssh/claire_repo -o IdentitiesOnly=yes' && \
  git config --global --add safe.directory ${VPS_DIR} && \
  (git checkout -- frontend/package-lock.json 2>/dev/null || true) && \
  git fetch --all -q && git checkout ${BRANCH} && git pull --ff-only && \
  cd backend && .venv/bin/pip install -q -r requirements.txt && \
  DJANGO_SETTINGS_MODULE=${SETTINGS} .venv/bin/python manage.py migrate --noinput && \
  DJANGO_SETTINGS_MODULE=${SETTINGS} .venv/bin/python manage.py collectstatic --noinput && \
  cd ../frontend && npm install --no-audit --no-fund && npm run build && \
  systemctl restart ${SERVICES} && systemctl is-active ${SERVICES}"

echo "▶ [4/4] Healthcheck ${HEALTH_URL}… (jusqu'à ~30 s, daphne peut mettre quelques secondes)"
CODE=000
for i in $(seq 1 10); do
  CODE="$($SSH "curl -s -o /dev/null -w '%{http_code}' ${HEALTH_URL}")"
  [ "${CODE}" = "200" ] && break
  echo "   tentative ${i}/10 : health=${CODE} — nouvel essai dans 3 s…"
  sleep 3
done
echo "   health=${CODE}"
if [ "${CODE}" != "200" ]; then
  echo "✗ health != 200 → ROLLBACK vers ${PREV_SHA}"
  $SSH "set -e; cd ${VPS_DIR} && git reset --hard ${PREV_SHA} && \
    cd backend && \
    DJANGO_SETTINGS_MODULE=${SETTINGS} .venv/bin/python manage.py migrate --noinput && \
    cd ../frontend && npm run build && systemctl restart ${SERVICES}"
  echo "↩ rollback effectué — déploiement ABANDONNÉ."; exit 1
fi
echo "✓ Déploiement OK — ${APP} @ ${BRANCH} (health 200)."
