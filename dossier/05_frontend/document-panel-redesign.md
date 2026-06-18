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

## 3bis. Audit v2 + solutions (itération 2)

Retours terrain (capture Instagram) et nouvelles demandes :

**(a) Bruit visuel des bandeaux « ▸ DÉBUT DE CLAUSE · … ».** Répété à chaque clause (beaucoup de
`BOILERPLATE DIVERS`), en MAJUSCULES pleine largeur → fatigue, dilue l'information.
| Option | Forces | Faiblesses |
|---|---|---|
| **A. Puce-thème compacte** (✅) : petite pastille colorée + label court à gauche, sans « DÉBUT DE CLAUSE ». Le rail + le pointillé portent déjà la frontière. | Discret, garde le thème, supprime la redondance. | Le mot « clause » disparaît (acceptable : la frontière reste visible). |
| B. Bandeau au survol uniquement | Zéro bruit au repos. | Moins découvrable, instable au survol. |
| C. Label en marge (gouttière) | Très propre. | Largeur de gouttière coûteuse en lecture. |
→ **A** : puce + code thème compact ; option densité dans `/settings` plus tard.

**(b) Sélection multi-blocs au bouton DROIT maintenu + annoter ensemble + compteur.**
| Option | Forces | Faiblesses |
|---|---|---|
| **A. Right-press + drag sur les blocs → plage de clauses, tooltip compteur, relâche = sélection ; clic-droit simple = menu phrase** (✅) | Gestuelle demandée ; pas de calcul de marquee (on suit le bloc survolé) ; un seul bouton. | Doit neutraliser le `contextmenu` après un drag ; distinguer clic vs drag. |
| B. Cases à cocher par bloc | Explicite. | Lourd, casse la lecture. |
| C. Shift+clic au niveau bloc | Simple. | Pas la gestuelle demandée. |
→ **A** : sélection de **blocs** (clauses) par glisser au bouton droit, **tooltip “N bloc(s)”** suivant
le curseur ; au relâchement, `SelectionToolbar` propose « Annoter les N blocs » (ThemePalette →
applique le thème à toutes les clauses sélectionnées) ; un clic-droit **sans déplacement** ouvre le
menu phrase (inchangé).

**(c) Masquer la traduction d'une phrase.** Le menu devient un **toggle** « Afficher/Masquer la
traduction » + une croix `×` sur la ligne FR. `setTranslated(i,false)` la retire.

**(d) Mode « traduction seule » (switch ergonomique en barre).** Remplacer le booléen `translateAll`
par un mode d'affichage **segmenté 3 états** : `VO` (original) · `Bilingue` · `FR` (traduction seule).
| Option | Forces | Faiblesses |
|---|---|---|
| **A. Switch segmenté 3 états `displayLang`** (✅) | Lisible, état unique, toutes les fonctions opèrent sur le texte affiché (mêmes index) ; bascule VO⇄FR instantanée. | Demande de remplacer `translateAll` partout. |
| B. 2 checkboxes (bilingue / FR-only) | Simple. | États incohérents possibles. |
→ **A** : `displayLang: 'orig' | 'both' | 'fr'` dans le store. En mode `fr`, chaque phrase REND le
texte FR (repli VO si traduction absente) ; **annotation, frontières, menu, sélection, injustice**
fonctionnent à l'identique (l'unité reste l'index de phrase). En `both`, VO + ligne FR. Le toggle
per-phrase et `translatedSentences` ne s'appliquent qu'en mode `both`/`orig` (surcouche ponctuelle).

**(e) Données.** Importer/ą confirmer les pré-annotations LLM (claude/codex) **déjà** présentes en base
(feed `--all` = 100 préannotations) ; **traduire réellement** le 1er document de test (Instagram, 158
phrases) phrase par phrase et re-synchroniser. **(f)** Mettre à jour le centre d'aide + la visite guidée.

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

## 5. Plan d'action itération 2 (P7→P12)

> **Statut itération 2** : P7 ✅ · P8 ✅ · P9 ✅ · P10 ✅ · P12 ✅ (P11 = données/backend,
> hors périmètre frontend). `tsc --noEmit` 0 erreur + Vitest 67/67 verts sur `/tmp/fe`.
> Spec E2E `document-ux.spec.ts` mise à jour (`lang-both`/`lang-fr`) ; clic simple inchangé.
>
> - **P7** ✅ : bandeau verbeux remplacé par une **puce compacte** (`data-testid="clause-badge"`) :
>   pastille couleur du thème + label court (casse normale), `seededFrom` en petit. Le rail
>   gauche + le pointillé (P2) portent la frontière.
> - **P8** ✅ : hook `useBlockDragSelect.ts` (right-press + drag → plage de clauses via
>   `clauseRangeBetween`/`runAt`), tooltip flottant `block-select-tip`, suppression du
>   `contextmenu` après un drag (clic-droit immobile → menu phrase inchangé), `user-select:none`
>   temporaire + `pointercancel`. Store `selectedClauseIds` + `setSelectedClauses`/
>   `clearClauseSelection`. `SelectionToolbar` mode blocs : « N bloc(s) » + `annotate-blocks`
>   (ThemePalette → `updateDraft(localId,{theme})` sur toutes les clauses) + « Effacer ».
> - **P9** ✅ : `SentenceMenu` toggle « Traduire / Masquer la traduction » + croix
>   `hide-translation-${i}` sur la ligne FR (`setTranslated(i,false)`).
> - **P10** ✅ : booléen `translateAll` remplacé par `displayLang:'orig'|'both'|'fr'`
>   (`setDisplayLang`, défaut `orig`). `LangSwitch.tsx` segmenté 3 états
>   (`lang-switch`/`lang-orig`/`lang-both`/`lang-fr`, `radiogroup`/`radio`, clavier ←/→).
>   En mode `fr` : texte FR rendu (repli VO + indicateur « VO »). Surcouche per-phrase
>   limitée à `orig`/`both`. Overlay TocPanel `toggle-translation` rebranché sur
>   `displayLang` (`orig`⇄`fr`). Interactions inchangées (unité = index de phrase).
> - **P12** ✅ : aide `selection-blocs.md` + `modes-langue.md` (manifest + index), MAJ
>   `workspace.md`/`raccourcis.md` ; visite guidée (`lang-switch`, sélection blocs, Frontières).
> - **Tests** : `workspaceStore.test.ts` étendu (displayLang, selectedClauseIds), nouveau
>   `blockSelect.test.ts` (mapping plage→clauses), `document-ux.spec.ts` mis à jour.

- **P7** Puce-thème compacte (remplace le bandeau verbeux) — `DocumentPanel`.
- **P8** Sélection multi-blocs au bouton droit + tooltip compteur + « Annoter N blocs » —
  `useBlockDragSelect` hook, `SelectionToolbar` (mode blocs), store `selectedClauseIds`.
- **P9** Masquer la traduction (toggle menu + `×` sur la ligne FR).
- **P10** Switch segmenté `displayLang` (VO/Bilingue/FR) ; rendu du texte FR en mode `fr` ; toutes les
  interactions opèrent sur l'index (inchangées). Remplace `translateAll`.
- **P11** Données : confirmer les pré-annotations LLM en base ; **traduction réelle** d'Instagram
  (158 phrases) → `data/translations/claudette_fr/Instagram.txt` + re-sync DB.
- **P12** Docs (`/help`) + visite guidée : nouvelles sections/étapes (sélection blocs, modes de langue).
Vérif : tsc 0 ; Vitest verts ; pytest verts ; specs E2E (anciennes + `document-ux`) vertes.

Critères de fin : tsc 0 ; Vitest verts ; pytest verts ; specs E2E nouvelles + anciennes vertes ;
frontières togglables et subtiles ; menu long-press/clic-droit fonctionnel avec accord LLM ;
multi-sélection + actions ; traduction phrase/sélection/document depuis la source réelle.
