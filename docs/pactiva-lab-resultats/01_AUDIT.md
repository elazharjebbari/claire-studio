# 01 — Audit : ce qui est produit, ce qui est montré, ce qui manque

Audit réalisé le 15 août 2026 par 4 lecteurs parallèles (rôles scientifiques, UI/données,
cadre statistique, pédagogie), consolidé ici. Toutes les références fichier:ligne ont été
vérifiées sur le code réel.

## 1. Le paradoxe central : les données existent, l'interface les ignore

Le runner (`research/pactiva_lab/runner.py`) produit un `results.json` riche — mais la
page de détail (`frontend/src/features/lab/RunResults.tsx`) n'en affiche qu'une fraction.

### 1.1 Champs produits et leur sort côté UI

| Champ de `results.json` | Produit par | Affiché ? |
|---|---|---|
| `metrics.macro_f1`, `micro_f1`, `ece` | runner | ✅ KPIs (`RunResults.tsx:220-227`) |
| `metrics.reliability_curve` | runner | ✅ `CalibrationFigure` |
| `per_fold` (κ/macroF1/microF1 par pli) | runner | ✅ table générique brute |
| `per_label` | runner | ⚠️ partiel : f1 + support seulement, **jamais precision/recall** |
| `human_ceiling.value/metric/note` | runner | ✅ KPI ; `pairs`/`warning` jamais |
| `errors.confusionMatrix` | runner | ✅ `ConfusionMatrixFigure` |
| `metrics.kappa` | runner (`:282`) | ❌ **jamais** — alors que κ est LA métrique de comparaison humains/LLM du plan |
| `metrics.macro_f1_ci` (bootstrap document, n=1000 : point/low/high/confidence/unit) | runner (`:188`) | ❌ **jamais** — « un résultat sans IC ne va pas dans l'article » (plan §3.3) |
| `metrics.*_dispersion` (écart-type inter-plis) | runner (`:296`) | ❌ jamais |
| T2 : `hamming_loss`, `subset_accuracy` ; T3 : `boundary_precision/recall`, `window_diff` | runner | ❌ jamais en KPI (noyés dans la table per-fold) |
| `errors.nErrors/errorRate/unfairErrorRate/unfairSentences/byAgreementClass/topConfusions/lowestConfidenceErrors` | runner (`:373-395`) | ❌ **toute l'analyse d'erreurs sauf la matrice** — dont les 20 phrases d'erreur les plus confiantes avec y_true/y_pred/scores/classe d'accord |
| `environment` (gpu/packages/elapsedSeconds) | env.py | ❌ jamais (le docstring d'`env.py` prétend le contraire) |
| `dataset` (fingerprint/nDocuments/nSentences), `config` | runner | ❌ jamais |
| `predictions.jsonl` (prédiction par phrase : document, fold, y_true, y_pred, confidence, top-5, unfair, agreement) | runner | ❌ sur disque, catalogué en `RunArtifact` (checksum SHA-256), **aucun endpoint de téléchargement/lecture** |
| `artifacts` (SVG/CSV) | services (`:305`) | ❌ sérialisés dans `RunDetail` mais jamais rendus |

### 1.2 Calculé côté Python mais jamais écrit dans `results.json`

- **`lrap`** (`metrics.py:149`) : défini, **appelé nulle part** — alors que le preset
  `multilabel-finetune` (LE classifieur du papier phare) le déclare comme métrique clé.
- **`human_ceiling` par paires** (`ceiling.py:25-116`, avec `perPair`) : importé par le
  runner mais **inutilisé** — le runner appelle son `_ceiling` approximatif (`:331`)
  faute de votes individuels dans le dataset agrégé. Le vrai plafond exige un dataset
  `aggregation='soft'` (déjà noté dans la note runtime affichée).
- `fold_dispersion` renvoie mean/std/min/max/n mais seul `std` est conservé.

## 2. Capacités et limites des 4 figures existantes (`charts.tsx`)

Toutes enveloppées dans `Figure` (`features/analysis/charts/Figure.tsx`) qui fournit
déjà : table accessible, export CSV/SVG, légende, état vide. Excellente base.

| Figure | Sait faire | Ne sait pas faire |
|---|---|---|
| `LabelScoreFigure` (:68) | scatter F1 vs support (log) | precision/recall, IC par label, plusieurs séries |
| `ConfusionMatrixFigure` (:148) | heatmap, diagonale distincte | normalisation par ligne, tri, lien vers `topConfusions` |
| `RunComparisonFigure` (:260) | barres + ligne plafond, **IC (`ci:{low,high}` tracées :336-345)** | plusieurs métriques, groupes/facettes, annotation de significativité |
| `CalibrationFigure` (:373) | fiabilité, rayon ∝ n, ECE en caption | calibration par classe |

**Bug réel confirmé** : `compare_runs` (backend `views.py:379-408`) renvoie `ci` par
ligne — mais `RunList.tsx` ne mappe que `{runId, label, value}` avant de le passer à
`RunComparisonFigure`, et le type TS de `compareRuns` (`api.ts`) omet `ci`. La figure
sait tracer des IC qu'elle ne reçoit jamais.

**`compare_runs` ne sait pas** : test apparié (aucun accès aux prédictions croisées),
delta, multi-métrique, comparaison per-label.

## 3. Le germe du dispatch ad-hoc existe déjà

`RunDetail` porte `run.task` (T1/T2/T3) et `config.model.family` — mais PAS le
`preset` de l'expérience (champ présent sur `Experiment`, absent des deux sérialiseurs
de run). L'ajouter est le prérequis du routage de vues (voir `04_SPEC_INTERFACES.md` §1).

## 4. Pédagogie : le savoir existe, au mauvais endroit

- Les commentaires de code de `charts.tsx` (l. 64-67, 141-147, 255-258, 367-372) sont
  d'excellents textes d'interprétation (« une suggestion à 95 % qui n'a raison que 60 %
  du temps détruit la confiance ») — **invisibles à l'utilisateur**.
- Le YAML des presets (`pipeline-presets.yaml`) porte déjà `why` + `duration_hint` par
  preset et un `recommended_order` commenté : le squelette tout prêt des introductions.
- Patterns d'UI pédagogique disponibles : `GoldHelpModal` (modale d'aide a11y avec
  lignes icône+titre+corps, badges, footer-résumé — patron à dupliquer), centre d'aide
  markdown (`content/help/manifest.ts` — ajouter des pages est trivial), hints inline
  (`STATUS_META.hint`), sous-titre/caption/légende/état-vide de `Figure`.
- Ton de référence (charte §7 + `GoldHelpModal` + `content/help/certitude.md`) :
  français soutenu, vouvoiement, phrases courtes, gras sur le mot-clé, message central
  en une phrase, jamais condescendant.
- Métriques sans définition accessible : macro vs micro-F1, κ, ECE, IC bootstrap,
  dispersion inter-plis, plafond humain (pourquoi approximé), LRAP, WindowDiff/Pk,
  `unfairErrorRate` (à définir de zéro — n'existe nulle part).
- Réutilisable tel quel : l'explication strict/majority/divergence de `GoldHelpModal`
  (l. 120-155).

## 5. Synthèse des lacunes, par critère de qualité

| Critère | Lacune principale |
|---|---|
| Utile | La vue ne répond pas à l'objectif décisionnel du preset (aucun dispatch) |
| Utilisable | Sweeps affichés comme N runs indépendants ; pas de vue agrégée (criblage, courbe) ; analyse d'erreurs riche jamais montrée |
| Compréhensible | Aucune introduction, aucune définition de métrique in-app ; savoir enfermé dans les commentaires |
| Scientifique | IC calculé puis jeté ; κ jamais montré ; aucun test apparié ; plafond humain affiché comme comparable ; LRAP jamais branché ; pas d'IC sur le plafond |
