# DNS `pactiva.legal` — enregistrements à publier chez le registrar

> Source de vérité = la sortie `dnsZoneFile` de l'étape 02 (`get Domain $DID`). Ce
> fichier en est la transcription, **enregistrement par enregistrement**, avec ce qui
> est requis / recommandé / optionnel. Les valeurs **`⟦…⟧` sont à recopier depuis la
> sortie de l'étape 02** (elles ne sont connues qu'après la création du domaine).
>
> Format des valeurs ci-dessous = champs DNS « nom / type / valeur ». Beaucoup de
> registrars veulent le **nom relatif** (sans `pactiva.legal.` final) : ex. `_dmarc`
> au lieu de `_dmarc.pactiva.legal.`. Adapte selon ton interface.

## A. REQUIS — sans ça, rien ne marche

| # | Type | Nom | Valeur | Note |
|---|---|---|---|---|
| 1 | **MX** | `pactiva.legal` | `10 mail.lumiereacademy.com.` | hôte mail mutualisé (existant, cert+rDNS+DANE OK) |
| 2 | **TXT (SPF)** | `pactiva.legal` | `v=spf1 mx -all` | autorise le MX (→46.202.128.168) ; **ne PAS** publier `v=spf1` seul |
| 3 | **TXT (DKIM ed25519)** | `⟦sel-ed⟧._domainkey` | `v=DKIM1; k=ed25519; h=sha256; p=⟦clé⟧` | `⟦sel-ed⟧ = v1-ed25519-AAAAMMJJ` (sortie étape 02) |
| 4 | **TXT (DKIM rsa)** | `⟦sel-rsa⟧._domainkey` | `v=DKIM1; k=rsa; h=sha256; p=⟦clé longue⟧` | la clé RSA est longue : si l'UI limite à 255 car., scinder en plusieurs chaînes entre guillemets (le `(...)` de la zone le montre) |
| 5 | **TXT (DMARC)** | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:info@pactiva.legal; adkim=s; aspf=r` | **valeur OVERRIDE manuelle** (voir encadré) ; départ `p=quarantine`, puis `p=reject` après 48–72 h propres |

> **DKIM (#3,#4)** : valeurs générées par Stalwart (gestion automatique). On les lit
> dans `dnsZoneFile`. Le **sélecteur inclut la date du jour** de création
> (`v1-ed25519-AAAAMMJJ`) — d'où l'obligation de les recopier depuis l'étape 02, pas
> de les deviner.
>
> **⚠ DMARC (#5) = override, NE PAS recopier la ligne `_dmarc` du `dnsZoneFile`.**
> Stalwart génère `v=DMARC1; p=reject; rua=mailto:postmaster@…` (sans `adkim/aspf`, et
> `rua` vers `postmaster`). On publie **à la place** la version ci-dessus : départ
> `p=quarantine` (rampe de sécurité), `adkim=s aspf=r` (alignement explicite), `rua`
> vers **`info@`** (boîte qui existe). C'est la **seule** divergence volontaire vis-à-vis
> de la zone générée.

## B. RECOMMANDÉ — supervision transport

| # | Type | Nom | Valeur | Note |
|---|---|---|---|---|
| 8 | **TXT (TLS-RPT)** | `_smtp._tls` | `v=TLSRPTv1; rua=mailto:info@pactiva.legal` | rapports d'échec TLS (utile, autonome) |

> **MTA-STS (#6 CNAME `mta-sts`, #7 TXT `_mta-sts`) : À OMETTRE par défaut.**
> Vérifié en live : sur ce serveur, `https://mta-sts.<domaine>/.well-known/mta-sts.txt`
> **n'est PAS servi** avec un certificat valide (le CNAME `mta-sts → mail.lumiereacademy.com`
> aboutit au **cert self-signed par défaut d'OpenLiteSpeed**, et la policy renvoyée est
> vide) — c'est déjà le cas pour femiglow. Publier `_mta-sts`/`mta-sts` serait donc
> **inerte**, et pourrait générer des rapports TLS-RPT d'échec de récupération de policy.
> ➜ Ne les publie **que si** tu sers un jour une vraie policy `mta-sts.txt` derrière un
> cert couvrant `mta-sts.pactiva.legal`. La sécurité transport reste assurée par STARTTLS
> opportuniste + DANE (sur l'hôte `mail.lumiereacademy.com`).

## C. OPTIONNEL — confort clients mail (autodiscovery)

| # | Type | Nom | Valeur |
|---|---|---|---|
| 9 | SRV | `_imaps._tcp` | `0 1 993 mail.lumiereacademy.com.` |
| 10 | SRV | `_submissions._tcp` | `0 1 465 mail.lumiereacademy.com.` |
| 11 | SRV | `_pop3s._tcp` | `0 1 995 mail.lumiereacademy.com.` |
| 12 | SRV | `_jmap._tcp` | `0 1 443 mail.lumiereacademy.com.` |
| 13 | SRV | `_caldavs._tcp` / `_carddavs._tcp` | `0 1 443 mail.lumiereacademy.com.` |
| 14 | CNAME | `autoconfig` / `autodiscover` | `mail.lumiereacademy.com.` |
| 15 | CNAME + TXT | `ua-auto-config` / `_ua-auto-config` | `mail.lumiereacademy.com.` / `v=UAAC1; a=sha256; d=⟦hash⟧` |

> #9–#15 : **recopie littérale** depuis le `dnsZoneFile` de l'étape 02 (jamais
> reconstruits à la main). Si une valeur (ex. le hash `_ua-auto-config`) n'apparaît pas
> dans la sortie, **omets** l'enregistrement. Tout est optionnel (confort clients).

## D. À NE PAS publier (et pourquoi)

- ❌ **`A mail.pactiva.legal`** : inutile, le MX pointe sur `mail.lumiereacademy.com`.
- ❌ **Enregistrements `TLSA`/DANE** : ils appartiennent à `mail.lumiereacademy.com`
  (déjà publiés sous `lumiereacademy.com`). femiglow n'en a aucun — pactiva non plus.
- ❌ **`A webmail.pactiva.legal`** : seulement si tu veux la **voie B** (webmail brandé,
  cf. 04). Pour la voie A (webmail via URL existante), rien à publier.
- ⚠️ **CAA** : `pactiva.legal` sert déjà un site en HTTPS — une CAA `letsencrypt.org`
  est cohérente **si** ton cert actuel vient bien de Let's Encrypt. Vérifie avant
  (sinon tu bloquerais le renouvellement du cert du site). Optionnel, à manier avec soin.

## Vérification post-publication (propagation)
```bash
dig +short MX pactiva.legal
dig +short TXT pactiva.legal                       # v=spf1 mx -all
dig +short TXT _dmarc.pactiva.legal
dig +short TXT v1-ed25519-AAAAMMJJ._domainkey.pactiva.legal
dig +short TXT v1-rsa-AAAAMMJJ._domainkey.pactiva.legal
```
Voir `03-dns-records.csv` pour un tableau importable, et `06-verification.md` pour la
recette complète (DKIM/SPF/DMARC = pass).
