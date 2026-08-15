# 03 — Cadre statistique : le bon test pour le bon objectif

Principe directeur : **simplicité défendable devant un relecteur JURIX** (IA & droit,
pas NeurIPS). Bootstrap et permutation par **document** — l'unité d'échantillonnage
réelle (39 documents, ~7 600 phrases ; les ~195 phrases d'un document ne sont pas
indépendantes) — plutôt que des tests paramétriques fragiles.

Chaque proposition est classée :
- **[FRONT]** — calculable côté frontend à partir des `results.json` déjà servis ;
- **[RUNNER]** — nouveau calcul Python pur dans `research/pactiva_lab/evaluation/` ;
- **[BACKEND]** — nouvel endpoint Django (lecture d'artefacts stockés, croisement de runs).

## 0. État des lieux vérifié (ce sur quoi on peut compter)

- `predictions.jsonl` par phrase (document, index, fold, y_true, y_pred, confidence,
  top-5 scores, unfair, agreement) est écrit par le runner ET rapatrié de Grid'5000
  (le `fetch()` rsync le répertoire `results/` entier). Catalogué en `RunArtifact`
  avec checksum. **Aucun endpoint ne le sert encore.**
- Les plis viennent du dataset (jamais recalculés) → deux runs sur le même dataset
  partagent exactement les mêmes 5 plis et 39 documents : **l'appariement par document
  est garanti par construction**. Le garde `comparable()` (mêmes plis, même tâche)
  existe déjà.
- Déjà calculé par run : `macro_f1_ci` (bootstrap document, n=1000), `per_fold`,
  dispersions, `human_ceiling` (approx.), `byAgreementClass`, ECE + courbe de fiabilité.

## a. Comparer deux modèles sur les mêmes plis (confirmatoire)

Concerne : embeddings-frozen vs legal-bert-finetune, encoders-comparison,
ablation-context, ablation-gold-quality, position-only vs baseline-fast.

**Approche principale [RUNNER + BACKEND]** : **bootstrap apparié par document sur
Δ métrique** (macro-F1 ou κ). Rééchantillonner les 39 documents avec remise, recalculer
`métrique(A) − métrique(B)` sur chaque tirage (n=1000), IC 95 % ; **significatif si
l'IC de Δ exclut 0**. Réutilise la machinerie `bootstrap_ci` existante (la métrique
devient la différence). Nécessite les `predictions.jsonl` des deux runs →
fonction pure `paired_bootstrap_diff()` dans `pactiva_lab/evaluation/stats.py` +
endpoint Django `POST .../lab/compare/paired` qui lit les deux artefacts.

**Complément gratuit (même code, même unité)** : **test de permutation par document**
(échanger les prédictions A↔B document par document, ~10 000 permutations) → p-value
exacte. À afficher ensemble : « Δ = +0,020, IC 95 % [−0,004, +0,041], p = 0,11 ».

**Écartés, avec motif affichable** :
- t-test sur 5 plis : n=5, variance sous-estimée car les ensembles d'entraînement se
  recouvrent (Bengio & Grandvalet 2004) ;
- McNemar par phrase : anticonservateur (les phrases d'un même document ne sont pas
  indépendantes).

**Repli [FRONT] (sans predictions.jsonl)** : différences appariées par pli (5 valeurs,
déjà dans `per_fold`) — signe constant ou non — plus chevauchement des IC individuels.
**Purement descriptif, étiqueté comme tel** (le non-chevauchement d'IC est conservateur ;
le chevauchement ne prouve rien).

## b. Criblage multi-configurations (exploratoire — screening-preprocess, 24–48 configs)

**[FRONT]** — Assumer l'exploratoire : **pas de forêt de p-values**.

1. **Classement** : point + IC document par config (déjà fournis par run), règle de
   survie affichée : *« retenue si son IC touche celui du meilleur »* (top-k honnête).
2. **Analyse marginale par axe** : moyenne des Δ entre paires de configs ne différant
   QUE sur cet axe (~5 comparaisons d'axes, pas 276 paires) — répond directement à
   « quels axes ont un effet ».
3. Si un relecteur exige une correction : **Benjamini–Hochberg (FDR)** sur les ~5 tests
   d'axe — Holm-Bonferroni y tuerait toute puissance à 39 documents pour rien. L'étage 2
   (confirmatoire, test a.) existe précisément pour valider les axes retenus. À dire
   tel quel dans l'article ET dans l'UI.

## c. Courbe d'apprentissage (learning-curve : 5 tailles × 5 répétitions)

**[FRONT]** pour l'affichage, **[BACKEND]** pour l'agrégation inter-runs du sweep.

- Ajuster **F1(n) = a − b·n^(−c)** (loi de puissance) sur les 25 points ; bande
  d'incertitude par bootstrap des répétitions intra-taille.
- **Honnêteté imposée par les données** : le pool d'entraînement par pli ≈ 31 documents
  → les tailles 30 et 40 sont écrêtées (quasi aucune variance de tirage) ; l'asymptote
  `a` est mal identifiée avec 5 tailles. **Extrapoler au plus à 2–3× (~100 documents)**,
  bande s'élargissant, formulation « la tendance suggère », jamais « le modèle
  atteindra ».
- L'agrégation des 25 runs du sweep en UNE courbe nécessite un endpoint qui regroupe
  les runs d'une même expérience par `evaluation.learning_curve.n_documents`.

## d. Comparaison au plafond humain

**[RUNNER]** pour l'IC, **[FRONT]** pour l'affichage. **Aucun test.**

Le plafond est un proxy doublement incommensurable : (1) `strict_agreement_rate` ≈
exactitude, pas un F1 ; (2) calculé sur le seul sous-ensemble multi-annoté. Donc :

- Ajouter un **IC bootstrap par document au plafond lui-même** (même machinerie, dans
  `_ceiling`) — le plafond devient une **bande de référence**, jamais une barre
  comparable.
- Rhétorique verrouillée dans l'UI : « X % d'un plafond approximé », jamais
  « atteint/dépasse l'humain ».
- La comparaison honnête existe déjà dans les données : **`byAgreementClass`** — le
  modèle échoue-t-il précisément là où les humains divergent ? (À mettre en avant dans
  la vue résultat principal.)

## e. Accord modèle–juges LLM (llm-judges-baseline)

**[RUNNER + BACKEND]** : matrice de **κ de Cohen par paire** (juge×juge, juge×gold,
supervisé×gold) + **α de Krippendorff nominal** global (cohérent avec l'α-MASI du
papier ressource), **IC par bootstrap de documents** (pas de SE analytique fragile).
Croise les 4 `predictions.jsonl` du sweep → endpoint dédié, calcul pur dans
`pactiva_lab/evaluation/stats.py`.

## f. Baselines triviales (baseline-fast, position-only)

**[FRONT]** — rôle : **plancher affiché en bande** sur chaque graphique comparatif
(point + IC déjà fournis), ancrant l'ampleur d'effet (« +12 points sur le plancher
TF-IDF ») — plus informatif qu'une p-value. Un seul test formel optionnel : Δ apparié
(test a.) du modèle-titre contre la meilleure baseline, comme garde-fou.

## g. Cas particuliers

- **multilabel-finetune (T2)** : brancher **LRAP** (déjà écrit dans `metrics.py:149`,
  jamais appelé) dans le runner [RUNNER] ; IC bootstrap document sur micro-F1, macro-F1
  ET l'écart micro−macro (« le point de rigueur ») ; plafond = α-MASI 0,635, PAS κ.
- **sequence-boundary (T3)** : WindowDiff/Pk avec IC bootstrap document ; plafond =
  fourchette Jaccard humaine 0,39–0,63 affichée en bande (une fourchette, pas un point).
- **ablation-label-noise** : courbe de dégradation = même mécanique d'agrégation de
  sweep que la courbe d'apprentissage (axe = taux de bruit au lieu de n_documents).

## h. Récapitulatif des chantiers de calcul

| Chantier | Classe | Consommé par |
|---|---|---|
| `paired_bootstrap_diff()` + `permutation_test_paired()` | [RUNNER] pur | vues comparaison, ablations, baselines |
| Endpoint `POST /lab/compare/paired` (lit 2 `predictions.jsonl`) | [BACKEND] | idem |
| Endpoint d'agrégation de sweep (courbe : n_documents ou noise_rate → points) | [BACKEND] | learning-curve, label-noise |
| `kappa_pairwise()` + `krippendorff_alpha()` + IC | [RUNNER] pur | llm-judges |
| Endpoint accord juges (croise N `predictions.jsonl`) | [BACKEND] | llm-judges |
| IC bootstrap sur le plafond dans `_ceiling` | [RUNNER] | toutes les vues |
| Brancher `lrap` dans le runner (T2) | [RUNNER] | multilabel |
| Ajustement loi de puissance + bande (TS pur, miroir testé) | [FRONT] | learning-curve |
| Analyse marginale par axe (TS pur sur configs+métriques des runs) | [FRONT] | screening |
| Transmettre `ci` de `compare_runs` jusqu'à la figure (bug) | [FRONT] | comparaison simple |

**Ordre d'implémentation** : le chantier a. (bootstrap apparié + endpoint) est le socle —
b., e., f. le réutilisent ; c. et d. sont indépendants et petits.
