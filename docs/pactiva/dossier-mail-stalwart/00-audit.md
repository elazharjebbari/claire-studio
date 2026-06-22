# Audit — Boîte mail Pactiva ↔ Stalwart (envoi auto + webmail)

> **But.** Photographier l'écosystème mail déjà installé sur le VPS (Stalwart Mail
> Server + webmail, partagé avec lumiereacademy.com et femiglow-maroc.com) et l'état
> de Pactiva côté e-mail, afin d'établir le chemin le plus court vers (a) un **envoi
> transactionnel fiable** depuis l'app, et (b) une **boîte mail consultable** via le
> **webmail** pour `pactiva.legal`. Inspiré de l'audit FemiGlow
> (`lumiere-beauty-lab/docs-femiglow(old)/audit-stalwart-email.md`). Faits + chemins,
> pas de plan ici (cf. `01-plan-action.md`).

Date : 2026‑06‑22. VPS : `srv983171` (46.202.128.168), rDNS = `mail.lumiereacademy.com`.

---

## 1. Serveur mail — déjà en place (partagé), OPÉRATIONNEL

| Élément | Valeur (vérifiée en live) |
|---|---|
| Serveur | **Stalwart Mail Server v0.16**, `stalwart-mail.service` = **active** |
| Binaire / config | `/opt/stalwart-mail/` ; `/etc/stalwart-mail/etc/config.json` → base **RocksDB** `/var/lib/stalwart/` (toute la config domaines/comptes/DKIM vit ici) |
| CLI | `/usr/local/bin/stalwart-cli` (dispo) — `--url` / env `STALWART_URL`,`STALWART_USER`,`STALWART_PASSWORD` |
| Credentials | `/root/stalwart-credentials.txt` (admin panel + webmail, **gère les 2 domaines**) |
| Ports en écoute | **25** (MX), **587** (submission STARTTLS — cible app), **465** (SMTPS), **143/993** (IMAP/S), **110/995** (POP3/S), **4190** (Sieve), **8080** (admin/JMAP/webmail HTTP, TLS terminé par Stalwart) |
| Admin panel | `https://mail.<domaine>/admin/login` (ex. `mail.lumiereacademy.com`, `mail.femiglow-maroc.com`) |
| **Webmail** | **`https://webmail.<domaine>`** (sous‑domaine dédié — ex. `webmail.femiglow-maroc.com`) |
| Domaines servis | `lumiereacademy.com` (hôte/admin, banner SMTP), `femiglow-maroc.com` (produit) |
| Redis | `requirepass` **défini** dans `/etc/redis/redis.conf` — ⚠ vérifier que Stalwart envoie bien ce mot de passe (l'audit FemiGlow signalait un `NOAUTH` en boucle dégradant rate‑limit/retry — à reconfirmer) |

**Conclusion serveur.** L'infra est prête et mutualisée ; ajouter Pactiva = **ajouter
un domaine + des comptes** dans Stalwart, **pas** réinstaller quoi que ce soit. Le
webmail Pactiva sera `https://webmail.pactiva.legal` (à pointer/servir, cf. plan).

---

## 2. `pactiva.legal` — état mail : NON PROVISIONNÉ

DNS interrogé en live (depuis le VPS) :

| Enregistrement | Résultat | Verdict |
|---|---|---|
| `A pactiva.legal` | `46.202.128.168` | ✅ (le site tourne déjà) |
| `MX pactiva.legal` | **vide** | ❌ aucun MX |
| `TXT pactiva.legal` (SPF) | **vide** | ❌ pas de SPF |
| `TXT _dmarc.pactiva.legal` | **vide** | ❌ pas de DMARC |
| `A mail.pactiva.legal` / `webmail.pactiva.legal` | **vide** | ❌ sous‑domaines mail absents |

→ **Aucun e-mail entrant/sortant fiable possible aujourd'hui pour `pactiva.legal`** :
le domaine n'est ni dans Stalwart (à confirmer via `stalwart-cli`), ni dans le DNS.
C'est le **gros du travail** (cf. plan + `02-dns-records.csv`).

---

## 3. Pactiva (app) — état e-mail : à moitié câblé

| Élément | Constat | Fichier |
|---|---|---|
| Plomberie d'envoi | **Existe déjà** : e-mails transactionnels via `django.core.mail.send_mail` | `backend/claire/accounts/emails.py` (vérif e-mail, reset mot de passe) |
| Backend e-mail | **prod = SMTP** (`django.core.mail.backends.smtp.EmailBackend`), dev = console, test = locmem | `config/settings/{base,prod,test}.py` |
| Hôte SMTP | défaut **`localhost:587`** STARTTLS (= submission Stalwart sur la même machine) | `base.py:291‑295` |
| Auth SMTP | `EMAIL_HOST_USER`/`EMAIL_HOST_PASSWORD` **absents** du `.env` prod → envoi **non authentifié** | `.env` prod |
| From | `DEFAULT_FROM_EMAIL = "CLAIRE Studio <no-reply@pactiva.legal>"` → **marque obsolète** (« CLAIRE Studio ») mais bon domaine | `.env` prod + `base.py:298` (défaut `@claire.local` à corriger) |
| Front | liens pointent sur `FRONTEND_BASE_URL=https://pactiva.legal` ✅ | `.env` prod |

**Conséquence.** En l'état, un envoi prod partirait en SMTP `localhost:587` **sans
compte authentifié** et depuis un domaine (`pactiva.legal`) **inconnu de Stalwart et
sans DKIM/SPF** → rejet quasi certain / spam. Il manque : le **domaine + le compte
`noreply@pactiva.legal`** dans Stalwart, les **creds dans `.env`**, le **DNS**, et le
nettoyage de la marque.

---

## 4. Leçons reprises de l'audit FemiGlow (à NE PAS répéter)

| Piège FemiGlow | Application à Pactiva |
|---|---|
| **SPF cassé** (`v=spf1` seul) → rejets sous DMARC strict | Publier d'emblée un SPF **fonctionnel** : `v=spf1 ip4:46.202.128.168 mx -all` |
| **Redis NOAUTH** en boucle (retry/rate‑limit dégradés) | Vérifier que Stalwart a bien le mot de passe Redis **avant** de générer du trafic |
| **Adresses mortes codées en dur** (`@femiglow.ma`) | Pactiva : pas d'adresse en dur ; juste corriger la **marque** du `From` |
| **HELO/rDNS** = `mail.lumiereacademy.com` (alignement DMARC) | Le HELO sortant restera `mail.lumiereacademy.com` (IP partagée) : on s'appuie sur **DKIM** (aligné sur `pactiva.legal`) + SPF de l'IP pour passer DMARC |
| **`8080` admin en clair** | Ne pas exposer `8080` publiquement ; accès admin via `https://mail.pactiva.legal/admin/login` (TLS Stalwart) |
| Secrets en clair dans `/tmp/*.json` | Purger tout fichier de bootstrap après import ; creds dans `.env` (chmod 600) |

---

## 5. Comptes à prévoir pour Pactiva
| Compte | Rôle |
|---|---|
| `noreply@pactiva.legal` | **émetteur applicatif** (vérif e-mail, reset) — `EMAIL_HOST_USER` |
| `contact@pactiva.legal` | boîte **consultable via webmail** (réception : support/contact) |
| (option) `admin@pactiva.legal` ou `postmaster@pactiva.legal` | `rua` DMARC / administration |

---

## 6. Diagnostic en une phrase
Le serveur Stalwart (TLS, DKIM, webmail, ports) est **prêt et mutualisé** ; il suffit
d'**ajouter le domaine `pactiva.legal` + les comptes** côté Stalwart, de **publier le
DNS mail** (MX/SPF/DKIM/DMARC + `mail`/`webmail`), puis d'**injecter les creds SMTP**
dans le `.env` Pactiva et de **corriger la marque du From** — en évitant les deux
pièges FemiGlow (SPF, Redis). Détails dans `01-plan-action.md` / `03-runbook.md`.
