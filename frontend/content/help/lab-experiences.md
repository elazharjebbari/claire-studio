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

Quatre expériences complètent le parcours hors ordre : `encoders-comparison` (le
pré-entraînement juridique paie-t-il ?), `knn-explainable` (le prix de
l'explicabilité), `ablation-gold-quality` (l'arbitrage améliore-t-il le modèle
aval ?), `ablation-label-noise` (robustesse au bruit d'étiquettes — l'ablation de
solidité du papier phare).

## Les mesures des papiers (bloc « Mesures d'accord & de gold »)

Deux expériences ne mesurent **aucun modèle** : elles recalculent, sur un export
daté du dataset, les chiffres d'accord et de protocole que les papiers publient —
la règle étant qu'aucun chiffre ne provient d'une requête ad hoc.

- **Mesures d'accord** (`iaa-mesure`) — E1 à E4 du papier de mesure : le **coût du
  multi-label** (α-MASI contre α nominal sur le même matériau, différence appariée
  avec IC par document), la **matrice annotateurs × juges** à vocabulaire constant,
  l'accord de **frontières reconstruites** (jamais le κ d'ancres, artefactuel), la
  **divergence de chaque annotateur au juge le plus proche** (borne inférieure du
  travail d'édition). Nécessite un dataset construit avec les votes bruts.
- **Cascade gold** (`gold-cascade`) — E5 : quelle part des phrases se résout
  automatiquement (unanime, majorité ≥ 2/3), quelle part exige un comité, et ce que
  l'arbitrage **change** par rapport à la pluralité des votes. Tant que rien n'est
  finalisé, l'écran l'affiche tel quel : ce sont des chiffres d'aperçu.

## La partie graphe (bloc « Hypergraphe & anomalies »)

Trois expériences testent l'hypothèse centrale de la partie graphe du papier long :
**l'identité des combinaisons de thèmes** d'une clause porte-t-elle un signal
d'abusivité, évalué contre les labels CLAUDETTE ?

- **Co-occurrence → abusivité** (`cooccurrence-abusivite`) — le « tableau 5 » :
  des scores d'anomalie non supervisés (rareté de combinaison, NPMI min, LOF,
  IsolationForest, OCSVM), un **contrôle négatif** (le simple nombre de thèmes) et
  une **référence supervisée** (P(abusif | combinaison)), tous en validation croisée
  par document. Règle de lecture : **rare ≠ abusif** — un détecteur ne vaut que
  s'il bat les contrôles.
- **Ablation déontique** (`cooccurrence-deontique`) — D1 : une couche déontique
  **prédite** (proxy à règles de modaux, déclaré comme tel) ajoutée à l'identité de
  combinaison — coût ou bénéfice, mesuré.
- **Ablation bruit** (`cooccurrence-bruit`) — G5 : les thèmes d'entraînement sont
  dégradés (10 à 35 %) pour simuler un classifieur amont imparfait — la borne de
  fiabilité opérationnelle du pipeline.

## L'onglet Programmes

L'onglet **Programmes** ordonne ces expériences au service des deux papiers
(papier long, papier court) : chaque item y porte son rôle (figure, tableau,
ablation) et son avancement **dérivé des runs réels** sur le jeu de données choisi
— jamais un état saisi à la main. « Validé » signifie : au moins un run réussi de
ce preset sur ce dataset.

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
