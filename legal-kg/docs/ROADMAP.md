# ROADMAP — phases, dépendances, chemin critique

> Douze phases (0–11), chacune avec objectif, entrées, tâches, sorties, dépendances, critères de
> validation, risques, priorité. Les *quality gates* sont dans [QUALITY_GATES.md](QUALITY_GATES.md), le
> DAG dans [`diagrams/dag.puml`](../diagrams/dag.puml), l'organisation agentique dans
> [AGENTS.md](AGENTS.md). Priorité : P0 (chemin critique), P1 (nécessaire), P2 (souhaitable).
>
> **État au 14 septembre 2026** : phases 0, 1 et 2 **largement réalisées** par ce dossier et les travaux
> antérieurs (audit, campagne, profil) ; phase 3 amorcée (LEGAL_MODEL + YAML) ; phase 4 décidée
> (ADR-001/002) ; le reste est à exécuter.

| Phase | Objectif | Entrées | Tâches | Sorties | Dépend de | Validation | Risques | Prio |
|---|---|---|---|---|---|---|---|---|
| **0 Audit des ressources** | savoir exactement ce qu'on a | dépôt, prod, exports | inventaire données/outils/accès ; export figé ; copie locale | `README.md`, `data/processed/`, inventaire (DATA_UNDERSTANDING §1) | — | export rejouable, empreinte | dérive des exports | P0 ✅ |
| **1 Revue de littérature** | savoir ce qui existe | brouillons août, recherches | vérification à la source ; cartographie ; bib | `STATE_OF_THE_ART.md`, `literature/references.bib` | 0 | Gate 1 | références non vérifiées | P0 ✅ |
| **2 Data understanding** | comprendre CLAUDETTE + couche | export | profil automatique ; interprétation ; cas limites | `DATA_PROFILE.md`, `DATA_UNDERSTANDING.md`, `data/profiling/` | 0 | Gate 2 | sévérité/sections absentes | P0 ✅ (réimport XML : P1) |
| **3 Modélisation juridique** | annexe exécutable | directive, doctrine | items → règles ; exceptions ; mapping catégories ; relecture juristes | `LEGAL_MODEL.md`, `ontology/directive_93_13.yaml` | 1, 2 | Gate 3 (relecture juriste) | interprétation erronée | P0 (en cours) |
| **4 Modélisation du graphe** | schéma D validé | 2, 3 | modèles A–D ; comparaison ; schéma YAML ; contraintes Memgraph ; ADR | `GRAPH_MODEL.md`, `ontology/legal_kg_schema.yaml`, `graph/schema/`, ADR-001/002/003 | 2, 3 | Gate 4 | sur-modélisation | P0 (décidé) |
| **5 Extraction LLM** | couche normative fiable | 3, 4 | schéma JSON ; prompts ; pilote multi-modèles (100 clauses) ; extraction hold-out ; validation juristes ; ablation brut/validé | `llm/`, `results/extraction/`, templates validés | 3, 4 | Gate 5 (RQ0/RQ4) | coût humain ; hallucinations | P0 |
| **6 Implémentation Memgraph** | graphe interrogeable | 4, 5 | build L1–L2 (aujourd'hui) ; ingestion ; contraintes ; L3–L5 ; vues ; tests | `src/graph/`, `graph/cypher/`, instance Memgraph | 4 (L1–L2) ; 5 (L3) | contraintes vertes ; requêtes de fumée | dérive du schéma | P0 |
| **7 Détection** | règles + baselines + approches | 5, 6 | règles gelées ✅ (v0.1) ; moteur ; B0–B4 (B0/B0'/B1 ✅ run `6bf45ed8…`) ; A3–A8 | `graph/rules/`, `src/detection/`, runs | 6 | Gate 6 partielle | fuite ; règles ajustées | P0 |
| **8 Évaluation** | RQ0–RQ6 mesurées | 7 | E0–E6 ; IC ; tests ; étude humaine | `results/`, tableaux imposés | 7 | Gate 7 | petits effectifs | P0 |
| **9 Analyse d'erreurs** | comprendre les échecs | 8 | taxonomie ; double codage ; omissions du benchmark | `ERROR_ANALYSIS.md` rempli ; liste d'omissions | 8 | κ inter-juges | — | P1 |
| **10 Consolidation scientifique** | résultats défendables | 8, 9 | vérification des fuites ; réplication modèle ouvert ; relecture adversariale | rapport de consolidation ; ADR mis à jour | 9 | Gate 8 | résultat nul | P0 |
| **11 Publication** | papiers + artefacts | 10 | 157 camera-ready ; ICAIL long ; ressource FAIR ; dépôt public | `paper/`, Zenodo | 10 | acceptation | délais | P0 |

## Chemin critique

0 → 3 → 5 (pilote → Gate 5) → 6 (L3) → 7 (règles gelées) → 8 (E2, E1) → 10 → 11.
Parallélisable : 6-L1/L2 et 7-B0–B3 dès maintenant ; 1 et 2 en maintenance ; 9 avec 8.

## Jalons datés

| Date | Jalon |
|---|---|
| 15 sept. 2026 | 157 : version de grâce (périmètre H0 du dossier grey-list) |
| 30 sept. | Gate 5 : pilote d'extraction évalué, modèle retenu |
| 15 oct. | 157 camera-ready (si accepté) : hold-out validé, E2/E6 complets |
| 15 nov. | Graphe L1–L5 complet (50 ToS), baselines B0–B3, Gate 6–7 |
| 15 déc. | E1, E3 (étude humaine lancée), E4 complet |
| 31 janv. 2027 | Gate 8 ; soumission ICAIL 2027 |
