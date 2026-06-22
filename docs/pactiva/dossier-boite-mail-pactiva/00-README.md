# Boîte mail `pactiva.legal` — dossier d'exécution infaillible

> **Objectif.** Créer **3 adresses fonctionnelles** sur le Stalwart déjà installé
> (`mail.lumiereacademy.com`, mutualisé), parfaitement câblées (envoi + réception +
> DKIM/SPF/DMARC alignés) et **consultables via webmail** :
>
> | Adresse | Usage |
> |---|---|
> | `info@pactiva.legal` | boîte de contact principale (réception + envoi) |
> | `elazhar.jebbari@pactiva.legal` | boîte personnelle |
> | `no-reply@pactiva.legal` | émetteur applicatif (transactionnel Pactiva) |
>
> Ce dossier est **issu d'une reconnaissance live** du serveur (Stalwart v0.16,
> SnappyMail, OpenLiteSpeed, DNS). Toutes les valeurs sont réelles, pas supposées.

## Décision d'architecture (la clé de l'infaillibilité)

On **clone à l'identique le domaine `femiglow-maroc.com`**, qui est le précédent
exact d'un « 2ᵉ domaine » ajouté à ce Stalwart et qui **fonctionne déjà**. En
particulier :

1. **MX → `mail.lumiereacademy.com`** (priorité 10). On **réutilise l'hôte mail
   existant** au lieu de créer `mail.pactiva.legal`. Conséquence : **aucun** nouveau
   certificat, **aucun** A `mail.pactiva.legal`, **aucun** enregistrement TLSA/DANE à
   gérer — l'hôte `mail.lumiereacademy.com` a déjà : A=46.202.128.168, **rDNS aligné**
   (`PTR 46.202.128.168 → mail.lumiereacademy.com`), cert Let's Encrypt valide, DANE
   publié. Le HELO sortant reste `mail.lumiereacademy.com` mais **c'est sans incidence
   sur l'alignement DMARC** : **SPF s'aligne** parce que l'enveloppe `MAIL FROM` est en
   `@pactiva.legal` (vérifiée contre `v=spf1 mx -all`, soit l'IP du MX 46.202.128.168),
   et **DKIM s'aligne** séparément via `d=pactiva.legal` (clés propres au domaine). Un
   seul des deux alignés suffit à DMARC.
2. **DKIM = gestion automatique** : Stalwart génère lui-même les paires
   **Ed25519 + RSA-2048** (sélecteur `v1-{algo}-{AAAAMMJJ}`, rotation 90j/7j/30j).
   On ne manipule **aucune clé** à la main.
3. **SPF `v=spf1 mx -all`**, **DMARC** (départ `p=quarantine`, puis `p=reject`),
   **DNS en gestion manuelle** (Stalwart génère la zone à publier, toi tu la publies
   chez le registrar `.legal`).
4. **Webmail** : SnappyMail (OLS) est **multi-domaine** et pointe IMAP/SMTP sur
   `localhost` → il suffit d'ajouter un fichier domaine `pactiva.legal.json` (copie
   conforme de `femiglow-maroc.com.json`). Accès immédiat via une URL webmail
   existante, ou via `webmail.pactiva.legal` dédié (optionnel, voir 04).

## Plan en 6 étapes (résumé)

| # | Étape | Où | Qui | Réversible ? |
|---|---|---|---|---|
| 1 | Créer le **domaine** `pactiva.legal` dans Stalwart (DKIM auto) | serveur (`stalwart-cli`) | Ahmed/Claude | oui (`delete`) |
| 2 | Récupérer la **zone DNS générée** (`get Domain`) | serveur | — | lecture |
| 3 | **Publier le DNS** chez le registrar `.legal` | registrar | **Ahmed** | oui |
| 4 | Créer les **3 comptes** (info / elazhar.jebbari / no-reply) | serveur | Ahmed/Claude | oui (`delete`) |
| 5 | Ajouter `pactiva.legal.json` à **SnappyMail** (+ webmail dédié optionnel) | serveur | Ahmed/Claude | oui |
| 6 | Câbler l'**app Pactiva** sur `no-reply@pactiva.legal` (`.env`) | code/`.env` | Claude | oui |

## Index du dossier

- **`01-etat-des-lieux.md`** — audit live (Stalwart, SnappyMail, OLS, DNS, précédent femiglow).
- **`02-stalwart-execution.md`** — commandes `stalwart-cli` EXACTES (domaine + DKIM + 3 comptes), avec payloads JSON copiables.
- **`03-dns-pactiva.md`** + **`03-dns-records.csv`** — enregistrements DNS exacts à publier (requis / recommandés / optionnels), avec les emplacements à remplir depuis la sortie de l'étape 2.
- **`04-webmail-snappymail.md`** — accès webmail : voie A (immédiate) et voie B (`webmail.pactiva.legal` brandé).
- **`05-app-pactiva-smtp.md`** — câblage SMTP de l'app + réconciliation `no-reply@` vs `noreply@`.
- **`06-verification.md`** — recette de validation bout-en-bout (DKIM/SPF/DMARC=pass, login IMAP, webmail, mail-tester).
- **`07-risques-rollback.md`** — sécurité serveur mutualisé, pièges, rollback.

> Ce dossier **affine et remplace** l'audit préliminaire `dossier-mail-stalwart/`
> (qui supposait une création par sous-commandes génériques et un SPF `ip4:`). Les
> valeurs ci-dessous sont celles **réellement observées** sur le serveur.
