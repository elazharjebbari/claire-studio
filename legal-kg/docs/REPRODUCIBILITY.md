# REPRODUCIBILITY — chaque chiffre remonte à son run

> Nous réutilisons le mécanisme déjà en production dans le Lab Pactiva (enveloppes d'expérience,
> portes de validité, provenance : `research/experiments/campaign.py`) et l'étendons au graphe et aux
> LLM. Aucun résultat n'est saisi à la main ; tout tableau est produit par un script depuis un
> `run_id`.

## 1. Ce qu'un run enregistre (obligatoire)

| Champ | Contenu |
|---|---|
| `run_id` | UUID ; nom de dossier `results/<kind>/<run_id>/` |
| `kind` | extraction \| graph_build \| detection_rules \| classification \| embedding \| evaluation \| audit |
| `code_version` | SHA git du dépôt ; état propre ou non ; diff si sale |
| `dataset` | empreinte de l'export (`7116e627…`), critères (`manifest.json`), taxonomie et version de spécification |
| `split` | `designSet/holdout` ou pli k ; liste des documents |
| `model` | nom, version/hash de poids ou identifiant API exact, fournisseur, date |
| `prompt` | chemin + `prompt_hash` (SHA-256 du texte), `schema_hash` ; le texte complet est copié dans le run |
| `params` | température, seed, max_tokens, effort, paramètres d'entraînement, seuils |
| `rules` | `rules_hash` + version + `frozen_at` (+ commit) pour les runs de détection |
| `started_at` / `ended_at` | UTC |
| `environment` | Python, paquets épinglés, matériel (CPU/GPU, site G5K, job OAR) |
| `cost` | tokens entrée/sortie, $ estimés, temps GPU |
| `results` | métriques avec IC ; fichiers de prédictions (`predictions.jsonl`) ; artefacts (CSV de graphe, modèles) |
| `gates` | portes passées/échouées (dataset figé, règles gelées, étanchéité, population constante, graine) |

Modèle : `configs/experiment.example.yaml` + `results/RUN_SCHEMA.json` (à générer par
`src/evaluation/run_record.py`).

## 2. Provenance dans le graphe

Chaque nœud/arête dérivé porte `run_id`, `source`, `created_at`, `version` ; les runs sont des nœuds
`Run` (PROV `Activity`) reliés par `PRODUCED_BY` ; les corrections humaines sont des `Activity`
`{validator, at, before, after}`. Les résultats sont append-only ; une nouvelle version **désactive**
(`superseded_by`) sans supprimer. Le graphe complet d'une expérience peut être **rejoué** depuis les
CSV d'ingestion versionnés (`graph/export/<dataset>/<run_id>/`).

## 3. Prompts et sorties intermédiaires

- Registre : `llm/prompts/PROMPT_REGISTRY.md` (id, version, hash, modèles testés, date, changements).
- Sorties brutes conservées telles quelles (`step_1_raw.jsonl`), puis chaque étape de validation
  (`step_2…step_6`), pour pouvoir recalculer toute métrique de RQ4 sans rappeler le modèle.
- Les modèles API sont identifiés par l'identifiant exact et la date ; en cas de retrait d'un modèle,
  la réplication se fait sur le modèle ouvert épinglé (hash de poids), prévu dès le protocole.

## 4. Environnements

- Python ≥ 3.11, dépendances épinglées (`requirements.lock`), conteneur pour Memgraph (image et version
  épinglées), MAGE version épinglée ; G5K : image/env conda documentés (`docs/pactiva-g5k`).
- Graines : 42 partout où un aléa existe (plis, bootstrap, initialisation) ; les bootstraps rapportent le
  nombre de tirages.

## 5. Fuites : contrôles automatiques

Tests (`tests/`) : (1) aucune règle ne mentionne `LABELED`/`Category` ; (2) les prompts ne contiennent
ni catégorie ni item ; (3) les exemples few-shot appartiennent aux 33 documents de conception ; (4) les
empreintes des règles utilisées dans un run de détection sont ≤ la date de première exécution sur le
hold-out ; (5) les documents de test d'un pli n'apparaissent pas dans son entraînement.

## 6. Publication

Dépôt public : code, schéma, règles (avec empreintes), prompts, templates validés (structures + offsets,
pas les textes sous droits), prédictions, scripts d'analyse, et le graphe exportable (CSV + RDF).
DOI Zenodo par version ; licence à décider (code : Apache-2.0 ou MIT ; données : CC BY 4.0 pour la couche,
sous réserve des droits sur les textes CLAUDETTE).
