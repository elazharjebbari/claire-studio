# Plan d'action — Refonte du workspace d'annotation Pactiva

> Source : `00-audit/audit-uiux.json` (7 axes vérifiés contre le code) et `01-besoins/besoins.md`.
> Décisions arrêtées : (1) Hover = `RationaleHover` popover passif ; (2) Nature = `NaturePicker` + badge, le volet « nature LLM » est une dépendance backend/loader ; (3) Inspecteur = refonte en 2 lots ; (4) Toolbar = `ToolbarShell` + groupes + overflow + section Sélection ; (5) Minimap verticale (remontée du conteneur de scroll) ; (6) Gutter = segments continus (hybride, option C) ; (7) Compare déjà N-way → corriger le bandeau pairwise + sticky.

Le travail est découpé en **3 lots** ordonnés par risque croissant. Les **Lots A et B sont 100 % frontend** (déployables sans migration ni redéploiement backend). Le **Lot C** porte la chaîne backend `legal_nature` LLM (migration + loader + serializer) et débloque le besoin B2.2 / B3.b « nature consultable par LLM ».

---

## Vue d'ensemble

| Lot | Contenu | Besoins couverts | Couches | Effort | Risque | Déployable seul |
|-----|---------|------------------|---------|--------|--------|-----------------|
| **A** | Hover rationale + NaturePicker (présentation humaine) + Gutter segments continus + Compare banner N-way & sticky | B1.1/B1.2, B2.1, B6.*, B7.2 (+ B7.1 wording) | front | M | faible | ✅ |
| **B** | Refonte InspectorPanel (Lot 1) + ToolbarShell/groupes/overflow/Sélection + Minimap verticale | B3.a/B3.c/B3.d, B4.*, B5.1 | front | L | moyen | ✅ (après A) |
| **C** | Chaîne `legal_nature` LLM bout-en-bout : loader (jointure `annotations[].id`), modèle + migration, services, serializer, type, `JudgeDetail`, comparateur N-modèles | B2.2, B3.b (« consultable par LLM ») | back + front | L | élevé (migration prod) | ❌ (dépend de A pour `NaturePicker`/badge, de B pour l'inspecteur) |

**Ordre de déploiement** : A → B → C. A et B sont strictement additifs côté UI ; C introduit une migration Django et touche le pipeline d'ingestion (services prod). Chaque lot est un déploiement `deploy/deploy-claire.sh` indépendant (gate tsc + vitest, healthcheck, rollback auto). Voir `runbook.md`.

---

## Lot A — Améliorations UI à risque faible (front, M)

Objectif : livrer immédiatement la valeur perçue la plus forte sur des données **déjà présentes côté client**, sans toucher au backend ni aux structures de l'inspecteur/toolbar (limite la surface de régression).

### A.1 — Hover rationale (`RationaleHover`) — axe 1

- **Quoi** : popover passif au survol prolongé (~300 ms) d'une phrase, fermé en quittant la zone (tampon ~120 ms anti-papillotement). Affiche : puce + label du thème, rationale **humain** (tronqué ~160 car.), et une ligne condensée par juge présent (`{Juge} · {label thème}`) + evidence en italique. `pointer-events-none` (n'intercepte ni clic, ni long-press, ni drag de sélection).
- **Création** : `frontend/src/components/workspace/RationaleHover.tsx` (gabarit `BoundaryEvidence.tsx`, variante passive : `z-40`, pas de listener clic-extérieur/Escape).
- **Câblage** : `DocumentPanel.tsx` — état `hover:{index,x,y}|null` + timer ref ; `onPointerEnter/onPointerLeave` sur le `<span>` de texte (`DocumentPanel.tsx:1110-1124`), garde `pointerType==='mouse'`. N'ouvrir que si `anchorByIndex.get(index)?.rationale` non vide OU au moins un `detailAt(...)` non nul.
- **a11y** : conserver un `title` natif minimal (thème + 1re phrase du rationale) sur le `<span>` comme repli tactile/lecteur d'écran.
- **Données** : aucune — `DraftClause.rationale/evidenceSpan` (humain) + `JudgeDetail` via `detailMapByJudge/detailAt` (LLM) existent déjà.
- **Réutilise** : `useAnchoredPosition.ts`, animation `fade-in` (`tailwind.config.ts:60-66`), `getThemeToken`, `llmJudgeLabel`, `JudgeEntry/JudgeDetail` (`SentenceMenu.tsx:28-43`).

**Critères d'acceptation A.1**
- AC-A1-1 : survol > ~300 ms d'une phrase annotée → `[data-testid="rationale-hover"]` visible, contient le label du thème et le rationale humain quand il existe.
- AC-A1-2 : survol d'une phrase **sans** rationale humain **ni** detail LLM → aucun popover (pas de bruit en lecture).
- AC-A1-3 : le clic simple, le clic-droit (`sentence-menu`), le long-press et le drag de sélection de blocs fonctionnent identiquement avec le hover actif (popover `pointer-events-none`).
- AC-A1-4 : sortie du curseur → fermeture sous ~150 ms ; pas de papillotement lors d'un déplacement court à l'intérieur de la phrase.

### A.2 — `NaturePicker` + badge (présentation humaine seule) — axe 2 (volet UI)

- **Quoi** : remplacer le `<select>` natif (`InspectorPanel.tsx:110-127`) par un composant à pastilles calqué sur `ThemePalette` (radiogroup ARIA, `describeOnHover` affichant `LegalNature.definition`). Ajouter un badge de nature à droite du `ClauseChip` (`InspectorPanel.tsx:69`) et l'exposer dans le hover de l'axe 1.
- **Création** : `frontend/src/components/ui/NaturePicker.tsx` ; helper **requis** `legalNatureToken(code)` dans `lib/tokens.ts` (les natures n'ont pas de couleur dans le type ni le YAML → couleur à dériver pour des pastilles fidèles à `ThemePalette`).
- **Pré-requis data (transverse, non bloquant)** : ajouter le champ `definition` aux 6 natures de `dossier/00_overview/vocabulary.yaml:34-39` (type/serializer le supportent déjà ; valeur actuellement vide) pour alimenter le hover explicatif.
- **Périmètre Lot A** : **présentation humaine uniquement**. La colonne « nature LLM » du comparateur et du `SentenceMenu` affiche `—` proprement tant que le Lot C n'est pas livré (aucune heuristique : préserve la confiance dans l'arbitrage).
- **Données** : côté humain, **rien à exposer** — `Clause.legalNature`, `PivotClause.legal_nature`, `addClause/patchClause(legal_nature)`, diff (`versionDiff.ts:21`) et verbe `clause.set_legalNature` existent déjà.

**Critères d'acceptation A.2**
- AC-A2-1 : sélection d'une nature dans `NaturePicker` → `updateDraft(localId,{legalNature})` ; persistance via autosave inchangée.
- AC-A2-2 : survol prolongé d'une pastille → tooltip avec label + définition (après ~450 ms, parité `ThemePalette`).
- AC-A2-3 : badge de nature visible dans l'en-tête de clause ; absence de nature → pas de badge (pas de placeholder bruyant).

### A.3 — Gutter à segments continus (hybride, option C) — axe 6

- **Quoi**, dans `ModelBoundaryRail.tsx` (`ModelBoundaryStrip`), en gardant le rendu par-ligne (alignement natif sans mesure pixel, `ModelBoundaryRail.tsx:7`) :
  1. **Continuité** : cellules jointives (retirer `gap-px` l.59 et `rounded-[1px]` l.101) ; arrondir seulement la 1re (`isStart`) et la dernière (`isEnd = seg.endSentence === i`) phrase du run.
  2. **Teinte toujours visible** : appliquer `token.color` (alpha ~30 %) même si `gutterShowCategory=false` ; le toggle « Catégories » devient un toggle d'**intensité/étiquette** (alpha plus fort + libellé), pas d'apparition. Fond gris `--surface-border` réservé aux runs sans thème.
  3. **Ruptures nettes** : à `isStart && prevSeg && prevSeg.themeCode !== seg.themeCode`, dessiner une fine ligne sombre 1px (`--surface-bg`) + un liseré saturé 2px `token.color` au-dessus de la cellule (remplace le tick 3px peu contrasté l.113-123).
  4. **Libellé** : élargir la colonne `w-2.5`→`w-3.5`, abréviation `text-[9px]` au début du run ; label complet via tooltip au survol.
  5. **Conflits reliés** : liseré ambre 2px sur les colonnes des modèles réellement divergents à l'index (prop `conflictModelIds` dérivée de `byIndexByJudge`, `DocumentPanel.tsx:262-269`), au lieu d'une 4e colonne ambre détachée.
  6. **Entête colonnes** : mini-entête sticky par colonne (pastille `m.identityColor` + `m.initial`).
- **Conserver** tous les `data-testid` : `model-gutter-row-*`, `gutter-cell-<id>-*`, `gutter-boundary-*`, `gutter-conflict-*`, `gutter-toggle-category`.
- **Données** : aucune nouvelle donnée API ; `coalesceRuns + segmentsFromRuns` fournissent déjà les spans. Champ optionnel `abbrev`/`short` recommandé sur `ThemeToken` (`tokens.ts`) pour éviter les collisions d'abréviation (TERMINATION vs TERMINATION_OF_*).

**Critères d'acceptation A.3**
- AC-A3-1 : un run de N phrases d'un modèle se lit comme un bloc continu (pas d'interstice ni de coin interne) ; arrondis uniquement aux extrémités.
- AC-A3-2 : la teinte de thème est visible **toggle OFF** ; le toggle augmente l'intensité et affiche le libellé (le test `gutter-toggle-category` reste vert : il teste l'état, pas le rendu).
- AC-A3-3 : à un changement de thème d'un même modèle, un séparateur net est rendu ; à un thème identique adjacent, aucun séparateur.
- AC-A3-4 : un index en conflit met en liseré les colonnes des modèles divergents ; les `gutter-conflict-*` restent présents et cliquables (`onJump`).

### A.4 — Compare banner N-way + sticky (option A du moteur compare) — axe 7

- **Quoi** :
  1. **Wording dynamique** : `compare-banner` (`DocumentPanel.tsx:518-539`) et le titre du toggle (`DocumentPanel.tsx:446`) construits depuis `compareJudgesData.map(j=>j.label)` via `llmJudgeLabel` (plus de « Claude / Codex » figé). Corriger aussi le dialog de pré-remplissage (`WorkspaceToolbar.tsx:339,344`).
  2. **Score honnête** : ajouter une fonction pure `agreementNway(byIndexList, n)` dans `lib/llmAgreement.ts` → `{ fullAgreementPct, fleissKappa, support }`. Le banner affiche un score qui correspond aux modèles réellement comparés (κ de Fleiss + % tous d'accord + support), au lieu du κ Claude/Codex pairwise trompeur.
  3. **Sticky d'un seul tenant** : fusionner `compare-banner` + `DivergenceNav` dans un conteneur `sticky top-0 z-10 backdrop-blur` (remplace l'offset magique `top-[3.25rem]` de `DivergenceNav.tsx:30`). Conserver `divergence-nav`, `divergence-counter`, `divergence-prev`, `divergence-next`.
  4. Légende du banner complétée avec « partiel » (slate) pour matcher le strip.
- **Données** : aucune route backend ; `preByJudge` (`hooks.ts:311-323`) et `compareJudgesData[].byIndex` existent.
- **Note** : extraire `agreementSegments` (aujourd'hui dans `ComparePanel.tsx`, importé par `compareNway.test.ts`) reste possible mais hors périmètre A ; `agreementNway` est autonome.

**Critères d'acceptation A.4**
- AC-A4-1 : comparer Claude + Mistral (sans Codex) → le banner liste « Claude / Mistral » et un score cohérent (pas un κ Claude/Codex).
- AC-A4-2 : `agreementNway` : 3 juges tous d'accord → `fullAgreementPct=100`, `fleissKappa=1` (aux arrondis près) ; divergence totale → `fleissKappa≤0`.
- AC-A4-3 : au scroll en mode comparer, le banner **et** la nav des divergences restent visibles (sticky d'un seul tenant) ; `n`/`p` continuent de naviguer.

---

## Lot B — Refonte structurelle UI (front, L)

Objectif : restructurer les surfaces denses (inspecteur, toolbar) et ajouter la minimap. Dépend de A (utilise `NaturePicker`, le badge nature et le hover). Toujours **sans backend**.

### B.1 — Refonte InspectorPanel (Lot 1, sans backend) — axe 3

Réécriture en 3 zones à poids visuel décroissant :
1. **En-tête (toujours visible)** : `ClauseChip` + badge nature + `CertaintyPicker` (size `sm`) + bouton **Valider** (réutiliser `setValidated`, repris de `SentenceMenu.tsx:167-182`, absent de l'inspecteur) + Supprimer.
2. **Classification (toujours visible)** : `ThemePalette` passée en `layout="grid"` + `describeOnHover` (props existantes, coût nul pour B3.a) ; `NaturePicker` (du Lot A).
3. **Justification (accordéon, ouvert si contenu)** : evidence (citation en italique bordée, pattern `SentenceMenu.tsx:318-322`) + rationale, puis le comparateur LLM juste dessous.
- **Comparateur N-modèles** : réécrire `InspectorJudgeCompare.tsx` — remplacer `type Source='human'|'claude'|'codex'` (l.17) et la lecture `claudePre/codexPre` (l.51-58) par une itération sur `llm.preByJudge` (`hooks.ts:311-323`) × `LLM_JUDGES`. Onglets `['Vous', ...juges présents]` (Mistral inclus). Conserver les `data-testid="inspector-source-*"`. La colonne « nature » affiche `—` tant que le Lot C n'est pas livré.
- **Commentaires (B3.d)** : extraire la carte riche de `CommentsPanel.tsx` (`avatar couleur` l.144-151, badge `scopeLabel` l.25-36, résolution) dans `CommentCard.tsx` partagé ; l'utiliser dans l'inspecteur, filtré sur la clause courante, avec compteur « Commentaires (n) » + composer inline (jamais replié/optionnel).

**Critères d'acceptation B.1**
- AC-B1-1 : tous les thèmes visibles en grille multi-rangées + tooltip explicatif (B3.a).
- AC-B1-2 : bouton Valider présent dans l'en-tête, équivalent à `SentenceMenu` (toggle `validated`).
- AC-B1-3 : le comparateur propose un onglet par juge **présent**, Mistral inclus (`inspector-source-mistral` existe si Mistral a des données).
- AC-B1-4 : les commentaires de la clause sont visibles sans scroll, avec compteur et champ de saisie inline.

### B.2 — ToolbarShell + groupes + overflow + section Sélection — axe 4

- **Primitives** : `ToolGroup.tsx` (`role=group` + `aria-label`, `ToolDivider`) et `OverflowMenu.tsx` (bouton « Plus » + popover style dialog).
- **Réorganisation** de `document-controls` (`DocumentPanel.tsx:388-514`) en groupes stables : `[Source/Comparaison]`, `[Sélection]`, `[Lecture]`, `[Langue]`, `CollabBar` à gauche. **Conserver tous les data-testid** (`document-controls`, `llm-source-switch`, `toggle-compare-panel`, `boundary-toggle`, `toggle-attribution`, `reading-controls`, `lang-switch`, `select-to-boundary`). Standardiser « Frontières » en toggle `aria-pressed` au même motif que les switches (`bg-accent/15 ... ring-accent/40`).
- **Section Sélections multiples** : `SelectionToolGroup.tsx`, rendu **uniquement** si `selectedSentences.length > 0` (pattern `CollabBar.tsx:31`). Compteur `selection-count` + actions :
  - `select-segment` → segment courant (borner via `boundaryStarts` ; **NB** en source humaine `runs` est perSentence → utiliser les frontières, pas `runAt`, pour ne pas paraître inerte) ;
  - `select-extend-next` / `select-reduce` → `nextBoundaryFrom` / nouveau `prevBoundaryFrom` (à ajouter dans `runs.ts`) ;
  - `select-to-boundary` (existant, déplacé) ;
  - `select-theme` → union des runs de même thème via nouvelle action store `selectMany(indices)` ;
  - `select-clear` → `clearSelection()`.
- **Overflow** : garder en surface Inspecteur/Commentaires/Historique ; déplacer Versions/Insights/Tour dans `OverflowMenu`.
- **a11y** : `role=toolbar` + `role=group`/`aria-label` par groupe.
- **Ajouts code** (front, triviaux) : `prevBoundaryFrom` (`runs.ts`), `selectMany` (`workspace.ts`).

**Critères d'acceptation B.2**
- AC-B2-1 : la barre est groupée et stable (groupes nommés, séparateurs) ; tous les anciens `data-testid` répondent.
- AC-B2-2 : `SelectionToolGroup` apparaît seulement quand ≥1 phrase est sélectionnée ; `selection-count` affiche le compte.
- AC-B2-3 : « Segment courant » sélectionne le segment borné par frontières (≥1 phrase, non inerte) ; « Tout le thème courant » sélectionne l'union (via `selectMany`) ; « Vider » remet à zéro.
- AC-B2-4 : Versions/Insights/Tour accessibles via « Plus » ; Inspecteur/Commentaires restent en surface.

### B.3 — Minimap verticale — axe 5

- **Pré-requis architecture (bloquant)** : remonter le conteneur de scroll. `ResizablePanels.tsx:152-158` possède l'`overflow-y-auto` ; le déplacer dans `DocumentPanel` (envelopper **tout** le `<div className="flex justify-center ...">` l.380, incluant le bloc `ComparePanel` sticky sibling) dans un `<div ref={scrollRef} className="h-full overflow-y-auto">`, et passer la `<section>` parente en `overflow-hidden`. La sticky toolbar `top-0` reste correcte (le contexte de scroll devient ce div).
- **Création** : `DocumentMinimap.tsx`, props `{ scrollRef, n, sentenceColors, boundaryStarts, conflictStarts:Set<number>, unfairnessByIndex, focused, onJump }`. (Adapter `conflictStartByIndex` `Map`→`Set` via `new Set(map.keys())`.)
- **Rendu** : colonne ~12px overlay à droite, sticky sous la toolbar ; 1 bande/phrase à hauteur uniforme (memo `sentenceColors`), tick frontières, liseré conflits, point injustice ; cadre viewport translucide piloté par `{scrollTop,scrollHeight,clientHeight}`.
- **Perf** : pas de `getBoundingClientRect` par phrase ; `onScroll` throttlé en `requestAnimationFrame` met à jour 3 nombres ; bandes en sous-composant mémoïsé (seul le cadre re-render au scroll) ; `ResizeObserver` sur `scrollRef`.
- **Interactions** : clic → `onJump(index)=focusSentence(index)` (réutilise le `scrollIntoView` existant) ; drag du cadre → `scrollRef.current.scrollTop`.
- **Toggle** : `showMinimap` dans `store/ui.ts` (pattern `readingWide`, défaut `true`, persisté) + checkbox dans le fieldset Overlays de `TocPanel.tsx:198-234`. Repli barre de progression sous une largeur seuil.
- **Données** : aucune — tout est déjà côté client.

**Critères d'acceptation B.3**
- AC-B3-1 : après remontée du scroll, le scroll du document, la toolbar sticky, le `ComparePanel` sticky et le `scrollIntoView` au focus fonctionnent identiquement (non-régression).
- AC-B3-2 : la minimap peint une bande par phrase à la couleur de son thème ; le cadre viewport suit le scroll.
- AC-B3-3 : clic sur une bande → saut + focus de la phrase ; le toggle `showMinimap` la montre/masque et persiste après reload.

---

## Lot C — Chaîne `legal_nature` LLM bout-en-bout (back + front, L)

Objectif : débloquer B2.2 / B3.b « nature consultable par LLM » en conservant une donnée déjà présente dans les JSON mais jetée à l'ingestion. **Correction load-bearing du verdict d'audit** : `legal_nature` n'est PAS dans `plan.clauses[]` (v9.4) ni dans `document_plan.segments[]` (v9.2) ; il vit dans le tableau de 1er niveau `annotations[]` (clé `id`). Le corpus actif est « v9.2-nature-derived » → chemin `normalize_v92`. La vraie correction est une **jointure** `segment.start_id ↔ annotations[].id`.

### C.1 — Backend
- `imports/loaders.py` (`normalize_v92`) : indexer `annotations[]` par `id`, et pour chaque segment lire `legal_nature` de l'annotation dont `id == segment.start_id`. Idem `normalize_v94` si la clé existe (open à v9.5).
- `imports/models.py` (`PreClause`) : ajouter `legal_nature = models.CharField(max_length=60, blank=True, default="")` + **migration**.
- `imports/services.py` : la persistance réelle est `PreClause.objects.bulk_create([...])` (`services.py:54-64`) → ajouter `legal_nature=c["legal_nature"]` (étape omise du verdict, indispensable sinon colonne + serializer restent vides).
- `imports/serializers.py` (`PreClauseSerializer.Meta.fields`) : ajouter `legal_nature` → sérialisé en camelCase `legalNature` (pont `djangorestframework_camel_case` confirmé).

### C.2 — Frontend
- `types/contract.ts` (`PreClause`) : ajouter `legalNature?: string|null`.
- `lib/pivot.ts:114` : propager la nature (au lieu de `legal_nature: null`).
- `SentenceMenu.tsx` (`JudgeDetail`) : ajouter `legalNature:string|null` ; `DocumentPanel.tsx` `buildJudgeDetailMap`/`detailAt` la portent ; affichage badge nature dans `JudgeBlock` + voyant accord/divergence symétrique au thème.
- `InspectorJudgeCompare.tsx` : ajouter la nature par juge + l'inclure dans « Reprendre ».
- `RationaleHover.tsx` : afficher la nature LLM quand disponible.

**Critères d'acceptation C**
- AC-C-1 : après réimport d'un document avec annotations Mistral/Claude, `PreClause.legal_nature` est peuplé (jointure `start_id`) ; vérifiable en base et via l'API (`legalNature`).
- AC-C-2 : le comparateur et le `SentenceMenu` affichent la nature de chaque juge ; un voyant accord/divergence apparaît quand les juges divergent sur la nature.
- AC-C-3 : tant qu'un juge n'émet pas de nature, l'UI affiche `—` (aucune heuristique).
- AC-C-4 : la chaîne humaine (saisie/persistance/diff/historique de `legalNature`) reste inchangée (non-régression).

---

## Risques & atténuations

| # | Risque | Lot | Probabilité | Impact | Atténuation |
|---|--------|-----|-------------|--------|-------------|
| R1 | Le hover vole le pointeur et casse clic/long-press/drag | A | moyen | élevé | `pointer-events-none` strict ; garde `pointerType==='mouse'` ; test Playwright dédié (clic + clic-droit avec hover actif). |
| R2 | Pastilles `NaturePicker` sans couleur (helper manquant) | A | élevé si oublié | moyen | `legalNatureToken` traité comme **requis** (pas optionnel) ; fallback couleur neutre si code inconnu. |
| R3 | Gutter : changement de teinte (toggle découplé) casse `gutter-toggle-category` | A | faible | moyen | Le test n'asserte que l'état du toggle, pas le rendu ; conserver l'attribut/état. |
| R4 | `agreementNway` (Fleiss) mathématiquement faux sur cas limites (1 juge, support 0) | A | moyen | moyen | Tests unitaires sur cas dégénérés (n=1, tout `null`, accord/désaccord parfaits) ; documenter le comportement (support 0 → score neutre/NaN géré). |
| R5 | Remontée du conteneur de scroll casse la sticky toolbar / `ComparePanel` sticky / `bg-reading` | B | moyen | élevé | Envelopper **tout** le `<div flex justify-center>` (l.380) y compris `ComparePanel` ; déplacer `bg-reading`/centrage avec le wrapper ; tests Playwright sticky + scrollIntoView. |
| R6 | Perf minimap (re-render des 139 bandes au scroll) | B | moyen | moyen | Bandes mémoïsées ; `onScroll` rAF-throttlé ne met à jour que 3 nombres ; bench documents 139+ phrases. |
| R7 | Réorg toolbar casse des `data-testid` utilisés par les e2e | B | moyen | élevé | Inventaire des testid à préserver (liste ci-dessus) ; e2e `document-ux.spec.ts` joué avant push. |
| R8 | **Migration prod `legal_nature`** + réimport long/erroné | C | moyen | élevé | Migration additive (champ `default=""`, non destructif) ; tester `normalize_v92` sur fixtures réelles avant déploiement ; réimport hors heures de pointe ; rollback = `git reset` + `migrate` (le champ reste, inerte). |
| R9 | Jointure `start_id ↔ annotations[].id` ne matche pas (formats hétérogènes) | C | moyen | moyen | Logguer le taux de match au load ; si <seuil, ne rien écrire (laisser `""`) plutôt qu'une valeur fausse. |

---

## Rollback (par lot)

- **A & B (front only)** : `deploy/deploy-claire.sh` fait un rollback automatique si `health != 200` (`git reset --hard ${PREV_SHA}` + rebuild + restart). Aucune migration → rollback instantané et complet. En cas de régression UX non bloquante détectée après coup : revert du/des commits du lot + redeploy.
- **C (migration)** : la migration est **additive** (`CharField default=""`), donc un `git reset` vers le SHA précédent **n'exige pas** de rollback de schéma (la colonne reste, inutilisée). Procédure : `git reset --hard ${PREV_SHA}` → `migrate --noinput` (no-op sur le schéma) → rebuild front → restart. Données réimportées : conserver un dump pré-réimport (`pg_dump` de la table `imports_preclause`) avant tout réimport massif pour restauration ciblée si la jointure a produit des valeurs erronées.

---

## Ordre de déploiement recommandé

1. **Lot A** — un déploiement, gate verte (tsc + vitest + e2e ciblés), healthcheck. Observer 24-48 h.
2. **Lot B** — un déploiement. Vérifier en priorité la non-régression du scroll (R5) et des testid toolbar (R7).
3. **Lot C** — déploiement avec migration : dump table `imports_preclause`, déployer (migration auto via `deploy-claire.sh`), réimport contrôlé, vérification du taux de match (R9).

Vérifications post-déploiement détaillées par axe : voir `runbook.md`.
