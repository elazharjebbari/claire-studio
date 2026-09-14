# legal-kg — programme R&D : Terms of Service → Legal Knowledge Graph → détection explicable des clauses abusives

> Dossier de pilotage **exploitable immédiatement**, créé le 14–15 septembre 2026 à partir du corpus
> CLAUDETTE, de la couche thématique Pactiva (50 ToS × 3 annotateurs × 4 juges LLM) et de la directive
> 93/13/CEE. Il contient l'état de l'art vérifié, la compréhension des données (profil régénérable), le
> modèle juridique, quatre modèles de graphe comparés et le modèle retenu, le schéma Memgraph et les
> requêtes Cypher, la stratégie d'extraction par LLM, le protocole expérimental complet, les ADR, les
> diagrammes, la feuille de route, l'organisation agentique et les quality gates.

## Où commencer

| Vous voulez… | Lisez |
|---|---|
| la contribution scientifique et comment elle est prouvée | [`docs/RESEARCH_QUESTIONS.md`](docs/RESEARCH_QUESTIONS.md), [`docs/PUBLICATION_STRATEGY.md`](docs/PUBLICATION_STRATEGY.md) |
| ce qui existe déjà dans la littérature | [`docs/STATE_OF_THE_ART.md`](docs/STATE_OF_THE_ART.md), [`docs/literature/references.bib`](docs/literature/references.bib) |
| les données telles qu'elles sont | [`docs/DATA_PROFILE.md`](docs/DATA_PROFILE.md) (généré), [`docs/DATA_UNDERSTANDING.md`](docs/DATA_UNDERSTANDING.md) |
| la directive rendue exécutable | [`docs/LEGAL_MODEL.md`](docs/LEGAL_MODEL.md), [`ontology/directive_93_13.yaml`](ontology/directive_93_13.yaml) |
| le graphe (modèles A–D, choix, schéma) | [`docs/GRAPH_MODEL.md`](docs/GRAPH_MODEL.md), [`ontology/legal_kg_schema.yaml`](ontology/legal_kg_schema.yaml), [`graph/`](graph/) |
| la construction par LLM et le choix des modèles | [`docs/LLM_EXTRACTION.md`](docs/LLM_EXTRACTION.md), [`llm/`](llm/), [`configs/models.yaml`](configs/models.yaml) |
| le protocole, les ablations, les métriques, les erreurs | [`docs/EXPERIMENTAL_PROTOCOL.md`](docs/EXPERIMENTAL_PROTOCOL.md), [`docs/ABLATION_PLAN.md`](docs/ABLATION_PLAN.md), [`docs/EVALUATION_PLAN.md`](docs/EVALUATION_PLAN.md), [`docs/ERROR_ANALYSIS.md`](docs/ERROR_ANALYSIS.md), [`docs/REPRODUCIBILITY.md`](docs/REPRODUCIBILITY.md) |
| les décisions et leurs raisons | [`docs/adr/`](docs/adr/) (ADR-001 → 005) |
| le plan, le DAG, les agents, les gates | [`docs/ROADMAP.md`](docs/ROADMAP.md), [`diagrams/dag.puml`](diagrams/dag.puml), [`docs/AGENTS.md`](docs/AGENTS.md), [`docs/QUALITY_GATES.md`](docs/QUALITY_GATES.md) |

## Structure du dépôt

```
legal-kg/
├── docs/                 documents de pilotage (+ adr/, literature/)
├── data/
│   ├── raw/              (archive XML CLAUDETTE originale — à déposer, non versionnée)
│   ├── processed/        export Lab 7116e627… (sentences, votes, judges, gold, reference, splits, manifest)
│   ├── annotations/      templates validés (à venir, phase 5)
│   └── profiling/        sorties du profil (CSV/JSON, régénérables)
├── ontology/             directive_93_13.yaml · legal_kg_schema.yaml
├── graph/
│   ├── schema/           memgraph_schema.cypher · NAMING.md
│   ├── cypher/           01_ingest · 02_detection_queries · 03_explanation_queries
│   ├── rules/            grey_list_queries.yaml (DSL, à geler) · FROZEN.txt · README.md
│   └── export/           CSV d'ingestion par dataset/run (générés par src/graph)
├── llm/                  prompts/ (versionnés, registre) · schemas/ (JSON Schema)
├── src/                  profiling/ · graph/ · extraction/ · detection/ · evaluation/
├── experiments/  results/  notebooks/  figures/  configs/  tests/  paper/
└── diagrams/             PlantUML (architecture, pipelines, modèle conceptuel, Memgraph, DAG)
```

## Reproduire ce qui est déjà exécutable

```bash
cd legal-kg
python3 src/profiling/profile_dataset.py          # → docs/DATA_PROFILE.md + data/profiling/*
python3 src/graph/build_document_graph.py         # → graph/export/7116e627/<run_id>/*.csv (L1, L2, L4-référence)
python3 src/graph/import_claudette_original.py   # → data/annotations/claudette_severity.jsonl + sections.jsonl
python3 src/extraction/build_clause_set.py        # → data/annotations/{clauses_all,pilot_100,holdout}
.venv/bin/python -m pytest tests -q               # parité des coefficients + étanchéité règles/prompts
.venv/bin/python src/extraction/extract_templates.py --clauses data/annotations/pilot_100/clauses.jsonl --repeat 3   # pilote (clé API requise)
# Memgraph (docker) : monter graph/export/<fp>/<run_id> sur /import, puis
#   mgconsole < graph/schema/memgraph_schema.cypher && mgconsole < graph/cypher/01_ingest.cypher
```

## État (15 septembre 2026)

Phases 0–2 faites (sévérité réimportée à 95,6 %, sections partielles) ; G3 et G4 passées (validation du porteur
le 15 sept, relecture des co-autrices juristes à consigner) ; **règles v0.1 gelées** (`graph/rules/FROZEN.txt`) ;
L1–L2 générées ; pilote d'extraction prêt (100 clauses) mais **bloqué par l'absence d'accès API LLM** sur ce
poste ; suite selon `docs/ROADMAP.md` et `docs/GATES_LOG.md`. Le long paper
JURIX 157 (« Executing the Grey List ») est la première application du programme
(`docs/pactiva-grey-list-157/` à la racine du dépôt principal).

## Principes non négociables

Ne pas inventer de résultats ni de références (statut ✅/⚠ par entrée) ; distinguer faits, hypothèses et
recommandations ; règles gelées avant toute évaluation sur les documents de validation ; aucune règle ne
lit la référence d'abusivité ; provenance et désaccord conservés dans le graphe ; chaque chiffre remonte
à un `run_id`.
