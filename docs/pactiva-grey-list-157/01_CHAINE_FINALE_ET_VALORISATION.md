# Soumission 157 — Chaîne finale des expérimentations et valorisation des résultats

*Rédigé le 15 septembre 2026. Point de départ : G1–G4 passées, G5 passée sur décision du porteur (pilote 100 clauses,
Opus 5 inline × 3 passes + Codex), G6 passée (B0–B2 sur le hold-out), G7 passée sur le pilote (Memgraph réel, parité
Python ↔ Cypher). Ce document décrit ce qui s'enchaîne dès que l'autre session a livré ses propositions v0.2, jusqu'à la
fin des expérimentations, puis la mise en valeur des résultats. Le plan de rédaction est dans `02_PLAN_REDACTION_PAPIER_LONG.md`.*

Principe directeur inchangé : **une seule exécution sur les 17 documents de validation**, avec des règles regelées par
empreinte avant, et aucune décision prise après avoir vu le hold-out (`legal-kg/docs/EXPERIMENTAL_PROTOCOL.md`,
`legal-kg/graph/rules/FROZEN.txt`).

---

## 1. Chaîne finale — étapes, dépendances, livrables

| # | Étape | Dépend de | Décision humaine ? | Outil / commande | Livrable | Durée |
|---|---|---|---|---|---|---|
| F0 | **Décider le schéma et le prompt v0.2** : élargir l'inventaire d'actions (39 % de `other` au pilote), la liste `specified_reason` de l'ancrage (20,6 % de normes signalées), éventuellement `counterparty` | livraison de l'autre session (`635341f`, propositions v0.2) | **oui** (porteur + juristes) | édition de `ontology/legal_kg_schema.yaml`, `llm/prompts/clause_template_extraction.md`, `llm/prompts/PROMPT_REGISTRY.md` | schéma v0.2, prompt v0.2 | 1 j |
| F1 | **Regel** : règles v0.2 (si un champ change), directive, schéma → nouvelles empreintes SHA-256 | F0 | oui (signature du gel) | `sha256sum` → `graph/rules/FROZEN.txt` ; `tests/test_rules_engine.py` (cas dorés à compléter pour tout nouveau code) ; `python -m detection.rules.compile_cypher` | `FROZEN.txt` v0.2, `04_rules_compiled.cypher` | ½ j |
| F2 | **Relecture juriste des 100 templates du pilote** (feuille `results/extraction/inline-opus5-pilot100-20260915/validation/`) puis `validation_sheet.py merge` | F0 (le vocabulaire v0.2 doit être connu des relectrices) | **oui** (F. Z. Boulaich, F. Ouali) | `src/extraction/validation_sheet.py merge` ; accord inter-juristes par champ (κ, Jaccard) sur un sous-échantillon commun ≥ 30 clauses | `step_5_validated.jsonl`, `VALIDATION_REPORT.md` (κ par champ) | 2–3 j de relecture |
| F3 | **Extraction du hold-out** : 1 087 clauses (`data/annotations/holdout/clauses.jsonl`), schéma v0.2, **3 passes** pour la stabilité, backend API si clé disponible, sinon backend inline avec écarts déclarés | F1 | non (mais décision du backend) | `src/extraction/extract_templates.py --clauses …/holdout/clauses.jsonl --repeat 3` ou `inline_backend.py export/replay` | `results/extraction/holdout-<modèle>-<date>/step_*.jsonl`, `STABILITY.json`, `run.json` | ½–1 j |
| F4 | **Validation juriste du hold-out** : toutes les normes des clauses des thèmes porteurs (TER, MOD, LTD, DISPUTES, FEES ≈ 242 clauses fortes) + échantillon aléatoire des autres ; le reste garde le statut `proposed` (ablation « proposé vs validé ») | F3 | **oui** | feuille de validation générée par `validation_sheet.py export` | `step_5_validated.jsonl` hold-out | 3–5 j |
| F5 | **Ingestion L3/L5 + graphe complet** | F4 | non | `python -m graph.ingest_norms --select validated …` ; `src/graph/load_memgraph.py --population holdout` (refuse si règles non gelées) | export L3 hold-out, `PARITY.md` hold-out | 1 h |
| F6 | **E2 — règles gelées sur le hold-out** (statut `validated`, projection `evidence_only`) | F1, F4 | non | `python -m detection.run_rules --population holdout --statuses validated` | `results/rules/holdout-v0.2/matches.jsonl`, `sentence_items.jsonl` | min |
| F7 | **Évaluation E2** contre la référence (module à écrire : `src/evaluation/evaluate_matches.py`) : par requête et par item (P, R, F1 contre la/les catégories mappées, `any` sinon), agrégé micro/macro, **IC bootstrap par document** (1 000), Δ vs thème seul (B0'), vs B1, vs B2 (binaire et par catégorie mappée), ablations (proposé vs validé ; `evidence_only` vs `whole_clause` ; T20 vs T11 ; sans thème), analyse des faux positifs par cause | F6 | non | nouveau script + `results/baselines/B2_lab_bb37a8ce/predictions.jsonl` pour l'appariement phrase à phrase | `results/evaluation/holdout-v0.2/E2.json`, tableaux `.tex` générés | 1 j de dev |
| F8 | **Tests statistiques pré-enregistrés** : permutation appariée par document (requêtes vs B0', vs B2 sur les items structurels), Holm sur les items, non-infériorité 0,05 si applicable (RQ3) | F7 | non | `src/evaluation/stats.py` (à écrire, réutiliser `research/pactiva_lab/evaluation/bootstrap.py`) | `STATS.json` | ½ j |
| F9 | **Audit expert des phrases signalées** : chaque phrase signalée sur le hold-out classée correct / discutable / faux ; pour les faux : erreur de template, de requête, ou d'étiquette de référence absente | F6 | **oui** (2 juristes, double aveugle sur ≥ 50 %) | feuille d'audit générée depuis `matches.jsonl` + sous-graphe témoin (`03_explanation_queries.cypher`) | `AUDIT.csv`, κ inter-juristes, taux par cause | 2–3 j |
| F10 | **Évaluation de l'explication (RQ4)** : sur un échantillon apparié de phrases signalées par les requêtes ET par B2, les juristes jugent si l'explication suffit à décider sans relire le contrat (sous-graphe témoin vs phrase seule / saillance B2) | F9 | **oui** | même feuille, colonne « suffisance », ordre aléatoire | `EXPLANATION_EVAL.json` | inclus dans F9 |
| F11 | **Taxonomie d'erreurs** (plan `docs/ERROR_ANALYSIS.md`) + cas qualitatifs : 3–5 exemples d'explications correctes, 3 faux positifs « défendables » (omissions de la référence), 2 erreurs de template | F9 | non | extraction Cypher des cas | annexe qualitative | ½ j |
| F12 | **Publication des ressources** : requêtes gelées, ontologie directive, schéma, templates validés (sans texte CLAUDETTE : indices de phrases + champs), code, `PARITY`, `FROZEN.txt`, notice de licence | F7–F11 | oui (licence, anonymat des annotatrices) | dépôt public (miroir de `legal-kg/` épuré) + DOI Zenodo | archive versionnée | 1 j |

Chemin critique : F0 → F1 → F3 → F4 → F6 → F7 → F9 → rédaction. Les décisions humaines (F0, F2, F4, F9) sont
le goulot : **les prévoir dès maintenant dans l'agenda des deux juristes** (≈ 8–10 jours de relecture au total).

### Ce qui peut être préparé sans attendre F0
- `src/evaluation/evaluate_matches.py` (F7) et `src/evaluation/stats.py` (F8) : à écrire et à tester **sur le pilote**
  (population `design`, statut `proposed`), avec des tests de non-régression ; ils ne toucheront au hold-out qu'à F7.
- Le générateur de feuille d'audit (F9) et la sortie « sous-graphe témoin » en texte (déjà lisible depuis Memgraph,
  `03_explanation_queries.cypher` § explication).
- Les gabarits LaTeX des tableaux (§ 3) avec génération automatique depuis les JSON (`src/reporting/make_tables.py`).
- Le module de comparaison phrase à phrase avec B2 (`predictions.jsonl` du run `bb37a8ce…`).

---

## 2. Hypothèses à trancher et fallbacks

| Risque | Signal | Repli déclaré |
|---|---|---|
| Pas de clé API pour F3 | — | backend inline ou Codex avec `protocol_deviations` déclarés (déjà fait au pilote) ; le papier le dit |
| Juristes indisponibles pour F4 complet | < 242 clauses validées | valider les thèmes porteurs seulement ; le reste reste `proposed` et devient l'ablation « prix de la validation » |
| Rappel faible des requêtes (< B0' sur certains items) | F7 | c'est un **résultat** (la liste indicative ne couvre pas la catégorie) ; l'analyse par item est prévue pour cela |
| Trop de `other` malgré v0.2 | > 20 % au hold-out | consigner ; n'ajouter aucune règle après coup (gel) |
| Parité Python/Cypher rompue au hold-out | `PARITY.md` NON | l'évaluateur Python fait foi (spécification exécutable) ; corriger le compilateur, pas les règles |
| Divergence de référence (FP défendables nombreux) | F9 | présenter comme constat sur le benchmark, avec le taux et 3 cas |

---

## 3. Valorisation — tableaux, figures, scripts

### 3.1 Tableaux du papier (numérotation cible)

| Tableau | Contenu | Source de données | Générateur | État |
|---|---|---|---|---|
| T1 Grey list ↔ CLAUDETTE ↔ thèmes ↔ expressibilité | 17 items, S/Q/P/— | `ontology/directive_93_13.yaml` | déjà rédigé dans `jurix2026-long-paper/placeholder/main.tex` (`tab:greylist`) | ✅ |
| T2 Abusivité par thème (T20, 50 docs) | n, part abusive, lift | `docs/DATA_PROFILE.md` | déjà rédigé (`tab:themes`) | ✅ |
| T3 Résultats par requête / item sur le hold-out | signalées, P, R, F1 [IC], Δ vs thème seul | F7 `E2.json` | `make_tables.py --table queries` | à produire |
| T4 Coût de l'interprétabilité | B0', B1, B2, requêtes : F1 binaire et par catégorie mappée [IC] | `results/baselines/README.md` + F7 | `make_tables.py --table cost` | B0'–B2 ✅, requêtes à produire |
| T5 Ablations | proposé vs validé ; evidence vs clause ; T20 vs T11 ; sans thème | F7 | `make_tables.py --table ablations` | à produire |
| T6 Audit expert | par requête : correct / discutable / faux ; cause des faux ; κ juristes | F9 `AUDIT.csv` | `make_tables.py --table audit` | à produire |
| T7 (annexe) Stabilité de l'extraction | conformité, Jaccard décisif, κ Fleiss des phrases signalées, Opus vs Codex | `STABILITY.json`, `COMPARE_*.json` | `make_tables.py --table stability` | données ✅ |

### 3.2 Figures

| Figure | Contenu | Source | Outil |
|---|---|---|---|
| Fig. 1 Pipeline en couches | contrat → thèmes validés → templates (LLM + juriste) → requêtes gelées → sous-graphe témoin | `diagrams/*.puml` (layers, pipeline) | PlantUML → PDF |
| Fig. 2 Exemple d'explication | clause réelle du hold-out (texte + template + règle + item), lue depuis Memgraph | `03_explanation_queries.cypher` | TikZ ou figure texte encadrée |
| Fig. 3 Précision/rappel par item avec IC | barres appariées requêtes vs B2 (catégorie mappée) | F7 | matplotlib (`make_figures.py`) |
| Fig. 4 Recouvrement | phrases abusives du hold-out : requêtes ∩ B2 ∩ B1 ; les 65 phrases hors de portée du texte seul | F7 + `ANALYSIS.json` | matplotlib (Venn / UpSet) |
| Fig. 5 (optionnelle) Stabilité | Jaccard des signatures décisives par passe et par modèle | `STABILITY.json` | matplotlib |

Contraintes IOS Press : figures en niveaux de gris lisibles, ≥ 8 pt dans les tableaux, une colonne ; budget total
figures + tableaux ≈ 3 pages sur 10.

### 3.3 Chiffres déjà publiables (hold-out) à reprendre tels quels
- B0' thème seul : F1 binaire 0,391 [0,344 ; 0,441] ; macro-F1 par catégorie 0,219 [0,201 ; 0,239].
- B1 TF-IDF + LR : 0,546 [0,512 ; 0,581] binaire ; 0,447 [0,415 ; 0,480] macro ; Lab 0,529 [0,492 ; 0,572].
- **B2 Legal-BERT : 0,701 [0,650 ; 0,749] binaire, AUC-PR 0,775, κ 0,661, ECE 0,056** ; rappel par catégorie TER 0,89 → A 0,65 ;
  83/101 faux négatifs avec score < 0,1 ; 65 phrases abusives vues par aucun modèle texte.
- Hold-out : 17 documents, 4 078 phrases, 440 abusives (10,8 %), 490 étiquettes, 1 087 clauses ≤ 8 phrases.
- Corpus : 50 ToS, 9 414 phrases, 1 137 étiquettes sur 1 032 phrases (11,0 %), sévérité réimportée sur 95,6 %.
- Couche thématique (short paper) : α-MASI 0,658 (T20) / 0,725 (T11) ; plafond humain κ 0,859 ; Legal-BERT thèmes κ 0,720.

### 3.4 Chiffres de conception (non publiables comme résultats, utilisables comme diagnostics déclarés)
- Pilote 100 clauses : 300/300 conformes, 608 normes (2,03/clause), 10,7 % sans norme, κ Fleiss 0,77 sur les phrases
  signalées, Jaccard décisif 0,80 ; diagnostic P 0,67–0,69 / R 0,46–0,48 sur 52 phrases abusives ; 38 appariements sur
  196 normes validées par le porteur ; parité Cypher 38 = 38.

---

## 4. Calendrier cible (camera-ready 15 octobre si acceptation)

| Semaine | Contenu |
|---|---|
| 16–19 sept. | F0 (décision v0.2), F1 (regel), scripts F7/F8 testés sur le pilote, gabarits de tableaux |
| 22–26 sept. | F2 (relecture pilote), F3 (extraction hold-out), début F4 |
| 29 sept.–3 oct. | fin F4, F5, F6, F7, F8 → premiers tableaux T3–T5 |
| 6–10 oct. | F9, F10, F11 ; rédaction des sections résultats/audit/discussion |
| 13–15 oct. | relecture croisée, figures finales, F12, dépôt |

Notification JURIX attendue avant le camera-ready : si refus, le même matériel alimente ICAIL 2027 (fin janvier),
avec la marge pour B3 et une validation juriste complète du hold-out (`docs/PUBLICATION_STRATEGY.md`).
