# Grid'5000 — API REST complète

> Recherche effectuée le 11 août 2026, sur la documentation officielle (wiki
> `grid5000.fr/w/API`, `/w/API_tutorial`, `/w/Advanced_OAR`) et tests empiriques en
> direct contre `api.grid5000.fr` (requêtes non authentifiées, résultats reproductibles
> avec `curl`). Chaque affirmation est sourcée. **Ce document est le plus important pour
> l'implémentation du client G5K de Pactiva Lab** — voir `07_ARCHITECTURE.md`.

---

## 0. Résumé exécutif — ce qui change le plus par rapport aux hypothèses de départ

**Correction majeure de périmètre** : contrairement à l'hypothèse habituelle (« les
données de référence sites/clusters/nodes sont publiques »), **la totalité de
`api.grid5000.fr` exige une authentification HTTP Basic, y compris la Reference API en
lecture seule**. Testé en direct :

```
$ curl -s -D - -o /dev/null "https://api.grid5000.fr/stable/sites"
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Basic realm="Grid'5000 API"
```

Identique pour `/stable/`, `/stable/sites`, `/stable/sites/grenoble/clusters`,
`/stable/sites/grenoble/jobs`, `/stable/sites/grenoble/status`,
`/stable/sites/grenoble/deployments`, et même `https://api.grid5000.fr/doc/` (la spec
elle-même). **Aucun endpoint n'est accessible sans identifiants Grid'5000.**

Il faut donc un compte Grid'5000 pour tout usage programmatique de l'API, y compris en
lecture.

**Alternative publique réelle (pas l'API REST à proprement parler)** : le
reference-repository (source de vérité sites/clusters/nodes) est mirroré publiquement et
sans authentification sur GitHub :
```
https://github.com/grid5000/reference-repository
data/grid5000/sites/<site>/clusters/<cluster>/nodes/<node>.json
```
Mêmes données JSON que la Reference API (mêmes clés `architecture`, `gpu_devices`,
`main_memory`...). **C'est le seul moyen de faire du lookup matériel sans compte
Grid'5000** — utilisé pour la vérification empirique de Pactiva Lab (voir
`11_RUNBOOK_SONNET5.md`).
[API_tutorial#Versioning](https://www.grid5000.fr/w/API_tutorial)

---

## 1. Authentification

### 1.1 Principe général

Point d'entrée : `https://api.grid5000.fr/`, utilisable de l'extérieur comme de
l'intérieur. Sécurité : HTTPS/TLS (RFC5246) + HTTP Basic Auth (RFC2617). *« A mutual
authentication scheme using SSL Client Certificates has been envisioned, but not
implemented due to lack of resources »* (côté API publique — un mode certificat existe
côté client officiel pour des « trusted clients » internes, voir §5.3).
[API](https://www.grid5000.fr/w/API)

### 1.2 Depuis l'extérieur

*« you MUST send your Grid'5000 credentials (login and password) via the use of the
HTTP Basic Authentication mechanism »*
```bash
curl -u mylogin:mypassword -X POST https://api.grid5000.fr/stable/sites/rennes/jobs -d "command=sleep 100"
```

### 1.3 Depuis l'intérieur (frontale/machine d'accès)

*« From within Grid'5000, you are transparently authenticated IF AND ONLY IF you connect
from a frontend or access machine »* — via IDENT/reverse-proxy (headers
`X-Api-Auth-Type: IDENT`, `X-Api-User-CN`, `X-Remote-Ident`, `X-Kadeploy-User`).
Confirmé par le tutoriel : *« Credentials are not needed from within Grid'5000, but are
required from outside »*.

### 1.4 Tunnel SSH (authentification transparente dans les deux sens)

```bash
ssh -NL 3443:api.grid5000.fr:443 login@access.grid5000.fr
curl -k -X POST https://localhost:3443/sid/sites/rennes/jobs -d "command=sleep 100"
```

### 1.5 Versions d'API : `stable` vs `sid`

- **`stable`** : alias vers la dernière version stable (forme `major.minor`), à utiliser
  en production.
- **`sid`** : instable, réservée au débogage sur demande du staff.
- **Pas de version `grid5000`** documentée — `grid5000` est l'`uid` de la ressource
  racine (le « grid » lui-même), pas un identifiant de version.
- Spec Swagger-like : `https://api.grid5000.fr/doc/` (auth requise, non consultée en
  détail).

### 1.6 Vérification empirique de la surface authentifiée

| Endpoint | Résultat (sans credentials) |
|---|---|
| `GET /stable/` | `401` |
| `GET /stable/sites` | `401` |
| `GET /stable/sites/grenoble/clusters` | `401` |
| `GET /stable/sites/grenoble/clusters/dahu/nodes` | `401` |
| `GET /stable/sites/grenoble/jobs` | `401` |
| `POST /stable/sites/grenoble/jobs` | `401` |
| `GET /stable/sites/grenoble/status` | `401` |
| `GET /doc/` | `401` |

Le challenge `WWW-Authenticate: Basic realm="Grid'5000 API"` provient d'Apache — ce n'est
pas un filtrage IP, c'est une exigence d'authentification sur l'intégralité du domaine.

### 1.7 Media types et négociation de contenu

- Item : `application/vnd.grid5000.item+json`
- Collection : `application/vnd.grid5000.collection+json`
- Format par suffixe (`.json`) ou header `Accept` — *« If you put both, the Accept HTTP
  header will be ignored »*.

---

## 2. Structure générale : HATEOAS, pagination

Chaque item a un `uid` obligatoire et un tableau `links` (`rel`/`href`/`type`) — HATEOAS
complet. Chaque collection a `links`, `items`, `total`, `offset`.

⚠️ **Pagination côté requête non explicitement documentée** sur le wiki (seuls les
champs de réponse `total`/`offset` le sont). Le client officiel expose des kwargs
`page`/`per_page`/`all`, mais son propre code contient le commentaire *« in the future
we may want to support automatic pagination »* — **à considérer comme non confirmé**.

---

## 3. Reference API (sites, clusters, nodes)

### 3.1 Exemples d'URLs

```
GET https://api.grid5000.fr/stable/sites
GET https://api.grid5000.fr/stable/sites/rennes
GET https://api.grid5000.fr/stable/sites/rennes/clusters/paravance/
GET https://api.grid5000.fr/stable/sites/grenoble/clusters/dahu/nodes/dahu-29
```

### 3.2 Exemple complet : `GET /stable/sites/rennes`

```json
{
  "compilation_server": false,
  "description": "Grid5000 Rennes site",
  "email_contact": "support-staff@lists.grid5000.fr",
  "frontend_ip": "172.16.111.106",
  "g5ksubnet": {"gateway": "10.159.255.254", "network": "10.156.0.0/14"},
  "ipv6": {"prefix": "2001:660:4406:07", "site_global_kavlan": 16, "site_index": 7},
  "kavlan_ip_range": "10.24.0.0/14",
  "latitude": 48.1, "longitude": -1.6667,
  "location": "Rennes, France", "name": "Rennes", "production": true,
  "type": "site", "uid": "rennes",
  "version": "44a8812238067115b482b283b38c44d7d55ec585",
  "links": [
    {"rel": "clusters", "href": "/stable/sites/rennes/clusters", "type": "application/vnd.grid5000.collection+json"},
    {"rel": "jobs", "href": "/stable/sites/rennes/jobs", "type": "application/vnd.grid5000.collection+json"},
    {"rel": "deployments", "href": "/stable/sites/rennes/deployments", "type": "application/vnd.grid5000.collection+json"},
    {"rel": "vlans", "href": "/stable/sites/rennes/vlans", "type": "application/vnd.grid5000.collection+json"},
    {"rel": "metrics", "href": "/stable/sites/rennes/metrics", "type": "application/vnd.grid5000.collection+json"},
    {"rel": "storage", "href": "/stable/sites/rennes/storage", "type": "application/vnd.grid5000.collection+json"},
    {"rel": "status", "href": "/stable/sites/rennes/status", "type": "application/vnd.grid5000.item+json"}
  ]
}
```

Important : **le lien `status` d'un site pointe vers `/stable/sites/{site}/status`**
(sans `/clusters/`) — voir contradiction notée en §9.

### 3.3 Attributs matériels exposés (dont GPU) — vérifié en direct

Testé via le miroir public du reference-repository, nœud `gemini-1.lyon.grid5000.fr`
(DGX-1, 8×V100) :

```json
{
  "architecture": {"nb_cores": 40, "nb_procs": 2, "nb_threads": 80, "platform_type": "x86_64"},
  "chassis": {"manufacturer": "NVIDIA", "name": "DGX-1 with V100-32"},
  "exotic": true,
  "gpu_devices": {
    "nvidia0": {
      "compute_capability": "7.0", "cores": 5120, "cpu_affinity": 0,
      "device": "/dev/nvidia0", "memory": 34359738368,
      "microarchitecture": "Volta", "model": "Tesla V100-SXM2-32GB",
      "performance": {"fp-16": 28260000000000, "fp-32": 14130000000000, "fp-64": 7066000000000},
      "power_default_limit": "300.00 W", "vendor": "Nvidia"
    }
  },
  "main_memory": {"ram_size": 549755813888},
  "processor": {"model": "Intel Xeon", "version": "E5-2698 v4", "microarchitecture": "Broadwell"},
  "supported_job_types": {"besteffort": true, "deploy": true, "max_walltime": 0, "queues": ["admin", "default"]},
  "type": "node", "uid": "gemini-1"
}
```

**Clé importante pour un client GPU-aware : `gpu_devices`** (dict indexé `nvidia0`,
`nvidia1`...) avec `model`, `memory` (octets), `cores`, `compute_capability`,
`microarchitecture`, `vendor`. Cela permet de **choisir un cluster compatible AVANT
réservation** (VRAM suffisante pour un modèle donné) — voir `07_ARCHITECTURE.md`
§Sélection informée de cluster.

Le niveau cluster expose aussi des métriques de puissance GPU nommées
(`bmc_gpu_power_watt`, `labels: {gpu: "0"}`).

### 3.4 Versioning Git des ressources de référence

```bash
curl https://api.grid5000.fr/stable/sites/rennes/clusters/versions?pretty
# {"total": 392, "offset": 0, "items": [{"uid": "68fdd0...", "date": "...", "message": "...", ...}]}
curl "https://api.grid5000.fr/stable/sites/grenoble/clusters/dahu/nodes/dahu-29?pretty&version=<sha>"
curl "https://api.grid5000.fr/stable/sites/grenoble/clusters/dahu/nodes/dahu-29.json?pretty&timestamp=<epoch>"
```

---

## 4. Endpoints Jobs

### 4.1 `POST /sites/{site}/jobs` — soumission

*« This API is a thin wrapper on top of the OAR tool, therefore most of the oarsub
options are supported »*.

```bash
curl -i https://api.grid5000.fr/stable/sites/grenoble/jobs?pretty -X POST -H'Content-Type: application/json' \
  -d '{"resources": "nodes=2,walltime=02:00", "command": "sleep 3600"}'
```

**Champs du corps JSON** :

| Champ | Type | Rôle |
|---|---|---|
| `resources` | string (grammaire `oarsub -l`) | sélection de ressources |
| `command` | string | commande exécutée en mode passif |
| `types` | array | `deploy`, `besteffort`, `exotic`, `cosystem`, `noop`, `container`, `inner=<id>`, `day`, `night` |
| `name` | string | nom du job (confirmé via client officiel) |
| `properties` | string (SQL WHERE) | filtre équivalent à `oarsub -p` |
| `key` | string | clé SSH publique (deployments uniquement) |

**Réponse `201 Created`** (état `waiting`) :
```json
{
  "uid": 1965464, "user_uid": "auser", "walltime": 7200, "queue": "default",
  "state": "waiting", "project": "g5k-staff", "mode": "PASSIVE",
  "command": "./oarapi.subscript.IEtz0", "submitted_at": 1607006878, "started_at": 0,
  "message": "R=64,W=2:0:0,J=B,P=g5k-staff", "properties": "maintenance = 'NO'",
  "directory": "/home/auser", "events": [],
  "links": [{"rel": "self", "href": "/stable/sites/grenoble/jobs/1965464", "type": "application/vnd.grid5000.item+json"}],
  "resources_by_type": {}, "assigned_nodes": []
}
```
Headers notables : `Location: .../jobs/1965464`, `ETag`, `Cache-Control: max-age=0,
private, must-revalidate`.

### 4.2 `GET /sites/{site}/jobs/{id}` — détail

Une fois `running`, en plus des champs ci-dessus : `scheduled_at`, `started_at` (epoch
réel), `resources_by_type: {"cores": ["dahu-3.../0", ...]}`, `assigned_nodes`
(array de FQDN, un par nœud).

**Champs confirmés au total** : `uid`, `user_uid`, `user`, `walltime` (secondes, entier),
`queue`, `state`, `project`, `types`, `mode`, `command`, `submitted_at`, `scheduled_at`,
`started_at`, `message`, `properties`, `directory`, `events`, `resources_by_type`,
`assigned_nodes`.

### 4.3 `GET /sites/{site}/jobs` — liste

Pas d'exemple `curl` brut dans le wiki, mais confirmé fonctionnel via le client
officiel avec filtrage par état : `gk.sites["rennes"].jobs.list(state="running")` —
paramètre `state` envoyé en query param.

### 4.4 `DELETE /sites/{site}/jobs/{id}` — suppression

```bash
curl -i -X DELETE https://api.grid5000.fr/stable/sites/grenoble/jobs/1965464
# HTTP/1.1 202 Accepted
# X-Oar-Info: Deleting the job = 1965464 ...REGISTERED...
```
*« Deletion is not immediate, that's why you receive a 202 Accepted »*.

### 4.5 Extension de walltime — endpoint distinct

```bash
curl -i -X POST https://api.grid5000.fr/stable/sites/grenoble/internal/oarapi/jobs/1743185.json \
  -H'Content-Type: application/json' -d '{"method":"walltime-change", "walltime":"+0:30:0"}'
```
*« Job must be running for a walltime change. For Waiting job, delete and resubmit. »*
*« Walltime change is not possible in the production queue (Nancy). »*
[Advanced_OAR#Using_the_REST_API](https://www.grid5000.fr/w/Advanced_OAR)

⚠️ Chemin **différent** de l'API Jobs standard (`/internal/oarapi/jobs/{id}.json`, pas
`/jobs/{id}`). Le client officiel expose une forme objet : `job.walltime_change.create({"walltime": "2:00:00"})`.

### 4.6 Grammaire `resources`/`properties` complète

```
{sql1}/name1=n1/name2=n2+{sql2}/name3=n3,walltime=hh:mm:ss
```
Hiérarchie : `cluster|switch > chassis > host > cpu > gpu > core` (calcul),
`cluster|switch > chassis > host > disk` (stockage). `nodes` = alias de `host`.

```
oarsub -I -l host=1/gpu=3          # 3 GPU sur un seul nœud
oarsub -p "gpu_count >= 3" -l host=1   # nœud complet, ≥3 GPU
```

`properties` (SQL WHERE) :
```
"cluster='graphene'"
"memnode='16384' and ib_rate='20'"
"host in ('node-1.site.g5k', 'node-2.site.g5k')"
"cpuarch='x86_64'"
```

Erreur si aucune ressource ne correspond (CLI) : `There are not enough resources for
your request / OAR_JOB_ID=-5` — équivalent HTTP non montré dans la doc, probablement
400/422 (non confirmé).

**Types confirmés** : `deploy`, `besteffort`, `exotic`, `cosystem`, `noop`,
`container`/`inner=<id>`, `day`/`night`/`night=noretry`. Queues confirmées :
`default`, `besteffort`, `p1`-`p4` (production Grenoble/Abaca).

---

## 5. Client officiel Python : `python-grid5000`

### 5.1 Identité du projet

- Package PyPI **`python-grid5000`** — `pip install python-grid5000`.
- Version au moment de la recherche : **1.2.5**.
- Dépôt canonique : GitLab Inria, `https://gitlab.inria.fr/msimonin/python-grid5000`
  (namespace personnel, PAS un org `grid5000` officiel).
- Auteur/mainteneur : Matthieu Simonin (Inria).
- Référencé par [Grid5000:Software](https://www.grid5000.fr/w/Grid5000:Software) comme
  *« a thin wrapper around the Grid'5000 REST API »* — **client de référence
  recommandé**, pas maintenu par une équipe multi-personnes officielle.
- Compatibilité : *« Client version 1.x ↔ API version 3.x (stable) »*.

### 5.2 Installation et configuration

```bash
pip install python-grid5000   # Python ≥3.5 ; deps: requests>=2.21, pyyaml>=5.1, ipython
```

`~/.python-grid5000.yaml` (extérieur) :
```yaml
username: MYLOGIN
password: MYPASSWORD
```
(depuis une frontale, identifiants optionnels — auth transparente)

```python
from grid5000 import Grid5000
import os
conf_file = os.path.join(os.environ.get("HOME"), ".python-grid5000.yaml")
gk = Grid5000.from_yaml(conf_file)
```

### 5.3 Authentification côté code source (vérifié sur le fichier réel)

```python
class Grid5000(object):
    def __init__(self, uri=DEFAULT_BASE_URL, username=None, password=None,
                 verify_ssl=None, timeout=None, session=None,
                 sslcert=None, sslkey=None, ssluser="anonymous", **kwargs):
```
`DEFAULT_BASE_URL = "https://api.grid5000.fr/stable"`.

- Mode `username`/`password` → `requests.auth.HTTPBasicAuth`.
- `verify_ssl` : `/etc/ssl/certs/ca-certificates.crt` si présent (frontale), sinon
  `True` (certifi standard, cas externe).
- Mode certificat client (« trusted client », usage interne réservé) : sans `g5k_user`,
  l'appel est fait en tant qu'utilisateur `anonymous`, limité à la Reference API en
  lecture — **pas un contournement pour un client externe standard**.

### 5.4 Résilience réseau — retry automatique intégré

```python
def _create_session(retries=5, backoff_factor=0.3, status_forcelist=(500, 502, 504)):
    retry = Retry(total=retries, read=retries, connect=retries,
                   backoff_factor=backoff_factor, status_forcelist=status_forcelist)
```
→ **5 tentatives, backoff exponentiel (0.3), sur les codes 500/502/504 uniquement**
(503 n'est PAS inclus).

### 5.5 Format d'erreur consommé par le client

```python
error_json = result.json()
for k in ("message", "error"):
    if k in error_json:
        error_message = error_json[k]
if result.status_code == 401:
    raise Grid5000AuthenticationError(...)
raise Grid5000HttpError(...)
```
→ Le corps d'erreur JSON attendu porte soit une clé **`message`**, soit une clé
**`error`** (déduit du code du client, pas une spec formelle publiée).

### 5.6 Hiérarchie d'exceptions

```python
class Grid5000Error(Exception): ...
class Grid5000AuthenticationError(Grid5000Error): pass   # HTTP 401
class RedirectError(Grid5000Error): pass
class Grid5000ParsingError(Grid5000Error): pass            # JSON invalide
class Grid5000ConnectionError(Grid5000Error): pass
class Grid5000OperationError(Grid5000Error): pass
class Grid5000HttpError(Grid5000Error): pass                # non-2xx hors 401
class Grid5000ListError(Grid5000OperationError): pass
class Grid5000GetError(Grid5000OperationError): pass
class Grid5000CreateError(Grid5000OperationError): pass
class Grid5000DeleteError(Grid5000OperationError): pass     # ex. 403 sur delete par un tiers
```

### 5.7 Fonctionnalités principales

```python
# Reference API
node_info = gk.sites["nancy"].clusters["grisou"].nodes["grisou-1"]

# Browsing offline (cache local)
data = gk.dump_ref_api()   # équivaut à GET /stable/?deep=1 (confirme l'existence passée de la v3.0)

# Jobs API
running_jobs = gk.sites["rennes"].jobs.list(state="running")
job = site.jobs.create({"name": "pyg5k", "command": "sleep 3600"})
while job.state != "running":
    job.refresh()
    time.sleep(10)
job.delete()
job.walltime_change.create({"walltime": "+01:00:00"})

# Deployments API
job = site.jobs.create({"name": "pyg5k", "command": "sleep 3600", "types": ["deploy"]})
deployment = site.deployments.create({"nodes": job.assigned_nodes, "environment": "debian9-x64-min"})

# Monitoring/Status API
site_statuses = gk.sites["rennes"].status.list()
```

Couvre aussi Vlan, Storage, Metrics, Stitching API.

### 5.8 Autres bibliothèques (référence)

Restfully (Ruby), Execo (Python, orchestration fonctionnelle), EnOSlib, Ruby-Cute.

---

## 6. Rate limiting, pagination, formats d'erreur

### 6.1 Rate limiting

**Aucune mention trouvée** dans la doc officielle ni le code du client officiel (pas de
logique de rate-limiting côté client, seulement retry sur 500/502/504). Quotas
**fonctionnels côté OAR** documentés : max 2 réservations avancées/site (hors <1h).

### 6.2 Codes de statut HTTP (liste officielle complète)

| Code | Signification |
|---|---|
| 200 | requête réussie |
| 201 | ressource créée |
| 202 | requête acceptée, traitement asynchrone |
| 304 | non modifié depuis dernier accès (GET conditionnel) |
| 400 | requête incorrecte |
| 401 | authentification requise |
| 403 | accès interdit |
| 404 | ressource inexistante |
| 405 | méthode HTTP non supportée |
| 406 | format demandé non disponible |
| 415 | content-type non supporté |
| 422 | structure de données invalide |
| 500 | erreur serveur |
| 503 | service indisponible |
| 504 | délai dépassé |

**Aucun schéma JSON formel du corps d'erreur** n'est publié sur le wiki ; meilleur indice
concret : clé `message` ou `error` (§5.5).

---

## 7. Webhooks / notifications sans polling

**Aucune trace trouvée** de webhooks, callbacks HTTP, WebSocket, ou notification
événementielle. Modèle exclusivement **polling actif**, y compris côté client officiel :
```python
while job.state != "running":
    job.refresh()
    time.sleep(10)
```

Mise en garde côté CLI OAR classique : *« If scripting OAR and regularly polling job
states with oarstat, you can cause a high load on the OAR server »* — pas d'équivalent
REST documenté à l'option `-s` optimisée. **Conclusion : un client robuste doit
implémenter un polling avec backoff raisonnable**, et peut s'appuyer sur `ETag`/
`Cache-Control` pour limiter la charge.

---

## 8. Autres API mentionnées (pour complétude)

- **Deployments API** : `POST /sites/{site}/deployments`, corps `{"nodes": [...],
  "environment": "debian11-min", "key": "<clé SSH>"}`.
- **Vlans API** : `resources: "{type='kavlan-local'}/vlan=1,nodes=2"`.
- **Metrics API** : basée sur Kwollect, voir `05_MONITORING_ML_GPU.md`.
- **Storage API** : voir `04_STOCKAGE_RESEAU.md`.

---

## 9. Contradiction documentaire notée

La section « Site status » du tutoriel donne l'URL
`/stable/sites/grenoble/clusters/status?pretty` (*« gives the status of the nodes,
disks, vlans, and subnets »*), alors que la ressource `site` elle-même (§3.2) publie
son propre lien `status` sous `/stable/sites/{site}/status` (sans `/clusters/`).
**Recommandation pour un client robuste** : ne pas coder en dur l'URL de statut, mais
suivre le lien `rel: "status"` renvoyé dynamiquement (principe HATEOAS).

---

## Points à vérifier plus tard (non résolus, faute d'identifiants Grid'5000)

1. Contenu détaillé de la spec `https://api.grid5000.fr/doc/` (401 sans compte) —
   contiendrait probablement le schéma JSON formel des requêtes/réponses.
2. Confirmation server-side que `page`/`per_page` sont réellement honorés.
3. Code HTTP exact pour une soumission avec ressources indisponibles/quota dépassé.
4. Existence ou non d'un rate limiting HTTP.

## Sources consultées

[API](https://www.grid5000.fr/w/API) ·
[API_tutorial](https://www.grid5000.fr/w/API_tutorial) ·
[Advanced_OAR](https://www.grid5000.fr/w/Advanced_OAR) ·
[Grid5000:Software](https://www.grid5000.fr/w/Grid5000:Software) ·
[Hardware](https://www.grid5000.fr/w/Hardware) ·
[PyPI python-grid5000](https://pypi.org/project/python-grid5000/) ·
[GitLab python-grid5000](https://gitlab.inria.fr/msimonin/python-grid5000) ·
[reference-repository (miroir GitHub)](https://github.com/grid5000/reference-repository)
