# 02 — Rôle de chaque expérimentation dans la première publication

Sources : `docs/pactiva-lab/specs/pipeline-presets.yaml`, `docs/pactiva-lab/01_PLAN_SCIENTIFIQUE.md`,
`docs/pactiva-anomalies-graphe/` (stratégie DÉFINITIVE), `docs/pactiva-papier-ressource/`.

## 1. Cadre de publication

- **Papier long (phare)** : *« From Reliable Multi-Label Clause Themes to
  Hypergraph-Based Detection of Unfair Clauses »* — sa section « Fiabilité des thèmes +
  classifieur supervisé » (**[F1]**) est ce que le Lab produit.
- **Papier court (mesure)** : *« How Much Does Multi-Label Cost? »* — repose sur les
  expériences d'accord inter-annotateurs E1–E5 du module Analyse & Qualité ; les presets
  Lab n'y contribuent qu'en écho (plafonds, coût de la cascade).
- **Invariants de preuve transverses** (plan §3.1–3.3) : GroupKFold par document sur
  plis figés ; ligne `human_ceiling` sur chaque figure comparative ; IC bootstrap 95 %
  au niveau document — *« un résultat sans IC ne va pas dans l'article »*.

## 2. Cartographie preset → publication

| Preset | Question | Papier | Objectif décisionnel | Preuve attendue | Critère déclaré |
|---|---|---|---|---|---|
| **baseline-fast** | Q1 (plancher) | Long §3 | Fixer le plancher TF-IDF — « sans plancher, aucun gain n'est interprétable » | Tableau baselines macro-F1 + plafond, mêmes plis que tout le reste | Aucun seuil — prérequis d'interprétabilité |
| **position-only** | Q2 (diagnostic) | Long (amont de F7) | Mesurer ce que la structure seule prédit avant tout modèle lexical | Comparaison appariée position vs TF-IDF vs transformers, mêmes plis | « Si forte, Q2 est à moitié répondue » |
| **llm-judges-baseline** | Q5 | Long (fig. F9) ; écho court R2 | Le supervisé bat-il les 4 juges LLM ? — « ferme la boucle du mur du κ » | κ vs gold des 4 juges sous le MÊME protocole que le supervisé ; fig. F9 humains/supervisé/LLM ; baseline figée, prompt documenté | Ordre attendu : humains > supervisé > LLM |
| **screening-preprocess** | Q3 (+A2) | Long, méthodo | Choisir les prétraitements ; éliminer les axes sans effet AVANT le GPU (étage 1) | Grille 24 runs, effet marginal par axe sur modèle bon marché, décision de survie explicite | Axe sans effet au criblage = abandonné (plan §5) |
| **embeddings-frozen** | Q4 (A3) | Long | Le fine-tuning vaut-il son coût ? | Comparaison appariée encodeurs × têtes vs fine-tuning, mêmes plis + coût (temps/mémoire) | Arbitrage coût/performance, pas de seuil chiffré |
| **learning-curve** | Q6 (A4) | Long (fig. F5) | Combien de documents annoter ? — « quand arrêter d'annoter ? » | Courbe macro-F1 vs 5/10/20/30/40 docs, 5 répétitions/point, IC, plafond tracé sur la même figure | « Niveau utile » vs plafond ; « le meilleur rapport résultat/effort du plan » |
| **legal-bert-finetune** | Q1 | Long — résultat principal T1 | À quel % du plafond humain (κ 0,769) le modèle arrive-t-il ? | Nested CV (inner_k 3), bootstrap 1000, calibration, `cross_reference_unfair`, matrice de confusion croisée avec l'IAA (F8) | Réponse Q1 : « oui, à X % du plafond sur T1 » |
| **ablation-context** | Q2 (A1) | Long — « contribution originale » | Le thème d'une phrase juridique est-il largement positionnel ? | Ablation appariée 6 runs (fenêtre 0/1/2 × position), barres + IC = fig. F7 | Le claim Q2 lui-même |
| **multilabel-finetune** | Q1 sur T2 | **Long — LE classifieur du papier phare [F1]** ; écho court R1 | Étiqueter un ToS inédit « à un niveau utile » sans LLM, en documentant la fragilité des thèmes rares | micro/macro-F1 + **LRAP** + IC, plafond **α-MASI 0,635** (pas κ) ; « micro-F1 ≫ macro-F1 » assumé ; F1 par étiquette vs support (F6) | Écart micro/macro = « le point de rigueur » (plan §7) |
| **sequence-boundary** | T3 (« le point dur ») | Long ; écho contribution 3 du court | Un modèle séquentiel fait-il mieux que l'accord humain famélique sur les frontières ? | WindowDiff, Pk, Jaccard + plafond humain 0,39–0,63 sur le même tableau | Comparaison au plafond Jaccard 0,39–0,63 |
| **knn-explainable** | — | Aucun papier central | Explication par l'exemple (valeur AI & Law + suggestions atelier) | Voisins récupérés + F1 honnête | — |
| **encoders-comparison** | Q4 | Long (tableau) | « Le domaine juridique paie-t-il ? » (encodeurs juridiques vs généralistes) | Tableau apparié par encodeur, mêmes plis | — |
| **ablation-gold-quality** | A5 | Écho E5 du court | « L'arbitrage gold vaut-il son coût ? » — décision stratégique de campagne | Comparaison appariée entraîné-sur-gold vs entraîné-sur-consensus | — |
| **ablation-label-noise** | A6 | **Long — l'ablation G5 du papier phare** | Robustesse du classifieur au bruit d'étiquettes | Courbe de dégradation 0/5/10/20 % × 3 répétitions + IC | — |

## 3. Ce que cette cartographie impose aux interfaces

Trois lectures structurantes pour `04_SPEC_INTERFACES.md` :

1. **Chaque preset a un objectif DÉCISIONNEL** (choisir, trancher, estimer, prouver) —
   la vue doit ouvrir sur la réponse à cette décision, pas sur des KPIs génériques.
2. **La preuve attendue est déjà spécifiée** par le plan (colonne « preuve attendue ») —
   les figures F5/F6/F7/F8/F9 de l'article sont les maquettes naturelles des vues.
3. **Les plafonds diffèrent** : κ 0,769 pour T1, α-MASI 0,635 pour T2, Jaccard
   0,39–0,63 pour T3 — une vue générique avec « le » plafond humain est fausse par
   construction pour deux tâches sur trois.

## 4. recommended_order = parcours de lecture

L'ordre recommandé du YAML (baseline-fast → position-only → llm-judges → screening →
embeddings-frozen → learning-curve → legal-bert-finetune → ablation-context →
multilabel-finetune → sequence-boundary) est le protocole deux étages du plan §5 :
criblage CPU d'abord, GPU ensuite. L'interface doit le rendre visible : chaque vue
indique où l'expérience se situe dans ce parcours et ce qui la précède/suit
(« cette expérience suppose le criblage terminé »).
