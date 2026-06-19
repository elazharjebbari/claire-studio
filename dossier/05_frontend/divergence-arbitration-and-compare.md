# Arbitrage des divergences LLM, comparaison visuelle & ergonomie du menu

**Statut** : conception → implémentation
**Périmètre** : 6 points fonctionnels demandés sur l'atelier d'annotation
**Méthode** : pour chaque point, 2–4 solutions candidates, forces/faiblesses/pertinence,
puis choix final argumenté. Plan global + runbook en fin de document.

Le fil conducteur : transformer la comparaison Claude/Codex d'un simple *overlay
passif* (vert/ambre) en un **dispositif d'arbitrage actif** — naviguer les
désaccords, lire les preuves de chaque modèle au bon endroit, choisir, et garder
une trace visuelle de la décision — sans jamais perturber l'annotation humaine.

---

## Point 1 — Naviguer de divergence en divergence + arbitrer en choisissant une proposition

### Problème

En mode comparaison, l'utilisateur voit des rails vert/ambre mais doit *chercher*
les désaccords à l'œil et faire défiler. Il n'y a aucun moyen de (a) sauter au
désaccord suivant, (b) choisir explicitement la proposition d'un modèle, (c) voir
ensuite quelle proposition a été retenue.

### Solutions candidates

**S1 — Liste de divergences dans un panneau dédié.**
Un panneau liste toutes les divergences ; clic = saut.
*Forces* : vue d'ensemble, tri possible. *Faiblesses* : occupe de la place
permanente, double emploi avec le plan, éloigne l'action du texte. *Pertinence* :
moyenne — utile en complément, pas comme mécanisme principal.

**S2 — Navigation par curseur + raccourcis clavier (n/p) + barre flottante compacte.**
Un index pur des divergences ; deux flèches + compteur « 3 / 12 » ; raccourcis
`n` (next) / `p` (prev) qui déplacent le focus sur la frontière de divergence et
la centrent. *Forces* : reste dans le flux de lecture, rapide au clavier, faible
encombrement, déterministe et testable (fonction pure). *Faiblesses* : pas de vue
d'ensemble (compensée par P4). *Pertinence* : forte — c'est l'attendu d'un outil
d'annotation pro (cf. navigation « next diff » des IDE).

**S3 — Mini-carte (scrollbar annotée) avec ticks de divergence.**
Des marqueurs sur une réglette verticale. *Forces* : densité d'information.
*Faiblesses* : précision de clic faible, accessibilité délicate, redondant avec P4.
*Pertinence* : moyenne — bon complément visuel, mauvais mécanisme d'action.

**Arbitrage (choisir une proposition).**
- *A1* : appliquer le thème du juge à l'annotation humaine en réutilisant
  `seededFrom`. *Faiblesse* : confond « pré-rempli en masse » et « arbitré
  ponctuellement » — on perd la sémantique.
- *A2* : nouveau champ `resolvedFrom: "claude" | "codex" | null` sur la clause.
  Choisir une proposition crée/maj la clause humaine **à l'ancre de la frontière**
  avec le thème du juge ET marque `resolvedFrom`. *Force* : sémantique claire,
  voyant trivial, traçable, réversible. **Retenu.**

### Décision

**S2 + A2.** Index pur des divergences (`lib/divergence.ts`), barre flottante
`DivergenceNav` (flèches ◂ ▸ + compteur), raccourcis `n`/`p`. Dans le menu
clic-droit d'une divergence, deux boutons « Choisir Claude » / « Choisir Codex »
appellent `resolveDivergence(anchor, judge, theme)`. La phrase résolue porte un
**voyant** : pastille colorée par juge + « ✓ Claude » / « ✓ Codex ». S3 est
partiellement couvert par le panneau comparatif (P4), donc non dupliqué.

---

## Point 2 — Le menu clic-droit doit rester entièrement dans l'écran

### Problème

Le menu est positionné en `fixed` aux coordonnées du clic, avec un clamp
approximatif (`innerHeight − 360`). Près du bas/à droite, il est rogné ; il faut
remonter pour pouvoir clic-droiter — friction inacceptable.

### Solutions candidates

**S1 — Clamp à hauteur estimée constante (statu quo).**
*Forces* : trivial. *Faiblesses* : la hauteur varie (rationale dépliable,
propositions absentes/présentes) → estimation fausse, débordements résiduels.
*Pertinence* : faible.

**S2 — Mesure réelle post-rendu + flip + clamp (`useLayoutEffect`).**
On rend le menu (invisible/au point brut), on mesure `getBoundingClientRect`, puis
on repositionne : si débordement bas → ancrer au-dessus du curseur (flip vertical) ;
si débordement droite → ancrer à gauche ; enfin clamp dur aux bords avec marge de
8 px. *Forces* : exact quelle que soit la hauteur, comportement « menu natif »,
pas de saut visible (layout effect avant peinture). *Faiblesses* : un cycle de
mesure (négligeable). *Pertinence* : forte. **Retenu.**

**S3 — Librairie de positionnement (Floating UI / Popper).**
*Forces* : robuste, gère collisions/scroll. *Faiblesses* : dépendance lourde pour
un seul popover, surface d'API, poids bundle. *Pertinence* : moyenne — surdimensionné
ici, on a déjà tout le reste maison.

### Décision

**S2.** `useLayoutEffect` mesure le menu et calcule `{left, top}` avec flip + clamp
(marge 8 px), recalculé si la taille change (dépliage rationale) via `ResizeObserver`
défensif. Aucune dépendance ajoutée.

---

## Point 3 — Choisir la version d'annotation en haut, activation instantanée et non destructive

### Problème

Le sélecteur de version existe mais (a) n'apparaît qu'en source LLM active, (b) doit
basculer *instantanément* sur le document courant, (c) **sans perturber** les
éléments déjà annotés par l'humain.

### Solutions candidates

**S1 — Recharger l'annotation au changement de version.**
*Faiblesse* rédhibitoire : écrase/ą perturbe les drafts humains. *Pertinence* : nulle.

**S2 — Version = clé react-query de l'overlay LLM uniquement (déjà le socle).**
Les drafts humains vivent dans le store local, indépendants. Changer la version ne
touche QUE `useLlmAgreement` (overlay, menu, comparaison). Le cache react-query rend
le switch instantané (versions préchargées). On rend le sélecteur **toujours visible**
dès qu'il existe ≥ 1 version, indépendamment de la source, et on garantit par test
qu'aucun draft n'est modifié au switch. *Forces* : non destructif par construction,
instantané, simple. *Pertinence* : forte. **Retenu.**

**S3 — Dupliquer le sélecteur dans la barre d'outils.**
*Forces* : « en haut » au sens strict. *Faiblesses* : deux sources de vérité UI,
risque de désynchronisation. *Pertinence* : moyenne — on garde **une** instance,
placée en tête du document (déjà « en haut » de la zone d'annotation), et on
l'affiche inconditionnellement.

### Décision

**S2.** Sélecteur unique en tête de document, visible dès qu'il y a des versions,
pillé par le store (`llmVersion`), n'alimentant que l'overlay LLM. Test vitest
explicite : « changer de version ne modifie pas `draftClauses` ». Bonus : badge
« riche » indiquant la version qui porte rationale/evidence.

---

## Point 4 — Visualiser côte à côte les blocs contigus de Claude et de Codex

### Problème

Comprendre *rapidement* où les segmentations se chevauchent et où elles divergent.
L'overlay par phrase (vert/ambre) ne montre pas la *structure en blocs* des deux
modèles ni leurs catégories en parallèle.

### Solutions candidates

**S1 — Deux colonnes de blocs alignées par index de phrase (timeline verticale).**
À gauche les runs de Claude, à droite ceux de Codex ; hauteur ∝ nombre de phrases ;
couleur = thème ; un liseré central marque accord (vert) / divergence (ambre) par
tranche. Clic sur un bloc = saut + focus. *Forces* : la structure saute aux yeux,
les frontières décalées sont visibles d'un coup d'œil, ergonomie « diff à deux
volets » familière. *Faiblesses* : place latérale (→ panneau togglable, pas
permanent). *Pertinence* : forte. **Retenu.**

**S2 — Bandeau horizontal unique empilant deux pistes.**
*Forces* : compact en hauteur. *Faiblesses* : pour des documents longs, les blocs
deviennent minuscules horizontalement ; lecture des catégories difficile.
*Pertinence* : moyenne.

**S3 — Tableau phrase × {Claude, Codex}.**
*Forces* : exhaustif. *Faiblesses* : verbeux, ne fait pas ressortir les blocs
contigus (l'essentiel de la demande). *Pertinence* : faible.

### Décision

**S1**, sous forme de **panneau comparatif togglable** (`ComparePanel`) affiché à la
demande (bouton + raccourci), visible surtout en mode comparaison. Design : deux
rails verticaux, étiquette de thème par bloc (tronquée + tooltip complet), liseré
d'accord/divergence au centre, surbrillance synchronisée avec la phrase focalisée,
clic = saut. Palette : couleurs de thème existantes (cohérence) ; accord = emerald,
divergence = amber, déjà tokenisés. Accessible (rôle liste, labels ARIA, navigable).

---

## Point 5 — Aperçu evidence span / rationale d'un modèle au niveau de la frontière

### Problème

Pour arbitrer une frontière, il faut souvent lire la **preuve** (evidence span) et/ou
le **raisonnement** (rationale) du modèle. Aujourd'hui ce n'est accessible que via le
menu complet de la phrase. On veut un accès *au niveau de la frontière même*.

### Solutions candidates

**S1 — Popover « aperçu » déclenché par une icône à la frontière.**
À chaque début de run, une petite icône « 👁/ⓘ » ouvre un popover compact montrant,
pour le juge choisi (Claude/Codex, sélectionnable), thème + evidence + rationale.
*Forces* : ciblé, non intrusif, réutilise le rendu du menu. *Faiblesses* : un clic
nécessaire. *Pertinence* : forte. **Retenu (mécanisme principal).**

**S2 — Aperçu inline dépliable sous la frontière.**
La frontière peut se « déplier » en une carte d'arbitrage inline (Claude vs Codex,
evidence/rationale en regard). *Forces* : tout reste dans le flux, compare les deux
d'un coup. *Faiblesses* : pousse le texte verticalement. *Pertinence* : forte —
**retenu comme variante du popover** : le popover propose un onglet « comparer » qui
affiche les deux modèles côte à côte.

**S3 — Tooltip au survol.**
*Forces* : zéro clic. *Faiblesses* : inaccessible au clavier/tactile, contenu long
(rationale) inadapté au tooltip, disparaît trop vite. *Pertinence* : faible.

### Décision

**S1 + S2.** Affordance d'aperçu à la frontière (icône discrète sur le badge de
clause), ouvrant un popover `BoundaryEvidence` : sélecteur Claude/Codex/Comparer,
affichage thème + evidence span (cité) + rationale (dépliable). Depuis ce popover,
bouton « Choisir cette proposition » (réutilise `resolveDivergence` de P1) pour
fermer la boucle audit → décision au même endroit. Clavier : touche `e` ouvre
l'aperçu de la frontière courante.

---

## Point 6 — Enrichir la visite guidée + raccourcis clavier pertinents

### Problème

La visite ne couvre pas les nouvelles capacités ; les raccourcis doivent rester
mémorisables et sans collision.

### Solutions candidates

**S1 — Étendre la visite linéaire existante (driver.js) + table de raccourcis.**
*Forces* : continuité, filtrage d'étapes déjà en place, faible coût. *Pertinence* :
forte. **Retenu.**

**S2 — Visites contextuelles multiples (par fonctionnalité).**
*Forces* : ciblé. *Faiblesses* : complexité de déclenchement, sur-ingénierie ici.
*Pertinence* : moyenne (évolution future).

### Décision

**S1.** Nouvelles étapes : navigation des divergences (n/p), arbitrage par
proposition + voyant, sélecteur de version, panneau comparatif, aperçu de frontière.
Récap des raccourcis enrichi. Centre d'aide (`/help`) mis à jour.

#### Raccourcis clavier (table consolidée, sans collision)

| Touche | Action | Portée |
|---|---|---|
| `j` / `k` | phrase suivante / précédente | toujours |
| `n` / `p` | **divergence** suivante / précédente | mode comparaison |
| `b` | poser/ouvrir la palette de thème (frontière) | toujours |
| `t` | cibler la recherche de thème | toujours |
| `c` | commentaire | toujours |
| `e` | **aperçu evidence/rationale** de la frontière courante | toujours |
| `g` | **basculer le panneau comparatif** | toujours |
| `1` / `2` | **adopter la proposition Claude / Codex** sur la divergence courante | mode comparaison |
| `0`–`3` | certitude de la clause sélectionnée | toujours |
| `⌘/Ctrl-S` | snapshot | toujours |
| `⌘/Ctrl-K` | palette de commandes | toujours |

> Note de cohérence : `1`/`2` servent à *adopter Claude/Codex* uniquement en mode
> comparaison sur une divergence ciblée ; hors de ce contexte, `0`–`3` conservent
> leur rôle de certitude (pas de focus de divergence → pas d'interception).

---

## Plan de résolution global

1. **Socle pur & store** (testable sans React)
   - `lib/divergence.ts` : `divergenceIndices(claudeByIndex, codexByIndex)`,
     `nextDivergence/prevDivergence(cursor, list)`.
   - Store : champ `resolvedFrom` sur `DraftClause` ; action
     `resolveDivergence(anchorIndex, judge, theme)` (crée/maj la clause humaine +
     `resolvedFrom`, `dirty=true`) ; reset/init inchangés (resolvedFrom porté par la clause).
2. **Composants**
   - `DivergenceNav` (flèches + compteur), branché sur l'index de divergences.
   - `ComparePanel` (deux rails alignés, togglable) + état `showComparePanel` (store).
   - `BoundaryEvidence` (popover d'aperçu) réutilisant le rendu juge du `SentenceMenu`.
   - `SentenceMenu` : boutons « Choisir Claude/Codex » + repositionnement mesuré (P2).
3. **Intégration DocumentPanel / Toolbar**
   - Barre de divergences en mode comparaison ; voyant `resolvedFrom` sur la phrase ;
     icône d'aperçu sur le badge de frontière ; sélecteur de version toujours visible.
   - Fix : transmettre `themeFocusRef` à `InspectorPanel`.
4. **Raccourcis** : étendre `useShortcuts` (n/p, e, g, 1/2 contextualisés) via callbacks.
5. **Visite & aide** : étapes + table de raccourcis + page `/help`.
6. **Tests** : vitest (divergence, store, positionnement) + playwright (5 parcours) + MSW.
7. **Runbook** : exécution de bout en bout + critères de validation.

### Principes non négociables

- **Non-destructif** : aucune action LLM (switch version, overlay, comparaison) ne
  modifie `draftClauses` ; seules les actions humaines explicites le font.
- **Pur d'abord** : toute logique d'index/divergence est pure et testée isolément.
- **A11y** : rôles ARIA, navigation clavier, contrastes tokenisés.
- **Zéro dépendance nouvelle** : positionnement et panneaux maison.

---

## Runbook (exécution de bout en bout)

> Paths utilisateur (machine locale). Le sandbox ne peut pas écrire la base SQLite ;
> la reconstruction DB est une étape locale.

### 0. Pré-requis
```
cd /Users/elazhar/PycharmProjects/claire-studio
```

### 1. Backend (données réelles multi-versions)
```
cd backend
rm -f db.sqlite3*          # repart d'une base saine
make feed-all              # migrate + feed_db --all + import_annotations_archive
make run                   # http://localhost:8000
```
Vérifier : `GET /api/v1/documents/<id>/annotation-versions` renvoie ≥ 2 versions.

### 2. Frontend
```
cd ../frontend
cp .env.local.example .env.local   # NEXT_PUBLIC_ENABLE_MOCKS=false en réel
npm install
npm run dev                        # http://localhost:3000
```

### 3. Vérification fonctionnelle (mode comparaison)
1. Ouvrir une annotation → barre d'outils, passer la source sur **Comparaison**.
2. **P3** : changer la **Version** en haut → l'overlay LLM change *instantanément* ;
   vérifier que les clauses humaines déjà posées **ne bougent pas**.
3. **P1** : `n`/`p` ou les flèches sautent de divergence en divergence (compteur à jour).
4. **P1** : clic-droit sur une divergence → « Choisir Claude » (ou `1`) → la phrase
   porte le **voyant ✓ Claude** ; « Choisir Codex » (ou `2`) bascule le voyant.
5. **P2** : clic-droit tout en bas de l'écran → le menu reste **entièrement visible**
   (flip vers le haut), sans scroll.
6. **P4** : `g` (ou le bouton) ouvre le **panneau comparatif** ; repérer un bloc
   divergent (liseré ambre), cliquer → saut à la phrase.
7. **P5** : `e` (ou l'icône de frontière) ouvre l'**aperçu** evidence/rationale ;
   basculer Claude/Codex/Comparer ; « Choisir cette proposition » referme la boucle.
8. **P6** : bouton « Visite guidée » → les nouvelles étapes s'affichent ; `/help`
   liste les raccourcis.

### 4. Tests automatisés
```
# Vitest + tsc (sandbox ou local)
cd frontend && node_modules/.bin/tsc --noEmit && npx vitest run
# Playwright (local, en mode mock)
NEXT_PUBLIC_ENABLE_MOCKS=true npm run build && npm run start &
npm run e2e
# Backend
cd ../backend && pytest -q
```

### 5. Critères de validation (Definition of Done)
- [ ] `tsc --noEmit` : 0 erreur.
- [ ] Vitest : 100 % vert, dont divergence.ts, resolveDivergence, positionnement.
- [ ] Playwright : 5 nouveaux parcours verts + suite existante verte.
- [ ] Switch de version prouvé non destructif (test dédié).
- [ ] Menu jamais rogné en bas/à droite (test de positionnement).
- [ ] Visite guidée enrichie + `/help` à jour.
- [ ] Commit conventionnel unique et lisible.
