# AGENTS — exécution agentique : rôles, interfaces, artefacts

> Le programme est conçu pour être exécuté par des agents spécialisés (humains ou LLM outillés, ex.
> sous-agents Claude Code / workflows), sous supervision humaine aux portes. Chaque agent a un
> **périmètre**, des **entrées/sorties typées** (fichiers du dépôt), des **interdits** et un **critère de
> fin**. Aucun agent n'écrit dans un artefact qui n'est pas le sien ; les passages de relais se font par
> fichiers versionnés, jamais par mémoire implicite.

| Agent | Responsabilité | Entrées | Sorties (propriétaire) | Interdits | Fin |
|---|---|---|---|---|---|
| **Research Agent** | vérifier et cartographier la littérature | requêtes, brouillons | `STATE_OF_THE_ART.md`, `literature/references.bib` (statut ✅/⚠ par entrée) | inventer une référence ; citer sans source | Gate 1 |
| **Data Audit Agent** | profiler et comprendre les données | `data/processed/` | `DATA_PROFILE.md` (généré), `DATA_UNDERSTANDING.md`, `data/profiling/` | modifier les données ; lire le hold-out pour concevoir des règles | Gate 2 |
| **Legal Modeling Agent** (+ juriste humain) | annexe → règles, mapping, exceptions | directive, doctrine, LEGAL_MODEL | `ontology/directive_93_13.yaml`, `graph/rules/*.yaml` (version, empreinte) | lire `LABELED` ; modifier une règle gelée | Gate 3 |
| **Knowledge Graph Architect** | schéma, contraintes, ADR | GRAPH_MODEL, exigences X1–X9 | `ontology/legal_kg_schema.yaml`, `graph/schema/*.cypher`, `docs/adr/` | ajouter une couche sans expérience qui la lit | Gate 4 |
| **LLM Extraction Agent** | prompts, schémas, pilote, extraction, contrôles 1–5 | clauses, schéma, inventaires | `llm/`, `results/extraction/<run>/step_*.jsonl`, `Run` records | inclure catégories/items dans les prompts ; marquer `validated` | Gate 5 (avec validation humaine) |
| **Memgraph Engineer** | ingestion, index, vues, requêtes, tests | CSV de build, schéma | `src/graph/`, `graph/cypher/`, instance | changer le schéma sans ADR | contraintes vertes |
| **Experiment Agent** | exécuter E0–E6, baselines, ablations | configs YAML, runs | `results/<kind>/<run_id>/` avec enregistrement complet | optimiser un seuil sur le test ; réexécuter des règles après les avoir vues échouer | Gate 6–7 |
| **Evaluation Agent** | métriques, IC, tests statistiques, tableaux | prédictions, références | `results/tables/*.csv`, `paper/tables/*.tex` | modifier une prédiction | tableaux imposés produits |
| **Scientific Reviewer** (adversarial) | chercher les fuites, les sur-interprétations, les références faibles | tout | rapport de revue (findings numérotés) ; ADR mis à jour | corriger lui-même le code | Gate 8 |
| **Documentation Agent** | cohérence des docs, diagrammes, README, registre des prompts | tout | `README.md`, `diagrams/`, `PROMPT_REGISTRY.md` | inventer un résultat | à chaque gate |

## Interfaces (contrats de fichiers)

- **Clauses → extraction** : `data/processed/clauses.jsonl` (id, document, start, end, text, theme_T11,
  action_inventory) produit par le Memgraph Engineer (build) et lu par l'Extraction Agent.
- **Extraction → graphe** : `results/extraction/<run>/step_6_validated.jsonl` (Norm + evidence + statut) ;
  seul le statut `validated` entre en L3 ; `proposed` entre avec `status=proposed`.
- **Règles → détection** : `graph/rules/grey_list_queries.yaml` (version, hash) compilé en Cypher par le
  moteur ; l'Experiment Agent refuse d'exécuter une version dont le hash n'est pas dans
  `graph/rules/FROZEN.txt` avec une date antérieure à la première exécution sur le hold-out.
- **Détection → évaluation** : `results/detection/<run>/predictions.jsonl` (sentence_id, category, score,
  rule_id, evidence_ids) ; format commun aux baselines pour que l'Evaluation Agent soit agnostique.
- **Évaluation → papier** : `paper/tables/*.tex` générés, jamais édités à la main.

## Supervision humaine

Décisions réservées aux humains : validation des templates (juristes), relecture des règles (juristes),
gel des règles (porteur), passage des gates, choix du modèle après pilote (score pondéré déclaré), toute
modification d'ADR. Les agents proposent, tracent, n'entérinent pas.

## Mise en œuvre avec Claude Code

Chaque agent = un sous-agent avec prompt de rôle (ce tableau), accès limité aux dossiers de ses
sorties, et obligation de citer les fichiers d'entrée lus ; les workflows (`Workflow`) enchaînent
Extraction → Memgraph → Experiment → Evaluation pour un `run_id` donné ; le Scientific Reviewer tourne
en fin de phase sur le diff.
