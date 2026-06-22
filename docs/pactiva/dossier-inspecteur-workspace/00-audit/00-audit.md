# 00 — Synthèse d'audit senior du workspace d'annotation

> Source vérifiée : [`audit-uiux.json`](./audit-uiux.json) (7 axes, chacun avec findings,
> options comparatives, recommendation, impacted_files, data_or_api_needs et un `verdict.sound`
> confronté au code réel). Besoins : [`../01-besoins/besoins.md`](../01-besoins/besoins.md).
> Cette synthèse condense l'audit, fixe le verdict express, hiérarchise les findings par sévérité,
> et — point critique — sépare honnêtement ce qui est **frontend-only** de ce qui **exige le backend**.

---

## 1. Verdict express

Le workspace est **fonctionnellement riche mais inégalement fini**. Le diagnostic transverse :
le moteur de données est en avance sur l'UI. Plusieurs capacités sont **déjà N-way / déjà calculées
côté client** (comparaison, runs coalescés, détails LLM par phrase) mais **mal exposées** par une
couche de présentation construite au fil de l'eau (barres non coordonnées, libellés « Claude/Codex »
figés, gutter fragmenté, inspecteur en liste plate).

Conséquence stratégique : **6 axes sur 7 sont réalisables en frontend pur**, à fort ROI et faible
risque. **Un seul vrai blocage backend existe** — la **nature juridique LLM** (`legal_nature`) — et il
ne concerne qu'**un sous-objectif** (B2.2 / B3.b « consultable par LLM »). Tout le reste de la nature
juridique (saisie, persistance, diff, historique côté humain) est **déjà complet**.

Verdict des 7 `verdict.sound` de l'audit : **tous `true`** (recommandations confrontées au code,
ancrages fichier:ligne vérifiés). Deux corrections de cadrage load-bearing sont signalées et reprises
ici (voir §4 et §5) : (a) la chaîne `legal_nature` côté loader n'est **pas** un `c.get()` mais une
**jointure** `segment.start_id ↔ annotations[].id` + un passage par `services.py` ; (b) la « double
notion de divergence » est en réalité du **code mort pairwise** (`lib/divergence.ts`), le retard vivant
étant le **bandeau** `compare-banner` resté pairwise.

**Recommandation d'enchaînement** : livrer d'abord le frontend pur (axes 1, 4, 5, 6, 7 + Lot 1 de
l'axe 3), puis traiter la dépendance backend `legal_nature` (Lot 2 de l'axe 3 / axe 2 volet LLM) en
chantier coordonné back/front avec migration + redéploiement prod.

---

## 2. Décisions arrêtées (rappel)

| # | Axe | Décision retenue (issue de l'audit) |
|---|-----|--------------------------------------|
| 1 | Hover rationale | **`RationaleHover`** : popover passif (réutilise `useAnchoredPosition` + anim `fade-in`), survol prolongé ~300 ms, `pointer-events-none`. |
| 2 | Nature juridique | **`NaturePicker` + badge** (calqué sur `ThemePalette`). La **nature LLM = dépendance backend/loader** (volet 2). |
| 3 | Inspecteur | **Refonte en 2 lots** : Lot 1 = UI pure ; Lot 2 = chaîne `legal_nature` LLM bout-en-bout. |
| 4 | Toolbar | **`ToolbarShell` + groupes + overflow + section Sélection** contextuelle. |
| 5 | Minimap | **Minimap verticale** type éditeur (prérequis : remonter le conteneur de scroll dans `DocumentPanel`). |
| 6 | Gutter | **Segments continus** (option hybride C : rendu par-ligne mais perçu en blocs, sans mesure pixel). |
| 7 | Compare | Déjà N-way → **corriger le bandeau pairwise + le rendre sticky** (option B), arbitrage 1..N en étape C. |

---

## 3. Tableau de synthèse par axe

Sévérité maximale des findings : `blocker` > `major` > `minor` > `info`. Effort selon l'estimation de
l'audit (S / M / L). « FE » = frontend-only ; « BE » = nécessite le backend.

| Axe | Pire finding | Findings (b/M/m/i) | Option retenue | Effort | Dépendance |
|-----|--------------|--------------------|----------------|--------|------------|
| **1 — Hover rationale** | major | 0 / 2 / 1 / 2 | B — `RationaleHover` (popover passif) | **M** | **FE** — donnée déjà dispo |
| **2 — Nature juridique** | **blocker** | 1 / 2 / 1 / 1 | A — 2e palette + colonne LLM | **M** (UI) + **L** (chaîne) | **FE** (humain) / **BE** (LLM) |
| **3 — Inspecteur** | **blocker** | 1 / 4 / 2 / 0 | B en 2 lots (Lot 1 = A) | **M** (Lot 1) + **L** (Lot 2) | **FE** (Lot 1) / **BE** (Lot 2) |
| **4 — Toolbar** | major | 0 / 6 / 1 / 2 | B — `ToolbarShell` + Sélection | **M** | **FE** |
| **5 — Minimap** | major | 0 / 2 / 1 / 4 | C — minimap verticale | **M** | **FE** |
| **6 — Gutter** | major | 0 / 5 / 3 / 0 | C — hybride segments continus | **M** | **FE** |
| **7 — Compare** | major | 0 / 3 / 3 / 2 | B — agrégat N-way + sticky fusionné | **M** | **FE** (agrégat calculé client) |

> Note : les deux `blocker` (axes 2 et 3) pointent **le même objet** — l'absence de `legal_nature`
> dans la chaîne LLM. Ce n'est donc **pas** un blocage du workspace dans son ensemble : la majeure
> partie des axes 2 et 3 (présentation humaine, `NaturePicker`, restructuration de l'inspecteur,
> comparateur N-modèles thème/evidence/rationale) est livrable **sans** ce déblocage.

---

## 4. Détail par axe : findings hiérarchisés, option, effort

### Axe 1 — Hover rationale (`RationaleHover`) — **M, frontend-only**

| Sévérité | Finding | Ancrage |
|---|---|---|
| major | Le rationale humain n'est exposé **nulle part au survol** | `DocumentPanel.tsx:1110-1124` (span sans `title`/`aria-describedby`) |
| major | Conflit potentiel hover vs sélection / long-press / scroll-into-view | `useLongPress.ts:47`, `DocumentPanel.tsx:361,769,373-376` |
| minor | Le rationale humain peut être vide (`""` par défaut) → ne pas afficher de popover bruyant | `store/workspace.ts:389/457/518/566` |
| info | Le rationale LLM est déjà calculé par phrase (consommé seulement au clic-droit) | `DocumentPanel.tsx:150-159, 924-940` |
| info | Pas de lib tooltip, mais `useAnchoredPosition` + anim `fade-in` réutilisables | `useAnchoredPosition.ts`, `tailwind.config.ts:59-66` |

**Retenu — Option B** : composant `RationaleHover.tsx` calqué sur `BoundaryEvidence`, ouvert au survol
prolongé (~300 ms), fermé avec tampon anti-papillotement (~120 ms), `pointer-events-none` pour ne casser
ni `onClick`, ni le long-press, ni le drag de sélection. Garde `pointerType === 'mouse'`. Repli a11y :
`title` natif minimal (thème + 1re phrase du rationale).

**Donnée/API** : **aucune**. Tout vient de `DraftClause.rationale/evidenceSpan` (humain, déjà dans le
store) et de `JudgeDetail` (LLM, déjà matérialisé via `buildJudgeDetailMap`/`detailAt`).

---

### Axe 2 — Nature juridique (`NaturePicker` + badge) — **M (UI, FE) + L (chaîne LLM, BE)**

| Sévérité | Finding | Ancrage |
|---|---|---|
| **blocker** | `PreClause` ne transporte pas la nature, le pipeline ne l'extrait pas → **la donnée LLM n'existe pas côté juge** | `contract.ts:316-321`, `imports/models.py:45-53`, `imports/serializers.py:22-23`, `loaders.py:55-107`, `pivot.ts:114` |
| major | Nature saisissable **uniquement via `<select>` brut**, déconnecté du reste de l'inspecteur | `InspectorPanel.tsx:110-127` |
| major | `JudgeDetail` ne porte pas la nature → aucune consultation/comparaison LLM possible | `SentenceMenu.tsx:28-36`, `InspectorJudgeCompare.tsx:60-62` |
| minor | Les 6 natures n'ont **pas de `definition`** dans le YAML → pas de tooltip explicatif | `vocabulary.yaml:33-39` (vs type `contract.ts:116-123`) |
| info | Côté humain l'infra est **complète** (modèle, persistance, diff, historique) | `vocabulary.yaml:33-39`, `contract.ts:291`, `endpoints.ts:301/317`, `versionDiff.ts:21` |

**Retenu — Option A en deux temps** :
- **Temps 1 (frontend pur)** : créer `ui/NaturePicker.tsx` calqué sur `ThemePalette` (pastilles + hover
  de définition), remplacer le `<select>`, ajouter un **badge nature** sur `ClauseChip` et dans le hover
  de l'axe 1. **Prérequis data léger (non-code)** : ajouter les `definition` aux 6 natures dans
  `vocabulary.yaml` (type/serializer les supportent déjà). **Requis** (et non « optionnel ») : un helper
  `legalNatureToken` (couleur) dans `lib/tokens.ts` si l'on veut des pastilles colorées fidèles, car les
  natures n'ont aujourd'hui **aucune couleur**.
- **Temps 2 (backend, voir §5)** : exposer `legal_nature` LLM de bout en bout.

**Ne pas** dériver de nature par heuristique (rejet de l'option C) : une « proposition LLM » fabriquée par
règle nuit à la confiance dans l'arbitrage. Tant que les juges n'émettent pas la nature, l'UI affiche
`—` proprement.

---

### Axe 3 — Refonte de l'inspecteur (2 lots) — **M (Lot 1, FE) + L (Lot 2, BE)**

| Sévérité | Finding | Ancrage |
|---|---|---|
| **blocker** | Nature juridique LLM **jetée à l'ingestion** (présente à la source, perdue) | `loaders.py:71-103`, `models.py:45-53`, `serializers.py:14-26`, `contract.ts:316-321` |
| major | Nature réduite à un `<select>` natif sans définition ni cohérence visuelle | `InspectorPanel.tsx:110-127` |
| major | `InspectorJudgeCompare` **codé en dur pour 2 juges** (claude/codex), non N-modèles | `InspectorJudgeCompare.tsx:17,51-58` (alors que `hooks.ts:311-323` expose `preByJudge`) |
| major | `evidence_span` & `rationale` présentés comme champs plats indistincts | `InspectorPanel.tsx:136-157` |
| major | Commentaires en **double implémentation**, version inspecteur appauvrie et reléguée en bas | `CommentThread.tsx` (utilisé `InspectorPanel.tsx:168-173`) vs `CommentsPanel.tsx:144-151` |
| minor | `ThemePalette` en mode `list` (scroll) au lieu de `grid` + `describeOnHover` dans l'inspecteur | `InspectorPanel.tsx:92-108` (vs `SentenceMenu.tsx:152-158`) |
| minor | Inspecteur = liste plate de 6 sections, sans hiérarchie ni bouton **Valider** | `InspectorPanel.tsx:66-174` (`setValidated` existe mais absent ici) |

**Retenu — Option B livrée en 2 lots** :
- **Lot 1 (frontend pur, = option A)** : restructurer l'inspecteur en 3 zones à poids décroissant
  (En-tête `ClauseChip` + badge nature + `CertaintyPicker` compact + **Valider** + Supprimer ;
  Classification `ThemePalette` en `grid`+`describeOnHover` + `NaturePicker` ; Justification evidence/rationale
  + comparateur). Rendre `InspectorJudgeCompare` **N-modèles** via `preByJudge` × `LLM_JUDGES` (Mistral inclus).
  Extraire une `CommentCard` partagée de `CommentsPanel` et l'utiliser dans l'inspecteur (compteur + composer
  inline, non repliés).
- **Lot 2 (backend, voir §5)** : porter `legal_nature` LLM jusqu'au comparateur et au `SentenceMenu`.

---

### Axe 4 — Refonte de la barre d'outils (`ToolbarShell`) — **M, frontend-only**

| Sévérité | Finding | Ancrage |
|---|---|---|
| major | **Deux barres non coordonnées** (chrome app vs reading controls) | `WorkspaceToolbar.tsx:176-177` + `DocumentPanel.tsx:388-390` |
| major | `document-controls` = empilement plat de 10+ contrôles, sans groupes ni séparateurs | `DocumentPanel.tsx:390` |
| major | **Vocabulaire visuel fragmenté** : checkbox natif / select natif / segmented / toggles coexistent (3 styles d'« actif ») | `DocumentPanel.tsx:415-423,400-412`, `LlmSourceSwitch.tsx:46-80` |
| major | **Section Sélections multiples quasi inexistante** (un seul bouton, pas de compteur) | `DocumentPanel.tsx:457-465` (store `selectRange/clearSelection` dispo `workspace.ts:800-819`) |
| major | Bouton « Comparer » présent mais sa **banner de divergence n'est pas sticky** | `DocumentPanel.tsx:440-456,518-548` |
| major | Libellés **Claude/Codex figés** alors que le système est N-modèles | `DocumentPanel.tsx:446,524`, `WorkspaceToolbar.tsx:339,344` |
| minor | Pas d'overflow / progressive disclosure (9 + 10 contrôles permanents) | `WorkspaceToolbar.tsx:218-272` |
| info | `transition-colors` seul ; pas de feedback d'état serveur (sauf `SaveIndicator`, bon modèle) | `LlmSourceSwitch.tsx:69`, `WorkspaceToolbar.tsx:379-419` |
| info | `CollabBar` = bon modèle de rendu conditionnel (`return null` en solo) | `CollabBar.tsx:31` |

**Retenu — Option B** : primitives `ToolGroup`/`ToolDivider`/`OverflowMenu`, groupes sémantiques stables
(`Source/Comparaison`, `Sélection`, `Lecture`, `Langue`), unification de l'état « actif » sur un seul motif,
libellés via `llmJudgeLabel`. Nouvelle `SelectionToolGroup` (rendue si `selectedSentences.length > 0`) :
compteur + Segment courant / Étendre / Réduire / Jusqu'à la frontière / Tout le thème / Vider.
**Conserver tous les `data-testid`.**

**Donnée/API** : **aucune**. Ajouts purement front : `prevBoundaryFrom` dans `lib/runs.ts` et action store
`selectMany(indices)`. ⚠ Point de vigilance d'implémentation : « Segment courant » via `runAt` en **source
humaine** ne sélectionne qu'1 phrase (runs `perSentence`) → borner via `boundaryStarts` pour une sémantique
utile.

---

### Axe 5 — Minimap verticale — **M, frontend-only**

| Sévérité | Finding | Ancrage |
|---|---|---|
| major | Le **conteneur de scroll appartient à `ResizablePanels`**, pas à `DocumentPanel` | `ResizablePanels.tsx:152-158` |
| major | **Aucun listener de scroll / IntersectionObserver** dans tout le workspace | `DocumentPanel.tsx:373-376` (seul `scrollIntoView` sur focus) |
| minor | `TocPanel` n'a aucune mise en évidence de la position courante | `TocPanel.tsx:183-195` |
| info | Aucune minimap/indicateur n'existe ; couleur de thème par phrase déjà dispo | `DocumentPanel.tsx:580-581,620-622` |
| info | 139+ phrases rendues sans virtualisation → éviter `getBoundingClientRect` par phrase | `DocumentPanel.tsx ~540+` |

**Retenu — Option C** : `DocumentMinimap.tsx` (colonne ~12 px, bande par phrase peinte via `sentenceColors`
mémoïsé, cadre viewport translucide, clic = saut, drag = scroll). **Prérequis architecture** : remonter le
`overflow-y-auto` dans `DocumentPanel` (envelopper le contenu dans un `<div ref={scrollRef}>`), `ResizablePanels`
devient `overflow-hidden`. Perf : état `{scrollTop, scrollHeight, clientHeight}` piloté par `onScroll`
rAF-throttlé + `ResizeObserver` ; bandes en sous-composant mémoïsé. Toggle `ui.showMinimap` persisté (pattern
`readingWide`). ⚠ Le wrapper de scroll doit **englober** le `<div flex justify-center>` (l.380) incluant le
`ComparePanel` sticky, sinon `sticky` et `bg-reading` cassent.

**Donnée/API** : **aucune** (tout est déjà calculé client : runs, `boundaryStarts`, `conflictStartByIndex`,
`unfairIndex`). `conflictStartByIndex` est une `Map` → adapter en `Set` pour la prop.

---

### Axe 6 — Gutter (segments continus) — **M, frontend-only**

| Sévérité | Finding | Ancrage |
|---|---|---|
| major | Segment rendu **en cellules par phrase** (pile fragmentée), pas en bloc continu — alors que la donnée est **déjà coalescée** | `ModelBoundaryRail.tsx:82-132` (vs `DocumentPanel.tsx:211,225`) |
| major | **Frontières peu nettes** : tick 3 px noyé dans des cellules de même teinte | `ModelBoundaryRail.tsx:113-123,107` |
| major | Catégorie illisible : abréviation 3 lettres en 7 px, conditionnelle (`showCategory` off par défaut) | `ModelBoundaryRail.tsx:124-129`, `tokens.ts:105-108`, `ui.ts:51` |
| major | Fond gris **identique pour tous les segments** quand `showCategory` off | `ModelBoundaryRail.tsx:84-110` |
| major | Pas d'indication de continuité inter-ligne (le run traverse des lignes DOM indépendantes) | `DocumentPanel.tsx:819-827` |
| minor | Colonne Conflit **à côté** des pistes (4e colonne), lien aux divergences non visualisé | `ModelBoundaryRail.tsx:55-81` |
| minor | Pas d'en-tête/intitulé de colonnes (association colonne→modèle par l'ordre seul) | `ModelBoundaryRail.tsx:40-135` |
| minor | `data-boundary='1'` posé mais aucun style ne l'exploite | `ModelBoundaryRail.tsx:95` |

**Retenu — Option C (hybride)** : garder le rendu par-ligne (« alignement natif sans mesure pixel »,
`ModelBoundaryRail.tsx:7`) mais le faire **percevoir comme des blocs** — cellules jointives (sans `gap-px`,
sans `rounded` internes), teinte de catégorie **toujours** visible (toggle = intensité/étiquette, pas
apparition), séparateur **net** uniquement aux ruptures de thème, libellé élargi (`w-3.5`, 9 px) + tooltip riche,
colonne conflit transformée en **liseré** sur les modèles réellement divergents (via `byIndexByJudge`), mini-entête
sticky par colonne. **Conserver tous les `data-testid`** (`gutter-cell-*`, `gutter-boundary-*`, `gutter-conflict-*`).

**Donnée/API** : **aucune**. `segmentsFromRuns` + `coalesceRuns` + `conflictZones` existent déjà ; modèles
divergents par index dérivables de `byIndexByJudge`. Optionnel : champ `abbrev`/`short` dans `ThemeToken` pour
éviter les vraies collisions d'abréviations (ex. `TERMINATION` vs `TERM_*`).

---

### Axe 7 — Compare N-way + barre divergences sticky — **M, frontend-only**

| Sévérité | Finding | Ancrage |
|---|---|---|
| major | Le **bandeau `compare-banner` est resté pairwise** (« Accord Claude / Codex », κ via `agreement(claude,codex)`) | `DocumentPanel.tsx:518-539`, `hooks.ts:307-318`, `llmAgreement.ts:96-123` |
| major | `lib/divergence.ts` **entièrement pairwise** → code mort (la nav réelle passe par `conflictZones` N-way) | `divergence.ts:23-76` (vs `DocumentPanel.tsx:296-303`) |
| major | `DivergenceNav` sticky **mais** le `compare-banner` au-dessus ne l'est pas (objectif sticky à moitié tenu) | `DivergenceNav.tsx:30`, `DocumentPanel.tsx:520-522` |
| minor | Panneau latéral masqué sous `xl` → perte de la nav sticky des rails | `DocumentPanel.tsx:835` |
| minor | Adoption clavier + `InspectorJudgeCompare` restent bi-modèles | `DocumentPanel.tsx:315-321`, `useDivergenceShortcuts.ts:61-70`, `InspectorJudgeCompare.tsx:17` |
| minor | Titre/toggle décrivent encore « Claude/Codex » | `DocumentPanel.tsx:446` |
| info | Le `ComparePanel` est **déjà N-way** (Mistral inclus, testé `compareNway.test.ts`) | `ComparePanel.tsx:47-66,271-280` |
| info | Pas d'agrégat N-way exposé (κ de Fleiss / % concordance N-juges) | `llmAgreement.ts:68-90` |

**Retenu — Option B** (A en premier commit, C ensuite) : ajouter `agreementNway()` (% tous d'accord + κ de
Fleiss + support) dans `lib/llmAgreement.ts` ; bandeau dynamique (`compareJudgesData.map(j=>j.label)` + score
N-way + légende « partiel ») ; **fusionner** bandeau + `DivergenceNav` en un seul `CompareStickyHeader`
`sticky top-0` (remplace l'offset magique `top-[3.25rem]`) ; supprimer le doublon de nav interne au panneau ;
rendre le panneau dispo sous `xl`. Déprécier le pairwise mort de `divergence.ts`. Étape C : arbitrage 1..N
(`adoptAtFocus(judgeId)`, touches dynamiques, `InspectorJudgeCompare` sur `LLM_JUDGES`).

**Donnée/API** : **aucune** côté backend. Le seul manque est un **agrégat calculé côté front** (`agreementNway`).
⚠ Correction de cadrage : `divergence.ts` pairwise n'est **pas** « une notion concurrente vivante » — il est
**mort** (importé nulle part hors tests) ; le vrai retard est le bandeau.

---

## 5. Dépendances backend — l'honnêteté FE vs BE

### 5.1 Le seul vrai blocage : la chaîne `legal_nature` LLM

C'est l'unique dépendance backend du dossier. Elle conditionne **B2.2** et **B3.b** (« nature juridique
consultable par LLM ») — et **rien d'autre**. La donnée existe à la source mais est **jetée à l'ingestion**.

**Chaîne à compléter (back → front)** :

1. **`loaders.py`** — ⚠ **correction load-bearing** : `legal_nature` n'est **pas** dans `plan.clauses[]`
   (v9.4) ni dans `document_plan.segments[]` (v9.2). Il vit dans un tableau séparé de premier niveau
   **`annotations[]`** (par phrase, clé `id`). La vraie correction est une **jointure**
   `segment.start_id ↔ annotations[].id` dans `normalize_v92` (le corpus actif est `v9.2-nature-derived`,
   cf. `besoins.md` B2.2). Ce **n'est pas** un simple `c.get("legal_nature")`.
2. **`services.py`** — ⚠ **fichier oublié dans le plan d'origine** : la persistance réelle est
   `PreClause.objects.bulk_create([...])` (`services.py:54-64`) ; sans y ajouter `legal_nature=...`, la
   colonne et le serializer resteront vides.
3. **`imports/models.py`** — nouvelle colonne `PreClause.legal_nature` (`CharField`, `blank/default`) **+ migration**.
4. **`imports/serializers.py`** — ajouter `legal_nature` aux `fields` (le pont `djangorestframework_camel_case`
   le sérialise automatiquement en `legalNature`, aucun aliasing manuel requis).
5. **`types/contract.ts`** — `PreClause.legalNature?: string | null`.
6. **`pivot.ts:114`** — propager au lieu de forcer `legal_nature: null` ; **`store/workspace.ts:760`** lit
   déjà `seg.legal_nature` → débloqué de fait.
7. **Front (frontend-only une fois la donnée présente)** — `JudgeDetail.legalNature` (`SentenceMenu.tsx:28`)
   via `buildJudgeDetailMap`/`detailAt` ; affichage dans `JudgeBlock` + comparateur de l'inspecteur.

**Prérequis data non-code** (frontend, mais data) : ajouter les `definition` aux 6 natures dans
`vocabulary.yaml:33-39` pour alimenter le hover explicatif du `NaturePicker` (type/serializer les supportent déjà).

**Coordination prod** : migration Django + redéploiement (cf. mémoire « Déploiement prod pactiva »).
C'est le **seul** chantier nécessitant un cycle back/front complet.

### 5.2 Ce qui est déjà complet côté backend (à ne PAS retoucher)

La chaîne **humaine** de la nature juridique est **opérationnelle** : `Clause.legalNature` (`contract.ts:291`),
`PivotClause.legal_nature`, `addClause`/`patchClause(legal_nature)` (`endpoints.ts:301/317`), autosave, diff
(`versionDiff.ts:21`), verbe d'historique `clause.set_legalNature`. Idem `LegalNature.definition` est **déjà
exposé** par l'API scheme (`serializers.py:29`, `contract.ts:122`) — il est seulement **inutilisé** et vide
dans le YAML.

### 5.3 Ce qui est frontend-only (aucun backend requis)

| Axe | Pourquoi frontend-only |
|-----|------------------------|
| 1 — Hover | `DraftClause.rationale` (store) + `JudgeDetail` (déjà calculé via `detailMapByJudge`/`detailAt`). |
| 2 — Nature (volet humain) | `NaturePicker`, badge, persistance déjà en place. (Seul le volet **LLM** = §5.1.) |
| 3 — Inspecteur (Lot 1) | Restructuration UI, `ThemePalette` grid, comparateur N-modèles via `preByJudge`, `CommentCard`. |
| 4 — Toolbar | Store `selectedSentences/selectRange/clearSelection` + helpers `runs.ts` ; ajouts `prevBoundaryFrom`, `selectMany`. |
| 5 — Minimap | Données client (runs, frontières, conflits, injustice) ; lift du scroll + toggle `ui`. |
| 6 — Gutter | `coalesceRuns`/`segmentsFromRuns`/`conflictZones` + `byIndexByJudge` déjà calculés. |
| 7 — Compare | `ComparePanel` déjà N-way ; `preByJudge` exposé ; seul ajout = `agreementNway()` **calculé côté front**. |

---

## 6. Synthèse des dépendances data — checklist

**Backend (cycle complet, migration + redéploiement)** :
- [ ] `loaders.py` — jointure `segment.start_id ↔ annotations[].id` (chemin v9.2) pour lire `legal_nature`.
- [ ] `services.py` — passer `legal_nature` au `bulk_create` de `PreClause`.
- [ ] `imports/models.py` — colonne `PreClause.legal_nature` + migration.
- [ ] `imports/serializers.py` — `legal_nature` dans `PreClauseSerializer.fields`.

**Data non-code (YAML, sans migration)** :
- [ ] `vocabulary.yaml:33-39` — ajouter `definition` aux 6 natures juridiques.

**Frontend lié à la donnée backend** :
- [ ] `types/contract.ts` — `PreClause.legalNature?`.
- [ ] `pivot.ts` / `store/workspace.ts` — propager `legal_nature`.
- [ ] `SentenceMenu.tsx` (`JudgeDetail`) + `DocumentPanel.tsx` (`buildJudgeDetailMap`/`detailAt`) + comparateur.

**Frontend pur (aucune donnée backend nouvelle)** :
- [ ] Ajouts lib/store : `prevBoundaryFrom` (`runs.ts`), `selectMany` (`workspace.ts`), `agreementNway` (`llmAgreement.ts`), `legalNatureToken` (`tokens.ts`).
- [ ] Composants nouveaux : `RationaleHover`, `NaturePicker`, `DocumentMinimap`, `CommentCard`, `ToolGroup`/`ToolDivider`/`OverflowMenu`/`SelectionToolGroup`, `CompareStickyHeader`.
- [ ] État UI persisté : `ui.showMinimap`.

---

## 7. Conclusion

Le workspace n'a **pas besoin d'une refonte fondamentale** : il a besoin d'une **couche de présentation qui
rattrape son moteur**. 6 axes sur 7 sont livrables sans toucher au backend, avec un risque maîtrisé (réutilisation
de patterns existants : `useAnchoredPosition`, `ThemePalette`, segmented switches, `CollabBar`, `conflictZones`).
La seule dette structurelle réelle est la **nature juridique LLM** — une donnée présente à la source mais jetée,
dont le déblocage exige une **jointure au loader + une migration**, isolée dans le Lot 2 pour ne pas bloquer la
valeur UX immédiate.
