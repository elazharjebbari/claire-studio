# ADR-001 — Choix du modèle de graphe : hybride en couches (modèle D)

**Statut** : accepté (14 septembre 2026) · **Décideurs** : porteur, KG Architect, juristes (relecture) · **Révision** : à Gate 4.

## Context
Nous devons représenter 50 ToS (9 414 phrases, 2 450 clauses) avec une référence d'abusivité par phrase,
trois couches d'annotation thématique (votes, juges, gold/consensus) à fiabilité mesurée, et une couche
normative à construire, pour exécuter des règles dérivées de l'annexe 93/13 et comparer texte vs
structure (RQ1–RQ6). Exigences X1–X9 (GRAPH_MODEL §1) : provenance et désaccord conservés, deux unités
(phrase/clause), énoncés normatifs à champs fermés, fondements juridiques comme nœuds, étanchéité
référence/règles, composition inter-clauses, sorties de modèles versionnées, Memgraph, génération
immédiate des couches existantes.

## Options considered
A. graphe documentaire seul — B. knowledge graph sémantique (ontologie + instances, RDF) — C. graphe
normatif seul — D. hybride en couches (documentaire + thématique + normative + juridique + résultats +
provenance) sur property graph, avec vue RDF d'export.

## Decision
Modèle **D**, avec règle d'admission : une couche n'existe que si une expérience la lit ; L1–L2 (+L4
référence) générées dès maintenant depuis l'export ; L3 ajoutée au rythme des templates validés ; L5
au fil des runs ; B conservé comme **vue d'export** (mapping vers LKIF-Core/ODRL/ELI) pour la publication.

## Rationale
Seul D satisfait X1–X9 ; A ne porte aucune norme ; B déplace le goulot vers l'instanciation et
l'inférence OWL ne répond pas aux RQ ; C est inévaluable sans ancrage documentaire ni couche de
référence. Les ablations du protocole correspondent exactement à des couches de D (ABLATION_PLAN), ce qui
rend la comparaison texte/structure interprétable.

## Consequences
≈ 14 étiquettes de nœuds et 16 types de relations ; discipline de nommage et de versionnement
(`graph/schema/NAMING.md`) ; les raccourcis IMPOSES/GRANTS/PROHIBITS sont des vues ; append-only pour
L4-règles et L5 ; un export RDF à maintenir pour la publication FAIR.

## Risks
Sur-modélisation (parade : règle d'admission par expérience) ; divergence schéma ↔ code (parade : schéma
YAML unique, contraintes générées, tests) ; clause consensus peu fiable aux frontières (parade : clauses
alternatives par source, re-découpage des clauses longues).
