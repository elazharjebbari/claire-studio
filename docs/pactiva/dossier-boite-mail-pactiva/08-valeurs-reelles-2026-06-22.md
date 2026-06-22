# Valeurs DNS réelles — `pactiva.legal` (snapshot 2026-06-22)

> Domaine **créé** dans Stalwart le 2026-06-22 (id `d`, DKIM auto). Ci-dessous les
> valeurs **réelles** issues de `get Domain d` (`dnsZoneFile`), prêtes pour Hostinger.
> ⚠️ Les clés DKIM **tournent tous les 90 j** (sélecteur daté) : ce fichier est un
> instantané. Si tu republies après une rotation, relis `dnsZoneFile` pour les nouveaux
> sélecteurs/`p=`.

Sélecteurs DKIM générés : **`v1-ed25519-20260622`** et **`v1-rsa-20260622`**.

## À publier dans Hostinger
> Dans Hostinger, le champ **Nom/Host est RELATIF** (sans `.pactiva.legal`, il l'ajoute).
> Pour les TXT, **ne pas mettre de guillemets** ; pour le DKIM RSA, coller la valeur en
> **une seule chaîne** (Hostinger gère le découpage 255 c.).

### REQUIS
| Type | Nom (Host) | Valeur | Prio | TTL |
|---|---|---|---|---|
| MX | `@` | `mail.lumiereacademy.com` | 10 | 3600 |
| TXT | `@` | `v=spf1 mx -all` | — | 3600 |
| TXT | `v1-ed25519-20260622._domainkey` | `v=DKIM1; k=ed25519; h=sha256; p=XdKzz8NtO/a8gc9ggQ5NsHrUcEnsWu/yJsWr1cs+gEE=` | — | 3600 |
| TXT | `v1-rsa-20260622._domainkey` | `v=DKIM1; k=rsa; h=sha256; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEApOj2UA9vKdLAmJbhxUuGTWtqAnveVt49Dz8tOqL6/VDOOUfXTHDYeikTr24GmXemZ6uhYAlg4QjEDR2K3YUv9HucfKyFeg02YpdM3VGVhv5QINU7jMVW+6yweiFwxF+9VnPo9WGF9EoFF81P1euq8nyLtAXRb0NYJkAnUrSVrcQ6nGKqu6rM9DMJDWWUpUYYfDLyLRfazlPIvmgkpTC5HIhCJlUPz2NmfKzgPdnDvmlx8VuAfIr/F+zCAuOsuq4REg8GGrN7CDf6RwUGtHajZ9/qI8wUGzZSZK+6rbMSTtNc8NaUoMxCN1jmwcBO+MPZd4iasbfDv7hW/lfCW5ft7wIDAQAB` | — | 3600 |
| TXT | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:info@pactiva.legal; adkim=s; aspf=r` | — | 3600 |

> **DMARC** : Stalwart génère `p=reject` ; on publie d'abord **`p=quarantine`** (rampe),
> puis on bascule `p=reject` après 48–72 h propres.

### RECOMMANDÉ
| Type | Nom (Host) | Valeur | TTL |
|---|---|---|---|
| TXT | `_smtp._tls` | `v=TLSRPTv1; rua=mailto:info@pactiva.legal` | 3600 |

### OPTIONNEL — autodiscovery (SRV + CNAME), recopie littérale
| Type | Nom | Valeur (prio/poids/port/cible) |
|---|---|---|
| SRV | `_imaps._tcp` | `0 1 993 mail.lumiereacademy.com` |
| SRV | `_submissions._tcp` | `0 1 465 mail.lumiereacademy.com` |
| SRV | `_pop3s._tcp` | `0 1 995 mail.lumiereacademy.com` |
| SRV | `_jmap._tcp` | `0 1 443 mail.lumiereacademy.com` |
| SRV | `_caldavs._tcp` / `_carddavs._tcp` | `0 1 443 mail.lumiereacademy.com` |
| CNAME | `autoconfig` / `autodiscover` | `mail.lumiereacademy.com` |

### À NE PAS publier
- ❌ **`mta-sts` (CNAME)** et **`_mta-sts` (TXT)** : MTA-STS **inerte** sur ce serveur
  (policy non servie, cert self-signed) — vérifié. Inutile, voire source de rapports d'échec.
- ❌ **`A mail.pactiva.legal`** / **TLSA** : le MX pointe sur `mail.lumiereacademy.com`.
- ⚠️ **CAA** : facultatif ; ne l'ajoute que si tu maîtrises l'émetteur du cert du site.
- `ua-auto-config` / `_ua-auto-config` : gadget, ignorable.

## Reste à faire (après publication DNS)
1. Créer les **3 comptes** (info@, elazhar.jebbari@, no-reply@) — cf. `02` §3.
2. Ajouter `pactiva.legal.json` à **SnappyMail** — cf. `04`.
3. Câbler le **`.env`** de l'app sur `no-reply@` — cf. `05`.
4. **Vérifier** (DKIM/SPF/DMARC = pass, réception, webmail) — cf. `06`.
