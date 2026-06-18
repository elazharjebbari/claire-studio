# Accord inter-annotateur (IAA)

> Périmètre : feature **F4/F7**. Relié à l'audit projet (`GET /api/v1/projects/{slug}/progress`),
> au double-codage (`collaboration.md` §1) et à l'anonymisation (`collaboration.md` §4). Le calcul
> sert le pilotage qualité, pas l'évaluation des personnes.

## 1. Ce que CLAIRE mesure

L'annotation CLAIRE comporte deux décisions superposées sur un document :

1. **Segmentation** : où l'annotateur pose les frontières de clause (les `anchor_index`). Une clause
   couvre les phrases de son ancre jusqu'à l'ancre suivante (segmentation monotone dérivée des ancres,
   comme v9.4 — CONTRACT §1).
2. **Étiquetage** : quel `theme` (et `legal_nature?`) il attribue à chaque clause.

On mesure donc **deux familles d'accord** qui ne se confondent pas :

| Décision | Métrique | Granularité |
|---|---|---|
| Étiquetage (catégoriel) | κ de Cohen (2 annotateurs), κ de Fleiss (≥ 3) | par **phrase** (label hérité de la clause couvrante) et par **clause alignée** |
| Segmentation (frontières) | WindowDiff, Pk (boundary similarity) | par document |

Comparer des thèmes suppose un référentiel d'unités commun : on **projette** chaque annotation sur
les phrases du document (chaque `Sentence.index` reçoit le `theme` de sa clause couvrante). Cette
projection par phrase est l'espace d'observation partagé, robuste aux désaccords de frontières.

## 2. κ de Cohen (deux annotateurs)

Pour deux annotations A et B du même document (même `LabelScheme`), sur les `n_sentences` phrases :

- `p_o` = accord observé = proportion de phrases où `theme_A == theme_B`.
- `p_e` = accord attendu par hasard = `Σ_c (p_A(c) · p_B(c))` sur les thèmes `c` du schéma.
- `κ = (p_o − p_e) / (1 − p_e)`.

Détails de calcul :

- Le **vocab fermé** du `LabelScheme` (CONTRACT §2) fixe l'ensemble des catégories : pas de catégorie
  surprise, `p_e` est bien défini. Les phrases « hors clause » (avant la première ancre) reçoivent
  une étiquette technique `∅` qui est une catégorie à part entière dans le calcul.
- `κ` est rapporté **global** et **par thème** (κ binaire un-contre-tous par catégorie), pour repérer
  les thèmes confus (ex. `WARRANTY_DISCLAIMER` vs `LIMITATION_LIABILITY`).
- Une **matrice de confusion** thème×thème est jointe : c'est l'outil de diagnostic le plus utile pour
  réviser les consignes (`Project.guidelines`).

## 3. κ de Fleiss (≥ 3 annotateurs)

Quand un document est codé par `m ≥ 3` annotateurs (double/triple codage via `Assignment`) :

- Pour chaque phrase `i` et catégorie `c`, `n_{ic}` = nombre d'annotateurs ayant attribué `c`.
- `P_i = (Σ_c n_{ic}² − m) / (m(m−1))` (accord par phrase).
- `P̄ = moyenne des P_i` ; `p_c = (Σ_i n_{ic}) / (N·m)` ; `P_e = Σ_c p_c²`.
- `κ_Fleiss = (P̄ − P_e) / (1 − P_e)`.

Pré-condition : même nombre `m` d'annotateurs par phrase (codage équilibré). Si le codage est
déséquilibré, on rapporte plutôt l'**α de Krippendorff** (gère les annotateurs manquants) ; signalé
explicitement dans le rapport pour ne pas mélanger les régimes.

## 4. WindowDiff (frontières)

La segmentation est évaluée indépendamment des thèmes :

- On code chaque document comme une séquence de frontières binaires entre phrases consécutives
  (`1` si une nouvelle clause commence à `i+1`, sinon `0`), dérivée des `anchor_index`.
- `WindowDiff(ref, hyp) = (1/(N−k)) · Σ ( |b(ref, i, i+k) − b(hyp, i, i+k)| > 0 )`, où `b(·)` compte
  les frontières dans une fenêtre de taille `k`, et `k ≈ moitié de la longueur moyenne de segment` de
  la référence (convention Pevzner & Hearst).
- En l'absence de « référence » privilégiée entre deux annotateurs pairs, on calcule WindowDiff de
  façon **symétrique** (moyenne des deux sens) et on rapporte aussi la **boundary similarity** (1 −
  WindowDiff borné) pour une lecture « plus haut = mieux ».

La primitive d'alignement de frontières par `anchor_index` est **partagée** avec le diff de versions
(`versioning.md` §3) — une seule implémentation, deux usages.

## 5. Agrégation par thème et par frontière

Le rapport IAA d'un projet expose trois niveaux :

1. **Document** : κ (étiquetage) + WindowDiff (frontières) pour chaque document multi-codé.
2. **Thème** : κ binaire par thème agrégé sur tous les documents (micro et macro moyenne) — relie
   directement les thèmes du `LabelScheme` aux zones de désaccord.
3. **Projet** : κ macro-moyen, WindowDiff moyen, n documents multi-codés, n paires d'annotateurs.
   Ce bloc nourrit `GET /api/v1/projects/{slug}/progress` (champ `iaa`) et la carte projet
   (`/projects`, navigation.md §1 : « IAA »).

```json
{
  "iaa": {
    "labeling": {"cohen_kappa_macro": 0.71,
                 "by_theme": {"TERMINATION": 0.83, "WARRANTY_DISCLAIMER": 0.52}},
    "segmentation": {"window_diff_mean": 0.18, "boundary_similarity": 0.82},
    "coverage": {"documents_multi_coded": 14, "annotator_pairs": 3, "regime": "balanced"},
    "anonymized": true
  }
}
```

## 6. Anonymisation & éthique du calcul

- Les rapports IAA sont **pseudonymisés par défaut** (`Annotateur A/B`, `collaboration.md` §4) ; la
  dé-anonymisation (`?anonymize=false`) est réservée `lead`/`admin` et **tracée** (`ActivityEvent
  verb=reveal_identity`).
- L'IAA mesure la **clarté des consignes et du schéma**, pas la « performance » d'une personne. Le
  produit ne classe pas les annotateurs ; il met en évidence les thèmes/frontières litigieux pour
  arbitrage par le `lead` (cf. `10_quality_certainty_comments/review_rating.md`).
- Pré-requis méthodologique (CONTRACT, qualité « fiable ») : ne calculer l'IAA que sur des annotations
  produites en **aveugle** (`peer_visibility: blind`) pour éviter la contagion — sinon le régime est
  signalé comme « non aveugle » dans `coverage`.

## 7. Tests (CONTRACT §6)

- `pytest iaa_kappa` : valeurs connues (table de contingence de référence) pour Cohen et Fleiss,
  bornes `[−1, 1]`, cas dégénéré accord parfait → 1.0.
- `pytest iaa_windowdiff` : cas tabulés Pevzner-Hearst, symétrie, fenêtre `k` correcte.
- `pytest iaa_projection` : projection clause→phrase correcte, gestion des phrases hors-clause `∅`.
- `e2e collaboration.spec` : double-codage → bloc `iaa` peuplé sur la carte projet et le dashboard.
