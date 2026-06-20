#!/usr/bin/env bash
# =============================================================================
# Provisioning initial CLAIRE Studio sur le VPS (à exécuter sur le serveur, root).
# Additif et isolé : DB+rôle dédiés, services systemd sur ports libres, build front.
# NE TOUCHE PAS à OpenLiteSpeed ni au certificat (étape séparée, après DNS).
# Secrets générés sur le serveur, jamais affichés ; .env en chmod 600.
# Idempotent autant que possible.
# =============================================================================
set -euo pipefail

APP=claire-studio
DIR=/var/www/$APP
DOMAIN="${DOMAIN:-pactiva.legal}"
BPORT="${BPORT:-8017}"
FPORT="${FPORT:-8018}"
REDIS_DB="${REDIS_DB:-11}"

cd "$DIR/backend"
python3 -m venv .venv
.venv/bin/pip install -q -U pip wheel
.venv/bin/pip install -q -r requirements.txt

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='claire'" | grep -q 1; then
  DBPW="$(openssl rand -base64 24 | tr -d '/+=')"
  sudo -u postgres psql -c "CREATE ROLE claire LOGIN PASSWORD '$DBPW';"
else
  DBPW=""
fi
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='claire_studio'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE DATABASE claire_studio OWNER claire;"

if [ ! -f .env ]; then
  [ -n "$DBPW" ] || { echo "Rôle claire déjà présent mais .env absent : fixe DBPW manuellement" >&2; exit 1; }
  RPW="$(grep -hoP 'redis://:\K[^@]+' /var/www/corolle-tracking/backend/.env /var/www/corolle-reviews/backend/.env 2>/dev/null | head -1)"
  SK="$(python3 -c 'import secrets;print(secrets.token_urlsafe(64))')"
  SEEDPW="$(python3 -c 'import secrets;print(secrets.token_urlsafe(16))')"
  umask 077
  cat > .env <<ENV
DJANGO_SETTINGS_MODULE=config.settings.prod
DJANGO_SECRET_KEY=$SK
DJANGO_DEBUG=false
DJANGO_ALLOWED_HOSTS=$DOMAIN,www.$DOMAIN,127.0.0.1,localhost
DATABASE_URL=postgres://claire:$DBPW@127.0.0.1:5432/claire_studio
CHANNELS_USE_REDIS=true
REDIS_URL=redis://:$RPW@127.0.0.1:6379/$REDIS_DB
FRONTEND_BASE_URL=https://$DOMAIN
CORS_ALLOWED_ORIGINS=https://$DOMAIN
DEFAULT_FROM_EMAIL=CLAIRE Studio <no-reply@$DOMAIN>
DJANGO_SECURE_SSL_REDIRECT=false
CLAIRE_SEED_PASSWORD=$SEEDPW
ENV
  chmod 600 .env
fi

# base.py lit .env automatiquement (django-environ) ; on ne fait PAS de `. ./.env`
# (valeurs avec espaces/<> non shell-safe). DJANGO_SETTINGS_MODULE doit être exporté
# pour choisir le module de settings (le .env ne peut pas le faire à temps).
PROD="DJANGO_SETTINGS_MODULE=config.settings.prod"
env $PROD .venv/bin/python manage.py migrate --noinput
env $PROD .venv/bin/python manage.py collectstatic --noinput
# seed_demo s'appuie sur les fixtures embarquées (corpus claudette_tos gitignoré,
# absent du clone) → démo autonome. Pour le corpus complet : rsync data/ puis feed_db.
env $PROD .venv/bin/python manage.py seed_demo || true

cd "$DIR/frontend"
cat > .env.production <<ENV
NEXT_PUBLIC_ENABLE_MOCKS=false
NEXT_PUBLIC_API_BASE=https://$DOMAIN/api/v1
NEXT_PUBLIC_WS_URL=wss://$DOMAIN
NEXT_PUBLIC_AUTO_LOGIN=false
ENV
npm ci --no-audit --no-fund
npm run build

cp "$DIR/deploy/systemd/$APP.service" "$DIR/deploy/systemd/$APP-web.service" /etc/systemd/system/
chown -R www-data:www-data "$DIR"
systemctl daemon-reload
systemctl enable --now "$APP" "$APP-web"
sleep 4
systemctl is-active "$APP" "$APP-web"
curl -fsS "http://127.0.0.1:$BPORT/api/v1/health" && echo " — backend OK"
curl -fsS -o /dev/null -w "front:%{http_code}\n" "http://127.0.0.1:$FPORT/"
echo "Provisioning app terminé (vhost+cert : étape séparée après DNS)."
