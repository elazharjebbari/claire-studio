# 03 — Protocole de validation expérimentale (pré-enregistré)

> Objet : décider **scientifiquement** l'adoption de T11 (ou du repli T14) comme
> taxonomie de traitement, par des expériences entraînées, appariées et datées —
> exécutables localement (CPU) et sur Grid'5000 (GPU), via le Lab.
>
> Statut : protocole rédigé AVANT exécution. Les hypothèses, seuils et règles de
> décision ci-dessous ne seront pas modifiés après avoir vu les résultats.

## 1. Principe d'implémentation : l'axe `theme_map`

La fusion est un **remapping au chargement**, jamais une écriture :

- **Où** : `research/pactiva_lab/data.py` (chargement du dataset). Nouvelle clé de
  configuration `data.theme_map` (nom d'un schéma enregistré). Au chargement, le
  mapping s'applique à `sentences.primary`, `sentences.themes`, `votes.*`,
  `judges.theme` — exactement le précédent `evaluation.label_noise` (axe de config
  du runner, résolu à l'exécution, jamais persisté dans le dataset).
- **Schémas nommés** : un fichier de spec `docs/pactiva-lab/specs/theme-maps.yaml`
  déclare `T14-fiabilite`, `T11-fonctionnel-strate`, `T10-fonctionnel` (mappings
  complets au fascicule 02 §4). Le code charge la spec ; aucun mapping en dur.
- **Traçabilité** : le nom du schéma entre dans la config du run donc dans son
  empreinte ; deux runs ne sont comparables que sur le même dataset ET le même
  schéma d'évaluation (voir §3, espace commun).
- **Invariants testés** : (i) `theme_map` absent ⇒ identité (aucun effet) ;
  (ii) tout code inconnu du mapping passe inchangé ; (iii) les plis sont IDENTIQUES
  entre schémas — propriété gratuite puisque le dataset et son `splits.json` ne
  changent pas : **toute comparaison inter-schéma est appariée par construction**.
- **Ce qui ne change pas** : la base, l'atelier, les exports, le gold — la
  taxonomie v1 reste la vérité d'annotation.

Effort estimé : ~1 journée (spec YAML + hook de chargement + validation contrat
backend + tests parité et invariants + axe de sweep dans les presets).

## 2. Hypothèses pré-enregistrées

| # | Hypothèse | Mesure | Critère de succès |
|---|---|---|---|
| **H1** — fiabilité | T11 rend l'accord multi-label acceptable | `iaa-mesure` sous `theme_map` : α-MASI, Δ apparié vs T20, IC bootstrap par document | α-MASI(T11) ≥ 0,667 ET IC du Δ excluant 0 |
| **H2** — apprenabilité | T11 s'apprend mieux, à espace d'évaluation ÉGAL | classifieurs entraînés (§3), macro-F1 **dans l'espace T11** : (a) entraîné T20, prédictions projetées ; (b) entraîné T11 nativement | IC du Δ apparié (b)−(a) excluant 0 en défaveur de (b) NON observé — c.-à-d. (b) ≥ (a) − 0,01 ; et F1 de queue (classes ex-rares) ↑ |
| **H3** — abusivité | T11 préserve le signal de détection | `cooccurrence-abusivite` (source votes puis gold) : AUC-PR de `combo_identity` et des détecteurs sous T20 vs T11 | perte relative d'AUC-PR ≤ 5 % (ou gain) |
| **H4** — frontières | T11 simplifie la segmentation | Jaccard des frontières reconstruites entre annotateurs ; `sequence-boundary` (WindowDiff/Pk) | Jaccard inter-annotateurs ↑ ; WindowDiff ↓ (IC appariés) |

**Règle de décision** (fixée maintenant) :

- H1 ∧ H3 vrais et H2 non dégradé → **adopter T11** pour les deux papiers.
- H1 vrai mais H3 faux → **repli T14** (rejouer H1–H3 sous T14 ; T14 ne touche pas
  aux strates, H3 y est presque assuré).
- H1 faux → conserver T20, publier le résultat négatif « granularité vs fiabilité »
  dans le papier court (le Δ simulé au 24 août rend ce cas improbable : +0,072
  [+0,059 ; +0,086], signe stable 100 %).
- T10 n'est JAMAIS adopté : il sert de test à charge du garde-fou G (§2 du 02) et
  de point de la courbe granularité/signal dans les figures.

## 3. Le piège méthodologique à éviter : comparer des macro-F1 d'espaces différents

Une macro-F1 sur 11 classes n'est **pas comparable** à une macro-F1 sur 20 classes
(moyenner sur des ensembles différents change la métrique). Toutes les comparaisons
H2 se font donc **dans l'espace commun T11** :

```
condition A (« projection ») : entraîner sur T20 → prédire → mapper les prédictions vers T11 → scorer en T11
condition B (« natif »)      : mapper les labels d'entraînement vers T11 → entraîner → scorer en T11
```

A mesure ce que la fusion apporte « gratuitement » à l'évaluation ; B mesure ce
qu'elle apporte à l'**apprentissage** (classes plus massives, frontières moins
contradictoires). L'écart B − A est LE résultat d'apprenabilité : si B > A, la
fusion aide le modèle à apprendre, pas seulement le score à monter. Même schéma
pour T14 et T10. Les plis étant identiques (§1), le test apparié par document
s'applique directement (`compare/paired` existant).

## 4. Matrice de runs

Étage 1 — **local CPU** (criblage, ~1 h de bout en bout) :

| Preset | Schémas | Rôle |
|---|---|---|
| `iaa-mesure` | T20, T14, T11, T10 | H1 — chiffres d'accord officiels sous mapping |
| `baseline-fast` (TF-IDF) | T20→T11 (A/B), T14, T10 | H2 au plancher — si l'effet n'existe pas ici, inutile de payer du GPU |
| `cooccurrence-abusivite` (source votes) | T20, T14, T11, T10 | H3 — AUC-PR détecteurs + référence supervisée |
| `cooccurrence-deontique`, `cooccurrence-bruit` | T11 vs T20 | robustesse de H3 (D1, G5 sous fusion) |

Étage 2 — **Grid'5000 GPU** (confirmatoire, seulement si l'étage 1 est concluant) :

| Preset | Schémas | Estimation |
|---|---|---|
| `embeddings-frozen` | T20 (A), T11 (B), T14 | ~2 h GPU |
| `legal-bert-finetune` | T20 (A), T11 (B) | ~6 h GPU (5 plis × 2) |
| `multilabel-finetune` | T20 (A), T11 (B) | ~6 h GPU |
| `sequence-boundary` | T20, T11 | ~4 h GPU — H4 |
| `learning-curve` | T11 | ~8 h GPU — la courbe des classes ex-rares refaite |

Total étage 2 : **~26 h GPU** (une réservation nuit sur une carte suffit,
`best-effort` accepté). Rappels opérationnels : rsync MANUEL de
`research/pactiva_lab` vers `~/pactiva-src` (lyon + nancy) après l'ajout de
`theme_map` ; **aucune réservation réelle sans validation explicite** (pas de
compte G5K actif à ce jour) — l'étage 2 tourne aussi, en ~4× plus long, sur CPU
local si nécessaire.

Étage 3 — **rejouer H1 et H3 sur le gold arbitré** dès ≥ 3 résolutions finalisées
(un clic : mêmes presets, dataset gold) — c'est la version « papier » des chiffres.

## 5. Statistique — règles transverses

- **Tout est apparié par document** : mêmes documents, mêmes plis, IC bootstrap par
  document (1 000 tirages), test de permutation par document (p en toutes lettres,
  jamais d'étoiles) ; « IC du Δ contenant 0 » se lit « aucune différence démontrée
  à cet effectif ».
- **Confirmatoire limité** : quatre hypothèses, une famille de tests chacune — pas
  de forêt de p-values ; tout le reste (per-classe, courbes) est descriptif avec IC.
- **Plafonds par tâche recalculés sous schéma** : comparer un modèle T11 au plafond
  humain T20 serait un artefact ; `iaa-mesure` sous `theme_map` fournit le plafond
  T11 (aperçu simulé : ~0,685).
- **Empreintes** : chaque chiffre publié cite (dataset fingerprint, schéma, preset,
  run id) — la règle « aucun chiffre issu d'une requête ad hoc » s'applique.

## 6. Livrables attendus

1. **Figure « granularité vs fiabilité vs signal »** (papier court) : x = nombre de
   classes (20, 14, 11, 10), y1 = α-MASI (IC), y2 = AUC-PR abusivité (IC) — le
   croisement des deux courbes EST le message : T11 est le coude.
2. **Tableau d'accord officiel sous T11** (papier court) : α-MASI, α nominal, par
   classe, frontières — les chiffres que la ressource publie.
3. **Ablation de taxonomie** (papier long) : classifieur et détection sous
   T20-projeté vs T11-natif — une ligne de tableau chacun.
4. **Décision motivée** consignée dans ce dossier (§2, règle de décision) avec les
   runs ids — la trace « protocole → résultat → adoption » qui fait la crédibilité
   de la ressource.
