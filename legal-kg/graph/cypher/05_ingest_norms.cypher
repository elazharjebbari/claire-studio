// Ingestion L3 (Norm) et L5 (MATCHES_ITEM) — CSV produits par src/graph/ingest_norms.py, montés sous /import/norms.
// Pré-requis : 01_ingest.cypher (Document, Sentence, Clause) et memgraph_schema.cypher (Party, AnnexItem).
// Étanchéité : aucune lecture de la couche de référence ici.

// Run de provenance
LOAD CSV FROM "/import/norms/run.csv" WITH HEADER AS row
MERGE (r:Run {id: row.id})
SET r.kind = row.kind, r.started_at = row.started_at, r.code_version = row.code_version, r.source = row.source, r.select = row.select;

// Clauses de travail (re-découpage ≤ 8 phrases) : créées si absentes de L1, reliées à leur parent et à leur thème T11
LOAD CSV FROM "/import/norms/clauses.csv" WITH HEADER AS row
MATCH (d:Document {id: row.document_id})
MERGE (c:Clause {id: row.id})
ON CREATE SET c.document = row.document, c.source = row.source, c.start = toInteger(row.start), c.end = toInteger(row.end),
              c.n_sentences = toInteger(row.n_sentences), c.taxonomy = "T11", c.themes_signature = row.theme_T11, c.derived = true
MERGE (d)-[:CONTAINS]->(c)
WITH c, row WHERE row.split_of <> ""
MATCH (parent:Clause {id: row.split_of}) MERGE (c)-[:SPLIT_OF]->(parent);

LOAD CSV FROM "/import/norms/clause_sentences.csv" WITH HEADER AS row
MATCH (c:Clause {id: row.clause_id}), (s:Sentence {id: row.sentence_id}) MERGE (c)-[:CONTAINS]->(s);

LOAD CSV FROM "/import/norms/clause_themes.csv" WITH HEADER AS row
MATCH (c:Clause {id: row.clause_id}), (t:Theme {key: row.theme_key})
MERGE (c)-[:HAS_THEME {role: row.role, source: row.source}]->(t);

// Normes + acteur + clause + provenance
LOAD CSV FROM "/import/norms/norms.csv" WITH HEADER AS row
MATCH (c:Clause {id: row.clause_id})
MATCH (r:Run {id: row.run_id})
MERGE (p:Party {role: row.actor})
MERGE (n:Norm {id: row.id})
SET n.modality = row.modality, n.action = row.action, n.object = CASE row.object WHEN "" THEN null ELSE row.object END,
    n.condition = row.condition, n.notice = row.notice, n.remedy = row.remedy, n.status = row.status, n.source = row.source,
    n.counterparty = CASE row.counterparty WHEN "" THEN null ELSE row.counterparty END,
    n.confidence = CASE row.confidence WHEN "" THEN null ELSE toFloat(row.confidence) END,
    n.amount_ratio = CASE row.amount_ratio WHEN "" THEN null ELSE toFloat(row.amount_ratio) END,
    n.opt_out_deadline_days = CASE row.opt_out_deadline_days WHEN "" THEN null ELSE toInteger(row.opt_out_deadline_days) END,
    n.notice_duration_days = CASE row.notice_duration_days WHEN "" THEN null ELSE toInteger(row.notice_duration_days) END
MERGE (c)-[:STATES]->(n)
MERGE (n)-[:HAS_ACTOR]->(p)
MERGE (n)-[:PRODUCED_BY]->(r);

// Evidence (phrases témoins)
LOAD CSV FROM "/import/norms/norm_evidence.csv" WITH HEADER AS row
MATCH (n:Norm {id: row.norm_id}), (s:Sentence {id: row.sentence_id})
MERGE (n)-[:EVIDENCED_BY]->(s);

// Relations entre normes (exceptions, conditions)
LOAD CSV FROM "/import/norms/norm_relations.csv" WITH HEADER AS row
MATCH (a:Norm {id: row.from_id}), (b:Norm {id: row.to_id})
FOREACH (_ IN CASE WHEN row.type = "EXCEPTION_TO" THEN [1] ELSE [] END | MERGE (a)-[:EXCEPTION_TO {run_id: row.run_id}]->(b))
FOREACH (_ IN CASE WHEN row.type = "CONDITIONAL_ON" THEN [1] ELSE [] END | MERGE (a)-[:CONDITIONAL_ON {run_id: row.run_id}]->(b));

// Validation humaine (Activity) — trace d'intervention, jamais un résultat
LOAD CSV FROM "/import/norms/activities.csv" WITH HEADER AS row
MATCH (n:Norm {id: row.norm_id})
MERGE (act:Activity {id: row.id})
SET act.actor = row.actor, act.at = row.at, act.kind = row.kind, act.note = row.note
MERGE (n)-[:EDITED_BY]->(act);

// Appariements (L5) — append-only, portés par run_id ; calculés hors graphe (run_rules.py) ou par 04_rules_compiled.cypher
LOAD CSV FROM "/import/norms/matches.csv" WITH HEADER AS row
MATCH (n:Norm {id: row.norm_id}), (i:AnnexItem {code: row.item})
MERGE (n)-[m:MATCHES_ITEM {rule_id: row.rule_id, rule_version: row.rule_version, run_id: row.run_id}]->(i)
SET m.family = row.family, m.rules_sha256 = row.rules_sha256,
    m.evidence_ids = CASE row.evidence_ids WHEN "" THEN [] ELSE split(row.evidence_ids, "|") END;
