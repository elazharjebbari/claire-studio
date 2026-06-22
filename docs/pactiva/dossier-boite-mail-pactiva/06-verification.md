# Recette de vérification bout-en-bout

À dérouler **après** : domaine + comptes créés (02), DNS publié & propagé (03),
`pactiva.legal.json` ajouté (04). Coche chaque ligne.

## 1. DNS propagé
```bash
dig +short MX pactiva.legal                      # 10 mail.lumiereacademy.com.
dig +short TXT pactiva.legal                     # "v=spf1 mx -all"
dig +short TXT _dmarc.pactiva.legal              # v=DMARC1; p=quarantine; ...
dig +short TXT v1-ed25519-AAAAMMJJ._domainkey.pactiva.legal   # v=DKIM1; k=ed25519; ...
dig +short TXT v1-rsa-AAAAMMJJ._domainkey.pactiva.legal       # v=DKIM1; k=rsa; ...
```
- [ ] MX, SPF, DMARC, DKIM(ed25519), DKIM(rsa) résolvent.

## 2. Stalwart connaît le domaine + les comptes
```bash
# (préambule auth de 02)
stalwart-cli query Domain --where name=pactiva.legal      # présent, Enabled=Yes
stalwart-cli query Account --where domainId=$DID          # info / elazhar.jebbari / no-reply
stalwart-cli query DkimSignature --where domainId=$DID    # 2 lignes, stage "published/used"
```
- [ ] domaine + 3 comptes + 2 DKIM présents.

## 3. Login IMAP réel (réception)
```bash
# Test SSL IMAP sur 993 (depuis le serveur) :
openssl s_client -quiet -crlf -connect localhost:993 <<'IMAP'
a LOGIN info@pactiva.legal <MOT_DE_PASSE_INFO>
a LIST "" "*"
a LOGOUT
IMAP
```
- [ ] réponse `a OK ... LOGIN completed` (auth acceptée) puis liste des dossiers.

## 4. RÉCEPTION entrante depuis l'extérieur (preuve MX + boîte)
Depuis une adresse externe que tu contrôles (Gmail/Outlook…), **envoie un mail VERS
`info@pactiva.legal`** (sujet ex. « test entrant pactiva »). Puis vérifie qu'il est
bien arrivé :
```bash
openssl s_client -quiet -crlf -connect localhost:993 <<'IMAP'
a LOGIN info@pactiva.legal <MOT_DE_PASSE_INFO>
a SELECT INBOX
a SEARCH SUBJECT "test entrant pactiva"
a LOGOUT
IMAP
```
- [ ] le `SEARCH` renvoie au moins un message (le MX accepte le courrier externe + la boîte reçoit).

## 5. ÉMISSION authentifiée + alignement (sortant)
```bash
# SMTP submission 587 STARTTLS, auth no-reply@, vers une adresse externe que tu contrôles :
swaks --server 127.0.0.1:587 --tls \
  --auth LOGIN --auth-user no-reply@pactiva.legal --auth-password '<P_NOREPLY>' \
  --from no-reply@pactiva.legal --to <toi>@gmail.com \
  --h-Subject "Pactiva — test DKIM/SPF/DMARC" --body "OK"
# (si swaks absent : apt-get install -y swaks, ou utiliser le snippet python smtplib de 02)
```
Dans le mail reçu (Gmail → « Afficher l'original » / en-têtes `Authentication-Results`) :
- [ ] **`dkim=pass header.d=pactiva.legal`**
- [ ] **`spf=pass`** ET **Return-Path / envelope-from en `@pactiva.legal`** (c'est l'enveloppe, pas le `From:`, qui détermine l'alignement SPF)
- [ ] **`dmarc=pass`**

## 6. Envoi depuis l'app (transactionnel réel)
- Déclencher un **reset mot de passe** sur un compte test de Pactiva.
- [ ] e-mail reçu, `From: Pactiva <no-reply@pactiva.legal>`, DKIM/SPF/DMARC = pass.

## 6 bis. Webmail
- [ ] **Voie A** : login `info@pactiva.legal` sur `https://webmail.lumiereacademy.com` → boîte ouverte, le **mail entrant du #4 visible**.
- [ ] **Voie B** (si choisie) : `curl -sI https://webmail.pactiva.legal/` → `200`, login OK, cadenas TLS valide.

## 7. Score externe
- Envoyer depuis `no-reply@pactiva.legal` vers l'adresse fournie par **mail-tester.com**.
- [ ] **score ≥ 9/10** (DKIM/SPF/DMARC/rDNS verts).

## 8. Durcissement final
- [ ] Après 48–72 h propres : passer DMARC `p=quarantine` → **`p=reject`** (comme lumiere/femiglow).
- [ ] Mots de passe des 3 comptes consignés dans le gestionnaire (et éventuellement `/root/stalwart-credentials.txt`).
- [ ] `no-reply@` configuré dans le `.env` prod, déploiement effectué.

## Échecs typiques → cause
| Symptôme | Cause probable | Fix |
|---|---|---|
| `dkim=none` chez le destinataire | TXT DKIM pas (encore) propagé / sélecteur faux | revérifier #1 avec le **sélecteur daté** exact de l'étape 02 |
| `spf=fail` | SPF mal publié (`v=spf1` seul, ou `~all`/`?all`) | publier exactement `v=spf1 mx -all` |
| `dmarc=fail` alors que dkim+spf pass | mauvais alignement | `adkim=s aspf=r` + DKIM `d=pactiva.legal` (déjà le cas) |
| Login webmail refusé | `pactiva.legal.json` absent / mauvais host | recopier le template femiglow (04), host=`localhost` |
| App: `SMTPAuthenticationError` | `EMAIL_HOST_USER/PASSWORD` faux | doivent valoir `no-reply@pactiva.legal` + `P_NOREPLY` |
