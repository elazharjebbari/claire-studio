// Ingestion des couches L1 (documentaire), L2 (thématique) et L4-référence depuis les CSV produits par
// src/graph/build_document_graph.py (graph/export/<dataset>/). Ordre : nœuds puis relations.
// Les chemins sont relatifs au répertoire monté dans le conteneur Memgraph (ex. /import).
// Idempotent : MERGE sur les identifiants.

// L1 — documents, phrases, clauses
LOAD CSV FROM "/import/documents.csv" WITH HEADER AS row
MERGE (d:Document {id: row.id})
SET d.name = row.name, d.population = row.population, d.n_sentences = toInteger(row.n_sentences),
    d.source_corpus = row.source_corpus, d.agreement_alpha = toFloat(row.agreement_alpha);

LOAD CSV FROM "/import/sentences.csv" WITH HEADER AS row
MERGE (s:Sentence {id: row.id})
SET s.document = row.document, s.index = toInteger(row.index), s.text = row.text, s.text_detok = row.text_detok,
    s.n_tokens = toInteger(row.n_tokens), s.doc_position = toFloat(row.doc_position)
WITH s, row MATCH (d:Document {id: row.document_id}) MERGE (d)-[:CONTAINS]->(s);

LOAD CSV FROM "/import/sentence_next.csv" WITH HEADER AS row
MATCH (a:Sentence {id: row.from_id}), (b:Sentence {id: row.to_id}) MERGE (a)-[:NEXT]->(b);

LOAD CSV FROM "/import/clauses.csv" WITH HEADER AS row
MERGE (c:Clause {id: row.id})
SET c.document = row.document, c.source = row.source, c.start = toInteger(row.start), c.end = toInteger(row.end),
    c.n_sentences = toInteger(row.n_sentences), c.themes_signature = row.themes_signature, c.taxonomy = row.taxonomy
WITH c, row MATCH (d:Document {id: row.document_id}) MERGE (d)-[:CONTAINS]->(c);

LOAD CSV FROM "/import/clause_sentences.csv" WITH HEADER AS row
MATCH (c:Clause {id: row.clause_id}), (s:Sentence {id: row.sentence_id}) MERGE (c)-[:CONTAINS]->(s);

// L1 — sections (réimportées des XML originaux : data/annotations/sections.jsonl)
LOAD CSV FROM "/import/sections.csv" WITH HEADER AS row
MERGE (x:Section {id: row.id})
SET x.document = row.document, x.order = toInteger(row.order), x.title = row.title, x.start = toInteger(row.start), x.end = toInteger(row.end)
WITH x, row MATCH (d:Document {id: row.document_id}) MERGE (d)-[:CONTAINS]->(x);

LOAD CSV FROM "/import/section_sentences.csv" WITH HEADER AS row
MATCH (x:Section {id: row.section_id}), (s:Sentence {id: row.sentence_id}) MERGE (x)-[:CONTAINS]->(s);

// L2 — thèmes (T20 + projections), consensus, votes, juges, gold
LOAD CSV FROM "/import/themes.csv" WITH HEADER AS row
MERGE (t:Theme {key: row.key}) SET t.code = row.code, t.taxonomy = row.taxonomy, t.label = row.label, t.stratum = row.stratum;

LOAD CSV FROM "/import/theme_projections.csv" WITH HEADER AS row
MATCH (a:Theme {key: row.from_key}), (b:Theme {key: row.to_key}) MERGE (a)-[p:PROJECTS_TO]->(b) SET p.spec_version = row.spec_version;

LOAD CSV FROM "/import/sentence_themes.csv" WITH HEADER AS row
MATCH (s:Sentence {id: row.sentence_id}), (t:Theme {key: row.theme_key})
MERGE (s)-[h:HAS_THEME {source: row.source, role: row.role}]->(t) SET h.confidence = toFloat(row.confidence), h.run_id = row.run_id;

LOAD CSV FROM "/import/annotations.csv" WITH HEADER AS row
MERGE (a:Annotation {id: row.id})
SET a.annotator = row.annotator, a.source = row.source, a.primary = row.primary, a.secondaries = split(coalesce(row.secondaries, ""), "|"),
    a.model = row.model, a.version = row.version, a.is_segment_start = (row.is_segment_start = "true")
WITH a, row MATCH (s:Sentence {id: row.sentence_id}) MERGE (s)-[:ANNOTATED_BY]->(a);

LOAD CSV FROM "/import/gold.csv" WITH HEADER AS row
MERGE (g:GoldDecision {id: row.id})
SET g.agreement_class = row.agreement_class, g.auto_level = row.auto_level, g.risk_band = row.risk_band,
    g.confidence = toFloat(row.confidence), g.decided_primary = row.decided_primary, g.finalized = (row.finalized = "true"), g.tally = row.tally
WITH g, row MATCH (s:Sentence {id: row.sentence_id}) MERGE (s)-[:DECIDED_BY]->(g);

// L4 — référence CLAUDETTE (isolée : jamais lue par les règles)
LOAD CSV FROM "/import/labels.csv" WITH HEADER AS row
MATCH (s:Sentence {id: row.sentence_id}), (c:Category {code: row.category})
MERGE (s)-[l:LABELED {source: "claudette"}]->(c) SET l.severity = toInteger(row.severity);

// Provenance du build
LOAD CSV FROM "/import/run.csv" WITH HEADER AS row
MERGE (r:Run {id: row.id}) SET r.kind = row.kind, r.started_at = row.started_at, r.code_version = row.code_version, r.dataset = row.dataset;

// L3 (Norm) et L4-règles (MATCHES_ITEM) sont ingérées par src/graph/ingest_norms.py après validation (Gate 5).
