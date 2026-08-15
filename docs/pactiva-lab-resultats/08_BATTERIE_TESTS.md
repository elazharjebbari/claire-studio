# 08 — Batterie de tests : évaluer et valider l'amélioration

Organisée par couche, avec les critères d'acceptation par lot. Convention du dépôt :
noms de tests en français descriptif, ⭐ pour les tests nés d'un bug/décision réels.

## 1. Statistiques Python (`research/tests/test_stats.py`) — valide L0

**Bootstrap apparié (`paired_bootstrap_diff`)**
- Cas dégénéré : A = B → Δ = 0 exactement, IC contenant 0, borne à borne serrées.
- Cas construit : A meilleur que B sur TOUS les documents → IC entièrement > 0.
- Cas ambigu : A meilleur sur la moitié des documents → IC contenant 0.
- ⭐ Déterminisme : même seed → résultat bit-à-bit identique ; seeds différents →
  IC voisins mais distincts.
- ⭐ Clés désalignées (`(document,index)` non identiques entre A et B) → exception
  `predictions_mismatch`, jamais un Δ silencieusement faux.
- L'unité est le document : corrompre TOUTES les phrases d'un seul document ne déplace
  l'IC que d'≈ 1/39 — corrompre une phrase par document sur 39 documents le déplace
  davantage (test anti-« bootstrap par phrase »).

**Permutation (`permutation_test_paired`)**
- A = B → p ≈ 1 ; A ≫ B partout → p ≤ 1/n_permutations + tolérance.
- p ∈ [0, 1] toujours ; déterminisme par seed.

**Accord (`kappa_pairwise`, `krippendorff_alpha_nominal`)**
- Accord parfait → κ = α = 1 ; indépendance simulée → κ ≈ 0.
- Valeurs de référence : cas de 4×N étiquettes calculé contre une implémentation de
  référence (valeurs figées en dur avec la source du calcul en commentaire).
- α cohérent avec κ moyen sur données à 2 juges.

**Runner enrichi**
- T2 : `lrap` présent dans `metrics` ; bornes [0,1] ; cas parfait → 1.
- `human_ceiling.ci` présent, contient `value`.
- `fold_dispersion` : mean/std/min/max/n tous conservés.
- ⭐ Non-régression de schéma : tous les champs préexistants de `results.json`
  inchangés (golden : un `results.json` d'avant le lot, comparé clé à clé).

## 2. Endpoints backend (`backend/tests/test_lab_stats_endpoints.py`) — valide L1

- `compare/paired` : nominal (fixtures `predictions.jsonl` de 2 runs mêmes plis) →
  200, `{delta, ciLow, ciHigh, pValue, nDocuments}` camelCase.
- ⭐ Plis différents → 409 (même contrat que `compare` existant) ; artefact absent →
  422 `predictions_missing` ; checksum corrompu → 422 explicite.
- Permissions : lead/reviewer 200, annotateur 403, hors-projet 403.
- `aggregate` : sweep learning-curve simulé (runs avec `learning_curve.n_documents`
  variés) → points groupés par taille, runs échoués signalés, jamais comptés dans les
  moyennes.
- `agreement` : 4 runs de juges → matrice κ symétrique (diagonale 1), α présent.
- `preset` exposé dans liste ET détail des runs.

## 3. Frontend — helpers purs (`frontend/tests/labResultView.test.ts`, `labStats.test.ts`) — valide L2/L4

- `resultViewFor` : les 14 presets → famille attendue (table exhaustive) ; sweep sans
  preset → sweep générique ; T2/T3 sans preset → G/H ; défaut → générique.
- `fitPowerLaw` : données synthétiques `a − b·n^(−c)` bruitées → paramètres retrouvés
  à tolérance ; données plates → pente nulle sans crash ; 2 points → refus explicite
  (pas d'ajustement) ; ⭐ parité TS↔Python sur golden JSON partagé (patron
  `goldParity.test.ts`).
- `marginalAxisEffects` (criblage) : grille 2×2 construite → effets exacts connus ;
  axe sans effet → Δ ≈ 0.
- Formatage : « 0,516 [0,482 – 0,558] », « ± 0,028 » (fonctions de format testées).

## 4. Frontend — vues (vitest, une suite par famille) — valide L3/L4

**Fixtures dorées** : construire 3 fixtures depuis des RUNS RÉELS de prod (camelCase,
via l'API) — le run embeddings gelés `ca4c7a9e` (macroF1 0,495, plafond 0,495, erreurs
complètes), le run legal-bert `8ae3bcb9` (succeeded G5K), un run partiel. Elles
remplacent les fixtures minimales inventées pour les nouvelles vues.

Pour CHAQUE famille (A, B, C, D, E, F, G, H) :
- La vue se monte sur sa fixture et affiche : intro (`experiment-intro`), verdict
  (`verdict-panel`) contenant un IC, la/les figures de la famille.
- ⭐ Le verdict ne contient JAMAIS une formulation interdite (voir §5).
- États : sweep incomplet → bandeau + rendu partiel ; run unique famille agrégée →
  repli sans crash ; échec → message existant.

Cas spécifiques :
- B : κ affiché ; `byAgreementClassFigure` rend les 3 classes ; si comparaison
  appariée disponible → `SignificanceNote` avec Δ/IC/p ; si 422 `predictions_missing`
  → mention « comparaison descriptive » (jamais un test silencieusement absent).
- D : configs hors règle de survie grisées ; bandeau « exploratoire » présent.
- E : zone d'extrapolation marquée (`data-extrapolated`), bornée (aucun point de
  courbe au-delà de 3× le max observé) ; note d'écrêtage présente.
- F : matrice κ symétrique rendue ; métadonnées de version des juges affichées.
- G : LRAP et écart micro−macro affichés ; plafond = α-MASI (0,635), pas κ.
- H : « plus bas = mieux » présent ; bande-fourchette (deux bornes), pas une ligne.
- Générique enrichie : IC + κ + dispersion affichés ; analyse d'erreurs dépliable ;
  tests existants de `labResults.test.tsx` toujours verts (non-régression).

## 5. Lint éditorial (`frontend/tests/labEditorial.test.ts`) — valide L5

Test qui parcourt `experimentIntros.ts`, `metricGlossary.ts` et les chaînes des
`VerdictPanel` :
- Formulations interdites absentes : « bat l'humain », « dépasse l'humain », « atteint
  l'humain », « significatif » sans test nommé, étoiles de significativité (`*` collé
  à une p-value), « le modèle atteindra ».
- Formulations requises présentes : chaque intro contient les 3 blocs (teste/rôle/lire) ;
  chaque entrée de glossaire ≤ 2 phrases pour l'info-bulle.
- Les 14 presets ont chacun une intro ; aucune intro orpheline.

## 6. Accessibilité et design — valide L2→L6

- Chaque nouvelle figure passe par `Figure` (table accessible + export) — test :
  `figure-*-table` présent pour chaque figure rendue.
- `role="progressbar"`/`aria-label` sur toute barre ; zones d'extrapolation
  distinguées par motif/opacité ET attribut, pas par la couleur seule.
- `npm run check:colors` vert avec les fichiers Lab ajoutés à `GUARDED` (L6).
- Harnais AA existant (`contrastAA.test.ts`) vert (aucun nouveau token).

## 7. Portes de validation par lot (résumé)

| Lot | Portes |
|---|---|
| L0 | §1 vert + suite `research/` complète + golden schéma |
| L1 | §2 vert + suite backend complète |
| L2 | §3 (dispatch, formats) + non-régression `labResults.test.tsx` + tsc/lint |
| L3 | §4 familles A/B/G/H + §6 |
| L4 | §3 (fitPowerLaw, axes) + §4 familles C/D/E/F + parité golden |
| L5 | §5 vert + pages d'aide dans le manifest |
| L6 | §6 complet + revue adversariale sans finding bloquant + deploy vérifié (ligne « Déploiement OK » + sha serveur) |

## 8. Validation finale de l'objectif (au-delà des tests automatiques)

Contrôle manuel guidé (15 min, à faire par l'utilisateur ou un agent avec captures) :
pour 3 expériences réelles de prod (embeddings-frozen, learning-curve, llm-judges),
vérifier que la page répond OUI aux cinq questions du dossier :
1. La question décisionnelle de l'expérience a-t-elle une réponse visible en < 5 s ?
2. Un non-spécialiste comprend-il chaque chiffre affiché (définitions accessibles) ?
3. Chaque affirmation comparative porte-t-elle IC ou test nommé ?
4. Les limites (proxy du plafond, extrapolation, exploratoire) sont-elles dites ?
5. Le contenu correspond-il à ce que l'article devra montrer (figures F5–F9) ?
