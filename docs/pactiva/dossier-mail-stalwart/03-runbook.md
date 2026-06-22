# Runbook — provisionner la boîte mail Pactiva (Stalwart) + webmail

> ⚠️ **Opérations sensibles sur un serveur mutualisé en production.** À exécuter
> par l'opérateur (Ahmed) après validation. Les commandes Stalwart sont à confirmer
> contre la version réellement installée (`stalwart-cli --help`) ; l'admin panel
> `https://mail.lumiereacademy.com/admin/login` fait la même chose en UI.
> **Ne jamais** afficher le contenu de `/root/stalwart-credentials.txt` ailleurs que
> sur le serveur ; ne pas committer de mot de passe.

## 0. Pré-vol (lecture seule)
```bash
ssh <vps>
systemctl status stalwart-mail            # doit être active (running)
export STALWART_URL=https://mail.lumiereacademy.com
export STALWART_USER=admin                 # cf. /root/stalwart-credentials.txt
# (saisir le mot de passe à la main, ne pas l'écrire dans l'historique)
stalwart-cli --url "$STALWART_URL" domain list      # confirmer que pactiva.legal est ABSENT
```

## 1. Stalwart — domaine + DKIM + comptes
```bash
# 1.1 Domaine
stalwart-cli --url "$STALWART_URL" domain create pactiva.legal

# 1.2 DKIM (génère les paires, à publier ensuite en DNS)
stalwart-cli --url "$STALWART_URL" dkim create pactiva.legal --algo rsa
stalwart-cli --url "$STALWART_URL" dkim create pactiva.legal --algo ed25519
stalwart-cli --url "$STALWART_URL" dkim get pactiva.legal     # imprime les TXT à publier

# 1.3 Comptes (mots de passe FORTS, stockés ensuite dans .env / gestionnaire)
stalwart-cli --url "$STALWART_URL" account create noreply@pactiva.legal  --name "Pactiva (no-reply)"
stalwart-cli --url "$STALWART_URL" account create contact@pactiva.legal  --name "Pactiva Contact"
# option : postmaster@pactiva.legal pour rua DMARC
```
> Si la sous-commande exacte diffère selon la version, faire la même chose via
> l'admin panel : **Domains → Add** puis **Accounts → Add**, **Settings → DKIM → Generate**.

## 2. TLS (certificats mail/webmail)
- Stalwart gère ACME : ajouter `mail.pactiva.legal` et `webmail.pactiva.legal` aux
  hôtes TLS (admin panel → **Server → TLS / ACME**), ou recharger après émission.
- Prérequis : les **A records** du Lot DNS doivent déjà résoudre (étape 3).

## 3. DNS — chez le registrar de `pactiva.legal` *(action utilisateur)*
Publier exactement `02-dns-records.csv`. En particulier :
```
MX     pactiva.legal              10 mail.lumiereacademy.com.
A      mail.pactiva.legal         46.202.128.168
A      webmail.pactiva.legal      46.202.128.168
TXT    pactiva.legal              "v=spf1 ip4:46.202.128.168 mx -all"
TXT    <sel-rsa>._domainkey…      <valeur DKIM RSA imprimée en 1.2>
TXT    <sel-ed>._domainkey…       <valeur DKIM Ed25519 imprimée en 1.2>
TXT    _dmarc.pactiva.legal       "v=DMARC1; p=quarantine; rua=mailto:postmaster@pactiva.legal; adkim=s; aspf=r"
```
Vérifier la propagation :
```bash
dig +short MX pactiva.legal
dig +short TXT pactiva.legal
dig +short TXT _dmarc.pactiva.legal
dig +short TXT <sel-rsa>._domainkey.pactiva.legal
```

## 4. App Pactiva — `.env` prod + redéploiement
Dans le `.env` prod (fichier chmod 600, **non versionné**) :
```env
EMAIL_HOST=127.0.0.1
EMAIL_PORT=587
EMAIL_USE_TLS=true
EMAIL_HOST_USER=noreply@pactiva.legal
EMAIL_HOST_PASSWORD=<mot de passe Stalwart de noreply@>
DEFAULT_FROM_EMAIL=Pactiva <noreply@pactiva.legal>
SERVER_EMAIL=noreply@pactiva.legal
```
Puis redéployer :
```bash
DJANGO_SECRET_KEY=deploy-gate-key ./deploy/deploy-claire.sh    # le gate tourne AVANT le push
# (le script redémarre le service applicatif)
```

## 5. Vérification de bout en bout
```bash
# 5.1 Envoi applicatif réel : déclencher un reset mot de passe sur un compte test
#     puis lire l'en-tête Authentication-Results du message reçu :
#     attendu → dkim=pass header.d=pactiva.legal ; spf=pass ; dmarc=pass
# 5.2 SMTP direct (depuis la machine, STARTTLS + AUTH) :
python - <<'PY'
import smtplib, ssl
s = smtplib.SMTP("127.0.0.1", 587, timeout=10); s.starttls(context=ssl.create_default_context())
s.login("noreply@pactiva.legal", "<mdp>")
s.sendmail("noreply@pactiva.legal", ["<votre-test@gmail.com>"],
           "Subject: Pactiva test\r\nFrom: Pactiva <noreply@pactiva.legal>\r\n\r\nOK")
s.quit(); print("sent")
PY
# 5.3 Score externe : envoyer à une adresse mail-tester.com → viser >= 9/10
# 5.4 Webmail : se connecter sur https://webmail.pactiva.legal avec contact@pactiva.legal
```

## 6. Rollback / sécurité
- Si délivrabilité KO : repasser DMARC à `p=none` le temps de diagnostiquer (ne pas
  laisser `reject` tant que DKIM/SPF ne sont pas `pass`).
- Couper l'envoi app : remettre `EMAIL_BACKEND=…console.EmailBackend` en prod (les
  e-mails partent dans les logs, aucun envoi réseau) puis redéployer.
- Secrets : aucun mot de passe dans git ni dans ce dossier ; `.env` chmod 600 ;
  purger tout fichier de bootstrap temporaire après usage.

## 7. Checklist finale
- [ ] `domain list` montre `pactiva.legal` + DKIM présents
- [ ] DNS : MX/SPF/DKIM/DMARC + `mail`/`webmail` résolvent
- [ ] TLS valide sur `mail.` et `webmail.pactiva.legal`
- [ ] Reset mot de passe test reçu, `dkim=pass spf=pass dmarc=pass`
- [ ] `From` = `Pactiva <noreply@pactiva.legal>` (plus « CLAIRE Studio »)
- [ ] `contact@pactiva.legal` lisible via webmail
- [ ] mail-tester ≥ 9/10
```
