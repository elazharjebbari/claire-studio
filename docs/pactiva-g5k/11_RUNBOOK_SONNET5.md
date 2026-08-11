# Runbook — exécution du Lot 0 par un agent Claude Sonnet 5

> Optimisé pour être suivi sans relire tout le dossier : chaque étape indique le
> fichier exact à créer/modifier, la commande de vérification, et le critère d'arrêt.
> **Ne réserve jamais de ressources Grid'5000 réelles** — aucune étape de ce runbook ne
> le nécessite ni ne le permet (pas d'identifiants disponibles).

---

## Avant de commencer

1. Lire `00_README.md` (découverte critique : toute l'API G5K est authentifiée).
2. Lire `07_ARCHITECTURE.md` en entier — les 4 découvertes critiques y sont numérotées
   et correspondent chacune à une section d'implémentation ci-dessous.
3. Vérifier l'état actuel : `backend/claire/lab/runners/g5k.py` (215 lignes, client
   maison `urllib`), `backend/claire/lab/models.py` (`ComputeCredential`, un seul champ
   `secret_encrypted`).

## Étape 1 — dépendances

```bash
cd backend
echo "requests>=2.28" >> requirements.txt
echo "python-grid5000>=1.2" >> requirements.txt
.venv/bin/pip install requests python-grid5000
```
Vérification : `python -c "from grid5000 import Grid5000; print('ok')"`.

## Étape 2 — modèle `ComputeCredential` étendu

Ajouter `ssh_key_encrypted = models.TextField(blank=True, default="")` à
`ComputeCredential` (`models.py`), créer la migration
(`python manage.py makemigrations lab`), l'appliquer en test uniquement (ne pas
toucher `db.sqlite3` de dev sans le vouloir — les tests créent leur propre DB).

**Critère d'arrêt** : `python manage.py makemigrations --check` ne signale plus de
divergence.

## Étape 3 — `claire/lab/g5k_ssh.py` (nouveau)

Fonction `temporary_ssh_key(raw_key: str) -> ContextManager[Path]` — écrit dans un
fichier temporaire à permissions `0600`, le supprime en sortie de contexte même sur
exception. Tests : contenu correct, permissions, suppression garantie (`pytest.raises`
dans le bloc `with`, vérifier que le fichier n'existe plus après).

## Étape 4 — `claire/lab/g5k_reference.py` (nouveau, pur)

```python
def gpu_clusters_for(min_vram_gb: float, nodes: dict) -> list[dict]:
    """nodes: {node_uid: {"site":..., "cluster":..., "node": <JSON reference-repository>}}
    Renvoie les clusters dont AU MOINS un GPU a >= min_vram_gb, triés par VRAM du
    premier GPU croissante. Un nœud sans `gpu_devices` est exclu silencieusement (ce
    n'est pas une exclusion à motiver, comme pour les annotations — c'est un filtre
    matériel simple)."""
```

**Test réel non-destructif** (niveau 3, `10_TESTS.md`) :
```bash
python -c "
import json
data = json.load(open('docs/pactiva-g5k/specs/g5k-clusters-gpu-sample.json'))
from claire.lab.g5k_reference import gpu_clusters_for
result = gpu_clusters_for(16, data['nodes'])
assert {r['cluster'] for r in result} == {'gemini', 'grouille', 'chifflot'}
assert 'dahu' not in {r['cluster'] for r in result}   # pas de GPU
print('OK', result)
"
```
Ce test utilise la fixture RÉELLE construite pendant la recherche (§`specs/g5k-clusters-gpu-sample.json`,
données récupérées en direct depuis le miroir public GitHub le 11/08/2026) — pas une
fixture inventée.

## Étape 5 — `claire/lab/g5k_client.py` (nouveau, remplace la logique HTTP maison)

Adapter `python-grid5000` : `build_client(login, password) -> Grid5000`,
`submit(client, site, config) -> str`, `poll(client, site, job_id) -> str`,
`cancel(client, site, job_id) -> None`, `test_connection(client) -> tuple[bool, str]`.
Mapper `Grid5000AuthenticationError` → `G5KError("g5k_auth_failed", ...)`,
`Grid5000HttpError`/`Grid5000ConnectionError` → `G5KError("g5k_unreachable", ...)`.

**Tests HTTP mockés** (niveau 2) : utiliser `responses` ou `unittest.mock.patch` sur
`requests.Session.request`, avec les payloads JSON EXACTS de `research/03_API_REST.md`
§4.1-4.2 (pas des payloads simplifiés) — copier-coller le JSON du rapport de recherche
dans la fixture de test, pour que le test verrouille le format réellement documenté.

## Étape 6 — `claire/lab/runners/g5k.py` (modifié)

`Grid5000Backend` devient un adaptateur sur `g5k_client.py` + `g5k_ssh.py` — l'interface
`ExecutionBackend` (`submit`/`poll`/`fetch`/`cancel`) ne change pas de signature.
`_rsync_push`/`_rsync_pull` utilisent désormais `g5k_ssh.temporary_ssh_key()` pour
passer `-i <chemin>` à `ssh`/`rsync` (option `-e "ssh -i <chemin> -o BatchMode=yes"`).
Si aucune clé SSH n'est configurée, `submit()` lève `G5KError("g5k_ssh_key_missing", ...)`
**avant** toute tentative rsync (échec rapide et explicite plutôt qu'un timeout SSH
cryptique).

## Étape 7 — garde-fou sweep GPU (`services.py`)

Dans `queue_run`/`experiment_run` (vue), si `len(variants) > LAB_G5K_MAX_RUNS_PER_SWEEP`
(setting, défaut 3) **et** `config.compute.target == "g5k"` **et** pas de `force=True`
explicite dans la requête → refuser avec `code="g5k_sweep_too_large"` et le message de
`specs/g5k-error-codes.csv`.

**Test** : sweep à 2 variantes G5K → OK ; sweep à 4 variantes G5K sans force → refusé ;
avec force → OK ; sweep à 4 variantes **local** → jamais concerné par ce garde-fou (la
bonne pratique documentée est spécifique à OAR/Grid'5000, pas au local).

## Étape 8 — marquer l'ancien doc déprécié

Déjà fait dans cette session : `docs/pactiva-lab/06_GRID5000.md` porte un bandeau
`⚠️ DÉPRÉCIÉ` en tête, pointant vers ce dossier.

## Étape 9 — suite complète + commit

```bash
cd backend && DJANGO_SECRET_KEY=x .venv/bin/python -m pytest -q
cd ../frontend && npx tsc --noEmit && npx vitest run
```
**Critère d'arrêt du lot 0** : tout vert, y compris le test réel non-destructif de
l'étape 4. Committer avec un message qui cite les 4 découvertes critiques corrigées.

---

## Journal d'exécution (à tenir à jour pendant l'exécution réelle)

### Recherche documentaire (11 août 2026)

5 agents de recherche en parallèle (WebSearch/WebFetch), chacun sur un axe. Rapports
complets dans `research/`. Découverte la plus significative : **toute l'API
`api.grid5000.fr` exige une authentification, même en lecture** (vérifié empiriquement,
401 sur tous les endpoints testés) — contrairement à l'hypothèse de départ. Deuxième
découverte majeure, propre à notre besoin : **Grid'5000 désactive l'authentification
par mot de passe en SSH** — le `ComputeCredential` existant (mot de passe seul) ne
permettait techniquement pas les transferts rsync déjà codés dans
`claire/lab/runners/g5k.py`, un bug latent jamais détecté faute de test réel.

### Exécution du Lot 0 (11 août 2026, même session)

**Dépendances** : `requests>=2.28` + `python-grid5000>=1.2` installées dans
`backend/.venv` (version résolue : 1.2.5). Code source du client officiel lu ligne à
ligne (`__init__.py`, `mixins.py`, `exceptions.py`) plutôt que supposé conforme au
rapport de recherche — a confirmé le retry (5×, backoff 0.3, 500/502/504) et révélé un
comportement non documenté par le wiki (§`07_ARCHITECTURE.md` §7bis) : `client.sites[site]`
consomme lui-même un appel HTTP GET avant tout accès à `.jobs`.

**Modèle** : `ComputeCredential.ssh_key_encrypted` + `last_test_ssh_ok` ajoutés,
migration `lab/0002_ssh_key_credential`, `makemigrations --check` propre.

**Nouveaux modules, tous testés** :
- `g5k_ssh.py` (6 tests, 100% de couverture) — fichier de clé temporaire 0600,
  suppression garantie y compris sur exception.
- `g5k_reference.py` (7 tests, 100%) — **2 tests contre des données Grid'5000 RÉELLES**,
  récupérées en direct depuis le miroir public du reference-repository pendant la
  recherche (`docs/pactiva-g5k/specs/g5k-clusters-gpu-sample.json` : 4 nœuds réels —
  Lyon `gemini` 8×V100 32 Go, Nancy `grouille` 2×A100 40 Go, Lille `chifflot` 2×P100
  16 Go, Grenoble `dahu` sans GPU). Le filtre par VRAM et le tri croissant sont donc
  vérifiés sur du vrai matériel, pas une fixture inventée.
- `g5k_client.py` (11 tests, 100%) — mocks HTTP construits sur les payloads JSON EXACTS
  du rapport de recherche (`research/03_API_REST.md` §3.2/§4.1/§4.2), pas des
  approximations. A révélé deux bugs de test (pas de code applicatif) au premier passage :
  collision de nom (`test_connection` importé au niveau module = collecté par pytest
  comme un test autonome) et sous-estimation du nombre d'appels HTTP réels (voir
  ci-dessus) — corrigés avant de valider la suite.
- `runners/g5k.py` (`Grid5000Backend`, réécrit) : adaptateur sur les 3 modules
  ci-dessus. 13 nouveaux tests dédiés (`test_lab_g5k_backend.py`, jamais testé de bout
  en bout avant ce lot — seul `poll_interval`/`build_run_script` avaient une couverture
  indirecte). **99% de couverture** sur l'ensemble des 4 modules G5K (175 lignes, 1 ligne
  de garde défensive inatteignable).

**Garde-fou sweep GPU** (`views.py`, `experiment_run`) : refuse un sweep G5K > 3 runs
(`LAB_G5K_MAX_RUNS_PER_SWEEP`, setting) sans `force=true`, avec message citant la bonne
pratique documentée. 3 tests (refus, `force` accepté, sweep local jamais concerné).

**Tests de sécurité étendus** (`test_lab_credentials.py`, balayage récursif déjà
existant) : le second secret (clé SSH) vérifié absent de toute sérialisation et de tout
`repr()`, au même niveau d'exigence que le mot de passe.

**Suite complète** : pytest backend **703** (contre 654 avant ce lot), tsc frontend 0
erreur (aucun changement frontend dans ce lot — reporté au Lot 1). Aucune ressource
Grid'5000 réelle n'a été réservée ; le seul appel réseau réel effectué est la lecture du
miroir public du reference-repository (sans authentification, sans écriture).
