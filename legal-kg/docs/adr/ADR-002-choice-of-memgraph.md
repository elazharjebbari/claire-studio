# ADR-002 — Substrat d'exécution : Memgraph (property graph, Cypher, MAGE)

**Statut** : accepté (14 septembre 2026) · **Révision** : si le volume dépasse ~10⁷ nœuds ou si une inférence OWL devient nécessaire.

## Context
Le graphe doit supporter des requêtes de motif et de chemin lisibles (règles R1–R4), des propriétés sur
les arêtes (source, confiance, run_id), des algorithmes de graphe (similarité, embeddings, communautés)
et une exécution locale reproductible. Volume cible : 50 ToS aujourd'hui (≈ 60 k nœuds, ≈ 150 k arêtes
avec annotations), 5 000 ToS à terme.

## Options considered
Memgraph (LPG, Cypher, MAGE, in-memory) — Neo4j (LPG, Cypher, GDS) — triplestore RDF (GraphDB, Jena ;
SPARQL, SHACL, OWL) — NetworkX/DGL en mémoire sans base — ArangoDB (multi-modèle).

## Decision
**Memgraph** comme substrat d'exécution ; export RDF pour la publication ; NetworkX pour les prototypes
d'algorithmes ; pas de triplestore en production.

## Rationale
Cypher exprime naturellement les motifs R1–R4 et retourne des sous-graphes témoins ; les propriétés
d'arête portent la provenance sans réification ; MAGE fournit node2vec, PageRank, détection de
communautés (Louvain, Leiden), similarité de nœuds, et des passerelles GNN (PyTorch Geometric) —
vérifié sur la documentation officielle le 14 septembre 2026 ; compatibilité openCypher/APOC facilite
une migration Neo4j si nécessaire ; imposé par le programme.

## Consequences
Contraintes : unicité et existence via `CREATE CONSTRAINT`, index par étiquette/propriété ; ingestion par
CSV ou CYPHERL ; pas d'inférence de schéma → validation par tests et par le schéma YAML ; versionnement
par propriétés (`run_id`, `superseded_by`) et snapshots ; les algorithmes dynamiques (online) sont
réservés à l'édition Enterprise — non requis.

## Risks
Perte d'interopérabilité sémantique (parade : vue RDF/OWL générée) ; dépendance à une base en mémoire
(parade : exports versionnés, rejouables) ; signatures des procédures MAGE à vérifier à chaque
montée de version (parade : tests de fumée).
