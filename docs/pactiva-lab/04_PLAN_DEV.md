# Plan de développement — 9 lots

> Chaque lot est **livrable seul**, testé, et laisse le produit dans un état cohérent.
> Un lot n'est « fait » que si ses critères d'acceptation passent et que la suite de tests
> existante reste verte (pytest ~425, vitest ~513 au 11 août 2026).

---

## Vue d'ensemble

| Lot | Titre | Dépend de | Effort | Valeur si on s'arrête là |
|---|---|---|---|---|
| **L0** | Sélection par maturité + preflight | — | S | On sait enfin ce qu'on a, à tout instant |
| **L1** | Construction et export du dataset | L0 | M | Le dataset est citable et publiable |
| **L2** | Métriques d'Analyse & Qualité corrigées et enrichies | — | M | **Les chiffres cessent d'être faux** (`boundary_kappa`) |
| **L3** | Visualisations (12 figures) | L2 | M | Les figures de l'article existent |
| **L4** | Package `pactiva_lab` — socle + baselines | L1 | M | Premiers résultats supervisés |
| **L5** | Orchestration Django (Experiment/Run) + backend local | L1, L4 | M | Expériences lancées depuis l'UI |
| **L6** | Embeddings, transformers, séquence | L4 | L | Les résultats principaux de l'article |
| **L7** | UI du Lab | L5 | L | Le chercheur n'a plus besoin de la ligne de commande |
| **L8** | Grid'5000 | L5 | M | Le calcul lourd est déporté |

**Ordre recommandé : L0 → L2 → L1 → L4 → L3 → L5 → L6 → L7 → L8.**

> **Pourquoi L2 si tôt ?** Parce que `boundary_kappa` publie aujourd'hui un chiffre faux
> (1,000 par construction). Tant qu'il n'est pas corrigé, chaque analyse produite est
> contaminée. C'est le seul lot dont le retard a un coût *scientifique*, pas seulement
> calendaire.

---

## L0 — Sélection par maturité + preflight

**Objet.** Répondre à « les documents finis, pas seulement ceux soumis ».

**À faire**
- `claire/lab/selectors.py` (**pur, sans Django**) : `annotation_maturity(clauses, n_sentences)`
  → `any | complete | submitted | gold` ; `select_annotations(rows, maturity, scope)`.
- Critère `complete` : **toutes** les phrases du document portent une clause `validated=True`.
- `preflight(project, criteria)` → comptages, distribution, **exclusions avec motif**, aperçu
  des splits, empreinte prévisionnelle.
- Endpoint `POST /lab/datasets/preflight`.
- Commande `manage.py lab_preflight --project <slug> --maturity complete`.

**Critères d'acceptation**
- [ ] Sur la prod, `maturity=complete` retourne **45 annotations** contre 35 pour `submitted`
      (les 10 de `fatima.ouali`, validées à 99,9 %).
- [ ] Endomondo (59/498 validées) est **exclu** avec le motif `partial_annotation`.
- [ ] Aucune exclusion n'est silencieuse : `len(retenus) + len(exclus) == len(candidats)` — testé.
- [ ] `selectors.py` n'importe rien de Django (test d'import).

---

## L1 — Construction et export du dataset

**À faire**
- `splits.py` (pur) : `GroupKFold` par document, stratifié, **déterministe** à graine égale.
- `aggregation.py` (pur) : `single` / `consensus` (réutilise `projects.gold_scoring`) / `soft`.
- `builder.py` : écrit `sentences.jsonl`, `judges.jsonl`, `reference.jsonl`, `splits.json`,
  `labels.json`, `manifest.json`, `README.md`.
- Modèle `LabDataset` **immuable** (surcharge de `save()`, comme `AnalysisSnapshot`).
- Endpoints `POST/GET /lab/datasets`, `/preview`, `/download`.
- Commande `manage.py lab_build_dataset`.

**Critères d'acceptation**
- [ ] Deux constructions des mêmes critères ⇒ **même `fingerprint`** (test).
- [ ] Aucun document n'apparaît dans deux plis (test de propriété).
- [ ] `sentences.jsonl` est conforme à `specs/data-dictionary.csv` (test de schéma).
- [ ] Une seconde construction identique renvoie **409 + l'id existant**.
- [ ] `n_documents < k` ⇒ `dataset_too_small`, jamais un `GroupKFold` qui explose.

---

## L2 — Métriques corrigées et enrichies ⚠️ prioritaire

**À faire**
- `boundary_agreement` : accord sur les **frontières reconstruites** (plages de thèmes
  identiques). `boundary_kappa` **conservé et marqué déprécié** — jamais supprimé.
- Nouvelles métriques : `alpha_masi`, `label_distribution`, `cooccurrence`,
  `human_llm_matrix`, `annotator_audit`, `gold_progress`, `campaign_readiness`.
- Chacune enregistrée dans le registre existant, avec sa version.

**Critères d'acceptation**
- [ ] `boundary_agreement` produit **0,39–0,63** sur les documents multi-annotés de la prod
      (et non 1,000).
- [ ] `campaign_readiness.complete_but_not_submitted` vaut **10** sur l'instantané du 11/08.
- [ ] `cooccurrence.unfair_lift` retrouve **7,4×** sur `LICENSE_IP+TERMINATION`.
- [ ] `alpha_masi` expose α-MASI **et** α nominal (l'écart est le résultat).
- [ ] Les 7 métriques existantes rendent un résultat **identique** avant/après (test de
      non-régression sur payload figé).
- [ ] `annotator_audit` est refusée à un annotateur sur ses pairs (test de politique).

---

## L3 — Visualisations

**⚠️ Charger la skill `dataviz` avant la première ligne de code de graphe.**

**À faire**
- `features/analysis/charts/` : primitives pures (`scaleLinear`, `scaleLog`, `Axis`, `Legend`,
  `Tooltip`, `ExportButton`) — **SVG maison, aucune bibliothèque de graphes** (voir `03_UX_UI` §4.1).
- Les 12 figures F1–F12.
- Export SVG + PDF + **CSV des données sous-jacentes**.
- Équivalent tabulaire accessible pour chaque figure.

**Critères d'acceptation**
- [ ] Les échelles sont des fonctions pures testées (domaine vide, valeur unique, valeurs
      négatives, échelle log avec zéro).
- [ ] Chaque figure a un état vide explicite qui **dit quoi faire**.
- [ ] Contraste AA en clair **et** en sombre (harnais existant).
- [ ] Aucune couleur en dur (garde anti-hex existante).
- [ ] Le CSV exporté correspond exactement aux valeurs affichées (test).
- [ ] `a11y.spec` reste vert.

---

## L4 — Package `pactiva_lab` : socle et baselines

**À faire**
- Squelette `research/pactiva_lab/` + `pyproject.toml` (dépendances **séparées** du backend).
- `config.py` (validation par le JSON Schema), `data.py`, `env.py`.
- `preprocess/` : détokenisation, normalisation, contexte, composition.
- `models/baselines.py` : majorité, position seule, TF-IDF+logreg/SVM, `llm_judges`.
- `evaluation/` : métriques T1/T2/T3, bootstrap par document, plafond humain.
- `cli.py` : `python -m pactiva_lab run --config … --data … --out …`.

**Critères d'acceptation**
- [ ] Le package s'installe et tourne **sans Django** (test en environnement isolé).
- [ ] Même graine + même dataset ⇒ `results.json` identique (test de déterminisme).
- [ ] Le plafond humain apparaît dans chaque `results.json` quand `human_ceiling=true`.
- [ ] Une config non conforme échoue **avant** tout calcul, avec le chemin JSON-pointer fautif.
- [ ] `results.json` valide le schéma de sortie.

---

## L5 — Orchestration Django + backend local

**À faire**
- Modèles `Experiment`, `ExperimentRun`, `RunArtifact`, `ComputeTarget`.
- `runners/base.py` (interface) + `runners/local.py` (sous-processus).
- `services.py` : file, dispatch, heartbeat, retry, annulation, **déduplication par empreinte**,
  ingestion validée.
- `management/commands/lab_worker.py` (calqué sur `analysis_worker`).
- Endpoints expériences / runs / artefacts / logs / compare / estimate.

**Critères d'acceptation**
- [ ] Un run relancé à l'identique renvoie **409 + le run existant** (économie de GPU).
- [ ] Un run zombie (sans heartbeat) est repris.
- [ ] `results.json` invalide ⇒ run `failed`, **aucune ingestion partielle**.
- [ ] `/compare` **refuse** deux runs aux splits différents, avec le motif.
- [ ] Annulation effective en moins de 10 s en local.
- [ ] Le worker survit à un run qui plante (le suivant démarre).

---

## L6 — Embeddings, transformers, séquence

**À faire**
- `features/embeddings.py` + cache par (modèle, empreinte du texte).
- `models/transformers.py` : *fine-tuning*, pondération de classes, focal loss, arrêt anticipé.
- `models/sequence.py` : étiquetage de séquence + CRF (T1 & T3).
- `experiments/grid.py` (criblage à deux étages) et `learning_curve.py`.
- `reporting/figures.py` et `tables.py` (LaTeX + CSV).

**Critères d'acceptation**
- [ ] Le cache d'embeddings évite un ré-encodage (test de compte d'appels).
- [ ] Le *fine-tuning* tourne sur CPU en mode dégradé (test d'intégration sur jouet).
- [ ] La courbe d'apprentissage produit un point par taille × répétition.
- [ ] Les tableaux LaTeX se compilent (test de compilation).
- [ ] `sweep` respecte `max_runs` et refuse au-delà avec le décompte.

---

## L7 — UI du Lab

**À faire**
- `features/lab/` : datasets (avec preflight en direct), expériences (guidé/expert), runs
  (suivi, journaux), résultats, comparaison, calcul.
- Éditeur de configuration validé en direct, erreurs pointées à la ligne.
- États `waiting` / `running` / `partial` distincts.

**Critères d'acceptation**
- [ ] Le preflight se met à jour à chaque changement de critère, sans construire.
- [ ] Le bouton « Construire » désactivé **dit pourquoi**.
- [ ] Basculer guidé ↔ expert ne perd pas la configuration.
- [ ] Les journaux affichés ne contiennent **aucun secret** (test).
- [ ] Navigation clavier complète ; `?` documente les nouveaux raccourcis.

---

## L8 — Grid'5000

**À faire**
- `crypto.py` (Fernet), modèle `G5KCredential`, endpoints `/api/me/compute-credentials` (+ test).
- `runners/g5k.py` : rsync, `POST /jobs`, sondage adaptatif, rapatriement, `oardel`.
- Génération du script `run.sh` avec **garde-fou GPU** et `_SENTINEL`.
- Documentation d'installation de l'environnement conda côté Grid'5000.

**Critères d'acceptation**
- [ ] `LAB_CREDENTIALS_KEY` absente ⇒ **503 au PUT**, jamais de stockage en clair (test).
- [ ] Aucune sérialisation n'expose le mot de passe (test sur tous les niveaux).
- [ ] Le mot de passe n'apparaît dans **aucun** journal (test avec capture de logs).
- [ ] Un job tué par le *walltime* est ingéré en `partial`, pas `failed`.
- [ ] API injoignable ⇒ `g5k_unreachable` et le run est rejouable en local.
- [ ] Le module reste **pleinement utilisable sans compte Grid'5000**.

---

## Ce qui est explicitement hors périmètre

- Entraînement de LLM génératifs (les 4 juges sont une baseline figée, pas à relancer).
- Service d'inférence en production dans l'atelier (ce sera une suite, une fois un modèle validé).
- Volet cross-lingue FR (2027).
- Détection d'anomalies par hypergraphe — **objectif B**, dossier séparé. Le Lab lui prépare
  toutefois le terrain avec la métrique `cooccurrence` et l'export du dataset.
