#!/usr/bin/env bash
# =============================================================================
# OpenLiteSpeed vhost + certificat Let's Encrypt pour CLAIRE Studio (à exécuter
# sur le VPS, root). ADDITIF sur un serveur à 14 sites : backup httpd_config,
# bloc virtualhost + map calqués sur les voisins, reload GRACIEUX, et ROLLBACK
# automatique si un voisin cesse de répondre. Idempotent.
# =============================================================================
set -euo pipefail
DOMAIN="${DOMAIN:-pactiva.legal}"
APP=claire-studio
EMAIL="${CERTBOT_EMAIL:-elazhar.jebbari@gmail.com}"
CONF=/usr/local/lsws/conf/httpd_config.conf
VHDIR=/usr/local/lsws/conf/vhosts/$APP
VHROOT=/usr/local/lsws/$APP
NEIGHBORS="reviews.eclosie.com tracking.eclosie.com cod.eclosie.com femiglow.eclosie.com"

BACKUP="$CONF.bak.claire.$(date +%s)"
cp "$CONF" "$BACKUP"
echo "▶ backup httpd_config → $BACKUP"

mkdir -p "$VHROOT/html/.well-known/acme-challenge" "$VHROOT/logs" "$VHDIR"
cp "/var/www/$APP/deploy/ols/claire.conf" "$VHDIR/claire.conf"
sed -i "s/pactiva\.legal/$DOMAIN/g" "$VHDIR/claire.conf"

python3 - "$CONF" "$DOMAIN" <<'PY'
import sys
conf, domain = sys.argv[1], sys.argv[2]
s = open(conf).read()
if "virtualhost claire-studio " not in s:
    block = ("virtualhost claire-studio {\n"
             "  vhRoot                  claire-studio\n"
             "  configFile              conf/vhosts/claire-studio/claire.conf\n"
             "  allowSymbolLink         1\n"
             "  enableScript            1\n"
             "  restrained              0\n"
             "}\n\n")
    i = s.index("\nlistener ")
    s = s[:i+1] + block + s[i+1:]
if ("claire-studio %s" % domain) not in s:
    out = []
    for line in s.splitlines(keepends=True):
        out.append(line)
        if line.strip().startswith("map") and "tracking tracking.eclosie.com" in line:
            out.append("  map                     claire-studio %s\n" % domain)
    s = "".join(out)
open(conf, "w").write(s)
print("httpd_config: virtualhost + map ajoutés (additif)")
PY

/usr/local/lsws/bin/lswsctrl reload
sleep 3

rollback() { echo "✗ $1 → ROLLBACK"; cp "$BACKUP" "$CONF"; /usr/local/lsws/bin/lswsctrl reload; exit 1; }
for h in $NEIGHBORS; do
  c="$(curl -s -o /dev/null -w '%{http_code}' "https://$h/" || echo 000)"
  echo "voisin $h:$c"
  case "$c" in 2*|3*|401|403) ;; *) rollback "voisin $h cassé ($c)";; esac
done

certbot certonly --webroot -w "$VHROOT/html" -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL"
RC="/etc/letsencrypt/renewal/$DOMAIN.conf"
grep -q "renew_hook" "$RC" 2>/dev/null || echo "renew_hook = /usr/local/lsws/bin/lswsctrl reload" >> "$RC"
/usr/local/lsws/bin/lswsctrl reload
sleep 3

echo "== smoke prod =="
curl -fsS "https://$DOMAIN/api/v1/health" && echo " — backend HTTPS OK"
curl -s -o /dev/null -w "front:%{http_code}\n" "https://$DOMAIN/"
for h in $NEIGHBORS; do echo -n "$h:"; curl -s -o /dev/null -w "%{http_code} " "https://$h/"; done; echo
echo "✓ vhost + HTTPS en place pour $DOMAIN."
