# Plan d'action — boîte mail Pactiva (Stalwart) + webmail

Objectif : `noreply@pactiva.legal` (envoi transactionnel app) + `contact@pactiva.legal`
(boîte consultable via **webmail**), avec délivrabilité propre (SPF/DKIM/DMARC).

## Lot 1 — Stalwart (serveur) — *exécutable via `stalwart-cli` / admin panel*
1. **Ajouter le domaine** `pactiva.legal` dans Stalwart.
2. **Générer les clés DKIM** pour `pactiva.legal` (RSA‑2048 + Ed25519, comme femiglow)
   → récupérer les enregistrements TXT `<sélecteur>._domainkey.pactiva.legal`.
3. **Créer les comptes** : `noreply@pactiva.legal` (mot de passe fort, rôle envoi),
   `contact@pactiva.legal` (boîte de réception), option `postmaster@pactiva.legal`.
4. **TLS** : obtenir/charger un certificat Let's Encrypt couvrant `mail.pactiva.legal`
   et `webmail.pactiva.legal` (ACME Stalwart, comme pour les autres domaines).
5. **Vérifier Redis** : Stalwart envoie bien le `requirepass` (sinon retry/rate‑limit dégradés).

## Lot 2 — DNS *(registrar de pactiva.legal — action utilisateur)*
Publier les enregistrements de `02-dns-records.csv` :
- `MX pactiva.legal → 10 mail.lumiereacademy.com.` (l'hôte mutualisé) **ou** `mail.pactiva.legal` si on lui donne un A + bannière dédiée.
- `A mail.pactiva.legal → 46.202.128.168` et `A webmail.pactiva.legal → 46.202.128.168`.
- **SPF** `pactiva.legal TXT "v=spf1 ip4:46.202.128.168 mx -all"` (NE PAS publier `v=spf1` seul — piège femiglow).
- **DKIM** : les 2 TXT fournis par Stalwart (Lot 1.2).
- **DMARC** `_dmarc.pactiva.legal TXT "v=DMARC1; p=quarantine; rua=mailto:postmaster@pactiva.legal; adkim=s; aspf=r"` (commencer `p=quarantine`, passer `p=reject` après une période d'observation propre).

## Lot 3 — App Pactiva *(code + `.env` prod)*
1. **Marque du From** : `DEFAULT_FROM_EMAIL="Pactiva <noreply@pactiva.legal>"` (corriger « CLAIRE Studio » ; défaut code mis à jour dans `base.py`).
2. **`.env` prod** : `EMAIL_HOST=127.0.0.1`, `EMAIL_PORT=587`, `EMAIL_USE_TLS=true`,
   `EMAIL_HOST_USER=noreply@pactiva.legal`, `EMAIL_HOST_PASSWORD=<mdp Stalwart>`.
   (127.0.0.1 évite le DNS et reste local à la machine ; STARTTLS sur 587.)
3. **Redéploiement** standard (`deploy/deploy-claire.sh`) + redémarrage service.

## Lot 4 — Webmail (accès boîte)
- `https://webmail.pactiva.legal` (UI Stalwart) — login `contact@pactiva.legal`.
- Admin : `https://mail.pactiva.legal/admin/login`.
- Vérifier que `8080` n'est pas exposé en clair (firewall), TLS terminé par Stalwart.

## Lot 5 — Vérification (cf. runbook)
- Envoi test depuis l'app (reset mot de passe d'un compte test) → réception + **DKIM=pass, SPF=pass, DMARC=pass** (en-têtes Authentication‑Results).
- `dig` confirme MX/SPF/DKIM/DMARC. `mail-tester.com` ≥ 9/10.
- Lecture via webmail OK.

## Critères d'acceptation
- [ ] `pactiva.legal` = domaine Stalwart avec DKIM publié + TLS valide.
- [ ] App envoie depuis `noreply@pactiva.legal` (auth OK), reçue avec DKIM/SPF/DMARC pass.
- [ ] `contact@pactiva.legal` consultable via `https://webmail.pactiva.legal`.
- [ ] SPF correct (pas `v=spf1` seul), DMARC ≥ quarantine, Redis authentifié.

## Risques (repris de femiglow)
| Risque | Mitigation |
|---|---|
| SPF cassé → spam/rejet | publier le SPF complet d'emblée |
| Redis NOAUTH → retry dégradé | confirmer le mdp Redis dans Stalwart avant trafic |
| Mauvais alignement DMARC (HELO=lumiereacademy) | s'appuyer sur **DKIM** aligné `pactiva.legal` (`adkim=s`), `aspf=r` |
| Secrets en clair | creds dans `.env` chmod 600 ; purge des bootstrap `/tmp/*.json` |
| Domaine `.legal` (registrar) | DNS = action utilisateur ; fournir les valeurs exactes (`02-dns-records.csv`) |
