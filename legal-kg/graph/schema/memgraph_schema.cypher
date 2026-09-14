// Memgraph — contraintes et index du Legal KG (modèle D). Dérivé de ontology/legal_kg_schema.yaml v0.1.
// Exécuter une fois sur une base vide : mgconsole < graph/schema/memgraph_schema.cypher
// Conventions : étiquettes PascalCase, relations UPPER_SNAKE, propriétés snake_case (graph/schema/NAMING.md).

// ---- Unicité ---------------------------------------------------------------------------------
CREATE CONSTRAINT ON (n:Document) ASSERT n.id IS UNIQUE;
CREATE CONSTRAINT ON (n:Section)  ASSERT n.id IS UNIQUE;
CREATE CONSTRAINT ON (n:Clause)   ASSERT n.id IS UNIQUE;
CREATE CONSTRAINT ON (n:Sentence) ASSERT n.id IS UNIQUE;
CREATE CONSTRAINT ON (n:Norm)     ASSERT n.id IS UNIQUE;
CREATE CONSTRAINT ON (n:Annotation)   ASSERT n.id IS UNIQUE;
CREATE CONSTRAINT ON (n:GoldDecision) ASSERT n.id IS UNIQUE;
CREATE CONSTRAINT ON (n:AnnexItem) ASSERT n.code IS UNIQUE;
CREATE CONSTRAINT ON (n:Category)  ASSERT n.code IS UNIQUE;
CREATE CONSTRAINT ON (n:LegalSource) ASSERT n.id IS UNIQUE;
CREATE CONSTRAINT ON (n:Run)       ASSERT n.id IS UNIQUE;
CREATE CONSTRAINT ON (n:Activity)  ASSERT n.id IS UNIQUE;
CREATE CONSTRAINT ON (n:Theme)     ASSERT n.key IS UNIQUE;   // key = code + '@' + taxonomy (Memgraph : unicité mono-propriété)
CREATE CONSTRAINT ON (n:Rule)      ASSERT n.key IS UNIQUE;   // key = id + '@' + version

// ---- Existence -------------------------------------------------------------------------------
CREATE CONSTRAINT ON (n:Sentence) ASSERT EXISTS (n.text);
CREATE CONSTRAINT ON (n:Sentence) ASSERT EXISTS (n.index);
CREATE CONSTRAINT ON (n:Clause)   ASSERT EXISTS (n.source);
CREATE CONSTRAINT ON (n:Norm)     ASSERT EXISTS (n.modality);
CREATE CONSTRAINT ON (n:Norm)     ASSERT EXISTS (n.source);
CREATE CONSTRAINT ON (n:Norm)     ASSERT EXISTS (n.status);
CREATE CONSTRAINT ON (n:Rule)     ASSERT EXISTS (n.rules_hash);
CREATE CONSTRAINT ON (n:Run)      ASSERT EXISTS (n.kind);

// ---- Index (étiquette / étiquette+propriété) ---------------------------------------------------
CREATE INDEX ON :Document;
CREATE INDEX ON :Document(population);
CREATE INDEX ON :Sentence(document);
CREATE INDEX ON :Clause(document);
CREATE INDEX ON :Clause(source);
CREATE INDEX ON :Theme(code);
CREATE INDEX ON :Theme(taxonomy);
CREATE INDEX ON :Annotation(annotator);
CREATE INDEX ON :Annotation(source);
CREATE INDEX ON :Norm(modality);
CREATE INDEX ON :Norm(action);
CREATE INDEX ON :Norm(status);
CREATE INDEX ON :AnnexItem(expressibility);
CREATE INDEX ON :Run(kind);

// ---- Vocabulaires de référence (nœuds constants) ------------------------------------------------
UNWIND ["provider", "user", "third_party"] AS r MERGE (:Party {role: r});
UNWIND ["A", "CH", "CR", "J", "LAW", "LTD", "TER", "USE"] AS c MERGE (:Category {code: c});
MERGE (s:LegalSource {id: "eli:dir:1993:13:oj"})
  SET s.title = "Council Directive 93/13/EEC on unfair terms in consumer contracts", s.jurisdiction = "EU", s.bindingness = "minimum_harmonisation";
UNWIND ["a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q"] AS code
  MERGE (i:AnnexItem {code: code})
  WITH i MATCH (s:LegalSource {id: "eli:dir:1993:13:oj"}) MERGE (i)-[:PART_OF]->(s);
// Correspondance item → catégorie CLAUDETTE (LEGAL_MODEL §2) — référence, jamais lue par une règle.
UNWIND [["a","LTD"],["b","LTD"],["f","TER"],["f","CR"],["g","TER"],["i","USE"],["j","CH"],["k","CH"],["l","CH"],["q","A"],["q","J"]] AS m
  MATCH (i:AnnexItem {code: m[0]}), (c:Category {code: m[1]}) MERGE (i)-[:MAPS_TO]->(c);

// ---- Notes -------------------------------------------------------------------------------------
// * Les raccourcis IMPOSES / GRANTS / PROHIBITS / ALLOWS sont des VUES (03_explanation_queries.cypher), pas des relations stockées.
// * MATCHES_ITEM / PREDICTED / SIMILAR_TO sont append-only : on ajoute superseded_by, on ne supprime pas.
// * Aucune requête de graph/rules ne doit mentionner LABELED ou Category (test tests/test_rule_isolation.py).
