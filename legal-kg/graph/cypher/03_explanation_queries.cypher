// Requêtes d'explication, de vues dérivées et d'audit. Paramètres : $norm_id, $sentence_id, $document_id, $run_id.

// Explication complète d'un signalement : règle, item, champs satisfaits, phrases d'evidence, clause, document
MATCH (n:Norm {id: $norm_id})-[m:MATCHES_ITEM]->(i:AnnexItem)-[:PART_OF]->(src:LegalSource)
MATCH (c:Clause)-[:STATES]->(n)
MATCH (d:Document)-[:CONTAINS]->(c)
MATCH (n)-[:HAS_ACTOR]->(p:Party)
OPTIONAL MATCH (n)-[:EVIDENCED_BY]->(s:Sentence)
OPTIONAL MATCH (n)-[:EDITED_BY]->(act:Activity)
RETURN d.name AS document, c.id AS clause,
       {actor: p.role, modality: n.modality, action: n.action, object: n.object, condition: n.condition, notice: n.notice, remedy: n.remedy} AS template,
       m.rule_id AS rule, m.rule_version AS rule_version, i.code AS annex_item, i.text AS annex_text, src.title AS legal_source,
       collect(DISTINCT {id: s.id, index: s.index, text: s.text_detok}) AS evidence,
       collect(DISTINCT {validator: act.actor, at: act.at}) AS validation_trail,
       m.run_id AS run_id
ORDER BY m.rule_id;

// Chemin explicatif lisible (pour le rendu texte) — à partir d'une phrase
MATCH (s:Sentence {id: $sentence_id})<-[:EVIDENCED_BY]-(n:Norm)-[m:MATCHES_ITEM]->(i:AnnexItem)
MATCH (n)-[:HAS_ACTOR]->(p:Party)
RETURN "Sentence " + toString(s.index) + " states that the " + p.role + " " +
       CASE n.modality WHEN "obligation" THEN "must " WHEN "prohibition" THEN "must not " ELSE "may " END + n.action +
       CASE WHEN n.condition IN ["discretion", "none_stated"] THEN " at its discretion" ELSE " for cause" END +
       CASE WHEN n.notice IN ["none", "not_stated"] THEN ", without notice" ELSE ", with notice" END +
       CASE WHEN n.remedy IN ["none", "not_stated"] THEN " and without remedy for the consumer" ELSE "" END +
       " — this matches Annex item (" + i.code + ") of Directive 93/13/EEC (rule " + m.rule_id + " v" + m.rule_version + ")." AS explanation;

// Contrefactuel minimal pour R1 : quel champ changer pour éteindre le signalement (calculé par le moteur ; ici la lecture)
MATCH (n:Norm {id: $norm_id})-[m:MATCHES_ITEM]->(i:AnnexItem)
RETURN i.code AS item,
       CASE i.code WHEN "g" THEN [{field: "notice", from: n.notice, to: "reasonable"}, {field: "condition", from: n.condition, to: "for_cause"}]
                   WHEN "j" THEN [{field: "condition", from: n.condition, to: "specified_reason"}, {field: "remedy", from: n.remedy, to: "right_to_cancel"}]
                   WHEN "l" THEN [{field: "remedy", from: n.remedy, to: "right_to_cancel"}]
                   ELSE [] END AS counterfactual_edits;

// Vues dérivées (raccourcis lisibles, jamais stockés)
MATCH (n:Norm {modality: "obligation"})-[:HAS_ACTOR]->(:Party {role: "user"}) RETURN n.id AS norm, "IMPOSES" AS view;
MATCH (n:Norm)-[:HAS_ACTOR]->(:Party {role: "provider"}) WHERE n.modality IN ["permission", "power"] RETURN n.id AS norm, "GRANTS" AS view;
MATCH (n:Norm {modality: "prohibition"}) RETURN n.id AS norm, "PROHIBITS" AS view;

// Audit : signalements d'un run avec la référence CLAUDETTE (usage ÉVALUATION seulement — jamais dans une règle)
MATCH (n:Norm)-[m:MATCHES_ITEM {run_id: $run_id}]->(i:AnnexItem)
MATCH (n)-[:EVIDENCED_BY]->(s:Sentence)
OPTIONAL MATCH (s)-[l:LABELED]->(cat:Category)
OPTIONAL MATCH (i)-[:MAPS_TO]->(mc:Category)
WITH m.rule_id AS rule, i.code AS item, s, collect(DISTINCT cat.code) AS labels, collect(DISTINCT mc.code) AS mapped
RETURN rule, item, count(DISTINCT s) AS flagged_sentences,
       sum(CASE WHEN any(x IN labels WHERE x IN mapped) THEN 1 ELSE 0 END) AS true_positives
ORDER BY rule;

// Théme seul (baseline B0') : P(catégorie | thème) sur une population — évaluation seulement
MATCH (d:Document {population: "designSet"})-[:CONTAINS]->(s:Sentence)-[:HAS_THEME {role: "primary", source: "consensus"}]->(t:Theme {taxonomy: "T11"})
OPTIONAL MATCH (s)-[:LABELED]->(c:Category)
RETURN t.code AS theme, c.code AS category, count(DISTINCT s) AS n ORDER BY theme, n DESC;

// Similarité de clauses (A4) via MAGE — signature indicative, vérifier la version : CALL node2vec.get_embeddings(...)
// puis distance cosinus sur Clause.embedding_node2vec ; ou CALL node_similarity.jaccard(...) sur les voisinages thématiques.

// Statistiques de structure d'un document (graph-only B4)
MATCH (d:Document {id: $document_id})-[:CONTAINS]->(c:Clause {source: "consensus"})-[:HAS_THEME {role: "primary"}]->(t:Theme {taxonomy: "T11"})
RETURN t.code AS theme, count(c) AS clauses, avg(c.n_sentences) AS mean_len ORDER BY clauses DESC;
