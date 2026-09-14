// Généré par src/detection/rules/compile_cypher.py depuis /Users/elazhar/PycharmProjects/claire-studio/legal-kg/graph/rules/grey_list_queries.yaml
// version 0.1 · sha256 8f2967dbbcc4911150393e92b1c1cc928de491d8115bc4b1024c1e16c2216f34 · gelée : True
// Paramètres : $run_id, $status ('validated' | 'proposed'). Étanchéité : aucune référence à la couche de référence.

// Q-g — item g — R1 — Provider may terminate/suspend at its discretion without (reasonable) notice
MATCH (d:Document)-[:CONTAINS]->(c:Clause)-[:STATES]->(n:Norm {status: $status})
WHERE EXISTS { MATCH (n)-[:HAS_ACTOR]->(:Party {role: "provider"}) } AND n.modality IN ["permission", "power"] AND n.action IN ["terminate", "suspend"] AND n.condition IN ["discretion", "none_stated"] AND n.notice IN ["none", "not_stated"] AND NOT EXISTS { MATCH (n)-[:EXCEPTION_TO|CONDITIONAL_ON]->(x:Norm) WHERE x.condition = "for_cause" }
MATCH (n)-[:EVIDENCED_BY]->(s:Sentence)
WITH d, c, n, collect(DISTINCT s.id) AS evidence, "g" AS item_code
MATCH (i:AnnexItem {code: item_code})
MERGE (n)-[m:MATCHES_ITEM {rule_id: "Q-g", rule_version: "0.1", run_id: $run_id}]->(i)
SET m.evidence_ids = evidence
RETURN d.id AS document, c.id AS clause, n.id AS norm, evidence, item_code AS item;

// Q-f-asymmetry — item f — R3 — Discretionary termination right of the provider with no symmetric termination right of the user in the document
MATCH (d:Document)-[:CONTAINS]->(c:Clause)-[:STATES]->(n:Norm {status: $status})
WHERE EXISTS { MATCH (n)-[:HAS_ACTOR]->(:Party {role: "provider"}) } AND n.modality IN ["permission", "power"] AND n.action IN ["terminate", "suspend"] AND n.condition IN ["discretion", "none_stated"] AND NOT EXISTS { MATCH (d)-[:CONTAINS]->(:Clause)-[:STATES]->(u:Norm {status: n.status}) WHERE u.id <> n.id AND EXISTS { MATCH (u)-[:HAS_ACTOR]->(:Party {role: "user"}) } AND u.modality IN ["permission", "power"] AND u.action IN ["terminate"] }
MATCH (n)-[:EVIDENCED_BY]->(s:Sentence)
WITH d, c, n, collect(DISTINCT s.id) AS evidence, "f" AS item_code
MATCH (i:AnnexItem {code: item_code})
MERGE (n)-[m:MATCHES_ITEM {rule_id: "Q-f-asymmetry", rule_version: "0.1", run_id: $run_id}]->(i)
SET m.evidence_ids = evidence
RETURN d.id AS document, c.id AS clause, n.id AS norm, evidence, item_code AS item;

// Q-j — item j — R1 — Provider may modify terms unilaterally with no valid reason specified
MATCH (d:Document)-[:CONTAINS]->(c:Clause)-[:STATES]->(n:Norm {status: $status})
WHERE EXISTS { MATCH (n)-[:HAS_ACTOR]->(:Party {role: "provider"}) } AND n.modality IN ["permission", "power"] AND n.action IN ["modify_terms"] AND n.condition IN ["discretion", "none_stated"]
MATCH (n)-[:EVIDENCED_BY]->(s:Sentence)
WITH d, c, n, collect(DISTINCT s.id) AS evidence, "j" AS item_code
MATCH (i:AnnexItem {code: item_code})
MERGE (n)-[m:MATCHES_ITEM {rule_id: "Q-j", rule_version: "0.1", run_id: $run_id}]->(i)
SET m.evidence_ids = evidence
RETURN d.id AS document, c.id AS clause, n.id AS norm, evidence, item_code AS item;

// Q-j-strict — item j — R1 — As Q-j and no notice and no right to cancel (Annex §2 indeterminate-duration exception not satisfied)
MATCH (d:Document)-[:CONTAINS]->(c:Clause)-[:STATES]->(n:Norm {status: $status})
WHERE EXISTS { MATCH (n)-[:HAS_ACTOR]->(:Party {role: "provider"}) } AND n.modality IN ["permission", "power"] AND n.action IN ["modify_terms"] AND n.condition IN ["discretion", "none_stated"] AND n.notice IN ["none", "not_stated"] AND n.remedy IN ["none", "not_stated"]
MATCH (n)-[:EVIDENCED_BY]->(s:Sentence)
WITH d, c, n, collect(DISTINCT s.id) AS evidence, "j" AS item_code
MATCH (i:AnnexItem {code: item_code})
MERGE (n)-[m:MATCHES_ITEM {rule_id: "Q-j-strict", rule_version: "0.1", run_id: $run_id}]->(i)
SET m.evidence_ids = evidence
RETURN d.id AS document, c.id AS clause, n.id AS norm, evidence, item_code AS item;

// Q-j-absence — item j — R2 — Modification clause with no notification norm and no notice
MATCH (d:Document)-[:CONTAINS]->(c:Clause)-[:STATES]->(n:Norm {status: $status})
WHERE n.action = "modify_terms" AND EXISTS { MATCH (c)-[:HAS_THEME {role: 'primary', source: 'consensus'}]->(:Theme {code: "MODIFICATION_OF_TERMS", taxonomy: 'T11'}) } AND NOT EXISTS { MATCH (c)-[:STATES]->(h:Norm {status: n.status}) WHERE h.action = "notify_change" } AND NOT EXISTS { MATCH (c)-[:STATES]->(h:Norm {status: n.status}) WHERE h.action = "modify_terms" AND h.notice IN ["duration", "reasonable"] }
MATCH (n)-[:EVIDENCED_BY]->(s:Sentence)
WITH d, c, n, collect(DISTINCT s.id) AS evidence, "j" AS item_code
MATCH (i:AnnexItem {code: item_code})
MERGE (n)-[m:MATCHES_ITEM {rule_id: "Q-j-absence", rule_version: "0.1", run_id: $run_id}]->(i)
SET m.evidence_ids = evidence
RETURN d.id AS document, c.id AS clause, n.id AS norm, evidence, item_code AS item;

// Q-k — item k — R1 — Provider may alter service characteristics unilaterally without valid reason
MATCH (d:Document)-[:CONTAINS]->(c:Clause)-[:STATES]->(n:Norm {status: $status})
WHERE EXISTS { MATCH (n)-[:HAS_ACTOR]->(:Party {role: "provider"}) } AND n.modality IN ["permission", "power"] AND n.action IN ["modify_service"] AND n.condition IN ["discretion", "none_stated"]
MATCH (n)-[:EVIDENCED_BY]->(s:Sentence)
WITH d, c, n, collect(DISTINCT s.id) AS evidence, "k" AS item_code
MATCH (i:AnnexItem {code: item_code})
MERGE (n)-[m:MATCHES_ITEM {rule_id: "Q-k", rule_version: "0.1", run_id: $run_id}]->(i)
SET m.evidence_ids = evidence
RETURN d.id AS document, c.id AS clause, n.id AS norm, evidence, item_code AS item;

// Q-l — item l — R1 — Provider may change price without a right to cancel
MATCH (d:Document)-[:CONTAINS]->(c:Clause)-[:STATES]->(n:Norm {status: $status})
WHERE EXISTS { MATCH (n)-[:HAS_ACTOR]->(:Party {role: "provider"}) } AND n.modality IN ["permission", "power"] AND n.action IN ["change_price"] AND n.remedy IN ["none", "not_stated"] AND NOT (n.object CONTAINS "indexation" OR n.object CONTAINS "index")
MATCH (n)-[:EVIDENCED_BY]->(s:Sentence)
WITH d, c, n, collect(DISTINCT s.id) AS evidence, "l" AS item_code
MATCH (i:AnnexItem {code: item_code})
MERGE (n)-[m:MATCHES_ITEM {rule_id: "Q-l", rule_version: "0.1", run_id: $run_id}]->(i)
SET m.evidence_ids = evidence
RETURN d.id AS document, c.id AS clause, n.id AS norm, evidence, item_code AS item;

// Q-ab — item ['a', 'b'] — R1 — Exclusion/cap of liability covering personal injury or gross negligence, or unbounded
MATCH (d:Document)-[:CONTAINS]->(c:Clause)-[:STATES]->(n:Norm {status: $status})
WHERE EXISTS { MATCH (n)-[:HAS_ACTOR]->(:Party {role: "provider"}) } AND n.action IN ["exclude_liability", "cap_liability", "exclude_remedy"] AND (n.object CONTAINS "personal_injury" OR n.object CONTAINS "death" OR n.object CONTAINS "gross_negligence" OR n.object CONTAINS "unbounded")
MATCH (n)-[:EVIDENCED_BY]->(s:Sentence)
WITH d, c, n, collect(DISTINCT s.id) AS evidence, CASE WHEN n.object CONTAINS "personal_injury" THEN "a" WHEN n.object CONTAINS "death" THEN "a" ELSE "b" END AS item_code
MATCH (i:AnnexItem {code: item_code})
MERGE (n)-[m:MATCHES_ITEM {rule_id: "Q-ab", rule_version: "0.1", run_id: $run_id}]->(i)
SET m.evidence_ids = evidence
RETURN d.id AS document, c.id AS clause, n.id AS norm, evidence, item_code AS item;

// Q-q — item q — R1 — Mandatory arbitration, class-action waiver, evidence restriction or burden shift imposed on the user
MATCH (d:Document)-[:CONTAINS]->(c:Clause)-[:STATES]->(n:Norm {status: $status})
WHERE ((EXISTS { MATCH (n)-[:HAS_ACTOR]->(:Party {role: "user"}) } AND n.modality IN ["obligation", "prohibition"] AND n.action IN ["impose_arbitration", "waive_class_action", "restrict_evidence", "shift_burden_of_proof", "waive_jury"]) OR (EXISTS { MATCH (n)-[:HAS_ACTOR]->(:Party {role: "provider"}) } AND n.modality IN ["power"] AND n.action IN ["impose_arbitration", "choose_forum"]))
MATCH (n)-[:EVIDENCED_BY]->(s:Sentence)
WITH d, c, n, collect(DISTINCT s.id) AS evidence, "q" AS item_code
MATCH (i:AnnexItem {code: item_code})
MERGE (n)-[m:MATCHES_ITEM {rule_id: "Q-q", rule_version: "0.1", run_id: $run_id}]->(i)
SET m.evidence_ids = evidence
RETURN d.id AS document, c.id AS clause, n.id AS norm, evidence, item_code AS item;

// Q-i — item i — R1 — Binding the user by mere use / by reference to terms not shown (procedural proxy)
MATCH (d:Document)-[:CONTAINS]->(c:Clause)-[:STATES]->(n:Norm {status: $status})
WHERE EXISTS { MATCH (n)-[:HAS_ACTOR]->(:Party {role: "provider"}) } AND n.modality IN ["power"] AND n.action IN ["bind_by_use", "incorporate_by_reference"]
MATCH (n)-[:EVIDENCED_BY]->(s:Sentence)
WITH d, c, n, collect(DISTINCT s.id) AS evidence, "i" AS item_code
MATCH (i:AnnexItem {code: item_code})
MERGE (n)-[m:MATCHES_ITEM {rule_id: "Q-i", rule_version: "0.1", run_id: $run_id}]->(i)
SET m.evidence_ids = evidence
RETURN d.id AS document, c.id AS clause, n.id AS norm, evidence, item_code AS item;

// Q-m — item m — R1 — Provider is sole judge of conformity or exclusive interpreter of the terms
MATCH (d:Document)-[:CONTAINS]->(c:Clause)-[:STATES]->(n:Norm {status: $status})
WHERE EXISTS { MATCH (n)-[:HAS_ACTOR]->(:Party {role: "provider"}) } AND n.modality IN ["power"] AND n.action IN ["determine_conformity", "interpret_terms"]
MATCH (n)-[:EVIDENCED_BY]->(s:Sentence)
WITH d, c, n, collect(DISTINCT s.id) AS evidence, "m" AS item_code
MATCH (i:AnnexItem {code: item_code})
MERGE (n)-[m:MATCHES_ITEM {rule_id: "Q-m", rule_version: "0.1", run_id: $run_id}]->(i)
SET m.evidence_ids = evidence
RETURN d.id AS document, c.id AS clause, n.id AS norm, evidence, item_code AS item;

// Q-p — item p — R1 — Assignment of the contract by the provider without the user's consent
MATCH (d:Document)-[:CONTAINS]->(c:Clause)-[:STATES]->(n:Norm {status: $status})
WHERE EXISTS { MATCH (n)-[:HAS_ACTOR]->(:Party {role: "provider"}) } AND n.modality IN ["permission", "power"] AND n.action IN ["assign_contract"] AND n.remedy IN ["none", "not_stated"]
MATCH (n)-[:EVIDENCED_BY]->(s:Sentence)
WITH d, c, n, collect(DISTINCT s.id) AS evidence, "p" AS item_code
MATCH (i:AnnexItem {code: item_code})
MERGE (n)-[m:MATCHES_ITEM {rule_id: "Q-p", rule_version: "0.1", run_id: $run_id}]->(i)
SET m.evidence_ids = evidence
RETURN d.id AS document, c.id AS clause, n.id AS norm, evidence, item_code AS item;

// Q-d — item d — R1 — Provider may retain sums paid when the user withdraws, without reciprocity
MATCH (d:Document)-[:CONTAINS]->(c:Clause)-[:STATES]->(n:Norm {status: $status})
WHERE EXISTS { MATCH (n)-[:HAS_ACTOR]->(:Party {role: "provider"}) } AND n.modality IN ["permission"] AND n.action IN ["retain_payment"] AND NOT EXISTS { MATCH (d)-[:CONTAINS]->(:Clause)-[:STATES]->(u:Norm {status: n.status}) WHERE u.id <> n.id AND EXISTS { MATCH (u)-[:HAS_ACTOR]->(:Party {role: "user"}) } AND u.modality IN ["permission"] AND u.action IN ["compensation"] }
MATCH (n)-[:EVIDENCED_BY]->(s:Sentence)
WITH d, c, n, collect(DISTINCT s.id) AS evidence, "d" AS item_code
MATCH (i:AnnexItem {code: item_code})
MERGE (n)-[m:MATCHES_ITEM {rule_id: "Q-d", rule_version: "0.1", run_id: $run_id}]->(i)
SET m.evidence_ids = evidence
RETURN d.id AS document, c.id AS clause, n.id AS norm, evidence, item_code AS item;

// Q-e — item e — R1 — Disproportionate compensation owed by the user (declared threshold)
MATCH (d:Document)-[:CONTAINS]->(c:Clause)-[:STATES]->(n:Norm {status: $status})
WHERE EXISTS { MATCH (n)-[:HAS_ACTOR]->(:Party {role: "user"}) } AND n.modality IN ["obligation"] AND n.action IN ["pay_compensation"] AND n.amount_ratio IS NOT NULL AND n.amount_ratio >= 2.0
MATCH (n)-[:EVIDENCED_BY]->(s:Sentence)
WITH d, c, n, collect(DISTINCT s.id) AS evidence, "e" AS item_code
MATCH (i:AnnexItem {code: item_code})
MERGE (n)-[m:MATCHES_ITEM {rule_id: "Q-e", rule_version: "0.1", run_id: $run_id}]->(i)
SET m.evidence_ids = evidence
RETURN d.id AS document, c.id AS clause, n.id AS norm, evidence, item_code AS item;

// Q-h — item h — R1 — Automatic renewal with unreasonably early opt-out deadline (declared threshold)
MATCH (d:Document)-[:CONTAINS]->(c:Clause)-[:STATES]->(n:Norm {status: $status})
WHERE EXISTS { MATCH (n)-[:HAS_ACTOR]->(:Party {role: "provider"}) } AND n.modality IN ["power"] AND n.action IN ["auto_renew"] AND n.opt_out_deadline_days IS NOT NULL AND n.opt_out_deadline_days >= 30
MATCH (n)-[:EVIDENCED_BY]->(s:Sentence)
WITH d, c, n, collect(DISTINCT s.id) AS evidence, "h" AS item_code
MATCH (i:AnnexItem {code: item_code})
MERGE (n)-[m:MATCHES_ITEM {rule_id: "Q-h", rule_version: "0.1", run_id: $run_id}]->(i)
SET m.evidence_ids = evidence
RETURN d.id AS document, c.id AS clause, n.id AS norm, evidence, item_code AS item;
