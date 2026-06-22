# Étape Stalwart — créer le domaine + DKIM + 3 comptes (commandes exactes)

> ⚠️ Serveur **mutualisé en production** (lumiereacademy + femiglow tournent dessus).
> On ne touche **que** des objets `pactiva.legal` : `create` / `get`. Aucune commande
> ci-dessous ne modifie les domaines existants. Tout est réversible (`delete`).

## 0. Préambule d'authentification (à coller en tête de session SSH)

```bash
ssh -i ~/.ssh/corolle_deploy root@46.202.128.168

# Récupère les identifiants admin du panel SANS les afficher, et cible le Stalwart local
sect=$(sed -n '/STALWART ADMIN PANEL/,/COMPTES EMAIL/p' /root/stalwart-credentials.txt)
export STALWART_USER=$(printf '%s\n' "$sect" | sed -nE 's/.*[Uu]ser:[[:space:]]*([^[:space:]]+).*/\1/p' | head -1)
export STALWART_PASSWORD=$(printf '%s\n' "$sect" | sed -nE 's/.*[Pp]ass:[[:space:]]*(.+)$/\1/p' | head -1)
export STALWART_URL="http://127.0.0.1:8080"     # API locale (contourne le 301 du proxy)

# Garde-fou : si l'extraction échoue, repli sur la valeur terrain connue puis stop si vide
[ -n "$STALWART_USER" ] || export STALWART_USER="admin@lumiereacademy.com"
[ -n "$STALWART_PASSWORD" ] || { echo "ERREUR: mot de passe admin non extrait — le saisir à la main"; }

# Sanity check (DOIT lister lumiereacademy.com + femiglow-maroc.com ; sinon auth KO) :
stalwart-cli query Domain
```

## 1. Créer le domaine `pactiva.legal` (clone exact de femiglow, DKIM auto)

```bash
stalwart-cli create Domain --json '{
  "name": "pactiva.legal",
  "isEnabled": true,
  "certificateManagement": { "@type": "Automatic", "acmeProviderId": "iodjw1oiaaqa", "subjectAlternativeNames": {} },
  "dkimManagement": { "@type": "Automatic",
    "algorithms": { "Dkim1Ed25519Sha256": true, "Dkim1RsaSha256": true },
    "selectorTemplate": "v{version}-{algorithm}-{date-%Y%m%d}",
    "rotateAfter": 7776000000, "retireAfter": 604800000, "deleteAfter": 2592000000 },
  "dnsManagement": { "@type": "Manual" },
  "subAddressing": { "@type": "Enabled" },
  "allowRelaying": false,
  "reportAddressUri": "mailto:info@pactiva.legal"
}'
```

> **`reportAddressUri = mailto:info@pactiva.legal`** (et non `postmaster@`) : on pointe
> les rapports vers une boîte **qui existera à coup sûr** (créée en §3). femiglow utilise
> la forme nue `mailto:postmaster` (Stalwart la résout en `postmaster@<domaine>`), mais
> `postmaster@` n'existe pas par défaut ⇒ on évite la dépendance en visant `info@`.

Cette commande renvoie l'**id** du nouveau domaine (ex. `d`). Récupère-le (la projection
`--fields id` est **confirmée** : `query` renvoie bien la clé `id`) :

```bash
DID=$(stalwart-cli query Domain --where name=pactiva.legal --fields id,name --json \
      | python3 -c 'import json,sys;rows=json.load(sys.stdin);print(rows[0]["id"] if rows else "")')
[ -n "$DID" ] || { echo "ERREUR: domaine pactiva.legal introuvable — la création a-t-elle réussi ?"; }
echo "Domain id = $DID"
```
*(Repli : `create Domain` affiche aussi l'id dans sa sortie ; tu peux le relever là.)*

> **Pourquoi ces valeurs ?** Elles sont calquées sur `femiglow-maroc.com` (cf. 01), seul
> `reportAddressUri` diffère délibérément (→ `info@`). DKIM `Automatic` ⇒ Stalwart génère
> **immédiatement** les 2 clés et remplit `dnsZoneFile`. `certificateManagement Automatic`
> avec SAN vide devrait être inoffensif (on ne sert aucun hôte TLS sous `pactiva.legal`),
> **mais vérifie-le** (le challenge ACME est TLS-ALPN-01 et le 443 de pactiva.legal est
> servi par OLS, pas Stalwart) :
> ```bash
> journalctl -u stalwart-mail --since "2 min ago" | grep -i -E "acme|alpn|pactiva" || echo "aucune tentative ACME — OK"
> ```
> Si une tentative TLS-ALPN-01 sur `pactiva.legal` apparaît en boucle, repasse le domaine
> en cert manuel : `stalwart-cli update Domain "$DID" --field certificateManagement='{"@type":"Manual"}'`.

## 2. Lire la zone DNS générée (DKIM inclus) → c'est ce que tu publieras

```bash
stalwart-cli get Domain "$DID"            # vue humaine : section « Zone File »
# ou, brut, le bloc à publier :
stalwart-cli get Domain "$DID" --json | python3 -c 'import json,sys;print(json.load(sys.stdin)["dnsZoneFile"])'
```

Tu obtiendras un bloc identique en forme à femiglow, mais pour `pactiva.legal`, avec
les **vraies valeurs DKIM `p=…`**. C'est la source pour les DKIM (et, si tu y tiens, les
SRV/autoconfig). **⚠ DEUX exceptions — ne PAS recopier ces lignes du `dnsZoneFile`** :
- **`_dmarc`** : Stalwart génère `p=reject` sans `adkim/aspf`. **On publie une version
  override** (départ `p=quarantine; adkim=s; aspf=r`, `rua=info@`) — voir 03. Bascule
  `p=reject` après observation.
- **`mta-sts` / `_mta-sts`** : **inerte sur ce serveur** (vérifié : la policy n'est pas
  servie avec un cert valide). À **omettre** par défaut — voir 03 §B.

Voir 03 pour le détail enregistrement par enregistrement.

## 3. Créer les 3 comptes

> `Account` est multi-variant ⇒ on crée la variante `User` : `create Account/User`.
> Le `secret` est fourni **en clair** ; Stalwart le hache au stockage (comme via l'UI).
> Génère des mots de passe forts et **conserve-les dans un gestionnaire** (puis ajoute-les
> à `/root/stalwart-credentials.txt` côté serveur si tu veux garder la convention).

```bash
# Génère 3 mots de passe forts (24 car. base64url) — affichés UNE fois :
P_INFO=$(openssl rand -base64 18 | tr '+/' '-_'); echo "info@        : $P_INFO"
P_AHMED=$(openssl rand -base64 18 | tr '+/' '-_'); echo "elazhar.jebbari@ : $P_AHMED"
P_NOREPLY=$(openssl rand -base64 18 | tr '+/' '-_'); echo "no-reply@    : $P_NOREPLY"

# info@pactiva.legal
stalwart-cli create Account/User --json "{
  \"name\": \"info\", \"domainId\": \"$DID\",
  \"description\": \"Pactiva — Contact / Info\", \"locale\": \"fr_FR\",
  \"roles\": {\"@type\":\"User\"}, \"permissions\": {\"@type\":\"Inherit\"},
  \"credentials\": [ {\"@type\":\"Password\", \"secret\": \"$P_INFO\"} ]
}"

# elazhar.jebbari@pactiva.legal
stalwart-cli create Account/User --json "{
  \"name\": \"elazhar.jebbari\", \"domainId\": \"$DID\",
  \"description\": \"Ahmed El Azhar Jebbari\", \"locale\": \"fr_FR\",
  \"roles\": {\"@type\":\"User\"}, \"permissions\": {\"@type\":\"Inherit\"},
  \"credentials\": [ {\"@type\":\"Password\", \"secret\": \"$P_AHMED\"} ]
}"

# no-reply@pactiva.legal  (émetteur applicatif)
stalwart-cli create Account/User --json "{
  \"name\": \"no-reply\", \"domainId\": \"$DID\",
  \"description\": \"Pactiva — émetteur applicatif (transactionnel)\", \"locale\": \"fr_FR\",
  \"roles\": {\"@type\":\"User\"}, \"permissions\": {\"@type\":\"Inherit\"},
  \"credentials\": [ {\"@type\":\"Password\", \"secret\": \"$P_NOREPLY\"} ]
}"
```

Vérifie :
```bash
stalwart-cli query Account --where domainId=$DID
# → info@pactiva.legal / elazhar.jebbari@pactiva.legal / no-reply@pactiva.legal
```

> **Si `credentials` (forme liste) est refusé** par cette build du CLI, utilise la forme
> **map** observée dans le stockage (la clé `"0"` est l'**index** de l'élément — 0, 1, … —
> pas un identifiant) : remplace par
> `"credentials": { "0": {"@type":"Password","secret":"…"} }`.
> En dernier recours : crée le compte sans `credentials` puis fixe le mot de passe via
> l'**admin panel** (`https://mail.lumiereacademy.com/admin/login`).

## 4. (Optionnel) alias `postmaster@` / `abuse@` (conformité RFC)

Les rapports DMARC/TLS-RPT pointent désormais sur **`info@pactiva.legal`** (étape 1 +
DNS 03) ⇒ **aucune dépendance bloquante** ici. Pour la conformité RFC 5321 (une boîte
`postmaster@` devrait exister), tu peux ajouter des **alias** `postmaster` et `abuse`
sur `info@` : 2 clics dans l'admin panel (compte `info` → Aliases →
`postmaster@pactiva.legal`, `abuse@pactiva.legal`), ou via `update Account` après avoir
confirmé la forme d'`EmailAlias` (`stalwart-cli describe Account` → `aliases: list<EmailAlias>`).
Purement optionnel : la supervision DMARC fonctionne déjà via `info@`.

## 5. Rollback (si besoin)
```bash
stalwart-cli query Account --where domainId=$DID --fields id   # ids des comptes
stalwart-cli delete Account <id> [<id> …]
stalwart-cli delete Domain "$DID"        # supprime aussi les DkimSignature liées
```
Aucun impact sur lumiereacademy.com / femiglow-maroc.com.
