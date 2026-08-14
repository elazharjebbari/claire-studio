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

## Étape 10 — checklist de validation manuelle (identifiants réels)

**Préalable indispensable à toute étape ci-dessous** : cette checklist ne peut être
suivie qu'une fois qu'un compte Grid'5000 existe réellement (email à
`support-staff@lists.grid5000.fr` ou parrainage laboratoire) — jusque-là, elle reste un
document de préparation, pas une action à entreprendre. Aucune étape de ce document n'a
été exécutée : ni compte, ni réservation, ni job réel n'existent au moment où ce texte
est écrit (11 août 2026). **Ne PAS créer de compte ni lancer de réservation sans
confirmation explicite de l'utilisateur** — c'est une action visible sur une plateforme
partagée, hors du périmètre d'un agent qui ne fait qu'exécuter un plan de tests.

Objectif : valider chaque brique **dans l'ordre du coût croissant** — s'arrêter au
premier échec plutôt que d'empiler les hypothèses. Chaque étape indique son **critère
d'arrêt** (ce qui doit être vrai avant de passer à la suivante) et son **impact**
(aucun / réversible / consomme des ressources partagées).

| # | Étape | Impact | Critère de passage à la suite |
|---|---|---|---|
| 10.1 | Enregistrer login + mot de passe dans l'écran Calcul (`ComputeSettings.tsx`), **sans** clé SSH | aucun (chiffré au repos, pas d'appel réseau) | `hasPassword=true` visible après rechargement |
| 10.2 | Cliquer « Tester la connexion » | 1 requête HTTP `GET` en lecture seule sur `api.grid5000.fr` | badge **API : opérationnel** ; badge **Transfert SSH : non testé** (aucune clé) |
| 10.3 | Générer une clé dédiée : `ssh-keygen -t ed25519 -f pactiva-g5k -N ""`, l'ajouter au compte Grid'5000 (interface web, section SSH keys), coller la clé **privée** dans le champ dédié, enregistrer | aucun côté Pactiva ; ajoute une clé au compte G5K (réversible, retirable depuis l'interface G5K) | `hasSshKey=true` |
| 10.4 | Retester la connexion | 1 connexion SSH `access.grid5000.fr` (`BatchMode=yes`, commande `true`) | badge **Transfert SSH : opérationnel** — sinon lire `lastTestDetail` (`g5k_auth_failed` = mot de passe faux, échec SSH = clé pas encore propagée côté G5K, attendre quelques minutes) |
| 10.5 | Construire un dataset minimal (1-2 documents) dans l'onglet Jeux de données | aucun (local) | dataset `ready` |
| 10.6 | Créer une expérience **CPU** (`model.family: tfidf_linear`), `compute.target: g5k`, `compute.g5k.site` = un site **peu chargé** (vérifier `https://intranet.grid5000.fr` ou l'outil Monika du site avant de choisir), `resources: "walltime=00:05"`, PAS de sweep | **réserve un nœud réel pendant ≤5 min** | run passe `queued → waiting → running → succeeded` (ou `partial`/`failed` avec un `error_code` cohérent) sans intervention manuelle |
| 10.7 | Vérifier dans l'UI (liste des runs) que `externalJobId` correspond bien à l'identifiant affiché par `oarstat` / l'interface G5K pour ce job | aucun | même identifiant des deux côtés — confirme que `submit()` renvoie le bon `uid` |
| 10.8 | Lancer un second run **CPU** similaire avec un `walltime` plus long (≥ 2 min) puis cliquer **Annuler** dans l'UI 10-20 s après le passage en `running` | réserve puis libère un nœud avant terme | run passe à `cancelled` en moins de 2× l'intervalle de sondage courant (`poll_interval`, 5-15 s) — **c'est le test qui valide en conditions réelles le correctif du 11 août 2026 sur `_wait_remote`** (§Journal ci-dessous) : sans ce correctif, le run resterait `running` indéfiniment malgré l'annulation |
| 10.9 | Vérifier côté Grid'5000 (`oarstat -u <login>` ou l'interface) qu'aucun job ne reste actif après 10.6/10.8 | — | file d'attente Grid'5000 vide pour ce compte — **ne jamais laisser un job orphelin tourner sur une ressource partagée** |
| 10.10 | (Optionnel, seulement si 10.1-10.9 sont tous verts) Un run **GPU** minimal (`legal-bert-finetune` sur le plus petit jeu de données possible, cluster suggéré par le panneau « Cluster recommandé », `walltime` court) | réserve un GPU réel, ressource la plus contendue de la plateforme | garde-fou GPU (`nvidia-smi`/`torch.cuda.is_available()`) ne se déclenche pas en faux positif ; run se termine `succeeded` ou `partial` avec un `error_code` explicite, jamais un blocage silencieux |
| 10.11 | Sweep G5K à 4 variantes (`encoders-comparison`) sans `force` | aucun (refusé côté serveur avant toute réservation) | 400 `g5k_sweep_too_large`, aucun job créé côté G5K — vérifier via `oarstat` que rien n'a été réservé |
| 10.12 | Même sweep avec « Continuer quand même » | réserve jusqu'à 4 nœuds | 4 runs créés, chacun suivi indépendamment dans la liste |

**En cas d'échec à une étape** : ne pas continuer vers la suivante. Le code d'erreur
affiché (`g5k_auth_failed`, `g5k_ssh_key_missing`, `g5k_transfer_failed`,
`g5k_unreachable`, `g5k_timeout`) pointe directement vers la brique en cause — voir
`specs/g5k-error-codes.csv` pour le détail de chacun et `07_ARCHITECTURE.md` pour
l'architecture des deux secrets indépendants.

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

### Lot 1 — UI complète + batterie de tests dense (11 août 2026, session suivante)

**Backend** : catalogue statique de clusters GPU (`g5k_reference.load_static_catalogue`,
`specs/g5k-gpu-clusters-catalogue.json`, ~15 clusters, 3 vérifiés empiriquement) +
endpoint `GET .../lab/g5k/clusters` (accessible sans identifiants configurés — catalogue
informatif, `configured` distingue « informatif » de « prêt à réserver »). 17 nouveaux
tests (10 `g5k_reference`, 7 vue).

**Frontend** (`08_UX_UI.md`, entièrement mis en œuvre) : `ComputeSettings.tsx` réécrit
— champ clé SSH + deux badges de test indépendants (API / Transfert SSH, jamais un seul
booléen agrégé). `ExperimentLauncher.tsx` étendu — panneau « Cluster Grid'5000
recommandé » (affiché dès qu'un modèle GPU cible `compute.target=g5k`, avant création de
l'expérience) et avertissement de sweep trop grand avec bouton « Continuer quand même »
(`force=true`) fidèle au mockup §4. **Vérifié en navigateur réel** (Playwright, backend
+ frontend lancés en local, compte `rita` reviewer, projet `CLAUDETTE Gold v1`) : les
deux secrets s'enregistrent et se testent indépendamment, le panneau cluster affiche le
catalogue réel trié par VRAM croissante, le garde-fou sweep se déclenche pour 4 runs et
« Continuer quand même » force bien le lancement, et le worker (`lab_worker --once`)
traite les 4 runs jusqu'à un échec propre et lisible (`g5k_transfer_failed`, faux
identifiants) — **aucune erreur console à aucune étape**. Un bug réel a été trouvé
pendant cette vérification manuelle (pas par les tests automatisés) : le bouton
« Lancer » passait `onClick={onLaunch}` directement, ce qui aurait transmis l'événement
React comme argument `force` (donc `force` toujours *truthy*) — corrigé en
`onClick={() => onLaunch()}` avant tout commit.

**Batterie de tests dense** (préparation identifiants réels, tâche explicitement
demandée par l'utilisateur) : `build_run_script` jamais vérifié dans son CONTENU avant
ce lot (seule son existence de fichier l'était) — 9 nouveaux tests purs, dont un test
d'injection shell sur `env_name` (protection `shlex.quote`). `execute_run`/`worker.py`
étendu à 100% de couverture (92 lignes) : succès complet bout en bout (`SUCCEEDED`,
jamais exercé avant — seul le cas `partial` l'était), propagation du code métier exact
sur échec de soumission et de rapatriement, construction réelle de `Grid5000Backend`
dans `_backend_for`.

**⭐ Bug réel trouvé par cette batterie** (pas une simple lacune de couverture) :
l'annulation coopérative d'un run Grid'5000 en attente ne fonctionnait PAS quand elle
était demandée depuis un processus différent de celui du worker — exactement le cas
réel en production, où `POST .../run/cancel` s'exécute dans le process web et
`manage.py lab_worker` tourne dans un process séparé. `_wait_remote` ne relisait jamais
`run.cancel_requested` depuis la base pendant sa boucle de sondage ; l'objet `run`
restait figé à sa valeur de chargement initial par `claim_next_run()`. Concrètement : un
job Grid'5000 de plusieurs heures cliqué « Annuler » dans l'UI n'aurait jamais été
interrompu avant son walltime naturel. Reproduit empiriquement AVANT correctif (test
qui échouait avec `other = ExperimentRun.objects.get(...)` simulant le process web
séparé), corrigé avec deux `run.refresh_from_db(fields=["cancel_requested"])` (dans la
boucle de `_wait_remote`, et avant le check final après `fetch`), verrouillé par 2 tests
permanents. **Ce bug n'aurait jamais pu être trouvé sans écrire spécifiquement un test
simulant deux processus distincts** — aucun test à un seul processus ne peut le
révéler, ce qui inclut toute vérification manuelle en local à un seul terminal.

**Couverture finale** : 99% sur les 5 modules G5K combinés (`g5k_client.py` 100%,
`g5k_ssh.py` 100%, `runners/g5k.py` 99%, `worker.py` 100%, `g5k_reference.py` 98% — les
2 lignes restantes sont des replis défensifs déjà documentés comme inatteignables par
construction). Suite complète : pytest backend **729** (+26 depuis le Lot 0), vitest
frontend **651** (+18), tsc 0 erreur, aucune régression.

**Checklist manuelle** (§Étape 10 ci-dessus) : écrite mais **non exécutée** — aucun
compte Grid'5000 réel n'existe à ce stade. C'est la partie du travail qui ne peut pas
être automatisée : elle attend la création d'un compte, hors du périmètre de cette
session.

### Lot 2 — identifiants réels, déploiement prod, correctifs de fiabilité (11-14 août 2026)

Un compte Grid'5000 réel existe désormais. **Étapes 10.1-10.4 exécutées et vertes en
production** : identifiant + mot de passe API enregistrés (`ejebbari`, PAS
`ejebbari@access.grid5000.fr` — piège réel rencontré : l'authentification HTTP Basic de
l'API Grid'5000 rejette le login suffixé, confirmé par `curl` indépendant), clé SSH
dédiée générée sans passphrase (`ssh-keygen -t ed25519 -f pactiva-g5k -N ""`) et
ajoutée au compte G5K — badges **API : opérationnel** et **Transfert SSH : opérationnel**
tous deux verts sur `pactiva.legal`.

Trois bugs de fiabilité corrigés en route, aucun lié à Grid'5000 lui-même mais tous
bloquants pour qu'un run (local ou G5K) puisse un jour aboutir en prod :
1. Aucun service systemd ne consommait la file de runs (`claire-studio-lab-worker`
   manquant) — tout run, local ou G5K, serait resté `queued` indéfiniment.
2. `research/` (le package ML) était possédé par `root` sur le VPS (créé via SSH root
   au provisioning), le worker tournant en `www-data` — écriture de cache refusée.
3. Le cache d'embeddings était indexé sur le lot ENTIER de phrases plutôt que par phrase
   individuelle — en validation croisée, aucune réutilisation entre plis, un run local
   dépassait le délai avant même son 2ᵉ pli sur 5 (voir `docs/pactiva-lab/` pour le
   détail — hors périmètre G5K mais découvert en vérifiant que les runs aboutissent).

**Étapes 10.5-10.12 restent NON exécutées** — c'est précisément l'objet de
`12_STRATEGIE_FIABILITE_EXECUTION.md`, qui reprend cette checklist tactique et l'englobe
dans une stratégie de fiabilité complète (observabilité, garanties de récupération des
résultats, points d'arrêt explicites). **Aucune réservation Grid'5000 réelle n'a été
soumise à ce jour** — seuls des tests de connexion en lecture seule (API) et une
poignée-de-main SSH ont eu lieu, jamais une commande `oarsub`.
