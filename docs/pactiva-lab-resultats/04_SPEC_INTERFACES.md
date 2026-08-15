# 04 — Spécification des interfaces ad-hoc de résultats

## 1. Mécanisme de routage (dispatch)

### 1.1 Prérequis backend

Ajouter `preset` aux deux sérialiseurs de run (`source="experiment.preset"`) — le champ
existe sur `Experiment`, il n'atteint pas le frontend. C'est LA clé de routage primaire.

### 1.2 Fonction pure de routage

```
resultViewFor(run): ViewFamily
  1. run.preset connu               → famille dédiée (table ci-dessous)
  2. sinon run.config.sweep présent → famille « sweep générique »
  3. sinon run.task                 → T2 → multilabel ; T3 → boundary
  4. sinon                          → famille « générique » (vue actuelle, conservée)
```

La vue générique actuelle n'est PAS supprimée : elle reste le repli pour toute
expérience libre (mode expert) — enrichie des corrections transverses (§3).

### 1.3 Table preset → famille de vue

| Famille | Presets couverts |
|---|---|
| A. Plancher | baseline-fast, position-only |
| B. Résultat principal T1 | legal-bert-finetune |
| C. Comparaison appariée | embeddings-frozen, encoders-comparison, ablation-context, ablation-gold-quality |
| D. Criblage | screening-preprocess |
| E. Courbe (taille ou bruit) | learning-curve, ablation-label-noise |
| F. Juges LLM | llm-judges-baseline |
| G. Multi-label T2 | multilabel-finetune |
| H. Frontières T3 | sequence-boundary |
| — kNN explicable | knn-explainable (variante légère de B, avec voisins) |

## 2. Anatomie commune de toute vue (le « contrat de page »)

Chaque vue, quelle que soit la famille, suit la même structure verticale :

1. **En-tête** (existant : nom, tâche, cible de calcul, job OAR, badge partiel).
2. **Introduction de l'expérience** (`ExperimentIntro`, nouveau composant) — repliable
   (`Disclosure`), OUVERTE par défaut à la première visite, état replié mémorisé :
   *ce que teste l'expérience · son rôle dans la publication · comment lire cette page*.
   Contenus dans `05_CONTENUS_PEDAGOGIQUES.md` §2, indexés par preset.
3. **Le verdict** (`VerdictPanel`, nouveau) — LA réponse à la question décisionnelle,
   en une phrase générée à partir des données + le chiffre clé + son IC. Jamais de
   verdict sans IC ; si le test apparié manque (predictions absentes), le verdict se
   dégrade explicitement (« comparaison descriptive — test apparié indisponible »).
4. **La preuve** — les figures spécifiques à la famille (§4).
5. **Les détails** — per-fold, analyse d'erreurs, environnement, config (repliés).
6. **Glossaire contextuel** — chaque KPI porte un `MetricCell` enrichi d'une
   info-bulle de définition (contenus §3 du doc 05) ; lien vers la page d'aide Lab.

Composants transverses nouveaux : `ExperimentIntro`, `VerdictPanel`, `MetricCell`
enrichi (définition + IC intégré : « 0,516 [0,482 – 0,558] »), `CeilingBand`
(bande de plafond avec IC, remplace la ligne simple), `SignificanceNote` (affiche
Δ/IC/p + les conditions du test + son motif d'indisponibilité le cas échéant).

## 3. Corrections transverses (toutes familles, vue générique incluse)

1. **IC partout** : `MetricCell` affiche `macro_f1_ci` (déjà servi, jamais affiché) ;
   `RunList` transmet `ci` à `RunComparisonFigure` (bug documenté dans 01_AUDIT §2).
2. **κ affiché** pour T1 (métrique de comparaison humains/LLM du plan).
3. **Dispersion inter-plis** affichée à côté de chaque moyenne (« 0,516 ± 0,028 »).
4. **Plafond humain** : toujours via `CeilingBand` (bande + IC + note « approximé »),
   plafond CORRECT par tâche (κ 0,769 / α-MASI 0,635 / Jaccard 0,39–0,63).
5. **Analyse d'erreurs enfin montrée** (section repliée) : `byAgreementClass` (avec la
   pédagogie strict/majority/divergence réutilisée du gold), `topConfusions` (liée à la
   matrice), `lowestConfidenceErrors` (les 20 erreurs les plus confiantes, avec texte).
6. **Environnement & reproductibilité** (replié) : GPU, packages, durée, fingerprint
   dataset, config — ce qui va dans l'annexe de l'article.

## 4. Spécification par famille

### A. Plancher (baseline-fast, position-only)

- **Verdict** : « Le plancher {TF-IDF|positionnel} est à {x} de macro-F1 [IC]. Tout
  modèle sérieux doit le dépasser nettement. » Pour position-only : « La structure seule
  explique {x} — {si ≥ seuil du plan : “une part substantielle : Q2 est à moitié
  répondue”}. »
- **Preuve** : barres comparées aux AUTRES planchers déjà exécutés sur les mêmes plis
  (majority-class implicite, baseline-fast, position-only) + `CeilingBand`.
- **Spécifique** : bouton « utiliser comme plancher de référence » (statut affiché
  ensuite dans toutes les vues comparatives).

### B. Résultat principal T1 (legal-bert-finetune)

- **Verdict** : « macro-F1 {x} [IC], soit {y} % du plafond humain approximé. » —
  formulation verrouillée (jamais « dépasse l'humain »).
- **Preuve** : KPIs (macro-F1+IC, micro-F1, **κ**, ECE) → `CeilingBand` → calibration →
  confusion (avec normalisation par ligne, nouveau) → **`byAgreementClassFigure`**
  (nouveau : taux d'erreur par classe d'accord — le modèle échoue-t-il là où les
  humains divergent ?) → per-label F1 vs support.
- **Comparaison intégrée** : si un run embeddings-frozen comparable existe → encart
  `SignificanceNote` avec le test apparié (« le fine-tuning gagne-t-il ? »).

### C. Comparaison appariée (embeddings-frozen, encoders-comparison, ablation-context, ablation-gold-quality)

Vue au niveau **expérience/sweep** (pas run par run) :

- **Verdict** : « {Meilleure variante} : {x} [IC]. Δ vs {seconde} = {δ} [IC de Δ],
  p = {p} (permutation par document). » ou la version descriptive de repli.
- **Preuve** : `RunComparisonFigure` AVEC IC (bug corrigé) + annotation de
  significativité par paire pertinente ; pour ablation-context : les 6 barres ordonnées
  par fenêtre — la maquette de la figure F7 de l'article.
- **Spécifique embeddings-frozen** : colonne coût (durée, GPU) à côté de la
  performance — l'objectif est un ARBITRAGE coût/performance.

### D. Criblage (screening-preprocess)

Vue agrégée du sweep (24–48 runs) :

- **Verdict** : « {n} configurations testées. Axes avec effet : {liste}. Axes sans
  effet (abandonnés pour l'étage GPU) : {liste}. »
- **Preuve 1 — classement** : barres triées, IC, **règle de survie surlignée** (configs
  dont l'IC touche celui du meilleur = retenues, les autres grisées).
- **Preuve 2 — effets marginaux par axe** (nouveau `AxisEffectFigure`) : pour chaque
  axe, moyenne des Δ entre paires ne différant que sur cet axe, avec IC.
- **Bandeau explicite** : « Criblage exploratoire — pas de correction multiple ; les
  axes retenus seront confirmés à l'étage 2 (test apparié). »

### E. Courbe (learning-curve, ablation-label-noise)

Vue agrégée du sweep :

- **Verdict** learning-curve : « À 39 documents, {x} [IC]. La tendance ajustée
  (loi de puissance) suggère {y} vers 100 documents [bande] — extrapolation limitée à
  2–3× l'effectif observé. » / label-noise : « Le modèle perd {δ} points à 10 % de
  bruit — {robuste|sensible} au bruit d'étiquettes. »
- **Preuve** : `LearningCurveFigure` (nouveau) — points (taille × répétitions), moyenne
  par taille, bande bootstrap intra-taille, ajustement en pointillés au-delà des
  données, `CeilingBand` horizontale. Axe X : documents (ou % de bruit).
- **Honnêteté intégrée** : la zone d'extrapolation est visuellement distincte
  (hachures/opacité) et bornée ; note sur l'écrêtage des tailles 30/40 (pool ≈ 31 docs).

### F. Juges LLM (llm-judges-baseline)

- **Verdict** : « Ordre observé : humains ({κ 0,769}) {>|≈} supervisé ({κ}) {>|≈}
  meilleur juge LLM ({κ}) — {conforme|contraire} à l'attendu du plan. »
- **Preuve 1** : la figure F9 — barres κ à la même échelle : plafond humain,
  supervisé (si run comparable), les 4 juges.
- **Preuve 2** : matrice κ par paire (juge×juge, juge×gold) + α de Krippendorff global
  avec IC (endpoint accord).
- **Métadonnées figées** : version des juges, date, mention « baseline figée, prompt
  documenté » (exigence du plan §6.5).

### G. Multi-label T2 (multilabel-finetune)

- **Verdict** : « micro-F1 {x} [IC] ; macro-F1 {y} [IC] ; écart micro−macro {δ} [IC] —
  le point de rigueur : {interprétation générée}. LRAP {z}. Plafond α-MASI 0,635. »
- **Preuve** : KPIs T2 (micro, macro, écart, LRAP, hamming_loss, subset_accuracy — les
  deux derniers existent déjà, jamais montrés) → per-label F1 vs support (la longue
  traîne, F6) → `CeilingBand` α-MASI.

### H. Frontières T3 (sequence-boundary)

- **Verdict** : « WindowDiff {x} [IC], Pk {y} [IC] — {au-dessus|dans|au-dessous de} la
  fourchette d'accord humain (Jaccard 0,39–0,63). »
- **Preuve** : KPIs T3 (window_diff, pk, boundary_precision/recall — existants, jamais
  montrés en KPI) + bande-fourchette humaine (une FOURCHETTE, pas un point).

## 5. Liste des runs d'un sweep : regroupement

`RunList` regroupe les runs d'une même expérience (même `experiment` id) sous une ligne
d'expérience dépliable, avec agrégat (n runs, terminés/échoués, meilleure valeur) et
lien vers la vue agrégée (familles C/D/E/F). Les runs individuels restent accessibles
en dépliant. Sans ce regroupement, un criblage de 48 runs reste illisible quelle que
soit la vue de détail.

## 6. Design

- Tokens sémantiques uniquement ; thème sombre du Lab ; composants `Figure` (export
  CSV/SVG conservé partout), `Panel`, `Disclosure`, patron `GoldHelpModal` pour la
  modale d'aide Lab.
- Significativité : JAMAIS d'étoiles seules — toujours « Δ, IC, p » en toutes lettres,
  avec le nom du test en info-bulle.
- Zones d'extrapolation/incertitude : opacité réduite + motif, jamais la couleur seule
  (daltonisme) ; `aria-label` descriptifs sur chaque figure (déjà le standard `Figure`).
- États : chaque vue gère « sweep incomplet » (n runs manquants → bandeau + figures sur
  les runs disponibles), « run unique d'une famille agrégée » (repli vue B/générique),
  « échec » (existant).
