# GRAPH_MODEL — quatre modèles de graphe, comparaison, recommandation

> Décision formelle : [ADR-001](adr/ADR-001-choice-of-graph-model.md). Schéma machine :
> [`ontology/legal_kg_schema.yaml`](../ontology/legal_kg_schema.yaml) ; contraintes Memgraph :
> [`graph/schema/memgraph_schema.cypher`](../graph/schema/memgraph_schema.cypher) ; diagrammes :
> [`diagrams/conceptual_model.puml`](../diagrams/conceptual_model.puml),
> [`diagrams/memgraph_model.puml`](../diagrams/memgraph_model.puml).

---

## 1. Ce que le modèle doit permettre (exigences issues des RQ et des données)

| # | Exigence | Origine |
|---|---|---|
| X1 | Conserver **toutes** les couches d'annotation (votes, juges, consensus, gold) avec provenance et confiance, sans écrasement | DATA_UNDERSTANDING §3, §5 ; Braun 2024 |
| X2 | Deux unités : phrase (référence, évidence) et clause (unité normative), clauses alternatives par source | DATA_UNDERSTANDING §7 |
| X3 | Énoncés normatifs à champs fermés (acteur, modalité, action, objet, condition, préavis, recours) interrogeables par motif | LEGAL_MODEL §3 |
| X4 | Fondements juridiques comme nœuds (items de l'annexe, extensions nationales) et résultats de règles comme arêtes versionnées | LEGAL_MODEL §1, §6 |
| X5 | Séparation référence CLAUDETTE ↔ règles (lisibilité contrôlée) | RQ2 (pré-inscription) |
| X6 | Composition entre clauses d'un même document (R3) | LEGAL_MODEL §3 |
| X7 | Sorties de modèles (classifieurs, embeddings) stockables comme couches datées | RQ1, RQ3 |
| X8 | Compatible Memgraph (LPG, Cypher, MAGE) ; exportable en RDF/OWL pour la publication | ADR-002 |
| X9 | Génération automatique possible depuis l'export existant pour les couches documentaire et thématique **dès aujourd'hui** | faisabilité |

## 2. Les quatre modèles

### Modèle A — graphe documentaire

`Document → Section → Clause → Sentence`, thèmes et catégories comme étiquettes de nœuds ou nœuds de
vocabulaire ; relations `CONTAINS`, `NEXT`, `HAS_THEME`, `LABELED`.
*Pour* : générable à 100 % depuis l'export ; sert immédiatement la similarité, les statistiques de
structure, les baselines « graph-only » (position, voisinage thématique, co-occurrence).
*Contre* : aucune sémantique normative ; les seules « règles » possibles sont des motifs de thèmes ;
explicabilité limitée (« cette phrase est dans une clause de résiliation »).

### Modèle B — knowledge graph sémantique

Instances reliées à des concepts d'une ontologie juridique (LKIF-Core-like : `Agent`, `Action`,
`LegalConcept`), relations `REFERS_TO`, `SIMILAR_TO`, `APPLIES_TO`, alignements vers des vocabulaires
externes (ELI pour la directive, ODRL pour les modalités).
*Pour* : interopérable, publiable en RDF, inférence de subsomption.
*Contre* : l'instanciation depuis le texte est le goulot ; les concepts ne suffisent pas à exprimer
« sans préavis » ou « sans réciprocité » (il faut des énoncés, pas des concepts) ; l'inférence OWL
n'est pas la détection recherchée ; risque de sur-modélisation avant d'avoir des données.

### Modèle C — graphe normatif

Centré sur `Norm {modality ∈ {obligation, permission, prohibition, power}}` avec `bearer`,
`counterparty`, `action`, `object`, `condition`, `notice`, `remedy` ; relations `IMPOSES`/`GRANTS`/
`PROHIBITS` (vues), `EXCEPTION_TO`, `CONDITIONAL_ON`, `CONTRADICTS` ; appariement direct aux items de
l'annexe.
*Pour* : c'est le niveau où vivent les items (a)–(q) ; raisonnement R1–R4 naturel ; explications
juridiquement formulées.
*Contre* : entièrement dépendant de l'extraction (RQ0/RQ4) ; sans ancrage documentaire ni couche
d'annotation, l'évaluation contre CLAUDETTE et la provenance sont impossibles.

### Modèle D — hybride en couches (recommandé)

Cinq couches sur un même property graph, chacune générable et évaluable séparément :

```
L1 Documentaire   Document ─CONTAINS→ Section ─CONTAINS→ Clause ─CONTAINS→ Sentence ; NEXT ; REFERS_TO
L2 Thématique     Sentence/Clause ─HAS_THEME{source, role, confidence}→ Theme{code, taxonomy} ; Annotation ; GoldDecision
L3 Normative      Clause ─STATES→ Norm{modality,…} ─HAS_ACTOR→ Party ; ─HAS_ACTION→ ActionType ; ─CONDITIONAL_ON→ Condition ; ─EVIDENCED_BY→ Sentence
L4 Juridique      Norm ─MATCHES_ITEM{rule_id, rule_version, run_id}→ AnnexItem ─PART_OF→ LegalSource ; AnnexItem ─MAPS_TO→ Category ; Sentence ─LABELED{severity}→ Category  (référence, isolée)
L5 Résultats      Sentence/Clause ─PREDICTED{model, version, run_id, score}→ Category ; Clause ─EMBEDDED{model}→ (vecteur) ; Clause ─SIMILAR_TO{method, score}→ Clause
+ Provenance      chaque nœud/arête des couches 2–5 porte {source, created_by, run_id, created_at, version} ; nœuds Activity/Agent (PROV) pour les runs
```

*Pour* : satisfait X1–X9 ; L1+L2 (+L4 référence) sont **générables aujourd'hui** depuis l'export
(`src/graph/build_document_graph.py`) ; L3 s'ajoute clause par clause au rythme de la validation ; les
ablations du protocole correspondent à des couches (sans L3 = « KG sans règles juridiques » ; sans L2 =
« sans relations sémantiques » ; sans provenance = L2/L5 aplaties).
*Contre* : plus de types (≈ 14 étiquettes de nœuds, ≈ 16 types de relations) ; discipline de nommage et
de versionnement indispensable ; le risque de « tout modéliser » est contenu par la règle **une couche
n'entre que si une expérience la lit**.

## 3. Comparaison

Échelle 1 (faible) – 5 (fort). Les notes sont des jugements d'équipe motivés dans le texte, pas des mesures.

| Critère | A documentaire | B sémantique | C normatif | **D hybride** |
|---|:-:|:-:|:-:|:-:|
| Explicabilité (chemin lisible en termes juridiques) | 2 | 3 | 5 | **5** |
| Complexité (inverse) | 5 | 2 | 3 | **3** |
| Scalabilité (Memgraph, 50 → 5 000 ToS) | 5 | 3 | 4 | **4** |
| Qualité scientifique (évaluable, falsifiable) | 3 | 2 | 3 | **5** |
| Capacité de raisonnement (R1–R4) | 1 | 3 | 5 | **5** |
| Facilité de génération automatique | 5 | 2 | 2 | **4** (L1–L2 immédiates, L3 progressive) |
| Compatibilité Memgraph | 5 | 3 (RDF natif absent) | 5 | **5** |
| Pertinence pour CLAUDETTE (référence par phrase, provenance) | 4 | 2 | 2 | **5** |
| Potentiel de publication | 2 | 3 | 4 | **5** |

**Recommandation : D**, avec une règle d'entrée en vigueur par couche (L1–L2 immédiatement ; L3 après
Gate 3/5 ; L5 au fil des expériences) et B **comme vue d'export** (mapping YAML → RDF/OWL avec LKIF/ODRL
pour la publication FAIR), pas comme substrat.

## 4. Le modèle D en détail

### 4.1 Nœuds

| Étiquette | Propriétés clés (obligatoires en gras) | Cardinalité attendue (50 ToS) |
|---|---|---|
| `Document` | **id**, name, population, n_sentences, source_corpus, agreement_alpha | 50 |
| `Section` | **id**, title, order (après réimport XML) | ~600 |
| `Clause` | **id**, **source** (consensus\|annotator\|gold\|llm), start, end, n_sentences, themes_signature, taxonomy | 2 450 (consensus) + alternatives |
| `Sentence` | **id**, **index**, text, text_detok, n_tokens, doc_position | 9 414 |
| `Theme` | **code**, **taxonomy** (T20\|T14\|T11\|T10), label, stratum | 20 + 14 + 11 + 10 |
| `Annotation` | **id**, **annotator**, **source** (human\|llm), primary, secondaries, model, version | 28 242 + 37 656 |
| `GoldDecision` | **id**, agreement_class, auto_level, risk_band, confidence, tally (map), finalized | 9 414 |
| `Norm` | **id**, **modality**, action, object, condition, notice, remedy, confidence, source, validated_by | ≈ 3 000 (estimation) |
| `Party` | **role** (provider\|user\|third_party) | 3 par document |
| `ActionType` | **code** (terminate, modify_terms, …), theme_scope | ≈ 25 |
| `AnnexItem` | **code** (a…q), text, expressibility, risk_class | 17 |
| `LegalSource` | **id** (ELI de la directive), title, jurisdiction, bindingness | 1 (+ extensions) |
| `Category` | **code** (A, CH, CR, J, LAW, LTD, TER, USE), definition | 8 |
| `Rule` | **id**, **version**, item, family (R1–R4), cypher_hash, frozen_at | ≈ 15 |
| `Run` | **id**, kind (extraction\|detection\|classification\|embedding), model, version, prompt_hash, seed, started_at | par exécution |

### 4.2 Relations

`CONTAINS` (Document→Section→Clause→Sentence), `NEXT` (Sentence→Sentence, Clause→Clause),
`REFERS_TO` (Clause→Section/Clause, {surface}), `HAS_THEME` (Sentence\|Clause→Theme, {**source**, role:
primary\|secondary, confidence, run_id}), `ANNOTATED_BY` (Sentence→Annotation), `DECIDED_BY`
(Sentence→GoldDecision), `PROJECTS_TO` (Theme→Theme, {spec_version} : T20→T11), `STATES` (Clause→Norm),
`HAS_ACTOR` / `HAS_COUNTERPARTY` (Norm→Party), `HAS_ACTION` (Norm→ActionType), `EVIDENCED_BY`
(Norm→Sentence, {span}), `EXCEPTION_TO` / `CONDITIONAL_ON` / `CONTRADICTS` (Norm→Norm), `MATCHES_ITEM`
(Norm→AnnexItem, {**rule_id**, **rule_version**, **run_id**, evidence_ids}), `MAPS_TO` (AnnexItem→Category),
`PART_OF` (AnnexItem→LegalSource), `LABELED` (Sentence→Category, {severity, source: claudette}),
`PREDICTED` (Sentence\|Clause→Category, {model, version, run_id, score}), `SIMILAR_TO` (Clause→Clause,
{method, score, run_id}), `PRODUCED_BY` (tout nœud/arête dérivé → Run).

Les raccourcis lisibles `IMPOSES`/`GRANTS`/`PROHIBITS`/`ALLOWS` sont des **vues** Cypher (modality ×
acteur), pas des arêtes stockées — une seule source de vérité.

### 4.3 Invariants (contraintes et tests)

- Unicité : `Document.id`, `Sentence.id`, `Clause.id`, `Norm.id`, `Theme(code, taxonomy)`, `AnnexItem.code`,
  `Rule(id, version)`, `Run.id`.
- Existence : toute `Norm` a exactement un `HAS_ACTOR` et ≥ 1 `EVIDENCED_BY` ; toute `MATCHES_ITEM` porte
  `rule_id`, `rule_version`, `run_id`.
- Disjonction : une `Norm` n'a qu'une modalité ; `Party.role` fermé.
- **Étanchéité** : aucune `Rule` ne mentionne `LABELED` ni `Category` (lint sur le Cypher des règles) ;
  aucune couche L5 n'est lue par L4.
- Versionnement : les résultats (L4 `MATCHES_ITEM`, L5) sont **append-only** par `run_id` ; on ne
  supprime pas, on désactive (`superseded_by`).

### 4.4 Ce qui se génère aujourd'hui

`src/graph/build_document_graph.py` produit, depuis `data/processed/`, les CSV de L1 (sans sections),
L2 (consensus, votes, juges, gold, thèmes T20 + projections) et L4-référence (`LABELED`), plus le
script Cypher `LOAD CSV`. L3 et L4-règles arrivent avec les templates validés (phase 5–7).

## 5. Alternatives écartées et pourquoi

- **RDF natif** : l'attribution de propriétés aux arêtes (source, confiance, run) exige la réification ou
  RDF-star ; Memgraph n'est pas un triplestore ; l'export RDF reste prévu (vue B).
- **Hypergraphe natif** : les hyperarêtes clause–thèmes de G2 sont représentées par le nœud `Clause`
  relié à plusieurs `Theme` (star expansion) — équivalent pour les requêtes, sans moteur spécialisé.
- **Un seul niveau (clause) sans phrases** : impossible d'évaluer contre CLAUDETTE ni de tracer
  l'évidence.
