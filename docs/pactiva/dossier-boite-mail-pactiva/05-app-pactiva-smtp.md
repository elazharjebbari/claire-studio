# Câbler l'app Pactiva sur `no-reply@pactiva.legal`

L'app envoie déjà des e-mails transactionnels (vérification d'adresse, reset mot de
passe) via `django.core.mail.send_mail` (`backend/claire/accounts/emails.py`). Il reste
à l'**authentifier** sur le compte Stalwart `no-reply@pactiva.legal`.

## Réconciliation `no-reply@` vs `noreply@`
La demande porte sur **`no-reply@pactiva.legal`** (avec tiret). Le commit `5f32502` avait
posé `noreply@` (sans tiret) ; **ce lot** aligne le défaut du code sur `no-reply@`
(`config/settings/base.py`) :
```python
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="Pactiva <no-reply@pactiva.legal>")
SERVER_EMAIL       = env("SERVER_EMAIL",       default="no-reply@pactiva.legal")
```
→ **Le compte créé (02) doit être `no-reply` (tiret).** Cohérent partout.

> ⚠️ Le déploiement (`deploy-claire.sh`) build depuis le **code versionné** : assure-toi
> que ce changement est bien **committé** avant de déployer
> (`git show HEAD:backend/config/settings/base.py | grep reply` doit montrer le tiret).
> De toute façon, le `.env` prod ci-dessous **prime** sur le défaut code — c'est lui qui
> garantit l'adresse exacte en production.

## `.env` prod (fichier non versionné, `chmod 600`)
Sur le serveur, dans le `.env` de l'app (jamais dans git) — **config réelle déployée** :
```env
DJANGO_EMAIL_BACKEND=claire.common.email_backends.LocalTrustedTLSBackend
EMAIL_HOST=mail.lumiereacademy.com
EMAIL_PORT=587
EMAIL_USE_TLS=true
EMAIL_USE_SSL=false
EMAIL_HOST_USER=no-reply@pactiva.legal
EMAIL_HOST_PASSWORD=<le mot de passe no-reply@ — voir .credentials/>
DEFAULT_FROM_EMAIL=Pactiva <no-reply@pactiva.legal>
SERVER_EMAIL=no-reply@pactiva.legal
```
> **Deux pièges rencontrés et résolus :**
> 1. **`EMAIL_HOST=mail.lumiereacademy.com`** (pas `127.0.0.1`) : Python 3.12 vérifie le
>    nom du certificat au `STARTTLS` ; sur `127.0.0.1` → « IP address mismatch ». Le FQDN
>    correspond au cert (et résout sur la même machine).
> 2. **Backend custom `LocalTrustedTLSBackend`** (`claire/common/email_backends.py`) :
>    Stalwart ne présente que le **cert feuille** sur 587 (sans la chaîne intermédiaire)
>    → vérif échoue (« unable to get local issuer »). Le backend custom utilise un
>    contexte TLS non vérifiant (chiffrement conservé), justifié car la soumission vise
>    le Stalwart **de confiance, même machine** (comme `verify_peer=false` côté SnappyMail).
>
> DKIM est appliqué par Stalwart à l'émission (clé `d=pactiva.legal`) → alignement DMARC
> OK quel que soit le HELO. **Vérifié en prod : `send_mail -> 1`.**

## Déploiement
```bash
DJANGO_SECRET_KEY=deploy-gate-key ./deploy/deploy-claire.sh    # gate (tests) AVANT push
```
Le défaut code (`no-reply@`) est committé dans ce lot ; seul le `.env` prod (creds) reste
à renseigner côté serveur. Sans creds, l'envoi resterait non authentifié → à éviter.

## Note délivrabilité
- `no-reply@pactiva.legal` enverra avec **DKIM `d=pactiva.legal` + SPF `mx` + DMARC**.
  Tant que le DNS (03) n'est pas publié, les e-mails partiraient mais seraient
  rejetés/spam. **Ordre correct : DNS publié & propagé → renseigner le `.env` → déployer.**
- Option « no-reply strict » : on peut interdire la réception sur `no-reply@` (Sieve qui
  jette, ou pas de relevé). Non requis ; par défaut la boîte reçoit (utile pour les
  bounces). À décider plus tard.
