# EVALUATION_PLAN — métriques du graphe, de la détection, de l'explication

> Trois objets à évaluer, trois jeux de métriques, une même discipline : IC par document, définitions
> figées avant les runs, scripts versionnés (`src/evaluation/`).

---

## 1. Évaluer le knowledge graph (RQ0, RQ4)

Référence : templates **validés** par juristes (hold-out complet ; échantillon de conception).
Comparaison : propositions brutes du modèle M.

| Métrique | Définition | Cible (H1 de RQ4) |
|---|---|---|
| **Schema compliance** | part des sorties valides contre le JSON Schema (avant correction) | ≥ 0,98 (structurel) |
| **Entity precision / recall** | `Norm` proposées correctes (même acteur, modalité, action) / proposées ; correctes / attendues | P ≥ 0,85 ; R ≥ 0,80 |
| **Relation precision / recall** | par champ relationnel (`HAS_ACTOR`, `HAS_ACTION`, `CONDITIONAL_ON`, `EVIDENCED_BY`) | P ≥ 0,75 |
| **Field accuracy** | exactitude par champ fermé (modality, condition, notice, remedy) | rapportée par champ |
| **Graph completeness** | part des clauses (thèmes cibles) avec ≥ 1 `Norm` validée ; part des champs `not_stated` | rapportée |
| **Graph consistency** | violations des contraintes d'ontologie (acteur manquant, double modalité, remedy sur prohibition, action hors inventaire) / total | 0 après étape 3 |
| **Hallucinated nodes / relations** | `Norm` ou champ non-null sans span d'evidence ; evidence hors de la clause | ≤ 0,05 |
| **Anchoring score** | part des champs non-null dont l'evidence contient un déclencheur lexical attendu (vérificateur) | rapporté |
| **Reproducibility** | identité exacte des sorties sur 3 exécutions (T=0) ; κ inter-exécutions par champ | ≥ 0,95 |
| **Coût / latence** | $ par 1 000 clauses ; s par clause ; tokens | rapportés |
| **Inter-validator agreement** | κ par champ entre deux juristes (échantillon double) | ≥ 0,67 |

## 2. Évaluer la détection (RQ1, RQ2, RQ5)

Référence : labels CLAUDETTE par phrase (8 catégories, multi-label). Déséquilibre : 3,9 % (A) à
26 % (LTD) des labels ; 11 % des phrases sont abusives.

| Métrique | Usage |
|---|---|
| **Precision / Recall / F1 par catégorie** | règles (décision binaire) et classifieurs (au seuil fixé sur train) |
| **Macro-F1** (métrique principale), micro-F1 | comparaisons appariées |
| **PR-AUC** par catégorie | classifieurs et scores (préférée à ROC-AUC vu le déséquilibre) |
| **κ de Cohen** | lien avec les mesures humaines et juges (short paper) |
| **Matrices de confusion** par méthode ; confusion catégorie × catégorie | analyse d'erreurs |
| **Couverture** | part des labels de référence situés dans une clause typée par un thème cible (borne supérieure du rappel des règles) |
| **Precision@k / lift** | pour les scores d'anomalie (A5) et de similarité (A4) |
| **Règle de projection** | evidence-only (principale) ; clause entière (annexe) |

Règles : seuils des classifieurs fixés sur les plis d'entraînement ; jamais d'optimisation de seuil sur
le test ; IC bootstrap par document ; petits effectifs affichés (n labels) dans chaque tableau.

## 3. Évaluer l'explicabilité (RQ3)

Une explication = **sous-graphe témoin** : la règle (id, version, item), les champs satisfaits, les
phrases d'evidence, et pour R3 les clauses co-impliquées. Elle est **observable** ; on n'évalue jamais
un « raisonnement » de LLM.

| Dimension | Mesure | Méthode |
|---|---|---|
| **Fidélité** | le signalement disparaît-il quand on retire l'evidence ? | test de suppression : masquer les phrases d'evidence → re-exécuter → taux de disparition (attendu 100 % pour les règles ; mesuré pour A7/A8 par ablation de features) |
| **Suffisance** | l'explication suffit-elle à un juriste pour trancher sans relire le contrat ? | étude humaine : 2 juristes, 200 signalements stratifiés (règle × TP/FP), échelle {suffisante, partielle, insuffisante} ; κ inter-juges |
| **Exactitude** | l'explication cite-t-elle le bon item et les bons éléments ? | juristes : {exacte, partiellement, erronée} |
| **Stabilité** | deux clauses quasi identiques reçoivent-elles la même explication ? | paires de clauses dupliquées/proches (182 doublons + voisins par similarité) → identité de la règle déclenchée |
| **Compréhension** | temps de décision et charge perçue | temps par cas ; échelle de Likert |
| **Utilité juridique** | l'explication pointe-t-elle vers un fondement mobilisable (item, jurisprudence) ? | juristes : oui/non + commentaire |
| **Contrefactuel** | quel changement minimal de la clause éteint le signalement ? | pour R1/R2 : champ à modifier (ex. `notice: none → reasonable`) — généré par le moteur, jugé « pertinent » ou non par les juristes |

Comparateur : explication par saillance (attention/gradient) de B2 sur les mêmes phrases, soumise aux
mêmes juges dans le même format visuel (phrases surlignées), en aveugle sur la méthode.

## 4. Analyse statistique des jugements humains

Proportions avec IC de Wilson ; κ inter-juges par dimension ; comparaison règles vs saillance par test
de McNemar apparié sur les mêmes cas ; effet de l'ordre contrôlé (contrebalancement).

## 5. Tableaux imposés du rapport final

1. KG : métriques §1 par modèle (pilote) et pour le modèle retenu (complet).
2. Détection : macro-F1 / PR-AUC par catégorie pour B0–B4, A3–A8, avec IC.
3. Règles : P/R/F1 par item et par règle, n labels, Δ vs thème-seul.
4. Ablations : Δ apparié vs référence, IC.
5. Explications : suffisance/exactitude/utilité, règles vs saillance.
6. Audit : origine des faux positifs ; omissions candidates.
