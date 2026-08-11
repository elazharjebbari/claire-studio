# Architecture technique — Pactiva Lab

> Comment le plan scientifique de [`01_PLAN_SCIENTIFIQUE.md`](01_PLAN_SCIENTIFIQUE.md) devient
> du code robuste, modulaire, évolutif, débogable et maintenable.

---

## 1. Le principe directeur

```
┌──────────────────────┐   dataset figé + signé   ┌───────────────────────────┐
│   PACTIVA (Django)   │ ───────────────────────▶ │  pactiva_lab (pur Python) │
│  produit les données │   JSONL + manifest.json  │  entraîne / évalue        │
│  ingère les résultats│ ◀─────────────────────── │  écrit results.json       │
└──────────────────────┘    résultats normalisés  └───────────────────────────┘
        ▲                                                   │
        │                                        exécuté à l'identique sur :
   UI React                                      • poste local  • VPS  • Grid'5000
```

**Django ne fait jamais de calcul scientifique.** Il n'importe ni `torch`, ni
`transformers`, ni `sklearn`. Conséquences directes :

- le backend reste **léger et déployable** (le VPS n'a pas besoin de PyTorch) ;
- le package ML est **testable sans base de données** ;
- le même code produit **exactement les mêmes chiffres** en local et sur Grid'5000 ;
- une expérience est **reproductible par un tiers** à partir du seul dataset publié.

**Le contrat entre les deux mondes est un dossier de fichiers**, pas un appel de fonction.
C'est ce qui permet l'exécution déportée sans couplage.

---

## 2. Arbre des fichiers

```
backend/claire/lab/                     ← nouvelle app Django (orchestration seulement)
    models.py            LabDataset · Experiment · ExperimentRun · RunArtifact · ComputeTarget · G5KCredential
    selectors.py         [PUR] sélection des annotations par maturité (any/complete/submitted/gold)
    builder.py           construction du dataset (lignes, splits, manifeste, empreinte)
    splits.py            [PUR] GroupKFold par document + stratification
    aggregation.py       [PUR] single / consensus / soft — réutilise projects.gold_scoring
    contracts.py         [PUR] schémas d'échange (validation entrée/sortie du runner)
    runners/
        base.py          interface ExecutionBackend (submit/poll/fetch/cancel)
        local.py         sous-processus sur la machine du backend
        g5k.py           API REST Grid'5000 + OAR
    services.py          cycle de vie : queue → dispatch → ingest → report
    views.py             API REST
    serializers.py
    crypto.py            chiffrement des identifiants au repos (Fernet)
    management/commands/
        lab_build_dataset.py
        lab_run.py
        lab_worker.py

research/pactiva_lab/                   ← package Python autonome (le calcul)
    __init__.py
    cli.py               point d'entrée : `python -m pactiva_lab run --config c.json --data d/ --out o/`
    config.py            dataclasses de configuration + validation par JSON Schema
    data.py              chargement du dataset, application des splits
    preprocess/
        detokenize.py    moses · regex_rules
        normalize.py     casse, masquage d'entités juridiques
        context.py       fenêtres, position, en-têtes de section
        pipeline.py      composition déclarative des étapes
    features/
        tfidf.py
        embeddings.py    sentence-transformers · E5 · BGE · Legal-BERT (extraction)
        cache.py         cache d'embeddings par (modèle, empreinte du texte)
    models/
        baselines.py     majorité · logreg · SVM · position · k-NN
        transformers.py  fine-tuning (Legal-BERT, RoBERTa, DeBERTa, ModernBERT)
        sequence.py      étiquetage de séquence + CRF (T1 & T3)
        llm_judges.py    baseline figée à partir des prédictions en base
    evaluation/
        metrics.py       T1 · T2 · T3 · calibration
        bootstrap.py     IC par document
        ceiling.py       plafond humain
        errors.py        analyse d'erreurs
    reporting/
        figures.py       les 12 figures, en SVG + PDF
        tables.py        LaTeX + CSV + Markdown
    experiments/
        grid.py          criblage à deux étages
        learning_curve.py
    env.py               capture de l'environnement (versions, matériel, graines)

frontend/src/features/lab/              ← UI du Lab
frontend/src/features/analysis/         ← module existant, enrichi

docs/pactiva-lab/                       ← ce dossier
```

---

## 3. Modèle de données (backend)

### 3.1 `LabDataset` — le jeu de données figé

| Champ | Type | Rôle |
|---|---|---|
| `id` | UUID | |
| `project` | FK | |
| `label` | str | nom lisible |
| `maturity` | `any` \| `complete` \| `submitted` \| `gold` | **la sélection par avancement** |
| `aggregation` | `single` \| `consensus` \| `soft` | |
| `scope` | JSON | `document_ids`, `annotator_ids`, `min_annotators`, `exclude_partial` |
| `manifest` | JSON | comptages, distribution des étiquettes, documents retenus **et écartés avec le motif** |
| `splits` | JSON | plis figés (liste d'`external_id` par pli) |
| `fingerprint` | str(64) | empreinte de (critères + contenu) |
| `snapshot` | FK `AnalysisSnapshot` nullable | traçabilité vers le socle existant |
| `storage_path` | str | dossier des artefacts (JSONL + manifeste) |
| `n_documents`, `n_sentences`, `n_labels` | int | |

**Immuable après création** — même règle que `AnalysisSnapshot` (surcharge de `save()`).
Rejouer les mêmes critères sur les mêmes données redonne le même `fingerprint` : c'est un test.

> **Point de conception important : la traçabilité des exclusions.** Le manifeste liste les
> documents **écartés avec le motif** (`partial_annotation`, `below_min_annotators`, …). Sans
> cela, un dataset qui perd silencieusement 12 documents produit un article faux. C'est la même
> discipline que le « jamais de repli silencieux » déjà en vigueur dans les exports.

### 3.2 `Experiment` — la configuration
`id` · `project` · `name` · `task` (`T1|T2|T3`) · `config` (JSON validé par le schéma) ·
`dataset` FK · `compute_target` FK · `created_by` · `tags`.

### 3.3 `ExperimentRun` — une exécution
Reprend la mécanique éprouvée d'`AnalysisRun` : `status` (queued/running/succeeded/failed/cancelled),
`progress`, `heartbeat_at`, `attempt`, `cancel_requested`, `error_code`, `error_detail`,
`fingerprint`, `metrics` (JSON), `environment` (JSON), `started_at`/`completed_at`,
`external_job_id` (identifiant OAR), `logs_path`.

### 3.4 `RunArtifact`
`run` FK · `kind` (`figure|table|model|predictions|errors|log`) · `path` · `mime` · `bytes` ·
`checksum`. Téléchargement soumis à la même politique d'accès que les artefacts d'analyse.

### 3.5 `ComputeTarget` et `G5KCredential`
`ComputeTarget` : `kind` (`local|g5k`), `site`, `cluster`, `walltime`, `resources`, `queue`,
`besteffort`, `env_setup`.
`G5KCredential` : voir [`06_GRID5000.md`](06_GRID5000.md) §sécurité — **jamais** en clair,
**jamais** relu par l'API.

---

## 4. Le contrat d'échange

### 4.1 Ce que Pactiva écrit (le dataset)

```
<storage_path>/
  manifest.json        critères, comptages, documents retenus/écartés+motif, fingerprint, versions
  sentences.jsonl      une ligne par phrase
  splits.json          {"scheme":"group_kfold_document","k":5,"folds":[["Atlas","9gag"],…]}
  labels.json          les 20 thèmes : code, libellé, support, ordre
  reference.jsonl      labels d'abusivité CLAUDETTE alignés (évaluation croisée)
  judges.jsonl         prédictions des 4 LLM alignées (baseline figée)
  README.md            généré : comment relire ce dataset
```

Une ligne de `sentences.jsonl` :
```json
{
  "document": "Atlas", "index": 12, "text": "we may terminate your account at any time .",
  "text_detok": "We may terminate your account at any time.",
  "doc_position": 0.20, "n_sentences": 60,
  "primary": "TERMINATION", "themes": ["TERMINATION", "ELIGIBILITY_ACCOUNT"],
  "boundary": true,
  "soft": {"TERMINATION": 0.67, "ELIGIBILITY_ACCOUNT": 0.33},
  "annotators": ["a1", "a2", "a3"], "n_annotators": 3, "agreement": "majority",
  "unfair": ["TER"], "source_maturity": "complete"
}
```

### 4.2 Ce que le runner rend (les résultats)

```
<out>/
  results.json         métriques par tâche/pli/étiquette + IC + plafond humain
  predictions.jsonl    prédiction par phrase (pour l'analyse d'erreurs et l'ingestion)
  errors.json          confusions, cas durs, croisements
  environment.json     versions, matériel, graines, durées
  figures/*.svg|pdf
  tables/*.csv|tex
  run.log
```

`results.json` est **validé par JSON Schema à l'ingestion**. Un runner qui produit une sortie
non conforme fait échouer le run avec un message explicite — jamais d'ingestion partielle
silencieuse.

### 4.3 Pourquoi des fichiers et pas des appels
Un dossier de fichiers traverse une frontière réseau, un ordonnanceur OAR, un système de
fichiers partagé et une reprise après incident. Un appel de fonction, non. C'est aussi ce qui
rend le paquet **publiable tel quel** en annexe de l'article.

---

## 5. Cycle de vie d'un run

```
  [DRAFT]──valider config──▶[QUEUED]──dispatch──▶[RUNNING]──┬──▶[SUCCEEDED]──▶ ingestion ──▶ artefacts
                                  ▲                  │       ├──▶[FAILED]  (error_code + detail)
                                  └──retry (≤3)──────┘       └──▶[CANCELLED]
```

- **Heartbeat** : un run sans battement depuis N minutes est déclaré zombie et repris — le
  mécanisme existe déjà dans `analysis` et est réutilisé.
- **Idempotence** : même `(dataset_fingerprint, config_fingerprint)` ⇒ le run existant est
  renvoyé au lieu d'être relancé. Économise des heures de GPU.
- **Annulation** : coopérative en local (drapeau lu par le runner), `oardel` sur Grid'5000.

---

## 6. API REST

Conventions du projet : camelCase en sortie (djangorestframework-camel-case), erreurs typées,
pagination. Détail complet dans [`specs/api-endpoints.yaml`](specs/api-endpoints.yaml).

```
GET    /api/projects/{slug}/lab/datasets              liste
POST   /api/projects/{slug}/lab/datasets              construit (202 + tâche de fond)
GET    /api/projects/{slug}/lab/datasets/{id}         détail + manifeste
GET    /api/projects/{slug}/lab/datasets/{id}/preview échantillon de lignes
POST   /api/projects/{slug}/lab/datasets/preflight    ⭐ simulation SANS construire
GET    /api/projects/{slug}/lab/experiments           liste
POST   /api/projects/{slug}/lab/experiments           crée (config validée par schéma)
POST   /api/projects/{slug}/lab/experiments/{id}/run  lance (202)
GET    /api/projects/{slug}/lab/runs?status=…         liste
GET    /api/projects/{slug}/lab/runs/{id}             détail + métriques
POST   /api/projects/{slug}/lab/runs/{id}/cancel
GET    /api/projects/{slug}/lab/runs/{id}/artifacts
GET    /api/projects/{slug}/lab/runs/{id}/logs        flux
POST   /api/projects/{slug}/lab/compare               comparaison N runs
GET    /api/projects/{slug}/lab/presets               presets du catalogue YAML
GET/PUT/DELETE /api/me/compute-credentials            identifiants (écriture seule)
POST   /api/me/compute-credentials/test               test de connexion
```

⭐ **`preflight` est le point d'ergonomie central** : avant de construire un dataset, l'utilisateur
voit *combien* de documents et de phrases il obtiendra, *lesquels* seront écartés et *pourquoi*.
Sans lui, on construit à l'aveugle et on découvre le problème après.

---

## 7. Exécution : local et Grid'5000

`ExecutionBackend` expose quatre opérations — `submit`, `poll`, `fetch`, `cancel` — et deux
implémentations :

| | `local` | `g5k` |
|---|---|---|
| Lancement | sous-processus `python -m pactiva_lab run …` | `POST /stable/sites/{site}/jobs` (OAR) |
| Suivi | code de retour + fichier de progression | `GET /jobs/{id}` → `waiting/running/…` |
| Données | système de fichiers local | rsync via `access.grid5000.fr` |
| Annulation | signal | suppression du job |
| Usage | baselines, embeddings gelés, criblage | *fine-tuning* GPU, grilles, courbes d'apprentissage |

**Ajouter un troisième backend (SLURM, cloud) ne touche que `runners/`.** C'est le point
d'évolutivité principal de l'architecture.

---

## 8. Enrichissement du module Analyse & Qualité

Le registre de métriques (`MetricDefinition(code, version, label, calculator)`) est déjà
extensible. On **ajoute des métriques**, on n'en modifie aucune — le versionnement existant
garantit qu'un rapport ancien reste lisible.

| Code | Objet | Figure |
|---|---|---|
| `alpha_masi` | α-MASI global/par thème + **α nominal en contrôle** | F3 |
| `boundary_agreement` | ⚠️ accord sur frontières **reconstruites** (corrige l'artefact κ=1,0) | F4 |
| `label_distribution` | longue traîne, support, entropie | F2 |
| `cooccurrence` | matrice de co-occurrence + **lift d'abusivité** | F12 |
| `annotator_audit` | biais par thème, stabilité, cas atypiques | — |
| `gold_progress` | cascade auto/majorité/arbitrage, avancement | F11 |
| `campaign_readiness` | ⭐ **prêt pour la science ?** documents multi-annotés, complets, gold finalisés | tableau de bord |
| `human_llm_matrix` | matrice d'accord 7×7 (3 humains + 4 juges) | F1 |

⭐ `campaign_readiness` répond en un écran à la question qui a demandé des requêtes SQL
manuelles dans les dossiers précédents : *où en est-on, et qu'est-ce qui bloque l'article ?*

**Correctif prioritaire — `boundary_agreement`.** L'actuel `boundaryKappa` vaut 1,000 par
construction (chaque phrase porte une ancre) : c'est un artefact, et le publier serait une
erreur factuelle. La nouvelle métrique mesure les frontières **reconstruites** (début de plage
de thèmes identiques). L'ancienne est conservée mais **marquée dépréciée**, jamais supprimée —
les rapports déjà produits doivent rester lisibles.

---

## 9. Qualités transverses

**Modularité.** Trois frontières nettes : sélection/agrégation (pur, sans Django) · orchestration
(Django, sans ML) · calcul (Python, sans Django). Chacune testable seule.

**Débogabilité.** Chaque run porte : sa config exacte, l'empreinte du dataset, l'environnement
capturé, son journal complet, et ses prédictions phrase à phrase. Reproduire un run = une
commande.

**Évolutivité.** Ajouter un modèle = une entrée dans `models/` + une entrée YAML. Ajouter un
prétraitement = une étape dans `preprocess/`. Ajouter une cible de calcul = une classe dans
`runners/`. Ajouter une métrique = un `registry.register(...)`. **Aucun de ces gestes ne touche
au reste.**

**Maintenabilité.** La logique pure est en Python sans dépendances lourdes et testée en
propriété ; le code Django reste de l'orchestration ; les configurations sont déclaratives
(YAML/JSON) et validées par schéma.

**Sécurité.** Identifiants chiffrés au repos et jamais relus par l'API ; artefacts servis sous
la politique d'accès existante ; aucune donnée contractuelle ne quitte le périmètre sans un
export explicitement autorisé.
