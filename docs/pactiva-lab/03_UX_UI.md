# UI / UX — Lab et Analyse & Qualité

> Navigation, écrans, composants, catalogue de visualisations. Cohérent avec le système de
> style existant (tokens `docs/pactiva/`, atelier sombre / pages claires, garde anti-hex).

---

## 1. Le public et ce qu'il vient faire

| Profil | Vient pour | Écran d'entrée |
|---|---|---|
| **Chercheur** (porteur) | Lancer des expériences, comparer, exporter les figures | Lab → Expériences |
| **Encadrant / relecteur** | Voir où en est la campagne et si les chiffres tiennent | Analyse → **Prêt pour la science** |
| **Annotateur** | Voir sa propre qualité, sans jugement comparatif | Analyse → Mon activité |

> Le troisième profil impose une contrainte : **un annotateur ne doit jamais découvrir un
> classement des annotateurs.** La politique d'indépendance déjà en vigueur (un annotateur ne
> lit pas les sessions de ses pairs) s'étend aux métriques : `access_for()` filtre déjà, l'UI
> ne doit pas contourner.

---

## 2. Navigation

```
/projects/[slug]/
├── analysis/                        ← module existant, ENRICHI
│   ├── (onglet) Vue d'ensemble      KPI + prêt pour la science
│   ├── (onglet) Fiabilité           κ, α-MASI, par thème, frontières       [F1 F3 F4]
│   ├── (onglet) Taxonomie           longue traîne, co-occurrence           [F2 F12]
│   ├── (onglet) Annotateurs         profils, stabilité, audit
│   ├── (onglet) Gold                cascade, avancement                    [F11]
│   └── (onglet) Rapports            existant : snapshots, rapports, PDF
│
└── lab/                             ← NOUVEAU
    ├── /datasets                    construire, prévisualiser, comparer
    ├── /experiments                 configurer, dupliquer, lancer
    ├── /runs                        file, suivi, journaux
    ├── /runs/[id]                   résultats, figures, analyse d'erreurs
    ├── /compare                     comparaison N runs
    └── /compute                     cibles de calcul + identifiants Grid'5000
```

**Point d'entrée unique dans la barre latérale : « Analyse & Lab »**, avec deux sous-entrées.
Le Lab n'est visible que pour les rôles `owner`/`reviewer` — un annotateur n'a rien à y faire.

---

## 3. Les écrans

### 3.1 Analyse → Vue d'ensemble : le bandeau « Prêt pour la science »

L'écran qui remplace les requêtes SQL manuelles. Une ligne par verrou, avec un état franc.

```
┌─ PRÊT POUR LA SCIENCE ──────────────────────────── campagne-pactiva ─┐
│                                                                      │
│  Documents multi-annotés     ███████░░░░░░░░░░░░  7 / 12   🟠        │
│  dont triple annotation      ██████░░░░░░░░░░░░░  3 / 5    🟠        │
│  Documents complets          ████████████████░░░ 45 / 50   🟢        │
│  Gold finalisés              ░░░░░░░░░░░░░░░░░░░  0 / 3    🔴        │
│  α-MASI (multi-label)        0,635   [seuil 0,667]         🟠        │
│  κ inter-annotateurs         0,769                         🟢        │
│                                                                      │
│  ⚠ 10 annotations complètes ne sont pas soumises → invisibles        │
│    dans les calculs standard.        [ Voir lesquelles ]             │
└──────────────────────────────────────────────────────────────────────┘
```

**Le rôle de cet écran est de dire ce qui bloque, pas de féliciter.** Chaque ligne rouge ou
orange est cliquable et mène à la liste des objets concernés.

### 3.2 Lab → Construire un dataset

Trois colonnes : **critères** → **aperçu en temps réel** → **conséquences**.

```
┌ CRITÈRES ─────────────┐ ┌ APERÇU (preflight) ────────────────────────┐
│ Maturité              │ │  45 documents · 8 934 phrases              │
│  ○ toutes             │ │  20 thèmes · 2 731 multi-thèmes (30,6 %)   │
│  ● complètes  ⓘ       │ │                                            │
│  ○ soumises           │ │  ⚠ 5 documents écartés :                   │
│  ○ gold finalisé      │ │     Endomondo   annotation partielle 59/498│
│                       │ │     Booking     0 clause validée           │
│ Agrégation            │ │     … [ voir les 5 ]                       │
│  ● consensus          │ │                                            │
│  ○ un annotateur      │ │  Longue traîne : FEEDBACK 31 · META 75     │
│  ○ soft labels        │ │  ⚠ 4 thèmes sous 50 occurrences            │
│                       │ │                                            │
│ Min. annotateurs  [1] │ │  Splits : GroupKFold(5) par document       │
│ ☑ exclure partielles  │ │  Empreinte : a3f9c1…  (nouveau)            │
└───────────────────────┘ └────────────────────────────────────────────┘
                                        [ Construire le dataset ]
```

**L'aperçu se met à jour à chaque changement, avant toute construction.** C'est le principe
d'ergonomie central : on ne découvre pas après coup qu'un dataset a perdu 12 documents.

Le bouton n'est actif que si l'aperçu est valide. S'il est désactivé, **il dit pourquoi** —
règle déjà appliquée ailleurs dans le produit (le bouton de validation grisé de l'atelier).

### 3.3 Lab → Configurer une expérience

Deux modes, un seul état sous-jacent :

- **Mode guidé** — on choisit une tâche (T1/T2/T3), un **preset** (`baseline-fast`,
  `embeddings-frozen`, `legal-bert-finetune`, `ablation-context`, `learning-curve`), une cible
  de calcul. Trois clics.
- **Mode expert** — l'éditeur JSON de la configuration, validé en direct par le schéma, avec
  les erreurs pointées à la ligne.

> Les deux modes éditent **le même objet**. Passer de guidé à expert montre le JSON produit ;
> revenir en guidé le relit s'il est reconnaissable. Pas de duplication de logique.

Un encart **estimation** avant lancement : durée approximative, GPU requis ou non, nombre de
runs engendrés (une grille de 3 × 4 × 5 = 60 runs, c'est bon à savoir **avant**).

### 3.4 Lab → Suivi d'un run

États distincts et lisibles — `waiting` (en file Grid'5000) n'est pas `running` :

```
● en file (Grid'5000 · nancy)   depuis 12 min      [ Annuler ]
◐ en cours   pli 3/5            ███████░░░ 62 %    [ Annuler ]
✓ terminé    4 min 12 s                            [ Résultats ]
⚠ partiel    walltime atteint au pli 4/5           [ Relancer + 2 h ]
✗ échec      g5k_unreachable                       [ Rejouer en local ]
```

Journal en flux, filtrable, avec téléchargement. **Le secret n'y apparaît jamais** — masquage
testé.

### 3.5 Lab → Résultats

En-tête : le tableau principal, **plafond humain sur la même échelle**.

```
                      macro-F1        micro-F1       κ / α
  plafond humain      0,74 ┃          0,81 ┃         0,769
  ─────────────────────────╂───────────────╂──────────────
  legal-bert +ctx     0,68 ┃▓▓▓▓▓▓▓▓░      0,79 ┃▓▓▓▓▓▓▓▓▓  0,71
  e5-large + logreg   0,61 ┃▓▓▓▓▓▓░░░      0,74 ┃▓▓▓▓▓▓▓░░  0,64
  tfidf + logreg      0,55 ┃▓▓▓▓▓░░░░      0,71 ┃▓▓▓▓▓▓░░░  0,58
  juge fable (LLM)    0,43 ┃▓▓▓░░░░░░      0,52 ┃▓▓▓▓░░░░░  0,41
```

Puis : par étiquette (triable par support), matrice de confusion, calibration, analyse
d'erreurs, artefacts. **Chaque figure a un bouton d'export SVG / PDF / CSV des données
sous-jacentes** — le CSV compte autant que l'image : un relecteur peut demander les nombres.

### 3.6 Lab → Cibles de calcul et identifiants

```
┌ Grid'5000 ──────────────────────────────────────────┐
│  Identifiant   [ ajebbari                        ]  │
│  Mot de passe  [ ••••••••••••  ]  (jamais réaffiché)│
│  ⓘ Chiffré au repos. Utilisé uniquement pour        │
│    soumettre vos jobs, sous votre compte.           │
│                                                     │
│  [ Tester la connexion ]   ✓ testé le 11/08 à 14:32 │
│                                                     │
│  Site [nancy ▾]  Ressources [gpu=1,walltime=04:00]  │
│  File [production ▾]   ☐ besteffort ⓘ               │
└─────────────────────────────────────────────────────┘
```

Si aucun identifiant : la cible `g5k` reste **listée mais désactivée**, avec le motif et un lien
vers ce formulaire. Jamais de disparition silencieuse d'une option.

---

## 4. Catalogue des visualisations

### 4.1 Décision technique : **SVG maison, pas de bibliothèque de graphes**

Aucune bibliothèque de graphes n'est présente aujourd'hui. L'ajouter serait tentant ; c'est
pourtant le mauvais choix ici, pour quatre raisons :

1. **L'export vectoriel est l'exigence n°1** (figures d'article). Avec du SVG écrit à la main,
   le DOM **est** la figure : l'export est une sérialisation, pas une conversion.
2. **Contrôle du thème** — le projet a des tokens de couleur et une garde anti-hex ; les
   bibliothèques imposent leurs palettes et rendent la conformité AA difficile à garantir.
3. **Testabilité** — les échelles et les chemins sont des fonctions pures, testables en vitest,
   comme le reste du code métier du projet.
4. **Poids** — recharts/d3 pèsent lourd pour ~12 figures dont la moitié sont des barres et des
   nuages.

→ Une couche de primitives `features/analysis/charts/` : `scaleLinear`, `scaleLog`, `Axis`,
`Legend`, `Tooltip`, `ExportButton`. **Fonctions pures + composants sans état.**

> ⚠️ **Avant d'écrire la première ligne de code de graphe, charger la skill `dataviz`** (palette,
> choix de forme, accessibilité, règles de légende/axe/infobulle). Cette contrainte est reprise
> dans le runbook au lot concerné.

### 4.2 Les figures

| Réf | Figure | Forme | Écran | Note de conception |
|---|---|---|---|---|
| **F1** | Matrice d'accord 7×7 (3 humains + 4 LLM) | carte de chaleur | Fiabilité | Séparateur visuel humains \| LLM ; échelle divergente centrée sur le hasard |
| **F2** | Longue traîne des thèmes | barres (log) + accord en second axe | Taxonomie | Le second axe montre d'un coup d'œil que **les thèmes rares sont les moins fiables** |
| **F3** | α-MASI vs α nominal | barres appariées + ligne de seuil 0,667 | Fiabilité | La ligne de seuil **fait** le message |
| **F4** | Thème vs frontière par document | nuage (x = accord thème, y = Jaccard frontière) | Fiabilité | Diagonale de référence ; les points sous la diagonale = segmentation plus dure |
| **F5** | Courbe d'apprentissage | ligne + ruban d'IC + asymptote « plafond humain » | Résultats | |
| **F6** | Score par étiquette vs support | nuage log-x | Résultats | Explique visuellement l'écart micro/macro |
| **F7** | Ablations | barres horizontales + IC | Résultats | Trié par effet, référence à zéro |
| **F8** | Confusion | carte de chaleur ordonnée | Résultats | Ordre par regroupement, pas alphabétique |
| **F9** | Humains / modèle / LLM | barres groupées | Résultats | La figure de conclusion |
| **F10** | Calibration | ligne + diagonale idéale | Résultats | |
| **F11** | Cascade gold | barres empilées + avancement | Gold | auto_1click / auto / manual |
| **F12** | Co-occurrence des thèmes | graphe à arcs ou matrice, arêtes = lift d'abusivité | Taxonomie | **Le pont vers l'objectif B** ; matrice par défaut (plus lisible que le graphe à 20 nœuds) |

### 4.3 Règles communes à toutes les figures
- Lisibles en **clair et sombre** (tokens, jamais de couleur en dur).
- **Jamais la couleur seule** pour porter l'information : forme, trame ou étiquette en doublon.
- Toujours : n, unité, et **IC quand la mesure en a un**.
- **Un état vide explicite** (« pas encore de document multi-annoté ») — jamais un cadre blanc.
- Export **SVG + PDF + CSV des données**.
- Toutes les données passent par le même sélecteur que le tableau associé : **une figure ne
  calcule jamais ses propres chiffres**.

---

## 5. États, erreurs et attente

| État | Traitement |
|---|---|
| Chargement | Squelettes aux bonnes dimensions, pas de spinner centré |
| Vide | Message qui **dit quoi faire** (« aucun dataset : commencez par en construire un ») |
| Support insuffisant | Affiché, mais **grisé avec le motif** (`min_support` non atteint) — jamais masqué |
| Erreur | Code + explication + action de reprise |
| Long calcul | Progression réelle (pli en cours), pas une barre décorative |

---

## 6. Accessibilité

- Contraste **AA** vérifié par le harnais existant.
- Toute figure a un **équivalent tabulaire** accessible (`<table>` visuellement masquée mais
  lisible par lecteur d'écran) — c'est aussi ce qui alimente l'export CSV.
- Navigation clavier complète ; l'aide clavier (`?`) est étendue aux nouveaux écrans.
- Pas d'interactif imbriqué (règle déjà tenue par `a11y.spec`).
- Les états de run sont annoncés en région `aria-live` polie.

---

## 7. Ce qui ne change pas

Le module Analyse & Qualité **garde** ses snapshots, rapports, presets, comparaisons et export
PDF. Les nouveaux onglets s'ajoutent ; les métriques existantes ne sont **ni modifiées ni
supprimées** (versionnement du registre). `boundary_agreement` remplace `boundaryKappa` dans
l'affichage, mais l'ancienne métrique reste calculable et **marquée dépréciée** — un rapport
produit en juillet doit rester lisible en septembre.
