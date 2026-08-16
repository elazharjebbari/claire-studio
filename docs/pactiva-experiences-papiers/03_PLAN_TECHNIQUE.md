# Plan technique — implémenter et exécuter les expériences manquantes

> Architecture inchangée : le runner (`pactiva_lab`) ne connaît ni base ni API — il lit un
> dataset figé et écrit `results.json` ; le backend ingère tel quel (`ingest_results`) ; l'UI
> route vers une vue ad-hoc par preset/tâche avec repli générique. Les trois nouvelles tâches
> s'insèrent dans ce moule sans le déformer.

## L1 — Dataset : votes bruts + gold (backend `lab/builder.py`, research `data.py`)

- `votes.jsonl` : une ligne par (document, phrase, annotateur) = `{document, index, annotator,
  primary, secondaries}` pour **toutes** les annotations retenues. C'est la matière brute d'IAA :
  indépendante de la politique d'agrégation, elle rend M1 reproductible sur export daté.
- `gold.jsonl` : si des résolutions existent pour le projet — `{document, index, tier
  (auto_1click|auto|manual), primary, secondaries, tally, status, finalized}`. Matière de M2.
- Manifeste : `nVotes`, `nGoldSentences`, `goldFinalized` (comptes de contrôle).
- `data.py` : chargeurs paresseux `load_votes(root)` / `load_gold(root)` (fichiers absents →
  structures vides, jamais d'erreur : les anciens datasets restent chargeables).

## L2 — Stats recherche (`evaluation/stats.py`)

- **Port pur de `projects/masi.py`** : `masi_distance`, `krippendorff_alpha_set` (distance
  paramétrable MASI/nominale-ensembles). Test de **parité golden** backend↔recherche.
- `gwet_ac1(units)` binaire par thème (présence/absence) — garde-fou de prévalence.
- `alpha_diff_bootstrap(units_by_doc)` : IC bootstrap par document de (α_nominal − α_MASI) et
  p bootstrap du signe — le test de significativité d'E1. Petit N assumé (IC larges déclarés).
- RNG : flux SHA-256 étiquetés par usage (règle du framework — jamais `random` global).

## L3 — Tâche `M1_agreement` (`research/pactiva_lab/measurement.py`)

Entrées : `votes.jsonl` + `judges.jsonl` + phrases. Volets du `results.json` :
1. `global` : α-MASI, α nominal (multi-label aplati en primaire pour le nominal), diff + IC + p
   (L2), n unités/docs/paires — sur les phrases à ≥2 annotateurs.
2. `perTheme` : par thème — α binaire présence/absence, Gwet AC1, support, accord observé.
3. `pairs` : par paire d'annotateurs — κ Cohen (primaire), accord brut, Jaccard moyen des jeux
   de thèmes, n unités, documents couverts.
4. `matrix` : annotateurs ∪ juges — accord primaire %, κ, Jaccard d'ensembles (E2, la 7×7 ;
   listes alignées, jamais de dict à clés libres — règle camelize).
5. `boundaries` : segments reconstruits par annotateur (plages de thèmes identiques) → Jaccard
   des positions de frontière par paire et par document (E3) ; le κ d'ancres n'est jamais émis.
6. `divergence` : par annotateur — % de phrases dont le jeu de thèmes diffère de chaque juge,
   `closestJudge` (min), par thème (E4-aperçu ; borne inférieure de l'édition, limite déclarée).
Métriques scalaires clés recopiées dans `metrics` (`alpha_masi`, `alpha_nominal`, `alpha_diff`,
`kappa_best_pair`, `boundary_jaccard_mean`…) pour tri/agrégats génériques.

## L4 — Tâche `M2_gold_cascade` (même module)

Entrées : `gold.jsonl` + `votes.jsonl`. Parts par tier ; **ce que l'arbitrage change** (décisions
`manual` ≠ pluralité des votes) ; ambiguïté résiduelle (part `divergence` restante) ; couverture
et statut de finalisation (aperçu honnête : « 0 résolution finalisée » s'affiche, ne se masque pas).

## L5 — Tâche `G2_cooccurrence` (`research/pactiva_lab/cooccurrence.py`)

- **Unités** : segments reconstruits par document (option `unit: segment|sentence`) ; label
  abusif = ∃ phrase du segment portant un `ReferenceLabel`.
- **CV** : les 5 plis figés du dataset (jamais recalculés) ; normalité apprise sur les documents
  TRAIN, scores sur TEST ; agrégation pooled + IC bootstrap par document.
- **Scorers** (tous calculés dans le même run — le tableau 5 est une comparaison interne) :
  non supervisés `rarity` (−log fréq. lissée de la combinaison exacte), `npmi_min` (paire
  interne la plus atypique), `lof`, `iforest`, `ocsvm` (multi-hot) ; contrôle négatif
  `cardinality` ; référence **supervisée assumée** `combo_identity` (P(abusif|combo) train,
  lissage Laplace, repli sur la moyenne marginale pour les combos inédits).
- **Ablations** (axes de sweep) : `deontic: none|rule_based` (taggeur modaux à règles —
  obligation/interdiction/permission — concaténé à l'identité de combinaison ; proxy déclaré de
  la couche prédite D1) ; `label_noise: 0…0.35` (corruption déterministe SHA-256 des thèmes des
  documents TRAIN uniquement — G5 versant détection).
- **Éval** : AUC-PR (average precision), precision@k (10/20/50), lift@k, ROC-AUC ;
  `perCategory` (une-contre-tous par catégorie CLAUDETTE) ; volet `structure`
  (segments, compression, combinaisons, hapax) ; volet `combinations` (top lift, support,
  exemples) ; artefact **`hypergraph.json`** (par document : segment → thèmes + abusivité).

## L6 — Contrats & catalogues (backend)

- `models.Task` +3 choix (migration), `contracts.TASKS`, familles modèle `measurement` et
  `cooccurrence_anomaly` (+ validation de leurs options), schéma JSON (enums + branches).
- `presets.yaml` : deux nouveaux blocs — `mesure-accord` (« Mesures d'accord & de gold ») et
  `graphe-anomalies` (« Hypergraphe & anomalies ») ; presets `iaa-mesure` (M1), `gold-cascade`
  (M2), `cooccurrence-abusivite` (G2 pivot), `cooccurrence-deontique` (sweep D1),
  `cooccurrence-bruit` (sweep G5-détection ×3 répétitions).
- `programs.yaml` : `papier-long` += M1 (tableau 2/F8) + G2 pivot + 2 ablations ;
  `papier-court` : M1 (E1–E4) et M2 (E5) **en tête**, échos existants ensuite.

## L7 — UI ad-hoc (frontend)

- `types.ts` : nouvelles tâches ; `resultView.ts` : familles `agreement` / `cascade` /
  `cooccurrence` + routage presets ; `AGGREGATED_FAMILIES` inchangé (les sweeps G2 passent en
  `paired`/`curve` selon l'axe).
- `resultViews.tsx` : trois vues ad-hoc ouvrant sur la décision de CHAQUE expérience (01_ANALYSE) :
  E1 en carte « le multi-label coûte X points d'α » avec seuil 0,667 matérialisé ; matrice E2 ;
  co-occurrence en « le tableau 5 » avec contrôles négatifs visuellement séparés des détecteurs.
- Textes : `experimentIntros.ts` (but/rôle/lecture pour les 5 presets) + `metricGlossary.ts`
  (α-MASI, Gwet AC1, AUC-PR, precision@k, lift, NPMI).

## L8 — Correctifs plateforme adjacents

- **V1.1** `projects/iaa.py` : `boundaryKappa` → Jaccard des frontières **reconstruites**
  (l'indicateur public actuel vaut 1,0 par construction).
- **V1.3** `gold/export.py` : publier `tally` + votes par annotateur (soft labels).
- V1.2 (`seeded_from`) : champ + écriture à la soumission (prospectif) — planifié, séparable.

## L9 — Batterie de tests

- Recherche (pytest) : parité MASI backend↔recherche (golden) ; Gwet AC1 sur valeurs connues ;
  reconstruction de segments (cas bord : doc entier uniforme, alternance, 1 phrase) ;
  déterminisme des scorers et du bruit (mêmes seeds → mêmes sorties) ; precision@k/lift exacts
  sur mini-fixture calculée à la main ; M1/M2/G2 bout-en-bout sur fixtures.
- Backend (pytest) : builder écrit/compte votes+gold ; anciens datasets sans fichiers →
  chargement OK ; contrats acceptent/refusent les nouvelles tâches/familles ; presets/programmes
  exposés ; parité `themes` du catalogue.
- Frontend (vitest) : routage des nouvelles familles ; rendu des trois vues sur fixtures ;
  lanceur guidé affiche les nouveaux blocs ; programmes affichent les nouveaux items.

## L10 — Protocole d'exécution « aperçu » (données en l'état)

1. Déploiement (gate complet ; vérifier « ✓ Déploiement OK @ sha » ET `git rev-parse HEAD`
   serveur ; relancer tel quel si flaky `lab.test.tsx`). **Rsync du package vers
   `~/pactiva-src` (lyon + nancy)** même si tout est CPU — parité obligatoire (leçon du 15 août).
2. Rebuild de 3 datasets (nouvelle empreinte, avec votes/gold) : `complete/consensus`,
   `submitted/consensus`, `any/consensus`.
3. Lancements API dans l'ordre de `02_MATRICE §4` ; suivi par l'UI de runs ; collecte des
   chiffres dans le rapport final (avec les caveats verrouillés : 1 paire, mono-annotateur, 0
   gold finalisé).
4. Post-V0 (action humaine) : rebuild + relance M1/M2/G2 en un clic — c'est le but de la
   versionnement par empreinte.
