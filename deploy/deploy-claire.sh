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
#   ./deploy/deploy-claire.sh --allow-migrations  # après backup + revue expand/contract
#   DEPLOY_UNSAFE=1 ./deploy/deploy-claire.sh --no-tests  # urgence exceptionnelle
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
FRONTEND_URL="https://${DOMAIN}/"
SERVICES="${APP} ${APP}-web ${APP}-analysis-worker ${APP}-lab-worker"
SETTINGS="config.settings.prod"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
SSH="ssh -i ${KEY} -o IdentitiesOnly=yes -o BatchMode=yes ${HOST}"

run_tests=1
allow_migrations=0
for a in "${@:-}"; do case "$a" in
  --no-tests) run_tests=0 ;; "") : ;;
  --allow-migrations) allow_migrations=1 ;;
  *) echo "option inconnue: $a" >&2; exit 2 ;;
esac; done

if [ "$BRANCH" = "HEAD" ]; then
  echo "✗ HEAD détachée : déploiement refusé." >&2; exit 1
fi
if [ "$BRANCH" != "${DEPLOY_BRANCH:-main}" ] && [ "${DEPLOY_ALLOW_BRANCH:-0}" != "1" ]; then
  echo "✗ branche '$BRANCH' refusée (attendue: ${DEPLOY_BRANCH:-main})." >&2
  echo "  Pour une release exceptionnelle: DEPLOY_ALLOW_BRANCH=1" >&2
  exit 1
fi
if [ -n "$(git status --porcelain --untracked-files=normal)" ]; then
  echo "✗ worktree sale : commit/stash requis avant de tester et déployer." >&2
  git status --short >&2
  exit 1
fi
if [ "$run_tests" = 0 ] && [ "${DEPLOY_UNSAFE:-0}" != "1" ]; then
  echo "✗ --no-tests exige DEPLOY_UNSAFE=1 (urgence explicitement assumée)." >&2
  exit 1
fi

echo "▶ Déploiement ${APP} — ${BRANCH} → ${HOST}:${VPS_DIR} (${DOMAIN})"

if [ "$run_tests" = 1 ]; then
  echo "▶ [1/4] Gate de tests (backend + front)…"
  [ -x "$VENV_PY" ] || {
    echo "✗ venv backend absent (${VENV_PY}) : exécuter make setup-backend." >&2; exit 1;
  }
  [ -x "$ROOT/frontend/node_modules/.bin/tsc" ] && \
    [ -x "$ROOT/frontend/node_modules/.bin/vitest" ] || {
      echo "✗ dépendances frontend absentes : exécuter npm ci dans frontend/." >&2; exit 1;
    }
  ( cd backend && "$VENV_PY" -m pytest -p no:warnings -q )
  ( cd frontend && node_modules/.bin/tsc --noEmit && node_modules/.bin/vitest run )
fi

TESTED_SHA="$(git rev-parse HEAD)"

PREV_SHA="$($SSH "cd ${VPS_DIR} && git rev-parse HEAD")"
echo "▶ SHA VPS courant : ${PREV_SHA}"

git cat-file -e "${PREV_SHA}^{commit}" 2>/dev/null || git fetch origin "$PREV_SHA" -q
MIGRATIONS="$(git diff --name-only "$PREV_SHA" "$TESTED_SHA" -- 'backend/**/migrations/*.py')"
if [ -n "$MIGRATIONS" ] && [ "$allow_migrations" != 1 ]; then
  echo "✗ migrations détectées entre le VPS et ${TESTED_SHA}:" >&2
  echo "$MIGRATIONS" >&2
  echo "  Vérifier compatibilité expand/contract + backup, puis relancer avec --allow-migrations." >&2
  exit 1
fi

echo "▶ [2/4] git push origin ${BRANCH}…"
git push origin "${TESTED_SHA}:refs/heads/${BRANCH}"
REMOTE_SHA="$(git ls-remote origin "refs/heads/${BRANCH}" | awk '{print $1}')"
[ "$REMOTE_SHA" = "$TESTED_SHA" ] || {
  echo "✗ SHA distant inattendu: testé=${TESTED_SHA}, distant=${REMOTE_SHA}" >&2; exit 1;
}

echo "▶ [3/4] VPS : pull → backend(migrate/collectstatic) + front(build) → restart…"
$SSH "set -e; cd ${VPS_DIR} && \
  export GIT_SSH_COMMAND='ssh -i /root/.ssh/claire_repo -o IdentitiesOnly=yes' && \
  git config --global --add safe.directory ${VPS_DIR} && \
  mkdir -p backups && \
  test -z \"\$(git status --porcelain --untracked-files=no | grep -v ' frontend/package-lock.json$' || true)\" && \
  if ! git diff HEAD --quiet -- frontend/package-lock.json; then \
    cp frontend/package-lock.json backups/package-lock.predeploy.\$(date -u +%Y%m%dT%H%M%SZ).json && \
    git restore --source=HEAD --staged --worktree -- frontend/package-lock.json; \
  fi && \
  test -z \"\$(git status --porcelain --untracked-files=no)\" && \
  git fetch origin ${BRANCH} -q && git checkout ${BRANCH} && \
  git reset --hard ${TESTED_SHA} && test \"\$(git rev-parse HEAD)\" = '${TESTED_SHA}' && \
  cd backend && .venv/bin/pip install -q -r requirements.txt && \
  DJANGO_SETTINGS_MODULE=${SETTINGS} .venv/bin/python manage.py migrate --noinput && \
  DJANGO_SETTINGS_MODULE=${SETTINGS} .venv/bin/python manage.py collectstatic --noinput && \
  cd ../research && [ -d .venv ] || python3.12 -m venv .venv && \
  .venv/bin/pip install -q --upgrade pip && \
  .venv/bin/pip install -q -e '.[sklearn,embeddings,transformers]' && \
  grep -q '^LAB_RESEARCH_PYTHON=' ../backend/.env || \
    echo \"LAB_RESEARCH_PYTHON=${VPS_DIR}/research/.venv/bin/python\" >> ../backend/.env && \
  chown -R www-data:www-data ${VPS_DIR}/research && \
  cd ../frontend && npm ci --no-audit --no-fund && npm run build && \
  cd .. && cp deploy/systemd/${APP}-analysis-worker.service deploy/systemd/${APP}-lab-worker.service /etc/systemd/system/ && \
  systemctl daemon-reload && systemctl enable ${APP}-analysis-worker ${APP}-lab-worker && \
  systemctl restart ${SERVICES} && systemctl is-active ${SERVICES}"

check_url() {
  local label="$1" url="$2" code=000
  for i in $(seq 1 10); do
    code="$($SSH "curl -s -o /dev/null -w '%{http_code}' ${url}")"
    [ "${code}" = "200" ] && break
    echo "   ${label} tentative ${i}/10 : HTTP ${code} — nouvel essai dans 3 s…"
    sleep 3
  done
  echo "   ${label}=HTTP ${code}"
  [ "${code}" = "200" ]
}

echo "▶ [4/4] Healthchecks API + frontend…"
if ! check_url api "$HEALTH_URL" || ! check_url frontend "$FRONTEND_URL"; then
  echo "✗ smoke incomplet → ROLLBACK CODE vers ${PREV_SHA}"
  echo "⚠ Le schéma DB n'est pas rétrogradé automatiquement." >&2
  $SSH "set -e; cd ${VPS_DIR} && git reset --hard ${PREV_SHA} && \
    cd backend && \
    DJANGO_SETTINGS_MODULE=${SETTINGS} .venv/bin/python manage.py migrate --noinput && \
    cd ../frontend && npm ci --no-audit --no-fund && npm run build && \
    systemctl restart ${APP} ${APP}-web && \
    if [ -f ../deploy/systemd/${APP}-analysis-worker.service ]; then \
      systemctl restart ${APP}-analysis-worker; \
    else \
      systemctl disable --now ${APP}-analysis-worker || true; \
    fi && \
    if [ -f ../deploy/systemd/${APP}-lab-worker.service ]; then \
      systemctl restart ${APP}-lab-worker; \
    else \
      systemctl disable --now ${APP}-lab-worker || true; \
    fi"
  echo "↩ rollback effectué — déploiement ABANDONNÉ."; exit 1
fi
echo "✓ Déploiement OK — ${APP} @ ${TESTED_SHA} (API + frontend 200)."
