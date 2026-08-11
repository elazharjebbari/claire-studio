# Architecture — piloter Grid'5000 depuis Pactiva Lab

> Étend `claire/lab/runners/g5k.py` (squelette existant, fonctionnel mais jamais
> vérifié contre la doc réelle) en s'appuyant sur les correctifs de `06_ANALYSE_BESOIN_PACTIVA.md`.
> Respecte le principe déjà en vigueur : Grid'5000 n'est jamais sur le chemin critique,
> l'interface `ExecutionBackend` (`submit`/`poll`/`fetch`/`cancel`) ne change pas — ce
> qui change, c'est ce qu'il y a dedans et deux ajouts (référence GPU, garde-fou sweep).

---

## 1. Découverte critique n°1 — l'authentification SSH est un secret DISTINCT du mot de passe API

**Grid'5000 désactive l'authentification par mot de passe pour SSH** (`research/01_VUE_ENSEMBLE_SITES_ACCES.md`
§3.1 : *« Password authentication is disabled »*) — seule une **clé publique SSH**
déposée sur le compte fonctionne. Or `Grid5000Backend._rsync_push`/`_rsync_pull`
(code existant) appellent `rsync`/`ssh` vers `login@access.grid5000.fr` en supposant
implicitement qu'une authentification par mot de passe fonctionnerait — **ce n'est
techniquement pas possible**. Le `ComputeCredential` actuel (login + mot de passe
chiffré) suffit pour l'API HTTP Basic, mais **pas** pour le transfert de fichiers.

### Correctif retenu

Étendre `ComputeCredential` avec un second secret optionnel, **une clé SSH privée
dédiée** :
```python
class ComputeCredential(models.Model):
    ...
    secret_encrypted = models.TextField()          # mot de passe API (déjà existant)
    ssh_key_encrypted = models.TextField(blank=True, default="")   # NOUVEAU
```
- **Recommandation explicite à l'utilisateur** (UI, §`08_UX_UI.md`) : générer une clé
  SSH **dédiée** à Pactiva (`ssh-keygen -t ed25519 -f pactiva-g5k -N ""`), l'ajouter à
  son compte Grid'5000 (page de gestion de compte), puis coller la **clé privée** dans
  Pactiva — jamais réutiliser une clé SSH personnelle déjà utilisée ailleurs.
- Chiffrement Fernet identique au mot de passe existant (même `LAB_CREDENTIALS_KEY`),
  jamais réexposée en lecture (même politique que le mot de passe).
- Au moment du transfert, la clé est déchiffrée en mémoire, écrite dans un fichier
  temporaire à permissions `0600` (`tempfile.NamedTemporaryFile`), passée à `ssh`/`rsync`
  via `-i`, puis **supprimée immédiatement après usage** (`try/finally`) — jamais
  persistée sur disque au-delà de la durée du transfert.
- **Dégradation explicite** : un run GPU qui nécessite un transfert de données réel
  échoue avec `code=g5k_ssh_key_missing` si seule la clé API est configurée — jamais de
  tentative silencieuse avec mot de passe (qui échouerait de toute façon côté Grid'5000,
  mais avec un message d'erreur SSH cryptique plutôt qu'un message Pactiva clair).

## 2. Découverte critique n°2 — client HTTP : migrer vers `python-grid5000`

Le client maison (`urllib.request`, `_request()`) fonctionne mais réimplémine ce que le
client officiel `python-grid5000` fait déjà, testé, avec :
- retry automatique (5 tentatives, backoff 0.3, codes 500/502/504) — le client maison
  actuel n'a **aucun retry**, un simple pic réseau transitoire ferait échouer un run ;
- hiérarchie d'exceptions propre (`Grid5000AuthenticationError`, `Grid5000HttpError`...) ;
- gestion HATEOAS (suit les liens `rel` renvoyés dynamiquement — corrige le piège noté
  en `03_API_REST.md` §9, l'URL de statut de site divergente entre deux pages du wiki).

### Décision

**Migrer vers `python-grid5000`** comme dépendance backend (`requests>=2.21`,
`pyyaml>=5.1` déjà présent). `Grid5000Backend` (notre classe, interface
`ExecutionBackend`) devient un adaptateur fin par-dessus `grid5000.Grid5000` — le reste
de l'architecture (modèle Experiment/Run, worker, vues, UI) ne change pas, car
`ExecutionBackend.submit/poll/fetch/cancel` reste la même interface. Risque accepté :
dépendance à un projet maintenu par un individu (Inria) plutôt qu'une équipe multi-
personnes — mais c'est le client **référencé par la documentation officielle** comme
recommandation, et le risque (un `pip install` figé à une version testée) est nettement
inférieur à celui de réimplémenter et maintenir soi-même retry + HATEOAS + parsing
d'erreurs.

## 3. Découverte critique n°3 — le sweep ne doit pas devenir N jobs OAR

`06_ANALYSE_BESOIN_PACTIVA.md` §3 : 2 de nos 5 presets GPU ont un sweep (4 et 6
variantes). Le modèle actuel (`claire/lab/services.queue_run`, appelé une fois par
variante dans `views.experiment_run`) créerait autant de jobs OAR distincts —
contraire à la bonne pratique documentée.

### Correctif retenu pour ce lot — un garde-fou, pas une refonte

Fusionner plusieurs `ExperimentRun` en un seul job OAR partagé demanderait de modifier
le modèle de données (`ExperimentRun.external_job_id` est actuellement 1-vers-1 avec un
job) — chantier disproportionné pour ce lot. **Pour l'instant** :
1. **Garde-fou logiciel** : `queue_run`/`experiment_run` (vue) refuse un sweep de plus
   de `LAB_G5K_MAX_RUNS_PER_SWEEP` (défaut 3) runs GPU sans confirmation explicite
   (`force=True`), avec un message qui **cite la bonne pratique documentée** plutôt
   qu'une limite arbitraire.
2. **Documenté comme limitation connue**, corrigée en piste P2 (§`09_PLAN_DEV.md`) :
   un mécanisme de **job conteneur** (`-t container`/`-t inner`) ou un simple script qui
   boucle sur N configs à l'intérieur d'une seule réservation, avec un nouveau modèle
   `ExperimentRunBatch` (FK `job_id` unique, plusieurs `ExperimentRun` enfants).

## 4. Découverte critique n°4 — sélection informée de cluster GPU (nouvelle capacité)

La Reference API (`gpu_devices`, `research/03_API_REST.md` §3.3) permet de vérifier
*avant* réservation qu'un cluster convient (VRAM suffisante). Nouveau module pur,
testable sans réseau :

```python
# claire/lab/g5k_reference.py (nouveau)
def gpu_clusters_for(min_vram_gb: float, catalogue: list[dict]) -> list[dict]:
    """Filtre un catalogue de clusters (déjà récupéré) par VRAM GPU minimale."""
```
Le catalogue est alimenté soit par un appel authentifié à l'API (utilisateur avec
identifiants configurés), soit — **pour le développement et les tests, sans compte
Grid'5000** — par le miroir public du reference-repository (`research/03_API_REST.md`
§0), rafraîchi manuellement et committé comme fixture (`specs/g5k-clusters-gpu.json`,
voir §`11_RUNBOOK_SONNET5.md` pour la génération réelle de ce fichier).

## 5. Composants — vue d'ensemble

```
claire/lab/
├── g5k_client.py          (NOUVEAU) — fine couche sur python-grid5000 : construit le
│                            client à partir d'un ComputeCredential déchiffré, mappe
│                            les exceptions Grid5000* vers G5KError (code, detail)
├── g5k_reference.py        (NOUVEAU) — sélection informée de cluster (pur, testable)
├── g5k_ssh.py              (NOUVEAU) — gestion de la clé SSH temporaire (permissions,
│                            nettoyage garanti), utilisée par les transferts rsync
├── runners/
│   └── g5k.py               (MODIFIÉ) — Grid5000Backend : submit/poll/fetch/cancel,
│                            adaptateur sur g5k_client + g5k_ssh
├── crypto.py                (MODIFIÉ) — encrypt_secret/decrypt_secret génériques,
│                            réutilisés pour le mot de passe API ET la clé SSH
├── models.py                 (MODIFIÉ) — ComputeCredential.ssh_key_encrypted (nouveau
│                            champ, migration)
├── services.py               (MODIFIÉ) — garde-fou sweep GPU (§3)
└── views.py                  (MODIFIÉ) — endpoint credentials accepte ssh_key en plus
                             du mot de passe ; endpoint clusters GPU (nouveau, §UX)
```

`research/pactiva_lab/` (le package ML autonome) **ne change pas** — il continue
d'ignorer tout de Django et de Grid'5000 ; le script `run.sh` généré appelle toujours
`python -m pactiva_lab run` exactement comme en local (principe déjà établi : même
commande, mêmes fichiers, en local ou sur Grid'5000).

## 6. Cycle de vie détaillé (diagramme de séquence complet)

Voir `diagrams/g5k-sequence-complete.puml`. Résumé texte :

```
Pactiva (worker)              access.grid5000.fr           api.grid5000.fr        OAR/nœud
   │ 1. déchiffre credentials (mot de passe + clé SSH)                                │
   │ 2. écrit config.json + run.sh localement                                         │
   │ 3. clé SSH → fichier temporaire 0600 ─────▶                                      │
   │ 4. rsync push (dataset + config + script) ▶ ~/pactiva/runs/<id>/                 │
   │ 5. supprime le fichier de clé temporaire                                         │
   │ 6. POST /jobs (python-grid5000, HTTP Basic) ──────────────────────────────────▶  │ waiting
   │ 7. GET /jobs/{id} (sondage adaptatif) ◀─────────────────────────────────────────│ running
   │                                                                    (écrit progress.json)
   │ 8. clé SSH → fichier temporaire (à nouveau, pour le pull) ▶                      │ stopped
   │ 9. rsync pull (results/) ◀── ~/pactiva/runs/<id>/results/                        │
   │ 10. supprime le fichier de clé temporaire                                        │
   │ 11. validation JSON Schema + ingestion (identique au chemin local)               │
```

**Sondage adaptatif** : inchangé (`poll_interval`, 5s→15s→60s selon le temps écoulé),
déjà correct par rapport à la doc (pas de webhooks, polling recommandé avec backoff).

**Mapping des états** : l'API renvoie `waiting`/`running` en minuscules
(`03_API_REST.md` §4.2) ; toute autre valeur (y compris un futur `error`/`terminated`
observé) est traitée comme `stopped` par notre `poll()` — le `fetch()` distingue ensuite
complet/partiel via `_SENTINEL`, donc ce mapping conservateur reste correct sans
modification.

## 7. Sécurité — synthèse des règles (étendues du dossier historique)

1. **Deux secrets distincts**, chiffrement Fernet identique, `LAB_CREDENTIALS_KEY`
   dédiée (inchangé).
2. **Écriture seule** pour les deux secrets — aucune sérialisation ne les expose,
   testé (voir `10_TESTS.md`).
3. **Clé SSH jamais sur disque durablement** — fichier temporaire 0600, durée de vie
   bornée au transfert, suppression garantie (`finally`), y compris en cas d'exception
   pendant le rsync.
4. **Test de connexion** couvre désormais deux vérifications distinctes et
   indépendamment rapportées : `api_ok` (mot de passe, `GET /sites`) et `ssh_ok` (clé
   SSH, `ssh -o BatchMode=yes login@access.grid5000.fr true`) — un utilisateur peut
   avoir l'un sans l'autre, l'UI doit le dire clairement plutôt qu'un seul booléen agrégé
   trompeur.
5. **Jamais dans les journaux** (inchangé, filtre déjà en place).

## 7bis. Découverte faite en écrivant les tests (Lot 0) — non documentée par le wiki

`client.sites[site]` (`python-grid5000`, `BracketMixin.__getitem__`) exécute lui-même un
GET `/sites/{site}` **avant** tout accès à `.jobs`/`.status` — vérifié en comptant les
appels HTTP réellement consommés dans les tests mockés (`tests/test_lab_g5k_client.py`).
Conséquence : chaque `submit`/`poll`/`cancel` coûte **2-3 requêtes HTTP** au lieu d'une
seule avec l'ancien client maison. Le sondage adaptatif (§`POLL_SCHEDULE`) reste
pertinent en fréquence, mais chaque sonde a désormais un coût réseau double — à garder
en tête si un jour le nombre de runs G5K simultanés devient significatif (aucune mention
de rate limiting HTTP trouvée dans la doc, mais aucune garantie d'absence non plus,
`research/03_API_REST.md` §6.1).

## 8. Ce qui NE change PAS (principes déjà corrects, confirmés par la recherche)

- Sondage adaptatif, jamais de webhook (confirmé : aucun mécanisme push documenté).
- `_SENTINEL` pour distinguer succès complet de walltime écourté (confirmé : pas
  d'endpoint REST pour lire un statut de complétion fin, `_SENTINEL` reste la bonne
  approche applicative).
- Conda + garde-fou `nvidia-smi`/`torch.cuda.is_available()` (confirmé : c'est
  exactement le workflow documenté, aucun mécanisme fiable de vérification
  pré-réservation n'existe côté Grid'5000).
- Dégradation maîtrisée : cible `g5k` désactivée avec motif si pas d'identifiants ;
  Grid'5000 injoignable → `failed` + rejouable en local.
