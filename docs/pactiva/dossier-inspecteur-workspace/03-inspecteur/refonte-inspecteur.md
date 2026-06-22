# Refonte de l'Inspecteur (`InspectorPanel`)

> Axe 3 des besoins (`01-besoins/besoins.md` §B3.a–d). Source d'audit :
> `00-audit/audit-uiux.json`, axes `legal-nature` et `inspector-refactor` (tous deux
> `verdict.sound = true`). Décision arrêtée : **refonte selon l'option B, livrée en 2 lots**.
>
> Cible de réécriture : `frontend/src/components/workspace/InspectorPanel.tsx` (177 lignes)
> et `frontend/src/components/workspace/InspectorJudgeCompare.tsx` (128 lignes).

---

## 1. Constat (état actuel, vérifié dans le code)

L'inspecteur est aujourd'hui une **liste plate de 6 sections** empilées en
`flex flex-col gap-4` (`InspectorPanel.tsx:67`), sans regroupement ni priorisation :

| # | Bloc actuel | Fichier:ligne | Défaut |
|---|-------------|---------------|--------|
| 1 | `ClauseChip` + bouton Supprimer | `InspectorPanel.tsx:68-81` | Pas de nature visible, **pas de bouton Valider** (alors que `setValidated` existe au store et est exposé dans `SentenceMenu.tsx:167-182`) |
| 2 | Provenance `seededFrom` | `:83-90` | OK |
| 3 | Thème via `ThemePalette` (mode `list`) | `:92-108` | Liste défilable `max-h-64`, **sans `describeOnHover`** → pas de tooltip explicatif (B3.a non tenu) |
| 4 | Nature via `<select>` natif | `:110-127` | Rendu OS, hors design-tokens, **aucune définition** affichée, **aucune nature LLM** (B3.b non tenu) |
| 5 | Certitude | `:129-134` | OK mais même poids visuel que tout le reste |
| 6 | Evidence (`<input>`) + Rationale (`<textarea>`) | `:136-157` | Champs plats indistincts, citation non mise en valeur (B3.c partiel) |
| 7 | `InspectorJudgeCompare` | `:159-166` | **Codé en dur 2 juges** (`type Source = "human"\|"claude"\|"codex"`, `InspectorJudgeCompare.tsx:17`), ne lit que `claudePre`/`codexPre` (`:51-52`), **ignore Mistral** et `preByJudge` (`hooks.ts:311`) ; ne compare ni le thème ni la nature |
| 8 | Commentaires via `CommentThread` | `:168-173` | Version **pauvre** (affiche `c.authorId` brut `CommentThread.tsx:35`, pas de portée, pas de couleur d'auteur, pas de compteur), reléguée en bas (B3.d non tenu) |

Les actions fréquentes (thème, certitude, valider) et les champs longs (rationale,
commentaires) ont **le même poids visuel** ; sur le panneau droit redimensionnable
(`AnnotationWorkspace.tsx:164`, `ResizablePanels`), tout est noyé.

---

## 2. Étude comparative A / B / C

Trois options de refonte, reprises de l'audit (`inspector-refactor.options`) et instruites
ici en tableau forces/faiblesses/ergonomie/effort.

### Option A — Refonte cosmétique frontend pure (sans backend)

| Critère | Détail |
|---------|--------|
| **Forces** | Aucune migration, livrable rapide. Couvre B3.a (`ThemePalette` en `grid` + `describeOnHover`, gratuit), B3.d (carte de commentaire riche extraite de `CommentsPanel`), réorganisation en zones/accordéons, `NaturePicker` custom avec définition au survol. Rend `InspectorJudgeCompare` N-modèles via `preByJudge` **déjà disponible**. |
| **Faiblesses** | Ne tient **PAS** B3.b « nature consultable par LLM » : la donnée `legal_nature` LLM reste jetée à l'ingestion → colonne nature LLM vide (`—` partout). On peut au mieux comparer evidence/rationale LLM (déjà partiel). |
| **Ergonomie** | Forte cohérence : réutilise `ThemePalette` grid, tokens, `CertaintyPicker`, couleurs contributeurs déjà éprouvés. |
| **Effort** | **M** (frontend seul). |

### Option B — Refonte frontend **+ chaîne `legal_nature` LLM** bout-en-bout

| Critère | Détail |
|---------|--------|
| **Forces** | Tient **TOUS** les objectifs dont B3.b/B3.c (nature + evidence + rationale consultables par LLM). Débloque une donnée **déjà présente** dans les JSON mais jetée (cf. `legal-nature-data.md`). `NaturePicker` symétrique au thème ; `InspectorJudgeCompare` devient un vrai comparateur N-modèles thème + nature + evidence + rationale avec « Reprendre ». |
| **Faiblesses** | Touche 6+ couches (`loaders.py`, `services.py`, `models.py` + migration, `serializers.py`, `contract.ts`, `pivot.ts`, `DocumentPanel`, `SentenceMenu`, `InspectorJudgeCompare`). Coordination back/front + redéploiement prod (cf. mémoire prod `pactiva.legal`). |
| **Ergonomie** | Cohérence maximale : la nature devient citoyen de 1re classe partout (inspecteur, `SentenceMenu`, compare), aligné sur le traitement du thème. |
| **Effort** | **L** (back + front). |

### Option C — Inspecteur « modèle vs vous » en colonnes (diff inline) + chaîne LLM

| Critère | Détail |
|---------|--------|
| **Forces** | Vision la plus puissante : chaque champ (thème/nature/evidence/rationale/certitude) en 2 colonnes Vous \| Juge avec adoption **par champ**. Résout d'emblée le finding « JudgeCompare déconnecté des champs ». |
| **Faiblesses** | Refonte structurelle lourde (layout 2 colonnes responsive **sur panneau étroit** `ResizablePanels`), risque d'encombrement vertical, dépend **quand même** de la chaîne `legal_nature` de l'option B. |
| **Ergonomie** | Puissant mais conflit avec la largeur réduite du panneau droit ; impose un mode « comparer » togglable pour ne pas alourdir le cas nominal. Plus risqué en UX. |
| **Effort** | **L** (back + front, layout responsive délicat). |

### Décision : **Option B, en 2 lots pour dérisquer**

- **Lot 1** = refonte UI **sans backend** (équivaut fonctionnellement à A, **livrable seul** immédiatement) — apporte toute la valeur UX (zones, accordéons, header avec Valider, `NaturePicker`, evidence/rationale hiérarchisés, commentaires riches, compare N-way sur thème/evidence/rationale).
- **Lot 2** = chaîne `legal_nature` LLM (détaillée dans `legal-nature-data.md`) — débloque **B3.b** : nature LLM dans le `NaturePicker`, le `SentenceMenu` et le comparateur.

Rejet de C : le diff colonne-par-colonne est séduisant mais inadapté à la largeur du
panneau droit redimensionnable ; il reste par ailleurs **dépendant de la même chaîne
backend** que B. On conserve l'idée d'« adoption par champ » de C, mais **dans le
comparateur** (boutons « Reprendre » par champ), sans imposer un layout 2 colonnes global.

---

## 3. Structure cible de l'`InspectorPanel`

Flux **vertical** conservé (compatible panneau étroit) mais **regroupé en 3 zones à poids
visuel décroissant**, avec **2 accordéons** pour les sections longues. L'état d'ouverture
des accordéons est **persisté** (clé `localStorage` `pactiva.inspector.accordion.*`, hors
store métier — préférence d'affichage, pas de la donnée d'annotation).

```
┌─ InspectorPanel ────────────────────────────────────────────┐
│ ZONE 1 — HEADER (toujours visible, collant en haut)         │
│   [ClauseChip thème]  [badge Nature]   [✓/◷ Valider] [Suppr]│
│   [CertaintyPicker size=sm]                                 │
│   (provenance seededFrom si présent)                        │
├─ ZONE 2 — CLASSIFICATION (toujours visible) ───────────────┤
│   ▸ Thème        ThemePalette layout="grid" describeOnHover │
│   ▸ Nature       NaturePicker (radiogroup + définition hover)│
├─ ZONE 3 — JUSTIFICATION (accordéon, ouvert si contenu) ────┤
│   Evidence span  (citation mise en valeur, bordée, italique)│
│   Rationale      (textarea)                                 │
│   ┌─ InspectorJudgeCompare (N-way) ───────────────────────┐│
│   │ [Vous] [Claude] [Codex] [Mistral]  ← onglets dynamiques││
│   │ thème / nature / evidence / rationale du juge          ││
│   │ [Reprendre tout] + Reprendre par champ                 ││
│   └────────────────────────────────────────────────────────┘│
├─ ZONE 4 — COMMENTAIRES (accordéon, en-tête « Commentaires (n) »)│
│   CommentCard[] filtrés sur la clause + composer inline     │
└──────────────────────────────────────────────────────────────┘
```

### 3.1 Zone 1 — En-tête (toujours visible)

Remplace `InspectorPanel.tsx:68-81`. Header **collant** (`sticky top-0 bg-panel z-10`)
pour que les actions clés restent atteignables quand on scrolle un long rationale.

- `ClauseChip` (thème, `selected`, `validated`) — réutilisé tel quel ; on passe désormais
  `validated={draft.validated}` pour afficher le voyant ✓/◷ (`ClauseChip.tsx:78-88`).
- **Badge Nature** à droite du chip : petit `<span>` neutre `bg-panel-muted` portant
  `getLegalNatureToken(draft.legalNature).label` (helper à créer, cf. §3.6) ; `—` si nulle.
- **Bouton Valider** (manquant aujourd'hui) — réutilise `setValidated(draft.localId, …)`
  (store, déjà câblé dans `SentenceMenu.tsx:167-182`). Même style binaire emerald/amber :
  ```tsx
  <button
    data-testid="inspector-validate"
    aria-pressed={draft.validated ?? false}
    onClick={() => setValidated(draft.localId, !(draft.validated ?? false))}
    className={validated ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-300"
                         : "border-amber-400/50 bg-amber-400/10 text-amber-200"}
  >
    {validated ? "✓ Validée" : "◷ Valider"}
  </button>
  ```
- Bouton **Supprimer** (`removeBoundary` + `selectClause(null)`) — conservé.
- `CertaintyPicker size="sm"` remonté dans le header (action fréquente) — déplacé depuis
  l'ancienne section 5 (`:129-134`).
- Provenance `seededFrom` (`:83-90`) — conservée, en encart fin sous le header.

### 3.2 Zone 2 — Classification (toujours visible)

**Thème (B3.a).** Passer `<ThemePalette>` (`:92-108`) en `layout="grid"` + `describeOnHover`
(props déjà existantes, `ThemePalette.tsx:23-25,39-40`). Effet : **tous les thèmes visibles**
en grille 2 colonnes sans scroll (`ThemePalette.tsx:117`) + **tooltip explicatif** au survol
prolongé (450 ms, `armTooltip` `:51-58`, `getThemeDescription`). **Coût ≈ 0** : on ajoute deux
props sur un composant déjà importé. On conserve le **toggle de désannotation** existant
(re-cliquer le thème posé retire la clause, `:99-102`).

**Nature juridique (B3.b présentation).** Remplacer le `<select>` natif (`:110-127`) par un
nouveau composant `NaturePicker` (cf. §3.6). Field :
```tsx
<Field label="Nature juridique">
  <NaturePicker
    value={draft.legalNature}
    legalNatures={legalNatures}      // déjà fourni par AnnotationWorkspace (scheme.legalNatures)
    describeOnHover
    onChange={(code) => updateDraft(draft.localId, { legalNature: code || null })}
  />
</Field>
```

### 3.3 Zone 3 — Justification (accordéon, ouvert par défaut s'il y a du contenu)

Regroupe evidence + rationale + comparateur (objectif : relier la **citation** à sa
**justification** et à leurs équivalents LLM, B3.c).

- **Evidence span** — mise en valeur typographique de la citation (pattern déjà utilisé
  `InspectorJudgeCompare.tsx:102` et `SentenceMenu.tsx:318-322` : `border-l-2 border-line
  pl-2 italic`). En lecture, on rend la citation entre guillemets `« … »` ; l'édition reste
  un champ texte mais visuellement distingué (encart bordé). `updateDraft({evidenceSpan})`.
- **Rationale** — `<textarea>` conservé (`:147-157`). C'est ce texte qui alimente le
  `RationaleHover` au survol de la phrase (cf. axe 1, dossier hover).
- **`InspectorJudgeCompare`** intégré **juste sous** ces deux champs (cf. §3.5).

### 3.4 Zone 4 — Commentaires (B3.d : visibles, pas optionnels)

Suppression de la dépendance à `CommentThread.tsx` (version pauvre) dans l'inspecteur.

- **Extraire** la carte riche de `CommentsPanel.tsx:134-172` (avatar couleur contributeur
  `:144-151`, badge de portée `scopeLabel` `:25-36`, résolution `:159-167`) dans un composant
  **partagé** `CommentCard.tsx`, consommé à la fois par `CommentsPanel` et l'inspecteur (pas
  de duplication). Le `nameOf` (map `userId → {name,color}` via `useContributors`,
  `CommentsPanel.tsx:60-64`) est hissé dans `CommentCard` ou passé en prop.
- L'inspecteur affiche les commentaires **filtrés sur la clause courante**
  (`scope === "clause" && clauseId === draft.serverId`) + un en-tête **`Commentaires (n)`**
  avec compteur dans le titre de l'accordéon, et le **composer inline toujours présent**
  (réutiliser le composer de `CommentsPanel.tsx:175-214`, portée figée à `clause`).
  Un fil à 0 commentaire reste visible avec son champ de saisie (exigence « pas optionnel »).

### 3.5 `InspectorJudgeCompare` — réécriture N-modèles

Réécriture de `InspectorJudgeCompare.tsx`. Remplacer le `type Source` codé en dur (`:17`) et
la lecture `claudePre`/`codexPre` (`:51-52`) par une **itération sur `llm.preByJudge`**
(déjà fourni par `useLlmAgreement`, `hooks.ts:311-313`) croisée avec `LLM_JUDGES`
(`lib/llmJudges.ts:21-25`, Mistral inclus) pour l'ordre/les libellés/les couleurs.

- **Onglets de source** générés dynamiquement : `['Vous', ...juges présents]` où « présent »
  = `preByJudge[id]` existe ET a une clause couvrante (`coveringClause`, déjà dans le fichier
  `:20-29`). Mistral apparaît automatiquement dès qu'il est importé.
- Type : `type Source = "human" | string` (id de juge), au lieu de l'union fermée.
- Pour le juge sélectionné, afficher **4 champs** : thème (`ClauseChip` lecture seule, `ghost`),
  **nature** (badge `NaturePicker` lecture seule — *Lot 2*, `—` tant que la donnée n'existe pas),
  evidence (citation bordée italique), rationale.
- **Reprendre par champ** + **Reprendre tout** (idée retenue de l'option C) :
  ```tsx
  <button onClick={() => updateDraft(draftLocalId, { evidenceSpan: judge.evidenceSpan })}>↧ Evidence</button>
  <button onClick={() => updateDraft(draftLocalId, { rationale: judge.rationale })}>↧ Rationale</button>
  <button onClick={() => updateDraft(draftLocalId, { legalNature: mapNature(judge.legalNature) })}>↧ Nature</button>  // Lot 2
  <button onClick={() => updateDraft(draftLocalId, { theme, evidenceSpan, rationale, legalNature })}>Reprendre tout</button>
  ```
  > **Note Lot 2** : la nature LLM (`judge.legalNature`) appartient à un **vocabulaire plus
  > riche que le vocab humain fermé** (cf. `legal-nature-data.md` §3). L'adoption d'une nature
  > passe donc par `mapLlmNatureToHuman()` (table de réconciliation, calquée sur le précédent
  > `theme_mapping.normalize_theme_code`). Une nature LLM hors-table (`UNKNOWN`, `META`, …)
  > est affichée **en lecture** mais **non adoptable** (bouton grisé) pour ne jamais injecter
  > un code hors-scheme dans l'annotation humaine (INV-3).
- Conserver les `data-testid` `inspector-source-*`, `inspector-source-content`,
  `inspector-source-adopt` (non-régression des tests existants).

### 3.6 Nouveau composant `NaturePicker`

`frontend/src/components/ui/NaturePicker.tsx`, calqué sur `ThemePalette` (pattern
`describeOnHover` + `armTooltip`) **mais plus simple** (6 natures fixes → pas de filtre, un
**`radiogroup` à pastilles** suffit, pas de listbox filtrable).

```ts
export interface NaturePickerProps {
  value: string | null;
  onChange: (code: string | null) => void;        // null = « aucune » (toggle)
  legalNatures: LegalNature[];                     // scheme.legalNatures (a déjà .definition)
  describeOnHover?: boolean;
  size?: "sm" | "md";
  readOnly?: boolean;                              // pour l'affichage dans le comparateur
}
```

Design / tokens :
- Pastilles en `flex flex-wrap gap-1`, chacune `rounded-md border px-2 py-1 text-xs`,
  sélection = `ring-2` + fond léger (même langage que `CertaintyPicker.tsx:44-58`).
- **Couleur** : les natures n'ont **aucune couleur** dans le type `LegalNature`
  (`contract.ts:116-123`) ni dans `vocabulary.yaml` → on **ajoute** un helper
  `getLegalNatureToken(code) → {label, color}` dans `lib/tokens.ts` (couleurs d'identité
  dérivées de la nature : OBLIGATION ambre, PROHIBITION rouge, PERMISSION vert,
  DEFINITION bleu, DECLARATION violet, PROCEDURE cyan). **Requis** (pas optionnel) pour des
  pastilles colorées fidèles — point soulevé par le verdict d'audit `legal-nature`.
- **Tooltip définition** au survol prolongé : réutiliser le pattern `armTooltip`/`hovered`
  de `ThemePalette.tsx:47-61,166-185`, en lisant `legalNature.definition` (déjà exposé par
  l'API scheme, `schemes/serializers.py:29`, type `contract.ts:121`). **Prérequis data** :
  les définitions sont **absentes de `vocabulary.yaml`** (les 6 natures n'ont que
  `code/label/order`) → il faut **les ajouter au YAML** (le type et le serializer les
  supportent déjà). Sans définition, le tooltip n'affiche que le label (dégradation propre).
- A11y : `role="radiogroup"`, chaque pastille `role="radio" aria-checked`, navigation flèches,
  `aria-describedby` vers le tooltip. `data-testid="nature-picker"`, `nature-option-<code>`.

---

## 4. Impacts

### 4.1 Frontend (Lot 1, sans backend)

| Fichier | Action |
|---------|--------|
| `components/workspace/InspectorPanel.tsx` | Réécriture en 4 zones + 2 accordéons (`localStorage`), header sticky, Valider, `NaturePicker`, evidence mise en valeur, `CommentCard` |
| `components/ui/NaturePicker.tsx` | **Création** (radiogroup à pastilles + tooltip définition) |
| `components/ui/ClauseChip.tsx` | Inchangé (déjà `validated`, déjà `ghost`) |
| `components/ui/ThemePalette.tsx` | Inchangé — on l'invoque avec `layout="grid" describeOnHover` |
| `components/workspace/InspectorJudgeCompare.tsx` | Réécriture N-modèles via `preByJudge` + reprise par champ |
| `components/workspace/CommentCard.tsx` | **Création** (extrait de `CommentsPanel.tsx:134-172`) |
| `components/workspace/CommentsPanel.tsx` | Consomme `CommentCard` (dédup) |
| `lib/tokens.ts` | Ajout `getLegalNatureToken()` (couleurs des 6 natures) |
| `dossier/00_overview/vocabulary.yaml` | Ajout des `definition` aux 6 natures (alimente le tooltip) |

### 4.2 Frontend + Backend (Lot 2, chaîne LLM)

Détaillé dans `legal-nature-data.md`. Synthèse des points de contact côté inspecteur :

| Fichier | Action |
|---------|--------|
| `types/contract.ts:316` | `PreClause` += `legalNature?: string \| null` |
| `components/workspace/SentenceMenu.tsx:28` | `JudgeDetail` += `legalNature: string \| null` ; badge nature dans `JudgeBlock` (`:269-283`) |
| `components/workspace/DocumentPanel.tsx:904` | `buildJudgeDetailMap`/`detailAt` portent `legalNature` |
| `components/workspace/InspectorJudgeCompare.tsx` | Affiche + adopte la nature (via `mapLlmNatureToHuman`) |
| `lib/pivot.ts:114` | `preClausesToPivot` propage `legal_nature` (au lieu de `null`) |
| `store/workspace.ts:760` | Le chemin prefill lit déjà `seg.legal_nature` → débloqué par pivot |
| Backend `loaders.py`, `services.py`, `models.py`+migration, `serializers.py` | Cf. `legal-nature-data.md` |

### 4.3 Accessibilité

- `NaturePicker` : `radiogroup` + navigation flèches + `aria-checked` + tooltip
  `aria-describedby` (parité `CertaintyPicker`/`ThemePalette`).
- Accordéons : `<button aria-expanded>` + `<region aria-labelledby>` ; respect de
  `prefers-reduced-motion` sur la transition d'ouverture (pas d'animation si réduit).
- Bouton Valider : `aria-pressed` (état binaire) — comme `SentenceMenu.tsx:171`.
- Comparateur : onglets `role="radio"` dans un `radiogroup` (conserve l'existant `:70`).
- Header sticky : ne pas piéger le focus ; ordre de tabulation logique (chip → valider →
  supprimer → certitude → thème → nature → justification → commentaires).

### 4.4 Performance

- `ThemePalette` en `grid` rend ~20 `<li>` sans scroll — coût négligeable (déjà fait dans
  `SentenceMenu`). `NaturePicker` = 6 pastilles, trivial.
- `InspectorJudgeCompare` itère `LLM_JUDGES` (≤ 3) × `coveringClause` (recherche binaire-ish
  sur clauses triées) — recalcul mémoïsé via `useLlmAgreement` (déjà `useMemo`, `hooks.ts:305`).
- Pas de nouvel appel réseau pour Lot 1 (toutes les données — `preByJudge`, contributeurs,
  commentaires — sont déjà chargées par des hooks existants).

### 4.5 Tests (non-régression + nouveaux)

- Conserver les `data-testid` existants : `inspector`, `inspector-no-clause`, `legal-nature`
  (le réaffecter au `NaturePicker` racine pour ne pas casser les sélecteurs), `evidence-span`,
  `rationale`, `inspector-source-*`, `comment-item`, `resolve-comment`.
- Nouveaux : `inspector-validate`, `nature-picker`, `nature-option-<code>`, `nature-tooltip`,
  `inspector-accordion-justification`, `inspector-accordion-comments`,
  `inspector-source-<judgeId>` (Mistral), `inspector-source-adopt-nature`.
- Vitest/MSW : monter l'inspecteur avec `preByJudge` à 3 juges → vérifier l'onglet Mistral.
  Playwright : valider depuis l'inspecteur → la clause passe `validated` dans le plan.

---

## 5. Plan de livraison

1. **Lot 1.a** — `getLegalNatureToken` + `NaturePicker` + `vocabulary.yaml` (définitions).
2. **Lot 1.b** — Réécriture `InspectorPanel` (4 zones, header sticky, Valider, accordéons).
3. **Lot 1.c** — `CommentCard` partagé + branchement inspecteur ↔ `CommentsPanel`.
4. **Lot 1.d** — `InspectorJudgeCompare` N-modèles (thème/evidence/rationale ; nature en `—`).
5. **Lot 2** — chaîne `legal_nature` LLM (cf. `legal-nature-data.md`) → la nature LLM
   s'allume dans le comparateur, le `SentenceMenu` et (optionnellement) le `RationaleHover`.

Le Lot 1 est **autonome et déployable** sans toucher au backend ni à la base de prod.
