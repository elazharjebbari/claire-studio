# État des lieux (reconnaissance live — 2026-06-22)

VPS `srv983171` / `46.202.128.168`. Accès root via `~/.ssh/corolle_deploy`.
Toutes les valeurs ci-dessous ont été **lues sur le serveur** (secrets jamais affichés).

## 1. Stalwart Mail Server

| Élément | Valeur observée |
|---|---|
| Version / service | **v0.16**, `stalwart-mail.service` = active (running) depuis 2026-06-05 |
| Binaire / CLI | `/opt/stalwart-mail/stalwart-mail` ; `/usr/local/bin/stalwart-cli` |
| Store de config | `config.json` → `{"@type":"RocksDb","path":"/var/lib/stalwart/"}` (toute la conf vit dans RocksDB, pas dans des fichiers) |
| Admin panel | `https://mail.lumiereacademy.com/admin/login` (gère les 2 domaines) ; user admin = `admin@lumiereacademy.com` |
| API management | exposée sur `:8080` (HTTP, derrière le reverse-proxy OLS). **Depuis le serveur on l'attaque en direct via `http://127.0.0.1:8080`** (le proxy renvoie 301 sur `/api/...`). |
| Ports en écoute | 25, 465, 587 (submission STARTTLS), 143, **993** (IMAPS), 110, **995**, 4190 (Sieve), 8080 |

### Modèle d'objets du CLI v0.16
Le CLI est générique : `get | query | create | update | delete | describe | apply | snapshot`.
Authentification : `--url`, `--user`, `--password` (ou env `STALWART_URL/USER/PASSWORD`).
Objets pertinents : **`Domain`**, **`Account`** (variantes `User`/`Group`), **`DkimSignature`**
(variantes `Dkim1Ed25519Sha256`/`Dkim1RsaSha256`), `AcmeProvider`.

### Domaines existants
```
Id  Domaine             Cert   DNS      DKIM
b   lumiereacademy.com  ACME   Manual   Manual (2 clés v1-*-20260427)
c   femiglow-maroc.com  ACME   Manual   Automatic (ed25519+rsa, rotation 90/7/30)
```
`AcmeProvider` : `id=iodjw1oiaaqa`, challenge **TLS-ALPN-01**, contact `postmaster@lumiereacademy.com`.

### Le précédent décisif : `femiglow-maroc.com` (= patron de pactiva.legal)
- Comptes déjà présents : `admin@`, `contact@`, `info@`, **`noreply@`** → exactement le motif voulu.
- **DKIM automatique** : `algorithms = {Ed25519, RSA}`, `selectorTemplate = v{version}-{algorithm}-{date-%Y%m%d}`,
  `rotateAfter=7776000000ms (90j)`, `retireAfter=604800000ms (7j)`, `deleteAfter=2592000000ms (30j)`.
- **`dnsZoneFile`** (champ généré par le serveur) — extrait réel :
  ```
  femiglow-maroc.com. IN MX 10 mail.lumiereacademy.com.
  femiglow-maroc.com. IN TXT "v=spf1 mx -all"
  _dmarc.femiglow-maroc.com. IN TXT "v=DMARC1; p=reject; rua=mailto:postmaster@femiglow-maroc.com"
  v1-ed25519-20260507._domainkey… IN TXT "v=DKIM1; k=ed25519; h=sha256; p=…"
  v1-rsa-20260507._domainkey…     IN TXT "v=DKIM1; k=rsa; h=sha256; p=…"
  mta-sts.femiglow-maroc.com. IN CNAME mail.lumiereacademy.com.
  _mta-sts… IN TXT "v=STSv1; id=…" ; _smtp._tls… IN TXT "v=TLSRPTv1; rua=mailto:postmaster@…"
  _imaps/_pop3s/_submissions/_jmap/_caldavs/_carddavs SRV → mail.lumiereacademy.com.
  autoconfig/autodiscover/ua-auto-config CNAME → mail.lumiereacademy.com.
  CAA letsencrypt + _validation-persist
  ```
  **Important** : femiglow **n'a aucun A `mail.femiglow-maroc.com` ni aucun TLSA** —
  tout pointe sur `mail.lumiereacademy.com`. C'est exactement le modèle qu'on copie.

### Structure d'un compte (ex. `noreply@femiglow-maroc.com`, secret redacté)
```json
{ "name":"noreply", "domainId":"c",
  "credentials":{"0":{"secret":"<hash>","@type":"Password"}},
  "roles":{"@type":"User"}, "permissions":{"@type":"Inherit"},
  "description":"FemiGlow app emailing sender", "locale":"fr_FR",
  "emailAddress":"noreply@femiglow-maroc.com" }
```
→ Créer un compte = `name` (localpart) + `domainId` + `credentials[Password.secret]`
+ `roles:User`. L'adresse `emailAddress` est dérivée automatiquement (`name@domain`).

## 2. SnappyMail (webmail)

| Élément | Valeur |
|---|---|
| Install | `/usr/local/lsws/webmail/snappymail` (servi par **OpenLiteSpeed/LiteSpeed**) |
| Données | `/usr/local/lsws/webmail/data/_data_/_default_` |
| Configs domaine | `…/domains/*.json` — présents : `lumiereacademy.com.json`, `femiglow-maroc.com.json`, `gmail.com.json`, `hotmail.com.json` ; `disabled` liste outlook/qq/yahoo/gmail/hotmail |
| Admin panel | `allow_admin_panel = On`, `admin_login = "admin"` (mot de passe redacté) |
| Multi-comptes | `allow_additional_accounts = On` ; `default_domain=""`, `determine_user_domain=Off` |

**Template `femiglow-maroc.com.json` (réel)** : IMAP `host=localhost:993 type=1 (SSL)`,
SMTP `host=localhost:587 type=2 (STARTTLS) useAuth=true`, Sieve désactivé, SASL
SCRAM-*/PLAIN/LOGIN, `ssl.verify_peer=false` (localhost). **Le host est `localhost`**
→ le fichier est **agnostique au domaine** : `pactiva.legal.json` en est une copie exacte.

> Conséquence : sans un `pactiva.legal.json`, SnappyMail tenterait d'auto-détecter
> `imap.pactiva.legal` (inexistant) et **le login échouerait**. Ce fichier est donc
> **obligatoire** pour le webmail (voir 04).

## 3. OpenLiteSpeed (reverse-proxy web)

- Serveur web sur 80/443 = **litespeed**. Conf : `/usr/local/lsws/conf/httpd_config.conf`.
- Webmail servi par 2 virtualhosts pointant sur `/usr/local/lsws/webmail` :
  - `virtualhost webmail` (conf `vhosts/Example/webmail.conf`) — mappé `webmail.lumiereacademy.com`.
  - `virtualhost femiglow-webmail` (conf `vhosts/Example/femiglow-webmail.conf`) — mappé `webmail.femiglow-maroc.com`.
- Maps dans `listener Default` (80) **et** `listener Defaultssl` (443).
- TLS de chaque webmail = **certbot** (`/usr/bin/certbot`), certs dans
  `/etc/letsencrypt/live/webmail.<domaine>/`, validation **webroot**
  `/var/www/_acme-challenge` (contexte `/.well-known/acme-challenge/` dans le vhost).
- `webmail.lumiereacademy.com` répond **HTTP 200** (SnappyMail up).

## 4. DNS — état actuel

| Nom | Actuel | Cible |
|---|---|---|
| `A pactiva.legal` | `46.202.128.168` ✅ (site) | inchangé |
| `MX / TXT / _dmarc pactiva.legal` | **vide** ❌ | à publier (étape 3) |
| `A mail.pactiva.legal` / `A webmail.pactiva.legal` | **vide** | mail: **inutile** ; webmail: seulement si voie B |
| `A mail.lumiereacademy.com` | `46.202.128.168` ✅ | hôte mail réutilisé |
| `PTR 46.202.128.168` | `mail.lumiereacademy.com.` ✅ | rDNS aligné (HELO sortant) |

## 5. Pactiva (app) — rappel
Backend prod = SMTP, `EMAIL_HOST` défaut `localhost:587`, `EMAIL_HOST_USER/PASSWORD`
**absents** du `.env`. Historique de la marque de l'expéditeur :
- commit `5f32502` a posé `DEFAULT_FROM_EMAIL = Pactiva <noreply@pactiva.legal>`
  (**sans tiret**) ;
- **ce lot** l'aligne sur la demande : `Pactiva <no-reply@pactiva.legal>` (**avec tiret**)
  + `SERVER_EMAIL = no-reply@pactiva.legal` (`config/settings/base.py`).

Reste donc côté app : créer le compte Stalwart `no-reply@` (02) et renseigner
`EMAIL_HOST_USER/PASSWORD` dans le `.env` prod (05). Le `.env` prime sur le défaut code.
