# Les expérimentations du Lab : le parcours

Le Lab exécute des **expériences reproductibles** (jeux de données figés, plis de
validation croisée constants, empreinte de configuration) au service de la première
publication. Chaque expérience répond à une **question décisionnelle** précise — sa page
de résultats s'ouvre sur la réponse à cette question, pas sur des chiffres génériques.

## Le parcours recommandé

L'ordre n'est pas décoratif : c'est le protocole **en deux étages** du plan
scientifique — criblage bon marché d'abord, GPU ensuite, chaque étape s'appuyant sur
la précédente.

1. **Plancher TF-IDF** (`baseline-fast`) — sans plancher, aucun gain n'est
   interprétable. Quelques minutes de CPU.
2. **Position seule** (`position-only`) — que prédit la structure du document, avant
   tout modèle lexical ? Le diagnostic amont de la question « le thème est-il
   positionnel ? ».
3. **Juges LLM** (`llm-judges-baseline`) — gratuit (préannotations déjà en base) :
   la référence zéro-shot, sous le même protocole que les modèles entraînés.
4. **Criblage des prétraitements** (`screening-preprocess`) — exploratoire : quels
   axes (casse, fenêtre, longueur…) ont un effet réel ? Les axes retenus passent à
   l'étage suivant, les autres sont abandonnés avant de payer du GPU.
5. **Embeddings gelés** (`embeddings-frozen`) — le rapport qualité/coût maximal, et
   le terme de comparaison de la question « le fine-tuning vaut-il son coût ? ».
6. **Courbe d'apprentissage** (`learning-curve`) — combien de documents annoter ?
   Le meilleur rapport résultat/effort du plan.
7. **Fine-tuning Legal-BERT** (`legal-bert-finetune`) — le résultat principal,
   exprimé en pourcentage du plafond humain approximé.
8. **Ablation de contexte** (`ablation-context`) — la contribution originale : le
   thème d'une phrase juridique est-il largement positionnel ?
9. **Multi-étiquettes** (`multilabel-finetune`) — la tâche réelle, le classifieur du
   papier phare ; plafond de référence α-MASI 0,635.
10. **Frontières** (`sequence-boundary`) — le point dur : les humains eux-mêmes ne
    s'accordent que modérément (Jaccard 0,39 – 0,63).

Trois expériences complètent le parcours hors ordre : `encoders-comparison` (le
pré-entraînement juridique paie-t-il ?), `ablation-gold-quality` (l'arbitrage
améliore-t-il le modèle aval ?), `ablation-label-noise` (robustesse au bruit
d'étiquettes — l'ablation de solidité du papier phare).

## Les invariants, sur chaque page de résultats

- **Un résultat sans intervalle de confiance ne va pas dans l'article** — chaque
  score s'affiche avec son IC (rééchantillonnage par document) et sa dispersion
  inter-plis.
- **Comparer exige les mêmes plis** — la plateforme refuse explicitement de comparer
  deux runs découpés différemment.
- **Le plafond humain est un proxy** — une bande de référence avec sa propre
  incertitude, jamais un adversaire à battre. Les plafonds diffèrent par tâche :
  κ 0,769 (thème), α-MASI 0,635 (multi-étiquettes), Jaccard 0,39 – 0,63 (frontières).
- **L'exploratoire s'assume** — le criblage affiche un classement et une règle de
  survie, pas une forêt de p-values ; le confirmatoire porte le test apparié
  (Δ, IC du Δ, p de permutation par document).
