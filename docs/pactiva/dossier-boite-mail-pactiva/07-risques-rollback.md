# Risques, sécurité (serveur mutualisé) & rollback

## Règle d'or : ne toucher QUE `pactiva.legal`
Le VPS héberge **lumiereacademy.com** et **femiglow-maroc.com** en production, sur le
**même** Stalmart et le **même** OLS. Toutes les opérations de ce dossier sont
**additives** et ciblées `pactiva.legal`. Interdits :
- ❌ modifier/supprimer un Domain/Account existant ;
- ❌ toucher la zone DNS des autres domaines ;
- ❌ éditer les vhosts `webmail`/`femiglow-webmail` (on en **clone** un nouveau) ;
- ❌ afficher/committer un secret (`/root/stalwart-credentials.txt`, mots de passe, clés privées DKIM, `.env`).

## Risques & mitigations
| Risque | Impact | Mitigation |
|---|---|---|
| Reload OLS avec conf invalide | **tous** les sites tombent | sauvegarder `httpd_config.conf` ; OLS n'a pas de « test de conf » CLI fiable → `lswsctrl reload` (gracieux, zero-downtime) **puis** vérifier `logs/error.log` + `curl -sI` d'un site existant ; restaurer le backup si erreur |
| Vhost SSL déclaré avant le cert (« vhssl post-cert ») | reload OLS échoue (cert introuvable) | monter le vhost **HTTP d'abord** (sans bloc `vhssl`), émettre le cert, **puis** ajouter `vhssl` + map 443 (cf. 04 voie B) |
| DMARC `p=reject` trop tôt | e-mails légitimes rejetés | démarrer `p=quarantine`, vérifier pass, puis `p=reject` |
| SPF mal formé (`v=spf1` seul, `~all`) | spam/rejet | exactement `v=spf1 mx -all` |
| Clé RSA DKIM scindée à tort dans l'UI registrar | `dkim=none/permerror` | recopier la chaîne complète (concaténer les segments `"..." "..."`) |
| CAA `letsencrypt` ajoutée alors que le cert du site vient d'ailleurs | renouvellement TLS du site bloqué | CAA = optionnel ; vérifier l'émetteur actuel avant |
| Création compte sans mot de passe consigné | perte d'accès | générer + **stocker** P_INFO/P_AHMED/P_NOREPLY au moment de l'étape 02 |
| `pactiva.legal.json` mauvais host | login webmail KO | copier le template femiglow (host=`localhost`) |
| Redis NOAUTH (piège relevé chez femiglow) | rate-limit/retries dégradés | hors périmètre ici ; surveiller si anomalies d'envoi |

## Ordre d'exécution (dépendances)
```
02 (domaine + DKIM auto + 3 comptes)  ──►  02.2 (lire dnsZoneFile)  ──►  03 (publier DNS) ──► propagation
        │                                                                                       │
        └──────────────────────────────────────────────────────►  04 (pactiva.legal.json) ────┤
                                                                                                ▼
                                                  06#3 login IMAP OK  +  06#4 RÉCEPTION entrante (externe → info@) OK
                                                                                                │
                            05 (.env no-reply + deploy)  ◄────────── DNS propagé ───────────────┘
                                                                                                ▼
                                                  06#5..#7 émission/DMARC/mail-tester  ──►  06#8 bascule DMARC p=reject
```
> - **Réception** : marche dès que le **MX** est publié (06#4 le prouve) ; pas besoin du reste.
> - **Émission propre** (DKIM/SPF/DMARC pass) : exige le DNS complet propagé ; ne renseigner
>   le `.env` de l'app (05) **qu'après** propagation.
> - **Rapports DMARC/TLS-RPT** : pointés sur **`info@`** (créé en 02) ⇒ aucune dépendance
>   à un compte `postmaster` (l'alias `postmaster/abuse` reste optionnel, cf. 02 §4).

## Rollback complet
```bash
# Stalwart (préambule auth de 02) :
stalwart-cli query Account --where domainId=$DID --fields id   # -> ids
stalwart-cli delete Account <id1> <id2> <id3>
stalwart-cli delete Domain "$DID"                              # purge aussi les DkimSignature

# SnappyMail :
rm -f /usr/local/lsws/webmail/data/_data_/_default_/domains/pactiva.legal.json

# OLS (voie B uniquement) : retirer le bloc virtualhost pactiva-webmail + les 2 maps,
#   supprimer pactiva-webmail.conf, puis  lswsctrl reload  (vérifier logs/error.log)
# Cert : certbot delete --cert-name webmail.pactiva.legal

# DNS : retirer les enregistrements pactiva.legal côté registrar.
# App : vider EMAIL_HOST_USER/PASSWORD du .env (revient à un envoi non authentifié).
```
Aucune de ces actions n'affecte lumiereacademy.com / femiglow-maroc.com.

## Ce que je peux exécuter pour toi (sur ton feu vert)
- **Étape 02** (créer domaine + DKIM + 3 comptes) et **04** (`pactiva.legal.json`) :
  réversibles, je peux les lancer et te livrer la zone DNS + les mots de passe (canal sûr).
- **Étape 03 (DNS)** : **toi**, chez le registrar `.legal`.
- **Étape 05 (.env + deploy)** : moi, une fois le DNS propagé.
- **Voie B (OLS)** : sensible (reload global) — à faire ensemble, avec sauvegarde préalable.
