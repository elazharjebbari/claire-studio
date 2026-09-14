// Requêtes de détection — exemples compilés depuis graph/rules/grey_list_queries.yaml (v0.1).
// Chaque requête retourne le SOUS-GRAPHE TÉMOIN : norme, clause, phrases d'evidence, item.
// Interdit : toute référence à LABELED / Category (étanchéité, testée). Paramètres : $run_id, $rule_version.
// Sémantique : not_stated ≠ none ; les valeurs proviennent des vocabulaires de legal_kg_schema.yaml.

// R1 — (g) résiliation d'un contrat à durée indéterminée sans préavis raisonnable
MATCH (c:Clause)-[:STATES]->(n:Norm {status: "validated"})-[:HAS_ACTOR]->(:Party {role: "provider"})
WHERE n.modality IN ["permission", "power"]
  AND n.action IN ["terminate", "suspend"]
  AND n.condition IN ["discretion", "none_stated"]
  AND n.notice IN ["none", "not_stated"]
  AND NOT EXISTS { MATCH (n)-[:EXCEPTION_TO|CONDITIONAL_ON]->(:Norm {condition: "for_cause"}) }
MATCH (n)-[:EVIDENCED_BY]->(s:Sentence)
MATCH (i:AnnexItem {code: "g"})
MERGE (n)-[m:MATCHES_ITEM {rule_id: "Q-g", rule_version: $rule_version, run_id: $run_id}]->(i)
SET m.evidence_ids = collect(DISTINCT s.id)
RETURN c.id AS clause, n.id AS norm, collect(DISTINCT s.id) AS evidence, "g" AS item;

// R1 — (j) modification unilatérale des clauses sans raison valable spécifiée
MATCH (c:Clause)-[:STATES]->(n:Norm {status: "validated", action: "modify_terms"})-[:HAS_ACTOR]->(:Party {role: "provider"})
WHERE n.modality IN ["permission", "power"] AND n.condition IN ["discretion", "none_stated"]
MATCH (n)-[:EVIDENCED_BY]->(s:Sentence)
MATCH (i:AnnexItem {code: "j"})
MERGE (n)-[m:MATCHES_ITEM {rule_id: "Q-j", rule_version: $rule_version, run_id: $run_id}]->(i)
SET m.evidence_ids = collect(DISTINCT s.id)
RETURN c.id AS clause, n.id AS norm, collect(DISTINCT s.id) AS evidence, "j" AS item;

// R1 — (j') variante stricte : ni raison, ni droit de résiliation (exception §2 « durée indéterminée » non satisfaite)
MATCH (c:Clause)-[:STATES]->(n:Norm {status: "validated", action: "modify_terms"})-[:HAS_ACTOR]->(:Party {role: "provider"})
WHERE n.modality IN ["permission", "power"] AND n.condition IN ["discretion", "none_stated"]
  AND n.remedy IN ["none", "not_stated"] AND n.notice IN ["none", "not_stated"]
MATCH (n)-[:EVIDENCED_BY]->(s:Sentence)
MATCH (i:AnnexItem {code: "j"})
MERGE (n)-[m:MATCHES_ITEM {rule_id: "Q-j-strict", rule_version: $rule_version, run_id: $run_id}]->(i)
SET m.evidence_ids = collect(DISTINCT s.id)
RETURN c.id AS clause, n.id AS norm, collect(DISTINCT s.id) AS evidence, "j" AS item;

// R1 — (a)/(b) exclusion ou plafonnement de responsabilité incluant dommage corporel / faute lourde, ou sans réserve
MATCH (c:Clause)-[:STATES]->(n:Norm {status: "validated"})-[:HAS_ACTOR]->(:Party {role: "provider"})
WHERE n.action IN ["exclude_liability", "cap_liability", "exclude_remedy"]
  AND (n.object CONTAINS "personal_injury" OR n.object CONTAINS "gross_negligence" OR n.object CONTAINS "unbounded")
MATCH (n)-[:EVIDENCED_BY]->(s:Sentence)
MATCH (i:AnnexItem {code: CASE WHEN n.object CONTAINS "personal_injury" THEN "a" ELSE "b" END})
MERGE (n)-[m:MATCHES_ITEM {rule_id: "Q-ab", rule_version: $rule_version, run_id: $run_id}]->(i)
SET m.evidence_ids = collect(DISTINCT s.id)
RETURN c.id AS clause, n.id AS norm, collect(DISTINCT s.id) AS evidence, i.code AS item;

// R1 — (q) entrave au recours : arbitrage imposé, renonciation à l'action collective, preuve
MATCH (c:Clause)-[:STATES]->(n:Norm {status: "validated"})
WHERE n.action IN ["impose_arbitration", "waive_class_action", "restrict_evidence", "shift_burden_of_proof", "waive_jury"]
  AND ((n.modality = "obligation" AND EXISTS { MATCH (n)-[:HAS_ACTOR]->(:Party {role: "user"}) })
       OR (n.modality = "prohibition" AND EXISTS { MATCH (n)-[:HAS_ACTOR]->(:Party {role: "user"}) })
       OR (n.modality = "power" AND EXISTS { MATCH (n)-[:HAS_ACTOR]->(:Party {role: "provider"}) }))
MATCH (n)-[:EVIDENCED_BY]->(s:Sentence)
MATCH (i:AnnexItem {code: "q"})
MERGE (n)-[m:MATCHES_ITEM {rule_id: "Q-q", rule_version: $rule_version, run_id: $run_id}]->(i)
SET m.evidence_ids = collect(DISTINCT s.id)
RETURN c.id AS clause, n.id AS norm, collect(DISTINCT s.id) AS evidence, "q" AS item;

// R2 — absence : clause de modification sans aucune norme de notification (schéma de clause attendu)
MATCH (c:Clause)-[:HAS_THEME {role: "primary", source: "consensus"}]->(:Theme {code: "MODIFICATION_OF_TERMS", taxonomy: "T11"})
WHERE EXISTS { MATCH (c)-[:STATES]->(:Norm {status: "validated", action: "modify_terms"}) }
  AND NOT EXISTS { MATCH (c)-[:STATES]->(:Norm {status: "validated", action: "notify_change"}) }
  AND NOT EXISTS { MATCH (c)-[:STATES]->(n2:Norm {status: "validated", action: "modify_terms"}) WHERE n2.notice IN ["duration", "reasonable"] }
MATCH (c)-[:STATES]->(n:Norm {action: "modify_terms"})-[:EVIDENCED_BY]->(s:Sentence)
MATCH (i:AnnexItem {code: "j"})
MERGE (n)-[m:MATCHES_ITEM {rule_id: "Q-j-absence", rule_version: $rule_version, run_id: $run_id}]->(i)
SET m.evidence_ids = collect(DISTINCT s.id)
RETURN c.id AS clause, n.id AS norm, collect(DISTINCT s.id) AS evidence, "j" AS item;

// R3 — asymétrie (f) : droit de résiliation discrétionnaire du fournisseur sans droit symétrique du consommateur dans le document
MATCH (d:Document)-[:CONTAINS]->(c:Clause)-[:STATES]->(n:Norm {status: "validated"})-[:HAS_ACTOR]->(:Party {role: "provider"})
WHERE n.modality IN ["permission", "power"] AND n.action IN ["terminate", "suspend"] AND n.condition IN ["discretion", "none_stated"]
  AND NOT EXISTS {
    MATCH (d)-[:CONTAINS]->(:Clause)-[:STATES]->(u:Norm {status: "validated", action: "terminate"})-[:HAS_ACTOR]->(:Party {role: "user"})
    WHERE u.modality IN ["permission", "power"]
  }
MATCH (n)-[:EVIDENCED_BY]->(s:Sentence)
MATCH (i:AnnexItem {code: "f"})
MERGE (n)-[m:MATCHES_ITEM {rule_id: "Q-f-asymmetry", rule_version: $rule_version, run_id: $run_id}]->(i)
SET m.evidence_ids = collect(DISTINCT s.id)
RETURN d.id AS document, c.id AS clause, n.id AS norm, collect(DISTINCT s.id) AS evidence, "f" AS item;

// R3 — composition : exclusion de responsabilité + exclusion de garantie + indemnisation à la charge de l'utilisateur (même document)
MATCH (d:Document)-[:CONTAINS]->(c1:Clause)-[:STATES]->(n1:Norm {status: "validated", action: "exclude_liability"}),
      (d)-[:CONTAINS]->(c2:Clause)-[:STATES]->(n2:Norm {status: "validated", action: "exclude_warranty"}),
      (d)-[:CONTAINS]->(c3:Clause)-[:STATES]->(n3:Norm {status: "validated", action: "indemnify", modality: "obligation"})-[:HAS_ACTOR]->(:Party {role: "user"})
RETURN d.id AS document, [c1.id, c2.id, c3.id] AS clauses, [n1.id, n2.id, n3.id] AS norms, "b" AS item, "R3-exculpation-triangle" AS rule_id;
// (composition évaluée qualitativement : pas de MERGE MATCHES_ITEM tant que la règle n'est pas gelée)

// R4 — incohérence : permission et interdiction du même acte pour le même acteur dans le même document
MATCH (d:Document)-[:CONTAINS]->(:Clause)-[:STATES]->(p:Norm {status: "validated", modality: "permission"})-[:HAS_ACTOR]->(a:Party),
      (d)-[:CONTAINS]->(:Clause)-[:STATES]->(q:Norm {status: "validated", modality: "prohibition"})-[:HAS_ACTOR]->(a)
WHERE p.action = q.action
MERGE (p)-[x:CONTRADICTS {run_id: $run_id}]->(q)
RETURN d.id AS document, p.id AS permission, q.id AS prohibition, p.action AS action;
