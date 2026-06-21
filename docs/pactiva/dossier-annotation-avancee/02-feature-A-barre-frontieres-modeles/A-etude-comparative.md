# Feature A — Étude comparative des solutions de visualisation

> Objectif : comparer plusieurs façons de **visualiser simultanément les frontières de
> clause par modèle** (Claude, Codex, +Mistral) sans basculer la source du document.
> Critères : **lisibilité simultanée, compacité, scalabilité N modèles, accessibilité,
> coût d'implémentation, performance, intuitivité**. La matrice chiffrée est dans
> `A-comparatif.csv` ; la décision argumentée dans `A-choix.md`.

Contexte technique commun (ne change pas selon la solution) : les frontières viennent des
`PreClause` LLM (span-based, `start_id`+`theme`) projetées en `Run` par
`computeRuns(judgeAnchors(pre.clauses), n)` — **déjà** calculées dans `DocumentPanel`
(`claudeRuns`/`codexRuns`). Toutes les options consomment cette même donnée ; elles
diffèrent uniquement par le **rendu** et l'**interaction**.

---

## Solution 1 — Réglette multi-pistes verticale **(RETENUE)**

Une **piste fine par modèle**, verticale, alignée aux phrases, dans un **gutter à droite**
de la colonne de lecture. Marqueur ⟦◷⟧ au début de chaque segment ; teinte + abréviation
de catégorie optionnelles ; tooltip au survol ; clic = centrer la phrase.

**Forces**
- **Lisibilité simultanée** maximale : N modèles côte à côte, mêmes lignes ⇒ comparer =
  comparer des colonnes alignées. Une frontière partagée = même ligne ; une divergence =
  décalage visible immédiat (cœur du besoin A4).
- **Compacité** : ~24 px/piste ⇒ 2 modèles ≈ 52 px, 3 ≈ 80 px, **hors** de
  `max-w-reading` (n'ampute pas la lecture, A5).
- **Scalabilité N** : grille `repeat(N, …)` ; ajouter Mistral = une piste de plus, zéro
  refonte (A7). Mode condensé possible au-delà de ~5.
- **Alignement natif** : la lecture se fait verticalement (sens de lecture du document) ;
  la réglette suit **le même axe** que les yeux → charge cognitive faible.
- **A11y** : forme (⟦◷⟧) + abréviation + couleur ; `role="grid"` navigable ; tooltips au
  focus. Daltonisme-safe par construction.
- **Cohérence** : réutilise `getThemeToken`, `focusSentence`, les runs existants → zéro
  divergence avec le rail gauche et les badges.

**Faiblesses**
- Coût d'implémentation **moyen** : nécessite un **alignement mesuré** (hauteurs de ligne
  variables à cause de la traduction FR per-phrase) via `ResizeObserver`.
- Largeur additionnelle à droite : à gérer en repli sous `xl` (mais la lecture reste
  prioritaire).
- Densité si **beaucoup** de modèles (>5) : nécessite un mode condensé (prévu, non bloquant).

**Pertinence / ergonomie / UI / UX**
- *Pertinence* : répond **directement** au constat d'audit (vue simultanée manquante).
- *Ergonomie* : geste unique (survol/clic) ; aucun changement de mode ; complète
  `compare`/`BoundaryEvidence` sans les dupliquer.
- *UI* : discrète, alignée à la grille, palette neutre + teintes du schéma fermé.
- *UX* : « qui coupe où » en un coup d'œil, exactement le mental model recherché.

---

## Solution 2 — Bascule de source actuelle (état des lieux, **baseline**)

L'existant : `LlmSourceSwitch` (human → claude → codex → compare). On regarde **un**
modèle à la fois ; `compare` superpose l'accord par phrase (vert/ambre).

**Forces**
- **Coût nul** : déjà en place, éprouvé, testé.
- **Zéro encombrement** : aucune surface UI ajoutée.
- Le mode `compare` chiffre l'accord (κ, %) — utile pour l'IAA, là où la réglette reste
  qualitative.

**Faiblesses**
- **Pas de simultanéité** : il faut **mémoriser** la segmentation A pour la comparer à B →
  charge cognitive élevée, erreurs d'appréciation (c'est le problème à résoudre).
- **Scalabilité nulle** : 3 modèles ⇒ 3 bascules à enchaîner ; `compare` est pensé pour
  **2** juges (vert/ambre), pas N.
- *Lisibilité simultanée* : 1/5 par définition.

**Pertinence / ergonomie / UI / UX**
- *Pertinence* : c'est le **point de départ** que A doit dépasser ; sert de référence.
- *Ergonomie* : correcte pour inspecter un modèle, mauvaise pour **comparer**.
- *UX* : ne couvre pas A1/A4. Conservée comme **outil complémentaire** (inspection/édition),
  pas comme réponse à A.

---

## Solution 3 — Minimap horizontale repliable (sous l'en-tête)

Une bande **horizontale** (type minimap de code) sous `document-controls`, où l'axe X = la
position dans le document et chaque modèle est une **ligne empilée** de segments colorés.

**Forces**
- **Vue d'ensemble** du document entier d'un seul écran (utile pour de longs docs).
- Compacte en **hauteur** (une poignée de pixels par modèle).
- Navigation rapide « cliquer pour sauter » sur tout le document.

**Faiblesses**
- **Axe contre-intuitif** : le document se lit **verticalement**, la minimap mappe la
  position sur **X** → l'œil doit faire une rotation mentale phrase↔position (friction).
- **Désalignement** avec le texte : impossible de mettre une frontière minimap **en face**
  de sa phrase (axes orthogonaux) ⇒ on perd l'ancrage local « cette frontière = cette
  phrase ».
- **Densité** : sur ~300 phrases comprimées sur la largeur d'écran, chaque phrase ≈ 1–3 px
  ⇒ marqueurs de frontière **fusionnés**, illisibles ; les segments courts disparaissent.
- *Scalabilité N* : empiler beaucoup de lignes mange la hauteur ; lecture croisée difficile.
- *A11y* : segments minuscules ⇒ cibles < 24 px, contraste/forme difficiles à garantir.

**Pertinence / ergonomie / UI / UX**
- *Pertinence* : bonne pour la **navigation** globale, faible pour la **comparaison fine**
  de frontières (le besoin A est local, phrase à phrase).
- *UI* : élégante mais trompeuse (précision apparente non tenue à haute densité).
- *UX* : convient comme **complément de navigation** futur, pas comme réponse à A1/A4.

---

## Solution 4 — Overlays empilés dans le rail gauche

Étendre le **rail gauche** existant (déjà coloré par le thème du run, P2) en plusieurs
sous-rails accolés (un par modèle) à **gauche** du texte, juste après le rail humain.

**Forces**
- **Réutilise** le rail existant (`box-shadow inset` par thème) → familier.
- **Alignement natif** aux phrases (même axe vertical que la réglette) — bon pour A1/A4.
- Coût modéré (on duplique un mécanisme connu).

**Faiblesses**
- **Empiètement à gauche** : la marge gauche est déjà chargée (numéro de phrase, rail
  humain, contour fantôme, surlignage injustice) ⇒ accoler 2–3 sous-rails **rapproche le
  texte du bord** et brouille la zone la plus regardée (début de ligne).
- **Conflit visuel** : le rail gauche **humain** est éditable/sémantique ; ajouter des
  rails LLM **lecture seule** au même endroit mélange deux statuts (édition vs référence)
  → ambiguïté (qui est ma frontière ? celle du modèle ?).
- *Compacité* : chaque sous-rail vole de la largeur **dans** le flux de lecture (contrairement
  à un gutter à droite, hors flux).
- *Scalabilité N* : au-delà de 2 modèles, la marge gauche devient un mur de couleurs.
- **Tooltip/clic** moins naturels (zone étroite collée au texte).

**Pertinence / ergonomie / UI / UX**
- *Pertinence* : techniquement proche de la réglette mais **du mauvais côté** (charge la
  marge de lecture au lieu de la préserver).
- *UX* : risque de confusion entre frontières « miennes » et « du modèle ».

---

## Solution 5 — Chips inline (puces de frontière dans le texte)

À chaque début de segment d'un modèle, insérer une **puce inline** dans le flux du texte
(ex. petit badge `Claude:MOD` au début de la phrase concernée), façon annotations en marge.

**Forces**
- **Contextuel** : la frontière est **exactement** sur la phrase, dans le texte.
- Aucune zone latérale ⇒ rien à mesurer/aligner.
- Réutilise le pattern de badge/`ghost` déjà présent (`ghost-${judge}-${index}`).

**Faiblesses**
- **Bruit dans la lecture** : sur des zones où les modèles coupent souvent, les chips
  **hachent** le texte ⇒ A5 (non intrusif) cassé ; lecture pénible.
- **Lisibilité simultanée faible** : pour 3 modèles, jusqu'à 3 chips par frontière ⇒
  empilement ; comparer « qui coupe où » oblige à **scruter le texte**, pas à balayer une
  colonne.
- **Pas d'alignement croisé** : on ne voit pas d'un coup l'écart entre modèles (les chips
  sont dispersées dans le corps).
- *Scalabilité N* : se dégrade vite (densité de chips × modèles).
- Les **fantômes LLM** existants jouent **déjà** un rôle proche (suggestions inline) ;
  multiplier les chips ferait **doublon** et surchargerait.

**Pertinence / ergonomie / UI / UX**
- *Pertinence* : utile pour une **frontière isolée**, inadapté à une **vue comparative**
  dense (le besoin A).
- *UX* : contredit l'exigence « non intrusif, lecture préservée ».

---

## Synthèse qualitative

| Aspect clé | S1 Réglette verticale | S2 Bascule (baseline) | S3 Minimap horiz. | S4 Overlays rail G | S5 Chips inline |
|---|---|---|---|---|---|
| Voir N modèles **en même temps** | ✅ excellent | ❌ impossible | ⚠️ global mais imprécis | ✅ bon (mais à G) | ⚠️ dispersé |
| **Aligné** à la phrase | ✅ | n/a | ❌ (axe X) | ✅ | ✅ (mais bruyant) |
| **Préserve** la lecture | ✅ (hors flux, à D) | ✅ | ✅ | ❌ (charge la marge G) | ❌ (hache le texte) |
| **Scalable** à N modèles | ✅ | ❌ | ⚠️ | ⚠️ | ❌ |
| **A11y** forme+couleur, clavier | ✅ | ✅ | ⚠️ (trop petit) | ⚠️ | ⚠️ |
| **Coût** | moyen | nul | moyen | moyen | faible |

---

## Conclusion → décision

Le besoin A est **local et comparatif** : « pour CETTE phrase / CETTE zone, où chaque
modèle place-t-il sa frontière, et lesquels sont d'accord ? ». Cela impose :
(1) **alignement** à la phrase (axe **vertical**, sens de lecture), (2) **simultanéité**
de N modèles, (3) **préservation** de la zone de lecture, (4) **a11y** robuste.

- S2 échoue sur la simultanéité (c'est le problème), S3 sur l'alignement (axe X) et la
  densité, S4 sur la préservation de la lecture (charge la marge gauche + confond
  édition/référence), S5 sur l'intrusivité et la lecture croisée.
- **S1 (réglette multi-pistes verticale)** est la seule à cocher les quatre exigences
  simultanément, pour un surcoût d'implémentation **moyen** et **maîtrisé** (alignement
  mesuré), en **réutilisant** les runs, tokens et actions existants.

> La réglette **n'élimine pas** S2 (`compare` reste l'outil d'IAA chiffré et d'arbitrage) :
> elle s'y **ajoute** comme couche de visualisation simultanée. Décision détaillée et
> chiffrée : `A-choix.md` + `A-comparatif.csv`.
