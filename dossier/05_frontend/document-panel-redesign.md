# Refonte ergonomique du panneau central (DocumentPanel)

> Analyse → solutions comparatives → plan d'action → runbook. Cible : lecture/annotation
> fluide, frontières lisibles, menu d'annotation au survol prolongé, multi-sélection,
> traduction locale phrase/sélection/document.

## 1. Existant & limitations

`DocumentPanel.tsx` rend chaque phrase en ligne, avec : un bandeau « ▸ Début de clause » à
chaque ancre, le surlignage d'injustice CLAUDETTE (overlay), un badge « fantôme » LLM sur les
phrases non ancrées. Interactions : **clic** = focus + pose/sélection d'ancre ; clavier `B/T/C/0-3`.

Limites constatées (cf. capture) :

1. **Frontières & runs peu lisibles.** Rien ne matérialise visuellement qu'une suite de phrases
   appartient à la *même* clause/thème ; la frontière n'est qu'un bandeau texte. Difficile de
   « voir » les blocs et leurs limites d'un coup d'œil.
2. **Pas de menu contextuel.** Le clic fait une seule action (poser/sélectionner). Impossible
   d'ouvrir, depuis la phrase, un mini-menu pour annoter finement **ou** consulter ce que Claude /
   Codex ont proposé pour cette phrase et leur niveau d'accord.
3. **Pas de multi-sélection.** On ne peut annoter qu'une frontière à la fois ; aucune action de
   masse.
4. **Traduction absente côté lecture.** Les `Translation` (FR) existent en base mais **aucun
   endpoint ne les expose** ; l'overlay « Traduction (FR) » n'a pas de source. Aucun bouton pour
   traduire une phrase, une sélection ou le document.

## 2. Solutions comparatives (par axe) + recommandations

### Axe 1 — Visualiser les runs de thème + frontières pointillées

| Option | Description | Forces | Faiblesses |
|---|---|---|---|
| **A. Rail couleur + séparateur pointillé** (✅ recommandé) | Bande verticale gauche teintée par le thème, continue sur tout le run ; trait **pointillé subtil** en haut de chaque clause (togglable). | Frontières + appartenance lisibles d'un coup ; n'altère pas le texte ; compatible thème sombre ; cohérent avec la pastille déjà présente. | Couleur gauche peut concurrencer l'overlay injustice → garder faible opacité + emplacements distincts (gauche vs surlignage du texte). |
| B. Fond teinté par run | Fond léger coloré par thème derrière toutes les phrases du run. | Très visible. | Fatigue oculaire, conflit fort avec le surlignage d'injustice, contraste AA difficile sur fond sombre. |
| C. Pointillés seuls entre clauses | Uniquement un trait pointillé entre blocs. | Minimal, zéro distraction. | N'aide pas à *voir l'appartenance* d'une phrase à son run. |

**Choix : A.** Rail gauche (theme color, ~3px, opacité modérée) + `border-top` **dashed** subtil
(`ink-muted/30`) au début de chaque clause. Overlay « Frontières » activable/désactivable
(défaut ON), indépendant du surlignage d'injustice. Bonnes pratiques : séparer les canaux visuels
(couleur de bord = thème ; surlignage de texte = injustice ; pointillé = frontière) pour éviter la
surcharge (loi de Hick, préattention couleur/position).

### Axe 2 — Menu d'annotation au clic maintenu

| Option | Description | Forces | Faiblesses |
|---|---|---|---|
| **A. Long-press + clic-droit → popover** (✅ recommandé) | Maintien ~450 ms **ou** clic droit ouvre un popover ancré à la phrase : annoter (thème/certitude/frontière) + bloc « LLM : Claude=… Codex=… ✓/✗ accord ». | Couvre souris **et** tactile ; le clic simple reste rapide (focus/ancre) ; découvrable (le clic-droit est standard). | Long-press inhabituel sur desktop → on l'**ajoute** au clic-droit, pas en remplacement. |
| B. Clic-droit seul | Menu contextuel natif-like. | Standard desktop. | Pas tactile ; l'utilisateur a demandé « rester cliqué ». |
| C. Survol → mini-barre | Barre d'actions au hover. | Zéro clic. | Transitoire, instable, mauvais en tactile, masque le texte. |

**Choix : A** (long-press **et** clic-droit, même popover). Popover maison (zéro dépendance),
positionné aux coordonnées, fermé au clic extérieur/`Échap`, navigable clavier. Le bloc LLM lit les
fantômes déjà chargés (Claude+Codex) : on calcule le thème du run LLM couvrant la phrase pour chaque
juge et on affiche un indicateur d'accord (✓ identiques / ✗ divergents avec les deux thèmes).

### Axe 3 — Multi-sélection + traduction locale

**Multi-sélection** — recommandé : **Shift+clic** (étend une plage depuis la dernière phrase),
**Cmd/Ctrl+clic** (ajoute/retire), surlignage des phrases sélectionnées + **barre d'action flottante**
quand la sélection est non vide (« Annoter la sélection », « Traduire la sélection », « Effacer »).
(Alternative drag-select écartée : conflit avec la sélection de texte natif et plus dur à rendre
fiable/testable.) « Annoter la sélection » = poser une frontière au 1er index sélectionné avec un
thème choisi et fusionner les ancres intermédiaires → la clause couvre toute la sélection.

**Traduction (déjà stockée localement)** — la traduction n'est pas un appel en ligne mais l'**affichage**
du texte FR stocké. Trois portées, un seul mécanisme :
- **Phrase** : bouton « 🌐 » au survol + entrée « Traduire » dans le menu long-press → affiche la
  traduction sous la phrase.
- **Sélection** : bouton de la barre d'action.
- **Document** : bouton d'en-tête « Traduire le document » → bascule l'overlay global.

| Option d'affichage | Forces | Faiblesses |
|---|---|---|
| **Ligne FR sous l'original** (✅) | Garde le contexte original ↔ traduction (lecture comparée) ; non destructif. | +50 % de hauteur quand global → réservé aux phrases ciblées + toggle global. |
| Remplacement du texte | Compact. | Perd l'original (l'annotation porte sur l'original tokenisé). |
| Info-bulle au survol | Discret. | Inexploitable pour lire/comparer en continu. |

**Backend requis** : `GET /documents/{id}/translations?lang=fr` → `{language, results:[{sentenceIndex,text}]}`
(lecture des `Translation` du set de la langue). Aucun appel de traduction en ligne.

## 3. Plan d'action (incrémental, modulaire, testable)

> **Statut** : P0 ✅ (backend livré) · P1 ✅ · P2 ✅ · P3 ✅ · P4 ✅ · P5 ✅ · P6 ✅
> (Vitest 59/59 verts, `tsc --noEmit` 0 erreur sur `/tmp/fe`). E2E `document-ux.spec.ts`
> écrit (mode mock) ; specs existantes inchangées (clic simple préservé).

- **P0 — Backend** ✅ : `GET /documents/{id}/translations?lang=fr` →
  `{language, count, results:[{sentenceIndex, text}]}`.
- **P1 — État** ✅ : store étendu — `showBoundaries` (défaut true), `selectedSentences:number[]`,
  `translateAll`, `translatedSentences:number[]` ; actions `toggleBoundaries`, `selectRange(from,to)`,
  `toggleSelected(i)`, `clearSelection`, `setTranslated(i,on)`, `toggleTranslateAll`.
  Choix `number[]` (vs `Set`) pour sérialisation/tests simples. Couvert par `tests/workspaceStore.test.ts`.
- **P2 — Runs & frontières** ✅ : `src/lib/runs.ts` pur (`computeRuns`, `runAt`, `runThemeAt`,
  `judgeThemeAt`) ; dans `DocumentPanel`, rail gauche `box-shadow inset 3px` teinté par le thème du run
  (opacité ~0.5) + `border-top` dashed `surface-text-muted/0.3` au début de clause, togglable
  (`boundary-toggle`). Pastille + bandeau « Début de clause » conservés. Tests `tests/runs.test.ts`.
- **P3 — Menu phrase** ✅ : `useLongPress.ts` (pointerdown→450 ms, annulé si move>8 px / up ;
  `onContextMenu` clic-droit) + `SentenceMenu.tsx` (popover `fixed`, clic extérieur + Échap, clavier).
  Blocs : Annoter (poser frontière, mini-ThemePalette, CertaintyPicker) ; LLM (accord Claude/Codex via
  `judgeThemeAt`) ; Traduire la phrase. Accord testé dans `tests/judgeAgreement.test.ts`.
- **P4 — Multi-sélection** ✅ : Shift+clic → `selectRange(lastFocused,i)` ; Cmd/Ctrl+clic →
  `toggleSelected` ; surlignage (anneau accent). `SelectionToolbar.tsx` flottante : compteur,
  « Annoter la sélection » (pose frontière au 1er index + `removeBoundary` des ancres internes),
  « Traduire la sélection », « Effacer ».
- **P5 — Traduction** ✅ : `useDocumentTranslations(documentId, "fr")` (Map index→texte) ; ligne FR
  `translation-${i}` sous la phrase si `translateAll || translatedSentences.includes(i)` ; bouton
  d'en-tête `translate-document` (toggle `translateAll`) ; overlay TocPanel `toggle-translation`
  rebranché sur `toggleTranslateAll` (même source). Handler MSW `GET /documents/:id/translations`.
- **P6 — Tests & a11y** ✅ : Vitest (`runs`, `judgeAgreement`, extension `workspaceStore`) ;
  Playwright `e2e/document-ux.spec.ts` (frontières togglables via `data-boundary`/`data-dashed`,
  clic-droit `sentence-menu`+`menu-llm`, Shift+clic `selection-toolbar` = « 3 », `translation-0`).
  Menu/toolbar navigables clavier, focus visibles, contrastes via tokens.

Qualités visées : **modulaire** (utils purs + composants isolés), **débogable** (data-testid,
erreurs via le bandeau API), **évolutif** (runs/translations génériques), **fiable** (tests),
**optimal** (mémoïsation des runs, pas de re-render global).

## 4. Runbook d'exécution

```
# 0. Pré-vol
cd backend && export DATABASE_URL="sqlite://:memory:" DJANGO_SETTINGS_MODULE=config.settings.dev DJANGO_SECRET_KEY=k
python3 -m pytest -q                       # base verte avant de commencer

# P0 backend
#  - éditer claire/corpora/views.py (action translations) + serializer
python3 manage.py check && python3 -m pytest -q tests/test_api_contract_shapes.py tests/test_translations*.py
#  - smoke live : runserver + curl GET /documents/<id>/translations?lang=fr (→ {results:[{sentenceIndex,text}]})

# P1→P5 frontend (sur copie /tmp/fe pour tsc/vitest)
cd frontend
#  - store, utils runs, SentenceMenu, SelectionToolbar, hooks, DocumentPanel
node_modules/.bin/tsc --noEmit            # 0 erreur
npx vitest run                            # unit verts (runs/store/accord LLM)

# P6 E2E (sur la machine)
npx playwright test e2e/document-ux.spec.ts
npx playwright test                       # non-régression (26+ specs)

# Lancement
make -C ../backend run   &  npm run dev   # recharger /annotate/<id>
```

Critères de fin : tsc 0 ; Vitest verts ; pytest verts ; specs E2E nouvelles + anciennes vertes ;
frontières togglables et subtiles ; menu long-press/clic-droit fonctionnel avec accord LLM ;
multi-sélection + actions ; traduction phrase/sélection/document depuis la source réelle.
