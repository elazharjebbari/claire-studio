# Fiche de transfert — E2 hold-out (passe 0) pour le papier 157

Rédigée le 15 sept. 2026 (midi) par la session « E2 grey list » à l'intention de la session de rédaction.
Commit des résultats : `0fb08e4`.

## Chemins

- Rapport E2 : `legal-kg/results/evaluation/holdout-v02-pass0/E2.md` (+ `E2.json`, `sentences_eval.jsonl`)
- Tests pré-enregistrés (Holm, permutations par document, non-infériorité) : `legal-kg/results/evaluation/holdout-v02-pass0/STATS.md` (+ `STATS.json`)
- Analyse des désaccords (FP stables, typologie des FN N0–N3) : `legal-kg/results/evaluation/holdout-v02-disagreement/DISAGREEMENT.md`
- Tableaux LaTeX : `jurix2026-long-paper/placeholder/tables/T3_queries.tex` (`tab:queries`), `T4_cost.tex` (`tab:cost`)
- Extraction : `legal-kg/results/extraction/inline-opus5-holdout-v02-20260915/` (`run.json`, `MANIFEST.json`, `AGENTS.json`)
- Appariements des règles : `legal-kg/results/rules/holdout-v02-pass0/` (`matches.jsonl`, `SUMMARY.json`)

## Protocole (à écrire tel quel)

- Requêtes v0.2 gelées (`graph/rules/FROZEN.txt`, SHA-256 `c3303e67…`, schéma `3682acf6…`) **avant** toute exécution sur le hold-out.
- Hold-out : 17 documents, 4 078 phrases, 440 phrases abusives, 1 087 clauses (≤ 8 phrases).
- **Une seule passe d'extraction** sur le hold-out (44 lots de 25 clauses, sous-agents `claude-opus-5` à contexte vierge) : 2 809 normes, 0 erreur de schéma, 105 clauses sans norme (9,7 %). La passe 1 (stabilité) n'est pas finie : ne pas annoncer d'estimation de stabilité hold-out ; la stabilité rapportée est celle du pilote (κ de Fleiss 0,86 sur 100 clauses × 3 passes).
- Normes évaluées en statut `proposed` (pas de validation juriste : limitation déclarée).
- Projection evidence-only ; IC bootstrap par document (2 000 rééchantillonnages) ; permutations appariées par document ; Holm sur 9 items ; non-infériorité δ = 0,05.

## Chiffres clés

Binaire (toute étiquette, 440 positives) :

| Système | P | R | F1 [IC 95 %] | signalées |
|---|---|---|---|---|
| Union des règles | 0,407 | 0,330 | **0,364 [0,316 ; 0,420]** | 356 |
| Thème seul (LODO) | — | — | 0,439 | — |
| B1 TF-IDF (Lab) | 0,454 | 0,634 | 0,529 [0,493 ; 0,571] | 614 |
| B2 Legal-BERT (Lab) | 0,643 | 0,771 | **0,701 [0,650 ; 0,751]** | 527 |

ΔF1 règles − thème seul = −0,075 (p 0,033). Non-infériorité rejetée face aux trois comparateurs (vs B2 : IC [−0,40 ; −0,28]).
Recouvrement règles/B2 sur les 440 : 123 communes, 22 règles seules, 216 B2 seul, 79 aucune.

Par item (population, IC bootstrap par document) :

| Item | Réf. | n_pos | signalées | P | R | F1 [IC] | ΔF1 vs thème | verdict Holm |
|---|---|---|---|---|---|---|---|---|
| a | LTD | 132 | 4 | 0,50 | 0,015 | 0,029 [0,00 ; 0,08] | −0,409 | pire |
| b | LTD | 132 | 19 | 0,79 | 0,114 | 0,199 [0,08 ; 0,31] | −0,240 | pire |
| f | TER,CR | 140 | 12 | 0,83 | 0,071 | 0,132 [0,03 ; 0,26] | −0,205 | pire |
| g | TER | 102 | 40 | 0,68 | 0,265 | 0,380 [0,27 ; 0,49] | +0,016 | ns |
| i | USE | 44 | 37 | 0,43 | 0,364 | 0,395 [0,31 ; 0,46] | **+0,213** | **mieux** (p 0,009) |
| j | CH | 88 | 42 | 0,62 | 0,295 | 0,400 [0,32 ; 0,50] | +0,002 | ns |
| k | CH | 88 | 22 | 0,50 | 0,125 | 0,200 [0,08 ; 0,34] | −0,198 | pire |
| l | CH | 88 | 18 | 0,61 | 0,125 | 0,208 [0,13 ; 0,29] | −0,191 | pire |
| q | A,J | 45 | 103 | 0,17 | 0,378 | 0,230 [0,15 ; 0,32] | +0,052 | ns |

Items structurels (8) : micro P 0,458 / R 0,146 / F1 0,221 ; macro-F1 0,222 ; Δ macro vs thème seul −0,147.
Couverture = 1,0 pour tous les items : aucun FN dans une clause sans norme ; la perte de rappel vient des champs des normes, pas d'une extraction manquante.

Items sans catégorie CLAUDETTE (audit seulement, non évaluables) : m 39 phrases (0 avec une étiquette quelconque, 15 documents), d 21 (7), p 17 (1), e 0, h 0.

## Lecture qualitative (Results C / Discussion)

- **a/b** : 42 FN bloqués par l'objet : l'item (a) exige `personal_injury`/`death`/`gross_negligence`, la catégorie LTD est bien plus large (dommages indirects, disponibilité). Les 19 signalements de (b) sont précis (P 0,79).
- **f/g** : FN typiques = `condition = for_cause` ou `actor = user` (résiliations motivées ou bilatérales que CLAUDETTE étiquette quand même TER).
- **j/k/l** : FN majoritairement « action ≠ modify_terms/change_price » (CH couvre des changements de service, pas seulement des conditions) ; 14 FP de (j) dans des clauses dont la notification est ailleurs dans le document.
- **q** : 86 FP presque tous dans DISPUTES_LAW : `provider power choose_forum` (choix de juridiction non étiqueté J par CLAUDETTE, qui vise l'arbitrage / le for étranger imposé) ; P 0,17.
- **i** : seul gain significatif ; la règle élargie (`deem_acceptance_by_use`) capte USE que le thème seul n'atteint pas, au prix de 21 FP.
- Message général : précision correcte là où l'item est étroit (g, j, b, f : 0,62–0,83), rappel faible partout ; le graphe explique chaque signalement (sous-graphe d'evidence), pas de non-infériorité au modèle texte-seul.

## Formulations à éviter

- Pas de « validated by legal experts » ; pas d'estimation de stabilité sur le hold-out ; ne pas dire que les règles battent B2 ou B1 ; ne pas citer « Codex » ou « Claude Code » comme modèle (modèle = `claude-opus-5`, harnais = Claude Code).
