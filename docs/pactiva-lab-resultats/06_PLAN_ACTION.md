# 06 — Plan d'action en 7 lots

Chaque lot est autoportant (testable, déployable, revue possible), ordonné par
dépendances. Effort indicatif en sessions-agent (une session ≈ un lot moyen pour un
agent Opus 5 outillé). Le détail exécutable pas-à-pas est dans `07_RUNBOOK_OPUS5.md` ;
les critères de validation dans `08_BATTERIE_TESTS.md`.

## Vue d'ensemble des dépendances

```
L0 (socle statistique Python)  ──►  L1 (endpoints backend)  ──►  L4 (vues agrégées C/D/E/F)
L2 (socle frontend transverse) ──►  L3 (vues simples A/B/G/H) ──► L4
L5 (pédagogie) dépend de L2 (composants) — contenus intégrables dès L3
L6 (finitions, regroupement RunList, aide) dépend de L3/L4/L5
```

## L0 — Socle statistique Python (`research/pactiva_lab/`) — 1 session

Conceptuel : `03_CADRE_STATISTIQUE.md` §a, d, e, g.

1. Nouveau module pur `pactiva_lab/evaluation/stats.py` :
   - `paired_bootstrap_diff(preds_a, preds_b, metric, n_resamples=1000, seed=…)` →
     `{delta, ci_low, ci_high, n_documents}` — rééchantillonnage PAR DOCUMENT ;
   - `permutation_test_paired(preds_a, preds_b, metric, n_permutations=10000, seed=…)`
     → p-value exacte ;
   - `kappa_pairwise(list_of_preds)` → matrice κ ; `krippendorff_alpha_nominal(…)` +
     IC bootstrap document.
   - Déterminisme total (seed explicite), aucune dépendance Django.
2. Runner : brancher `lrap` (T2) ; IC bootstrap sur le plafond dans `_ceiling` ;
   conserver mean/min/max de `fold_dispersion` (pas seulement std).
3. Tests : `research/tests/test_stats.py` (cas connus, sanité, déterminisme — voir
   `08_BATTERIE_TESTS.md` §1). Suite `research/` complète verte.

Livrable : fonctions pures testées ; `results.json` enrichi (lrap, ceiling.ci,
dispersion complète) sans rupture de schéma (champs ajoutés, jamais renommés).

## L1 — Endpoints backend (`backend/claire/lab/`) — 1 session

Dépend de L0. Conceptuel : `03_CADRE_STATISTIQUE.md` §h.

1. `preset` ajouté aux deux sérialiseurs de run (`source="experiment.preset"`).
2. `POST /projects/<slug>/lab/compare/paired` — corps `{runA, runB, metric}` :
   vérifie `comparable()`, lit les deux `predictions.jsonl` (via `RunArtifact` +
   `storage_path`, vérification du checksum), appelle `stats.py`, renvoie
   `{delta, ciLow, ciHigh, pValue, nDocuments, test:"paired_bootstrap+permutation"}`.
   409 explicite si plis différents ; 422 explicite si un artefact manque (code
   `predictions_missing` — la vue affichera le mode descriptif de repli).
3. `GET /projects/<slug>/lab/experiments/<id>/aggregate` — regroupe les runs d'un
   sweep : axe (`learning_curve.n_documents` | `noise_rate` | axes de sweep) → points
   {x, runs:[{id, value, ci, status}]}. Sert les familles D et E.
4. `POST /projects/<slug>/lab/agreement` — corps `{runIds[]}` : croise N
   `predictions.jsonl`, renvoie matrice κ + α + IC. Sert la famille F.
5. Tests : `backend/tests/test_lab_stats_endpoints.py` (fixtures predictions.jsonl,
   cas 409/422, parité camelCase). Suite backend complète verte.

## L2 — Socle frontend transverse — 1 session

Indépendant de L0/L1 (peut démarrer en parallèle).

1. Corriger le **bug ci** : `RunList` transmet `ci` à `RunComparisonFigure` ; type
   `compareRuns` complété.
2. Nouveaux composants : `MetricCell` enrichi (IC intégré, ± dispersion, info-bulle de
   définition), `CeilingBand`, `VerdictPanel`, `SignificanceNote`, `ExperimentIntro`
   (sur `Disclosure`, état replié mémorisé par compte via prefs existantes).
3. `resultViewFor(run)` pur (`features/lab/resultView.ts`) + types.
4. Module de contenus `features/lab/content/experimentIntros.ts` + glossaire
   `metricGlossary.ts` — textes copiés de `05_CONTENUS_PEDAGOGIQUES.md`.
5. Corrections transverses de la vue générique : κ affiché, IC partout, dispersion,
   sections repliées analyse d'erreurs (`byAgreementClass`, `topConfusions`,
   `lowestConfidenceErrors`) et environnement/reproductibilité.
6. Tests vitest : helpers purs, dispatch, MetricCell, vue générique enrichie.

## L3 — Vues ad-hoc simples (familles A, B, G, H) — 1-2 sessions

Dépend de L2 ; la famille B profite de L1 (`compare/paired`) mais fonctionne sans
(repli descriptif).

1. Famille A (planchers), B (résultat principal T1 avec `byAgreementClassFigure` et
   confusion normalisée par ligne), G (T2 : KPIs multi-label + LRAP + plafond α-MASI),
   H (T3 : KPIs frontières + bande-fourchette).
2. Intros et glossaire branchés (contenus de L2).
3. Tests vitest par famille (fixtures dorées de `08_BATTERIE_TESTS.md` §4).

## L4 — Vues agrégées (familles C, D, E, F) — 2 sessions

Dépend de L1 (endpoints aggregate/paired/agreement) et L2.

1. Famille C (comparaison appariée, avec `SignificanceNote` et repli descriptif).
2. Famille D (criblage : classement + règle de survie + `AxisEffectFigure` +
   bandeau exploratoire).
3. Famille E (`LearningCurveFigure` : ajustement loi de puissance TS pur
   `fitPowerLaw()` — testé contre des données synthétiques et en parité avec une
   implémentation Python de référence —, zone d'extrapolation distincte, bornée 2-3×).
4. Famille F (juges : F9 + matrice κ + α + métadonnées figées).
5. Tests vitest par famille + parité TS↔Python de `fitPowerLaw` (golden).

## L5 — Pédagogie complète — 1 session

Dépend de L2 (composants) ; intégrable en continu dès L3.

1. Pages du centre d'aide : `content/help/lab-experiences.md` (le parcours
   recommended_order raconté) + `content/help/lab-metriques.md` (glossaire long) ;
   entrées au `manifest.ts`.
2. `LabHelpModal` (patron `GoldHelpModal`) accessible depuis toute vue de résultats.
3. Vérification éditoriale : formulations verrouillées (05 §4) présentes, aucune
   formulation interdite (test lint-éditorial de `08_BATTERIE_TESTS.md` §5).

## L6 — Finitions et cohérence — 1 session

1. Regroupement des runs par expérience dans `RunList` (04 §5) avec agrégat et lien
   vers la vue agrégée.
2. Ajout des nouveaux fichiers Lab au garde anti-hex (`GUARDED` de
   `check-no-hex.mjs`) — l'audit a montré que le Lab n'y est pas.
3. Revue adversariale finale (workflow 2 angles : correction + design/a11y), boucle de
   correctifs, déploiement, mise à jour de la mémoire projet.

## Périmètre exclu (délibérément)

- **Vrai plafond humain par paires** (`ceiling.py` complet) : nécessite un dataset
  `aggregation='soft'` — chantier données, pas interface. Noté comme suite possible.
- Endpoint de téléchargement des artefacts bruts (SVG/CSV/predictions) : utile, mais
  orthogonal — peut devenir un lot L7 ultérieur.
- Toute modification du protocole scientifique lui-même (plis, k, bootstrap n) —
  ce dossier consomme le protocole, il ne le change pas.
