# Refonte de la barre d'outils du workspace (Axe 4)

> Dossier d'ingénierie — Pactiva, refonte du workspace d'annotation.
> Source d'audit : [`00-audit/audit-uiux.json`](../00-audit/audit-uiux.json) (axe `toolbar`, `sound: true`).
> Besoins : [`01-besoins/besoins.md`](../01-besoins/besoins.md) — **B4.1** (analyse structure/hiérarchie/couleurs/animations), **B4.2** (organisations comparatives → proposition finale), **B4.3** (section « sélections multiples » avancée).
> Décision arrêtée : **Option B** — `ToolbarShell` + `ToolGroup` + groupes sémantiques + overflow « Plus » + section **Sélection** contextuelle.

---

## 1. État des lieux : ce qui ne va pas aujourd'hui

### 1.1 Deux barres concurrentes, non coordonnées

Le chrome d'outils du workspace est **éclaté sur deux composants** qui s'ignorent :

| Barre | Fichier | Nature | Contenu |
|---|---|---|---|
| **Barre haute** (chrome app) | `WorkspaceToolbar.tsx:177` | `flex flex-wrap … border-b bg-elevated px-4 py-2` (non sticky) | DocumentSwitcher, StatusPill, SaveIndicator, **Pré-remplir** (radiogroup juges), Historique, Commentaires, Inspecteur, Versions, Insights, Tour, puis `ml-auto` : Certitude globale, Snapshot, Validation-meter, Soumettre |
| **Barre basse** (`document-controls`) | `DocumentPanel.tsx:388-515` | `sticky top-0 z-20 … flex flex-wrap items-center gap-3` | CollabBar, Version (select), Frontières (checkbox), LlmSourceSwitch, Attribution, Comparer, « Jusqu'à la frontière », Légende, reading-controls (zoom/large), LangSwitch |

Le `data-testid="document-controls"` visé par le besoin n'est **pas** dans `WorkspaceToolbar` mais dans `DocumentPanel`. Les deux barres portent des **doublons conceptuels** : le pré-remplissage (haut) et la source LLM (bas) concernent tous deux les juges, mais sont séparés de plusieurs centimètres et de styles différents.

### 1.2 `document-controls` = empilement plat sans hiérarchie

`DocumentPanel.tsx:390` pose **9 contrôles hétérogènes** dans un unique `flex flex-wrap items-center gap-3`, sans `role="group"`, sans séparateur, sans ordre stable. En `flex-wrap`, le retour à la ligne est **imprévisible** : la barre se réorganise différemment selon la largeur du panneau (qui est lui-même redimensionnable via `ResizablePanels`).

### 1.3 Vocabulaire visuel fragmenté : 3 conventions « actif » + contrôles natifs

Trois styles d'« état actif » cohabitent pour la même intention :

| Contrôle | Style actif | Réf. |
|---|---|---|
| LlmSourceSwitch / LangSwitch (segmented) | `bg-accent/15 text-ink shadow-sm ring-1 ring-accent/40` | `LlmSourceSwitch.tsx:71`, `LangSwitch.tsx:66` |
| Attribution / Comparer (toggle) | `border-accent/60 bg-accent/10 text-ink` | `DocumentPanel.tsx:434,449` |
| reading-wide (`↔`) | `bg-accent/15 text-ink ring-1 ring-accent/40` (sans `shadow-sm`) | `DocumentPanel.tsx:507` |

Pire, les **primitives de contrôle** ne sont pas alignées :
- **Frontières** = `<input type="checkbox">` nu (`DocumentPanel.tsx:415-423`) au milieu de switches stylés ;
- **Version** = `<select>` HTML natif (`DocumentPanel.tsx:400-412`), rendu OS, hors design tokens ;
- Attribution = `<button aria-pressed>` ; LlmSourceSwitch = `role="radio"`.

Quatre grammaires d'interaction pour une seule barre.

### 1.4 Libellés « Claude/Codex » figés alors que le système est N-modèles

Le système gère déjà **3 juges** (`LLM_JUDGES` : claude, codex, **mistral** — `llmJudges.ts:21-25`), et `PREFILL_OPTIONS` (`WorkspaceToolbar.tsx:167-174`) comme `LlmSourceSwitch` (`LlmSourceSwitch.tsx:22-30`) sont **générés dynamiquement** depuis cette liste. Mais des libellés restent **codés en dur** sur 2 juges :

- `title="Panneau comparatif Claude/Codex — g"` — `DocumentPanel.tsx:446` ;
- bandeau « Accord Claude / Codex » — `DocumentPanel.tsx:524` ;
- dialog de pré-remplissage : `pendingPrefill === "claude" ? "Claude" : "Codex"` — `WorkspaceToolbar.tsx:339` **et** `:344` (Mistral y est rendu comme « Codex »).

La barre **mélange du dynamique correct et des libellés figés**, ce qui ment à l'utilisateur dès qu'un 3ᵉ modèle est en jeu.

### 1.5 Aucune progressive disclosure, aucun overflow

`WorkspaceToolbar.tsx:218-272` aligne **6 boutons texte+icône** (Historique, Commentaires, Inspecteur, Versions, Insights, Tour) tous au **même poids visuel** (`border border-line px-2 py-1 text-xs text-ink-muted`), sans distinction entre actions fréquentes (Inspecteur, Commentaires) et rares (Insights, Tour, Versions). Pas de menu « Plus ». Sur écran étroit, `flex-wrap` empile des lignes non structurées.

À l'inverse, **`CollabBar` est le bon modèle** (`CollabBar.tsx:31` : `if (!presenceEnabled) return null;`) : rien si non pertinent, discret sinon. C'est ce pattern conditionnel qu'on généralise à la section Sélection et au groupe Comparer.

### 1.6 La section « sélections multiples » est quasi inexistante côté barre

Un **seul** contrôle existe dans la barre : `select-to-boundary` (`DocumentPanel.tsx:457-465`), qui fait `selectRange(focused, nextBoundaryFrom(boundaryStarts, focused, n) - 1)`.

Or le store expose déjà tout le nécessaire : `selectedSentences[]` (`workspace.ts:95`), `selectRange` / `toggleSelected` / `clearSelection` (`workspace.ts:800-819`), déjà câblés sur Shift+clic (`DocumentPanel.tsx:774`) et Ctrl+clic (`:779`). Les helpers `runAt` / `runThemeAt` / `nextBoundaryFrom` (`runs.ts:116,146,155`) rendent triviales les actions « segment courant », « tout le thème courant », « étendre/réduire ». **Aucune n'est exposée**, et il n'y a **aucun compteur** « N phrases sélectionnées » dans la barre.

> **Point de coordination clé.** Il existe déjà un composant `SelectionToolbar` (`SelectionToolbar.tsx`, rendu `DocumentPanel.tsx:887`) : une **barre flottante** bas-centre qui apparaît dès qu'il y a une sélection et porte les **actions** sur la sélection (Annoter, Désannoter, Valider, Traduire, Effacer) — plus un mode blocs (Étendre/Réduire d'**une** phrase via `applyBlockOp`). Il faut donc **distinguer deux rôles** et ne pas les confondre :
> - **Construire** l'ensemble sélectionné (où s'arrête la sélection ? quel périmètre ?) → c'est le rôle de la nouvelle **section Sélection de la barre** (`SelectionToolGroup`).
> - **Opérer** sur l'ensemble construit (l'annoter, le valider…) → reste le rôle de la `SelectionToolbar` flottante existante.
> Les « Étendre/Réduire » du `SelectionToolGroup` agissent sur les **bornes du périmètre de sélection** (jusqu'à la frontière de segment), à ne pas confondre avec les `block-extend`/`block-shrink` de la flottante qui étendent un **bloc-clause d'une phrase** via `applyBlockOp` (`SelectionToolbar.tsx:208,218`).

### 1.7 Animations pauvres, pas de feedback d'état serveur dans la barre

Tous les boutons se limitent à `transition-colors`. Pas d'état `pressed` animé, pas de transition à l'apparition conditionnelle du toggle Comparer ni du bandeau. **Bon contre-exemple à généraliser** : `SaveIndicator` (`WorkspaceToolbar.tsx:379-419`) est correct (`role="status"`, `aria-live="polite"`).

---

## 2. Trois options comparatives (B4.2)

| Critère | **A — Regroupement in-place + séparateurs** | **B — `ToolbarShell` + groupes + overflow + Sélection contextuelle** | **C — Barre contextuelle flottante + barre principale allégée** |
|---|---|---|---|
| **Principe** | Garder les 2 barres, y injecter des wrappers `role="group"` + un `ToolGroup`/`ToolDivider`, standardiser « Frontières » en toggle stylé | Primitives `ToolbarShell`/`ToolGroup`/`ToolDivider`/`OverflowMenu` ; `document-controls` réorganisé en groupes ordonnés stables ; nouvelle section **Sélection** conditionnelle + compteur ; overflow « Plus » ; libellés N-modèles | Séparer 2 régimes : barre principale (réglages persistants) toujours en haut + une `SelectionActionBar` flottante n'apparaissant qu'en sélection |
| **Forces** | Risque quasi nul, aucun changement de store, gain de lisibilité immédiat ; réutilise tokens et markup segmented existants | Traite **les 4 problèmes majeurs** : densité plate, vocabulaire fragmenté, libellés figés, absence de section Sélection. Vraie barre contextuelle. a11y renforcée (`role="toolbar"` + `role="group"`). Réutilise les patterns éprouvés (segmented, conditionnel `CollabBar`, tokens accent/line) | Découvrabilité maximale des actions multi-sélection ; libère la barre principale ; pattern « floating pill » d'éditeur moderne |
| **Faiblesses** | Ne résout ni le doublon haut/bas, ni la non-stickiness du bandeau divergence ; `flex-wrap` reste imprévisible avec trop de groupes | Refactor plus large (déplacer du JSX de `DocumentPanel` vers sous-composants, brancher 2 nouvelles primitives store) ; plus de surface de test (testids à préserver) | **Nouveau langage d'UI flottant absent du reste de l'app** → risque d'incohérence + collision avec `compare-banner`/`DivergenceNav` déjà en bas ; **doublonne la `SelectionToolbar` flottante déjà existante** ; gestion focus/z-index/positionnement plus délicate |
| **Ergonomie** | Correcte, mais reste un patch | Cohérence forte : prolonge le langage visuel appris (segmented, conditionnel), barre contextuelle = vraie réponse au besoin | Puissant mais introduit une 2ᵉ barre flottante en plus de celle qui existe → confusion |
| **Effort** | **S** | **M** | **L** |

### Choix retenu — Option B (justification)

**B est le seul plan qui traite simultanément les quatre problèmes majeurs** (densité plate de `document-controls`, vocabulaire visuel fragmenté, libellés Claude/Codex figés, absence d'une vraie section Sélection multiple) **sans introduire un nouveau langage d'UI flottant** non présent ailleurs — écueil de l'Option C, d'autant plus net qu'une barre flottante (`SelectionToolbar`) **existe déjà** ; en ajouter une seconde créerait deux barres flottantes au rôle voisin.

On **intègre les standardisations de l'Option A comme première étape** de B (lot 0 ci-dessous), car elles sont à risque nul et préparent le terrain.

L'audit confirme : tout repose sur le store et `runs.ts` existants ; **aucune donnée ni API backend nouvelle** n'est requise. Les seules additions code sont deux helpers front : `prevBoundaryFrom` (`runs.ts`) et l'action store `selectMany`.

---

## 3. Architecture cible

### 3.1 Wireframe ASCII de la barre `document-controls` cible

```
┌─ document-controls (sticky top-0 z-20, role="toolbar", aria-orientation="horizontal") ────────────────────────────┐
│                                                                                                                    │
│  [● ◑◐ +2  Inviter]   │  [Humain│Claude│Codex│Mistral│Comparer]  ⟨Comparer⟩  Version[Auto ▾]  │  …               │
│  └── CollabBar ──────┘ │ └──────── GROUPE: Source / Comparaison ───────────┘                  │                  │
│   (rien si solo)         role="group" aria-label="Source et comparaison"                       │                  │
│                                                                                                                    │
│   …  │  ⟨Frontières⟩  ⟨Attribution⟩  [A−  100%  A+]  [↔]   │   [VO│Bilingue│FR]   │  [⋯ Plus ▾]                   │
│      │ └───── GROUPE: Lecture ──────────────────────────┘  │ └─ GROUPE: Langue ─┘ │  └ OverflowMenu ┘            │
│        role="group" aria-label="Lecture"                     role="group"             (Légende modèles,           │
│                                                              aria-label="Langue"       réglages rares)            │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

  ── apparaît UNIQUEMENT si selectedSentences.length > 0 (pattern CollabBar) ──
┌─ SelectionToolGroup (role="group" aria-label="Sélection multiple") ────────────────────────────────────────────┐
│  ◧ 7 phrases sélectionnées │ [Segment courant] [Jusqu'à la frontière] [⊟ Étendre] [⊞ Réduire] [Tout le thème] [✕ Vider] │
│  └ selection-count ───────┘                                                                                       │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
        (apparition animée : opacity + translateY(2px) → 0, réutilise le keyframe fade-in 120ms)

  ── EN MODE COMPARER (isCompare), bloc sticky d'un seul tenant (cf. axe 7) ──
┌─ CompareStickyHeader (sticky, sous document-controls) ─────────────────────────────────────────────────────────┐
│  Accord Claude / Codex / Mistral   κ(Fleiss) 0.62 · 78% tous d'accord (132)   ● accord ◐ partiel ◯ conflit       │
│  ◄ Divergence 3/9 ►   (DivergenceNav, data-testid conservés)                                                     │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Légende des groupes (ordre stable, gauche → droite) :

```
CollabBar │ Source/Comparaison │ Sélection* │ Lecture │ Langue │ Plus
          ↑ ToolDivider          ↑ *conditionnel
```

> La **barre haute** (`WorkspaceToolbar`) suit la même grammaire mais reste centrée sur le **chrome applicatif** (document, statut, sauvegarde, validation, soumission). On y applique l'overflow « Plus » (cf. §3.6) et la correction des libellés du dialog de pré-remplissage. Les actions fréquentes restent en surface : Inspecteur, Commentaires, Historique.

### 3.2 Nouvelles primitives de barre

Trois petits composants dans `components/workspace/` (présentationnels, sans état métier) :

```tsx
// ToolGroup.tsx
export function ToolGroup({
  label,
  children,
  className,
}: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div role="group" aria-label={label}
         className={cn("inline-flex items-center gap-1.5", className)}>
      {children}
    </div>
  );
}

// ToolDivider.tsx — séparateur vertical purement visuel
export function ToolDivider() {
  return <span aria-hidden className="mx-1 h-5 w-px bg-line/50" />;
}

// OverflowMenu.tsx — bouton « Plus » + popover réutilisant useAnchoredPosition
//   (le même hook que SentenceMenu/BoundaryEvidence : flip + clamp viewport).
//   Style du popover aligné sur les dialogs : border-line bg-elevated shadow-xl.
export function OverflowMenu({ items }: { items: OverflowItem[] }) { /* … */ }
```

`ToolbarShell` est le conteneur racine commun (remplace les `<div className="flex flex-wrap…">` actuels) :

```tsx
// ToolbarShell.tsx
export function ToolbarShell({
  sticky = false,
  ariaLabel,
  children,
}: { sticky?: boolean; ariaLabel: string; children: React.ReactNode }) {
  return (
    <div
      role="toolbar"
      aria-label={ariaLabel}
      aria-orientation="horizontal"
      className={cn(
        "flex flex-wrap items-center gap-3 text-sm",
        sticky &&
          "sticky top-0 z-20 -mx-2 mb-4 border-b border-line/40 bg-reading/90 px-2 py-2 " +
          "backdrop-blur supports-[backdrop-filter]:bg-reading/75",
      )}
    >
      {children}
    </div>
  );
}
```

> **Réutilisation, pas réécriture.** `LlmSourceSwitch`, `LangSwitch`, `CollabBar`, `reading-controls`, `ModelBoundaryLegend` ne changent pas de comportement : ils sont simplement **rangés dans des `ToolGroup`**. La seule réécriture interne porte sur « Frontières » (checkbox → toggle) et le wording N-modèles.

### 3.3 Réorganisation de `document-controls` (groupes ordonnés et stables)

Remplacer `DocumentPanel.tsx:388-515` par un `ToolbarShell sticky` contenant, dans cet ordre **fixe** :

| Groupe | `aria-label` | Contenu | testids conservés |
|---|---|---|---|
| (gauche) | — | `CollabBar` (rien si solo) | `collab-bar`, `collab-invite` |
| **Source / Comparaison** | `Source et comparaison` | `LlmSourceSwitch` + bouton **Comparer** (si `compareDataReady`) + select **Version** | `llm-source-switch`, `toggle-compare-panel`, `llm-version-select` |
| **Sélection** *(conditionnel)* | `Sélection multiple` | `SelectionToolGroup` — voir §4 | `selection-count`, `select-segment`, `select-to-boundary`, … |
| **Lecture** | `Lecture` | **Frontières** (toggle) + **Attribution** + `reading-controls` (A−/%/A+/↔) | `boundary-toggle`, `toggle-attribution`, `reading-controls`, `reading-wide` |
| **Langue** | `Langue` | `LangSwitch` | `lang-switch` |
| **Plus** | `Plus d'options` | `OverflowMenu` : `ModelBoundaryLegend` (déplacée), réglages rares | `toolbar-overflow` |

Séparateurs `ToolDivider` entre groupes. **Tous les `data-testid` existants sont préservés** pour ne casser ni les tests Vitest/MSW ni les e2e Playwright.

### 3.4 Standardisation des contrôles (lot 0, issu de l'Option A)

1. **Frontières** (`DocumentPanel.tsx:415-423`) : le `<input type="checkbox">` nu devient un `<button aria-pressed>` au **même style** qu'Attribution, sur **un seul motif d'état actif** unifié. On retient le motif `LlmSourceSwitch` (le plus répandu, segmented + reading-wide) :

   ```
   actif  : "bg-accent/15 text-ink shadow-sm ring-1 ring-accent/40"
   inactif: "border border-line text-ink-muted hover:bg-panel-muted"
   ```

   On harmonise donc **Attribution** et **reading-wide** sur ce même motif (notamment ajouter le `shadow-sm` manquant sur reading-wide, `DocumentPanel.tsx:507`, et abandonner le motif `border-accent/60 bg-accent/10`). Résultat : **une seule grammaire visuelle « actif »** sur toute la barre.

2. **Version** : le `<select>` natif reste fonctionnellement (faible enjeu visuel), mais reçoit les classes tokens déjà appliquées (`border-line bg-panel text-ink`) — c'est déjà le cas (`DocumentPanel.tsx:402`), on le range simplement dans le groupe Source.

### 3.5 Libellés N-modèles (suppression des « Claude/Codex » figés)

- Titre du toggle Comparer (`DocumentPanel.tsx:446`) → construit depuis les modèles comparés : ``title={`Comparer ${compareJudgesData.map(j => j.label).join(" / ")} — g`}`` (ou wording « Comparer les modèles sélectionnés — g » si simple). Aligné avec l'axe 7.
- Bandeau d'accord (`DocumentPanel.tsx:524`) → traité par l'axe 7 (`CompareStickyHeader` N-way) ; la barre ne fait plus l'hypothèse « Claude / Codex ».
- **Dialog de pré-remplissage** (`WorkspaceToolbar.tsx:339` et `:344`) : remplacer les deux ternaires `pendingPrefill === "claude" ? "Claude" : "Codex"` par `llmJudgeLabel(pendingPrefill)` (`llmJudges.ts:30`). Le narrowing est sûr : le bloc est gardé par `{pendingPrefill && (...)}` (`WorkspaceToolbar.tsx:330`), donc `pendingPrefill` est une `string` non nulle à cet endroit.

### 3.6 Overflow « Plus » dans la barre haute

Dans `WorkspaceToolbar.tsx:218-272`, garder en surface les actions **fréquentes** (Inspecteur, Commentaires, Historique) et déplacer les actions **rares** (Versions, Insights, Tour) dans un `OverflowMenu` « Plus ». Le popover réutilise `useAnchoredPosition` et le style `border-line bg-elevated shadow-xl` des dialogs existants (`WorkspaceToolbar.tsx:337`). `WorkspaceTourButton` peut rester un item d'overflow.

### 3.7 Animations & a11y transverses

- **Baseline** : conserver `transition-colors` partout.
- **Apparition** du `SelectionToolGroup` et du bandeau compare : réutiliser le keyframe **`fade-in`** déjà défini (`tailwind.config.ts:60-66` : `opacity 0→1` + `translateY(2px)→0`, 120 ms ease-out). Classe `animate-fade-in`. Respecter `prefers-reduced-motion` (désactiver le translate).
- **`role="toolbar"`** sur les deux shells, **`role="group"` + `aria-label`** par groupe (« Source et comparaison », « Sélection multiple », « Lecture », « Langue »). Les segmented existants conservent leur `role="radiogroup"`/roving tabindex (déjà conformes, `LlmSourceSwitch.tsx:37-44`).
- Le compteur de sélection est `role="status"` `aria-live="polite"` (sur le modèle de `SaveIndicator`) pour annoncer « 7 phrases sélectionnées ».

---

## 4. Section « SÉLECTIONS MULTIPLES » (B4.3) — `SelectionToolGroup`

Nouveau composant `components/workspace/SelectionToolGroup.tsx`, **rendu uniquement si `selectedSentences.length > 0`** (pattern conditionnel de `CollabBar.tsx:31`), placé dans le groupe **Sélection** de `document-controls`. Il **construit** le périmètre ; les **opérations** restent à la `SelectionToolbar` flottante (Annoter/Valider/Traduire).

### 4.1 Compteur

```tsx
<span data-testid="selection-count" role="status" aria-live="polite"
      className="inline-flex items-center gap-1.5 font-medium text-ink">
  <SquareDashedMousePointer size={14} aria-hidden />
  {n} phrase{n > 1 ? "s" : ""} sélectionnée{n > 1 ? "s" : ""}
</span>
```

> Le testid `selection-count` est **déjà utilisé** par la `SelectionToolbar` flottante (`SelectionToolbar.tsx:90`). Pour éviter la collision e2e, le compteur de la barre prend `data-testid="selection-count-toolbar"` ; la flottante conserve `selection-count`.

### 4.2 Actions (toutes câblées sur des primitives existantes ou triviales)

| Action | testid | Câblage | Donnée |
|---|---|---|---|
| **Segment courant** | `select-segment` | borner le segment **tous modèles confondus** autour de `focused` via `boundaryStarts` : `selectRange(prevBoundaryFrom(boundaryStarts, focused, n), nextBoundaryFrom(boundaryStarts, focused, n) - 1)` | `boundaryStarts` (`DocumentPanel.tsx:237`), `nextBoundaryFrom` (`runs.ts:155`), **`prevBoundaryFrom` (à ajouter)** |
| **Jusqu'à la frontière** | `select-to-boundary` | *existant*, **déplacé** ici : `selectRange(focused, nextBoundaryFrom(boundaryStarts, focused, n) - 1)` | inchangé |
| **Étendre** | `select-extend-next` | étendre le périmètre à la frontière de segment suivante : `selectRange(min(sel), nextBoundaryFrom(boundaryStarts, max(sel), n) - 1)` | `nextBoundaryFrom` |
| **Réduire** | `select-reduce` | reculer la borne haute à la frontière de segment précédente : `selectRange(min(sel), prevBoundaryFrom(boundaryStarts, max(sel), 0) ... )` (clampé, jamais < min) | **`prevBoundaryFrom`** |
| **Tout le thème courant** | `select-theme` | union des runs dont `r.theme === runThemeAt(runs, focused)` → `selectMany(indices)` | `runThemeAt` (`runs.ts:146`), **`selectMany` (à ajouter)** |
| **Vider** | `select-clear` | `clearSelection()` | `workspace.ts:819` |

`min(sel)`/`max(sel)` = `Math.min(...selectedSentences)` / `Math.max(...)`. `selectRange` clampe déjà à `[0, nSentences-1]` (`workspace.ts:804-806`), donc passer les bornes est sûr.

### 4.3 Sémantique « Segment courant » — piège à éviter (réserve d'audit)

`runAt(runs, focused)` ne convient **pas** pour « segment courant » : en source **humaine**, `runs` est calculé en mode `perSentence` (`DocumentPanel.tsx:197`, `computeRuns(..., { perSentence: true })`), donc un run humain couvre **une seule** phrase — l'action paraîtrait inerte. C'est pourquoi on borne via **`boundaryStarts`** (`DocumentPanel.tsx:237`, frontières **tous modèles confondus**), qui donne un vrai segment quelle que soit la source. Cf. réserve explicite du verdict d'audit (point 2).

### 4.4 « Tout le thème courant » — contiguïté non garantie

Les runs de même thème sont **souvent** contigus mais pas toujours (runs neutres intercalés en `perSentence`). Une simple `selectRange(min, max)` capturerait des phrases d'autres thèmes au milieu. D'où **`selectMany(indices: number[])`** : sélection potentiellement **non contiguë**, robuste. Implémentation : balayer `runs`, collecter `r.start..r.end` de chaque run dont le thème égale `runThemeAt(runs, focused)`.

### 4.5 Additions code (front only — aucun backend)

```ts
// lib/runs.ts — symétrique de nextBoundaryFrom (runs.ts:155-161)
/** Frontière strictement AVANT `from` (ou `min` si aucune en deçà). Pur → testable. */
export function prevBoundaryFrom(starts: number[], from: number, min: number): number {
  let best = min;
  for (const s of starts) {
    if (s < from && s > best) best = s;
  }
  return best;
}
```

```ts
// store/workspace.ts — voisin de selectRange (workspace.ts:800)
selectMany: (indices) =>
  set(() => {
    const next = Array.from(new Set(indices))
      .filter((i) => Number.isInteger(i) && i >= 0)
      .sort((a, b) => a - b);
    return { selectedSentences: next };
  }),
```

(Déclaration de type associée à ajouter à côté de `selectRange: (from, to) => void;` — `workspace.ts:203`.)

### 4.6 Tests

- **Unitaires** (`tests/runs.test.ts`) : `prevBoundaryFrom` (cas : frontière strictement avant, aucune → `min`, égalité ignorée), symétrie avec `nextBoundaryFrom`.
- **Store** : `selectMany` dédoublonne + trie + filtre les index invalides.
- **Composant** (`SelectionToolGroup`) : rendu conditionnel (rien si `selectedSentences` vide), compteur singulier/pluriel, chaque action déclenche le bon appel store (mock). Préserver `select-to-boundary` (déplacé, pas supprimé).
- **e2e** : sélectionner 3 phrases → vérifier `selection-count-toolbar`, puis « Tout le thème courant » étend la sélection, « Vider » la remet à zéro.

---

## 5. Synthèse des impacts

### 5.1 Fichiers impactés

| Fichier | Nature de l'intervention |
|---|---|
| `frontend/src/components/workspace/DocumentPanel.tsx` | Réorganiser `document-controls` (388-515) en `ToolbarShell` + `ToolGroup`s ; standardiser Frontières en toggle ; wording N-modèles du toggle Comparer ; insérer `SelectionToolGroup` |
| `frontend/src/components/workspace/WorkspaceToolbar.tsx` | `OverflowMenu` « Plus » (Versions/Insights/Tour) ; corriger le dialog de pré-remplissage (339, 344) via `llmJudgeLabel` |
| `frontend/src/components/workspace/ToolbarShell.tsx` | **À créer** — conteneur `role="toolbar"` |
| `frontend/src/components/workspace/ToolGroup.tsx` | **À créer** — `role="group"` + `aria-label` |
| `frontend/src/components/workspace/ToolDivider.tsx` | **À créer** — séparateur visuel |
| `frontend/src/components/workspace/OverflowMenu.tsx` | **À créer** — bouton « Plus » + popover (`useAnchoredPosition`) |
| `frontend/src/components/workspace/SelectionToolGroup.tsx` | **À créer** — section Sélection contextuelle (§4) |
| `frontend/src/components/workspace/LlmSourceSwitch.tsx`, `LangSwitch.tsx`, `CollabBar.tsx` | Inchangés (rangés dans des `ToolGroup`) |
| `frontend/src/lib/runs.ts` | **+ `prevBoundaryFrom`** |
| `frontend/src/store/workspace.ts` | **+ action `selectMany`** (+ type) |
| `frontend/src/lib/llmJudges.ts` | Inchangé (déjà `llmJudgeLabel`) |

### 5.2 Backend / Data

**Aucun besoin API ni donnée nouveau.** Tout repose sur le store (`selectedSentences`, `selectRange`, `clearSelection`, `focused`) et les helpers `runs.ts` existants. Seules additions : 2 helpers front (`prevBoundaryFrom`, `selectMany`).

### 5.3 a11y

- `role="toolbar"` + `aria-orientation` sur les shells ; `role="group"` + `aria-label` par groupe.
- Compteur de sélection en `role="status"` `aria-live="polite"`.
- Segmented conservent `role="radiogroup"` + roving tabindex (déjà conformes).
- `OverflowMenu` : `aria-haspopup="menu"`, `aria-expanded`, fermeture Escape + clic extérieur, focus piégé dans le popover.
- Standardisation du motif « actif » : un seul anneau `ring-accent/40` → contraste AA homogène.

### 5.4 Performance

Impact nul : aucune nouvelle boucle au scroll, pas de re-render supplémentaire. `SelectionToolGroup` ne monte que lorsqu'une sélection existe (sélecteur Zustand fin `selectedSentences`). `selectMany` est O(n) sur les index sélectionnés. Les calculs « segment/thème » réutilisent `runs`/`boundaryStarts` déjà mémoïsés (`DocumentPanel.tsx:197,237`).

### 5.5 Plan de livraison (dérisqué)

1. **Lot 0** (risque nul, = Option A) : `ToolbarShell`/`ToolGroup`/`ToolDivider`, regroupement sémantique, standardisation « actif », Frontières → toggle, wording N-modèles. Tests verts, testids préservés.
2. **Lot 1** : `SelectionToolGroup` + `prevBoundaryFrom` + `selectMany` + tests (§4.6).
3. **Lot 2** : `OverflowMenu` « Plus » dans la barre haute.

Le bandeau de divergence sticky (point 7) est traité dans le dossier de l'axe Comparaison ; la barre cible ci-dessus est compatible avec le `CompareStickyHeader` qui s'y branche (réf. wireframe §3.1).
