# Accès webmail (SnappyMail)

SnappyMail est **multi-domaine** et pointe IMAP/SMTP sur `localhost`. Deux voies :
- **Voie A (immédiate, zéro DNS)** : accès via une URL webmail existante.
- **Voie B (brandée)** : `https://webmail.pactiva.legal` dédié.

Dans les **deux** cas, le fichier domaine `pactiva.legal.json` est **obligatoire**
(sinon SnappyMail cherche `imap.pactiva.legal` inexistant → login refusé).

## Étape commune — ajouter le domaine `pactiva.legal` à SnappyMail

```bash
ssh -i ~/.ssh/corolle_deploy root@46.202.128.168
D=/usr/local/lsws/webmail/data/_data_/_default_/domains
# Copie conforme du template femiglow (host=localhost → agnostique au domaine) :
cp -a "$D/femiglow-maroc.com.json" "$D/pactiva.legal.json"
chown nobody:nogroup "$D/pactiva.legal.json"
chmod 600 "$D/pactiva.legal.json"
# Vérifie le contenu (doit montrer IMAP localhost:993, SMTP localhost:587) :
python3 -c 'import json;d=json.load(open("'"$D"'/pactiva.legal.json"));print("IMAP",d["IMAP"]["host"],d["IMAP"]["port"],"| SMTP",d["SMTP"]["host"],d["SMTP"]["port"])'
```

> Pas besoin de redémarrer SnappyMail (configs relues à chaud). Le nom du fichier =
> la **partie domaine** du login : `info@pactiva.legal` → SnappyMail lit `pactiva.legal.json`.
> Alternative GUI : admin panel SnappyMail (`allow_admin_panel=On`, login `admin`)
> → Domains → Add → `pactiva.legal`, IMAP `localhost:993 SSL`, SMTP `localhost:587 STARTTLS`.

## Voie A — accès immédiat (recommandée pour démarrer)

Une fois `pactiva.legal.json` en place **et** les comptes créés (02), connecte-toi sur
une URL webmail **déjà servie** :

- `https://webmail.lumiereacademy.com`  →  login **complet** `info@pactiva.legal` + mot de passe.

SnappyMail route vers `localhost:993` et authentifie l'adresse complète. **Aucun DNS,
aucun cert, aucune conf OLS** à ajouter. C'est fonctionnel tout de suite.

> Limite : l'URL affiche le domaine d'une autre marque. Pour une URL propre, voir voie B.

## Voie B — `webmail.pactiva.legal` brandé

### B.1 DNS (chez le registrar — Ahmed)
```
A  webmail.pactiva.legal  46.202.128.168
```
(une seule entrée ; ligne `VOIE-B` du CSV)

> ⚠️ **Ordre critique** (piège « vhssl post-cert »). Le certificat n'existe pas encore,
> et le vhost de femiglow embarque un bloc `vhssl` pointant un cert inexistant : si on
> déclarait le vhost SSL d'emblée, le reload OLS **échouerait** (cert introuvable) et
> impacterait tous les sites ; et certbot HTTP-01 ne peut valider que si le challenge
> est servi pour ce Host. On procède donc **HTTP d'abord, TLS ensuite**, en sauvegardant
> la conf avant toute édition.

```bash
cd /usr/local/lsws/conf
cp httpd_config.conf "httpd_config.conf.bak.pactiva-$(date +%Y%m%d-%H%M%S)"
```

### B.2 Vhost OLS **HTTP-only** (clone sans bloc TLS) + acme-challenge
```bash
# Clone le conf, renomme le host, et SUPPRIME le bloc vhssl (pas de cert encore) :
cp -a vhosts/Example/femiglow-webmail.conf vhosts/Example/pactiva-webmail.conf
sed -i 's#webmail.femiglow-maroc.com#webmail.pactiva.legal#g' vhosts/Example/pactiva-webmail.conf
# Retire le bloc vhssl { ... } (sera réajouté en B.4, après émission du cert) :
perl -0pi -e 's/\nvhssl\s*\{.*?\}\n//s' vhosts/Example/pactiva-webmail.conf
# Le contexte /.well-known/acme-challenge/ -> /var/www/_acme-challenge/... est conservé.
```
Puis dans `httpd_config.conf` :
1. Ajoute le **virtualhost** (à côté de `femiglow-webmail`) :
   ```
   virtualhost pactiva-webmail {
     vhRoot                  /usr/local/lsws/webmail
     configFile              conf/vhosts/Example/pactiva-webmail.conf
     allowSymbolLink         1
     enableScript            1
     restrained              0
   }
   ```
2. **Uniquement** dans `listener Default` (port **80**), ajoute la map (à côté des
   `map femiglow-webmail …`) :
   ```
   map                     pactiva-webmail webmail.pactiva.legal
   ```
   *(on n'ajoute PAS encore la map sur `Defaultssl`/443 — le cert n'existe pas.)*

### B.3 Recharger (HTTP) + obtenir le certificat
```bash
/usr/local/lsws/bin/lswsctrl reload                 # rechargement gracieux (zero downtime)
tail -n 20 /usr/local/lsws/logs/error.log           # vérifier l'absence d'erreur de conf
# Le challenge DOIT être servi pour ce Host (sinon certbot 404) :
echo ok > /var/www/_acme-challenge/.well-known/acme-challenge/selftest
curl -s http://webmail.pactiva.legal/.well-known/acme-challenge/selftest   # attendu : ok
rm -f /var/www/_acme-challenge/.well-known/acme-challenge/selftest
# Émission Let's Encrypt (HTTP-01 via le webroot déjà câblé) :
certbot certonly --webroot -w /var/www/_acme-challenge -d webmail.pactiva.legal \
  --non-interactive --agree-tos -m postmaster@pactiva.legal
# → /etc/letsencrypt/live/webmail.pactiva.legal/{privkey,cert,fullchain,chain}.pem
```
> Prérequis : l'A record (B.1) doit déjà résoudre vers 46.202.128.168.

### B.4 Activer le TLS (vhssl + map 443) puis recharger
```bash
# Réajoute le bloc vhssl à pactiva-webmail.conf (cert désormais présent) :
cat >> /usr/local/lsws/conf/vhosts/Example/pactiva-webmail.conf <<'VHSSL'

vhssl  {
  keyFile                 /etc/letsencrypt/live/webmail.pactiva.legal/privkey.pem
  certFile                /etc/letsencrypt/live/webmail.pactiva.legal/cert.pem
  certChain               1
  CACertPath              /etc/letsencrypt/live/webmail.pactiva.legal/fullchain.pem
  CACertFile              /etc/letsencrypt/live/webmail.pactiva.legal/chain.pem
}
VHSSL
```
Dans `httpd_config.conf`, ajoute la map dans **`listener Defaultssl`** (port **443**) :
```
map                     pactiva-webmail webmail.pactiva.legal
```
Recharge et teste :
```bash
/usr/local/lsws/bin/lswsctrl reload
tail -n 20 /usr/local/lsws/logs/error.log
curl -sI https://webmail.pactiva.legal/ | head -1       # attendu : HTTP/2 200
```

> ⚠️ **Sécurité OLS (serveur mutualisé)** : toujours partir du backup B.1. OLS n'a pas
> de « test de conf » fiable en ligne de commande (`lshttpd` est le démon, pas un
> validateur) ⇒ on **vérifie après chaque `reload`** via `logs/error.log` + un `curl -sI`
> sur un site existant (ex. `https://webmail.lumiereacademy.com/`). En cas d'erreur :
> restaurer le backup (`cp httpd_config.conf.bak.pactiva-… httpd_config.conf`) puis
> `lswsctrl reload`. `lswsctrl reload`/`restart` sont **gracieux (zero downtime)** chez OLS.

## Récap webmail
| | Voie A | Voie B |
|---|---|---|
| `pactiva.legal.json` | requis | requis |
| DNS | aucun | `A webmail.pactiva.legal` |
| Cert | aucun | certbot |
| Conf OLS | aucune | vhost HTTP → cert → vhssl + map 443 (**2 reloads**) |
| URL | `webmail.lumiereacademy.com` | `webmail.pactiva.legal` |
| Délai | immédiat | ~15 min (propagation A + cert) |
