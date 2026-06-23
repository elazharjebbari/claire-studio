# 06 · Conception technique — Système 3 canaux (validation / provenance / multi-label)

> **Document technique (dev), niveau ingénierie senior.** Traduit le design du dossier UX
> (système 3 canaux orthogonaux) en contrats de types, découpage de composants et règles de
> dérivation, **ancré sur le code réel** de `claire-studio/frontend`. Stack : Django REST +
> Next.js App Router + Zustand + React Query + MSW + Vitest + Playwright + pytest.
>
> **Principe directeur** : la provenance et l'état de validation ne sont **PAS** des champs
> stockés mais une **PROJECTION pure** dérivée des champs natifs déjà présents
> (`validated`, `seededFrom`, `resolvedFrom`, `triageLevel`, `themes`). Une **source unique**
> (`validationDisplay.ts`) produit cette projection ; tous les composants la consomment.
> **Aucune migration back-end.**

---

## 1. Cartographie design → technique

| Canal UX (synthèse) | Question | Vecteur visuel | Porté techniquement par |
|---|---|---|---|
| Niveau C1–C5 | difficulté / accord | couleur de niveau (déjà déployé) | `triageLevel` + `TRIAGE_LEVEL_META` (existant, non touché) |
| **Provenance de validation** | pré-annotation / moteur / manuel ? | **forme** ★ / ⚡ / ✎ ; couleur = état | `validationDisplay.ts` (NOUVEAU, pur) → `ProvenanceMark.tsx` (NOUVEAU) |
| **Multi-label** | combien de thèmes ? lequel domine ? | chip plein / pointillé + badge `+N` + toggle 🏷 | `secondaryCount()` + `ClauseChip` étendu + `MultiLabelEditor` (inspecteur) |

État de l'existant à faire évoluer (vérifié dans le code) :

- `src/components/ui/ClauseChip.tsx` : n'affiche que `✓`/`◷` inline (`validated?: boolean`) + le thème **primaire scalaire** (`themeCode`). Pas de provenance, pas de `+N`.
- `src/components/workspace/InspectorPanel.tsx` : zone « Thème » = une `ThemePalette` mono (`value={draft.theme}`, `onChange` → `updateDraft({ theme })`). Pas de secondaires, pas de toggle.
- `src/store/workspace.ts` : `DraftClause` porte déjà `themes?: ThemeTag[]`, `seededFrom`, `resolvedFrom`, `validated`, `triageLevel`. `primaryOf(themes)` existe. Pas d'action dédiée multi-label.
- `src/lib/autosave.ts` : `themesKey()` + `sameFields()` comparent **déjà** `themes` (clé trivialisée pour le miroir mono) → l'autosave persiste `themes` sans modification.
- `src/lib/api/endpoints.ts` : `swapClausePrimary(id, label)` → `POST /clauses/{id}/swap-primary` existe déjà.
- `src/types/contract.ts` : `ThemeTag { label; role: "primary"|"secondary"; support? }`, `ClauseRole`, `primaryThemeOf()`.
- Refuges : `src/lib/triage/rules.ts` → `refuges: ["PREAMBLE_SCOPE", "MISC_BOILERPLATE"]`, déjà exclus comme secondaires côté moteur (`isRefuge` dans `engine.ts`).

> ⚠ **Pré-requis bloquant (étape 1 du runbook)** : figer la liste des thèmes / `theme_aliases`
> avant toute spec de chips. La source des libellés reste `getThemeToken(code).label`.

---

## 2. Module source unique — `frontend/src/lib/validationDisplay.ts`

**Rôle** : fonction PURE, sans React, sans I/O, **seul** endroit qui décide forme + couleur +
libellé. Testable isolément (Vitest, `tests/validationDisplay.test.ts`). Tout composant qui
affiche un signe de validation/provenance DOIT passer par ce module — interdiction de
recoder la logique ailleurs (règle de revue).

### 2.1 Contrat de type

```ts
export type Provenance = "preannotation" | "engine" | "manual" | "none";
export type ValidationState = "validated" | "to_validate" | "uncovered" | "conflict";

export interface ValidationDisplay {
  /** Reflet de DraftClause.validated (présence d'une référence confirmée). */
  validated: boolean;
  /** QUI a (ou propose de) valider — détermine la FORME. */
  provenance: Provenance;
  /** Niveau de triage, présent UNIQUEMENT si provenance === "engine". */
  level?: TriageLevel;
  /** Glyphe forme retenu : "★" | "⚡" | "✎" | "◷" | "❗" | "·". */
  glyph: string;
  /** État générique (couleur), orthogonal à la forme. */
  state: ValidationState;
  /** Classe Tailwind de couleur d'état (jamais une couleur seule → toujours doublée du glyph + label). */
  colorClass: string;        // ex. "text-emerald-400" | "text-amber-400" | "text-rose-400" | "text-slate-400"
  /** Hex d'accent de provenance (pour liseré/halo discret), optionnel. */
  accentHex?: string;        // ★ #F59E0B · ⚡ #3B82F6 · ✎ #22C55E
  /** Libellé court visible/tooltip (« Validé via le triage — règle C2 »). */
  label: string;
  /** Libellé long pour aria-label (forme + état + règle), JAMAIS la couleur seule. */
  ariaLabel: string;
}

/** Entrée minimale : un sous-ensemble lisible de DraftClause / Clause (Pick découplé). */
export type ValidationInput = Pick<
  DraftClause,
  "validated" | "seededFrom" | "resolvedFrom" | "triageLevel" | "themes"
>;

export function validationDisplay(c: ValidationInput): ValidationDisplay;
export function secondaryCount(themes?: ThemeTag[]): number;
```

`secondaryCount` : `themes ? themes.filter(t => t.role === "secondary").length : 0`. Centralisé
ici pour que le badge `+N` (ClauseChip) et le compteur de l'inspecteur partagent **un seul**
calcul (pas de divergence possible).

### 2.2 Table de décision — dérivation des 3 types

La dérivation lit l'état brut et applique l'ordre de priorité **strict** ci-dessous. La
provenance répond à « qui fait foi », l'état à « est-ce confirmé ». Les deux sont indépendants.

**Priorité de PROVENANCE (forme)** — la première règle vraie gagne :

| Ordre | Condition sur l'entrée | `provenance` | `glyph` (si validé) | `accentHex` | Justification |
|---|---|---|---|---|---|
| 1 | `triageLevel != null` | `engine` | `⚡` (+ badge `Cx`) | `#3B82F6` | une clause portant un niveau C1–C5 vient du moteur de triage |
| 2 | `seededFrom != null` **et** `validated` | `preannotation` | `★` | `#F59E0B` | pré-annotation LLM adoptée et confirmée |
| 3 | `validated` (sans 1 ni 2) | `manual` | `✎` | `#22C55E` | saisie/validation purement humaine |
| 4 | sinon | `none` | `◷` ou `·` | — | proposé non confirmé, ou phrase non couverte |

> Note d'ordonnancement : **moteur (1) prime sur pré-annotation (2)**. Une clause peut être à la
> fois `seededFrom` ET porter un `triageLevel` (le moteur part souvent d'un seed) ; le signal le
> plus informatif pour l'annotateur est « validé via le triage, règle Cx », donc `engine` gagne.
> `resolvedFrom` (arbitrage de divergence) n'ouvre **pas** un 4ᵉ type : il renseigne le libellé
> du juge dans `label`/`ariaLabel` mais la forme reste celle de la règle 1/2/3 applicable.

**État (couleur)** — dérivé en parallèle, alimenté par `validationByIndex` côté piste mais
recalculé localement ici sur la clause :

| Condition | `state` | `glyph` si non encore couvert par la forme | `colorClass` |
|---|---|---|---|
| `validated === true` | `validated` | glyphe de provenance (★/⚡/✎) | `text-emerald-400` (#34D399) |
| `triageLevel ∈ {C4,C5}` **et** `!validated` | `conflict` | `❗` (en sus de la forme proposée) | `text-rose-400` (#F43F5E) |
| clause présente, `!validated` | `to_validate` | `◷` | `text-amber-400` (#FBBF24) |
| aucune clause (entrée vide) | `uncovered` | `·` | `text-slate-400` (#64748B) |

Règles invariantes encodées dans le module (et testées) :
- **R1** — une seule forme par clause (dernière action de validation fait foi via la priorité 1→4).
- **R2** — le code `Cx` n'apparaît **que** si `provenance === "engine"`.
- **R3** — `glyph` ≥ 12 px et **toujours** accompagné de `label`/`ariaLabel` (jamais la couleur seule).
- **R4** — C4/C5 ne peuvent jamais sortir `state="validated"` sans `validated===true` explicite (pas d'auto-validation).

### 2.3 Pseudo-flux

```
validationDisplay(c):
  provenance = deriveProvenance(c)         // table 2.2, priorité 1→4
  state      = deriveState(c)              // validated > conflict(C4/C5) > to_validate > uncovered
  glyph      = glyphFor(provenance, state) // ★/⚡/✎ si validated ; ◷ si to_validate ; ❗ si conflict ; · si uncovered
  level      = provenance === "engine" ? c.triageLevel : undefined
  label      = labelFor(provenance, state, level, judge=c.resolvedFrom ?? c.seededFrom)
  return { validated: !!c.validated, provenance, level, glyph, state,
           colorClass, accentHex, label, ariaLabel }
```

`deriveProvenance`, `deriveState`, `glyphFor`, `labelFor` sont des helpers privés purs du
module — chacun testable, mais seule `validationDisplay` est exportée comme API publique (avec
`secondaryCount`). Pas d'autre export pour éviter la dispersion de la logique.

---

## 3. Découpage en composants

### 3.1 `ProvenanceMark.tsx` (NOUVEAU, présentationnel pur)

`frontend/src/components/ui/ProvenanceMark.tsx`. **Aucune** logique métier : reçoit un
`ValidationDisplay` (ou la clause + dérive en interne via le module — voir contrat ci-dessous)
et **affiche** le glyphe + couleur + tooltip. Réutilisé à l'identique dans `ClauseChip` (plan)
et l'inspecteur (en-tête de clause + piste).

```ts
export interface ProvenanceMarkProps {
  /** Soit l'objet déjà dérivé (préféré : pas de recalcul), soit la clause brute. */
  display: ValidationDisplay;
  /** Taille de cible : "gutter" (≥24px) | "inspector" (≥32px) | "chip" (inline ≥12px glyphe). */
  size?: "gutter" | "inspector" | "chip";
  /** Affiche le badge Cx à droite de ⚡ (provenance engine uniquement). */
  showLevel?: boolean;
  className?: string;
}
```

- `data-testid="provenance-mark"`, `data-provenance={display.provenance}`, `data-state={display.state}`, `data-level={display.level}` → cibles de test stables.
- Glyphe en `aria-hidden`, doublé d'un `<span className="sr-only">{display.ariaLabel}</span>` ou `title={display.label}` selon le contexte (toujours un équivalent textuel).
- Couleur via `display.colorClass` (état) + liseré/halo optionnel via `display.accentHex` (provenance). **Jamais** la couleur comme seul signal.
- Badge `Cx` rendu seulement si `showLevel && display.level` ; teinté de la couleur de **niveau** (`TRIAGE_LEVEL_META`), pas de l'accent de provenance (canaux distincts).

### 3.2 `ClauseChip` étendu (existant, `src/components/ui/ClauseChip.tsx`)

Évolution **rétro-compatible** : la prop `validated?: boolean` reste acceptée (chemin legacy),
mais on ajoute une prop `display` qui prime quand fournie. On ajoute le badge `+N`.

```ts
export interface ClauseChipProps {
  themeCode: string;            // inchangé — reste le thème PRIMAIRE (scalaire)
  anchorIndex?: number;
  selected?: boolean;
  ghost?: boolean;
  validated?: boolean;          // legacy, conservé (✓/◷) si `display` absent
  display?: ValidationDisplay;  // NOUVEAU — pilote ProvenanceMark ; prime sur `validated`
  secondaryCount?: number;      // NOUVEAU — badge "+N" si > 0
  size?: "sm" | "md";
  onClick?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  className?: string;
}
```

Rendu (ordre interne du chip) : `[pastille couleur thème] [ProvenanceMark si display] [+N si secondaryCount>0] [index] [label primaire]`.

- `+N` : pastille discrète `data-testid="multilabel-badge"`, `aria-label={"+" + n + " thème(s) secondaire(s)"}`, positionnée pour **ne pas télescoper** le glyphe de provenance (gap dédié). N=0 → pas de pastille (pas de bruit).
- Le call-site (TocPanel) calcule `display={validationDisplay(clause)}` et `secondaryCount={secondaryCount(clause.themes)}` — il ne refait aucune logique.

### 3.3 `MultiLabelEditor` (NOUVEAU, dans/à côté de `InspectorPanel`)

`frontend/src/components/workspace/MultiLabelEditor.tsx`. Remplace la zone « Thème » mono
actuelle de l'inspecteur. Sous-composant dédié pour garder `InspectorPanel` lisible et testable
en isolation (`tests/multiLabelEditor.test.tsx`).

Structure visuelle (maquette `04_prototypage/maquettes/inspecteur_clause.txt`) :

```
[ 🏷 Mono | Multi-label ]  ← toggle, libellé + position (pas la couleur seule)
[ ✓ ContractType (primaire, chip plein gras) ]            → swap-primary au clic d'un secondaire
[ + Liability (pointillé, ✕ retirable) ] [ + Termination ]
[ ＋ thème secondaire ]  ← ouvre ThemePalette (refuges EXCLUS)
```

```ts
export interface MultiLabelEditorProps {
  clause: DraftClause;
  themeCodes: string[];                 // vocab du scheme (passé par l'inspecteur, existant)
  onChangeThemes: (themes: ThemeTag[]) => void;  // → store.setClauseThemes(localId, themes)
}
```

Comportements :
- **Toggle Mono/Multi** : `data-testid="multilabel-toggle"`, états distinguables sans couleur (libellé « Mono » / « Multi-label » + position du switch + focus visible). Cible ≥ 32 px.
  - Mono → Multi : ouvre l'affordance « + thème secondaire » (ne modifie pas encore `themes`).
  - Multi → Mono : **annulation immédiate** — retire tous les secondaires en un `setClauseThemes([primaire])`, un seul snapshot undo. Re-toggle = revient à l'état précédent (undo/redo global est le filet, mais le geste lui-même est réversible).
- **Chip primaire** : `ClauseChip` plein, `display` dérivé. Cliquer un secondaire propose de le **promouvoir** primaire → appel `swapClausePrimary` (réordonne les rôles), sinon édition locale via `setClauseThemes`.
- **Chips secondaires** : `ClauseChip` `ghost` (pointillé) + `✕` retirable (`data-testid="remove-secondary-{code}"`).
- **« + thème secondaire »** : ouvre une `ThemePalette` filtrée — **refuges retirés de `themeCodes`** (cf. §5). Sélection → `setClauseThemes([...themes, {label: code, role: "secondary"}])`.
- Feedback < 200 ms : apparition/disparition des secondaires animée (transition CSS courte), accent bleu clair `#64B5F6` sur l'état Multi (cf. `04_prototypage/animations.md`).

---

## 4. Store — action `setClauseThemes`

`frontend/src/store/workspace.ts`. Nouvelle action transactionnelle, alignée sur les actions
existantes (`updateDraft`, `applyTriageDecisions`) qui poussent toutes un snapshot undo et
marquent `dirty`.

```ts
setClauseThemes: (localId: string, themes: ThemeTag[]) => void;
```

Contrat (invariants encodés + testés `tests/setClauseThemes.test.ts`) :

| # | Règle | Mise en œuvre |
|---|---|---|
| I1 | Exactement **1 primaire** | normalise : 1ᵉʳ `role==="primary"` conservé ; si 0 → promeut le 1ᵉʳ ; si >1 → garde le 1ᵉʳ, rétrograde les autres en `secondary` |
| I2 | **Refuge jamais secondaire** | filtre `themes.filter(t => t.role==="secondary" && isRefuge(t.label))` → rejeté silencieusement (et bloqué en amont dans l'UI, §5) |
| I3 | `theme` scalaire = primaire | `theme = primaryOf(normalized)` (réutilise `primaryOf` existant) → cohérent avec `primaryThemeOf` du contrat |
| I4 | Multi-label **additif** | n'altère ni `boundary`, ni `triageLevel`, ni `validated` |
| I5 | Snapshot undo + dirty | `undoStack: pushUndo(s.undoStack, s.draftClauses)`, `redoStack: []`, `dirty: true` (comme les pairs) |
| I6 | Doublons | dédoublonne par `label` ; un `label` déjà primaire ne peut pas être secondaire |

Pseudo-flux :

```
setClauseThemes(localId, themes):
  normalized = normalizeRoles(themes)        // I1
  normalized = dropRefugeSecondaries(normalized)  // I2
  normalized = dedupe(normalized)            // I6
  primary = primaryOf(normalized)            // I3
  draftClauses = map(c => c.localId===localId ? {...c, themes: normalized, theme: primary} : c)
  undoStack = pushUndo(...), redoStack = [], dirty = true   // I5
```

> **Persistance** : aucune nouvelle plomberie. `themes` mis à jour ⇒ `themesKey()` change ⇒
> `sameFields()` renvoie false ⇒ l'autosave inclut la clause dans `updates` ⇒ `PATCH /clauses`
> avec le tableau `themes[]`. Le miroir mono (`[{primary, support 0}]`) reste trivialisé par
> `themesKey` → pas de PATCH parasite (vérifié `src/lib/autosave.ts:40-49`). La promotion
> primaire passe par `swapClausePrimary` (endpoint dédié existant) quand on veut l'effet serveur
> atomique ; sinon le simple réordonnancement local + autosave suffit.

---

## 5. Refuge — règle « jamais secondaire » (défense en profondeur)

Trois niveaux, alignés sur l'invariant back-end :

1. **UI (préventif)** : `MultiLabelEditor` filtre les refuges hors des `themeCodes` passés à la `ThemePalette` du « + thème secondaire » → l'annotateur ne peut pas les sélectionner. Source : `isRefuge` / `rules.refuges` (`PREAMBLE_SCOPE`, `MISC_BOILERPLATE`).
2. **Store (défensif)** : `setClauseThemes` applique I2 même si une entrée frauduleuse arrive (programmation directe, test, futur appelant).
3. **Back-end (autoritaire)** : `PATCH /clauses` / `swap-primary` rejettent déjà un refuge secondaire (invariant natif, non touché).

Message UX en cas de tentative (clic-droit, raccourci) : tooltip/inline « Un thème-refuge ne
peut pas être secondaire » (`data-testid="refuge-blocked"`), 100 % des cas (critère étape 5).

---

## 6. Réversibilité & undo/redo

- **Toggle Mono/Multi** = annulation immédiate du geste courant (un `setClauseThemes`, donc un
  seul snapshot undo). Re-toggle restaure l'état précédent.
- **Undo/redo global** (filet existant, `undoStack`/`redoStack` de snapshots `DraftClause[]`)
  couvre toute mutation, y compris `setClauseThemes` et `swapClausePrimary`.
- **Feedback < 200 ms** : transitions CSS courtes (pas de requête réseau dans le chemin du
  rendu ; l'autosave est asynchrone et débattu en arrière-plan). Mesure prototype (critère étape 4).

---

## 7. Principes d'ingénierie (robuste / modulaire / évolutif / débuggable)

| Principe | Mise en œuvre concrète |
|---|---|
| **Source unique** | `validationDisplay.ts` est le SEUL endroit qui mappe état→forme/couleur. Interdit de recoder ailleurs (règle de revue + grep CI possible sur `text-emerald`/`★`/`⚡` hors module). |
| **Pur + testable** | Module sans React/I/O → Vitest unitaire exhaustif sur la table de décision (chaque ligne 2.2 = un cas), + `secondaryCount`. `setClauseThemes` testé sur I1–I6. |
| **Modulaire** | `ProvenanceMark` présentationnel pur, réutilisé chip+inspecteur+piste. `MultiLabelEditor` isolable. Chip rétro-compatible (prop `display` additive, `validated` legacy conservé). |
| **Évolutif** | Ajouter un 4ᵉ type de provenance = 1 ligne dans la table + 1 glyphe ; aucun composant à modifier (ils lisent `ValidationDisplay`). La provenance étant dérivée, aucune migration de données. |
| **Débuggable** | `data-testid` + `data-provenance`/`data-state`/`data-level` sur chaque marque ; `secondaryCount` traçable ; `ValidationDisplay` est un objet sérialisable inspectable en devtools. |
| **Accessibilité (jamais la couleur seule)** | `glyph` (forme) + `ariaLabel`/`title` (texte) toujours présents ; couleur d'état seulement en renfort. Cibles ≥ 24 px (gouttière) / ≥ 32 px (inspecteur). Toggle distinguable en N&B. |

---

## 8. Plan de fichiers (récapitulatif)

| Fichier | Action | Contenu |
|---|---|---|
| `src/lib/validationDisplay.ts` | **créer** | `validationDisplay()`, `secondaryCount()`, types `ValidationDisplay`/`Provenance`/`ValidationState` |
| `src/components/ui/ProvenanceMark.tsx` | **créer** | composant présentationnel pur |
| `src/components/ui/ClauseChip.tsx` | **étendre** | props `display`, `secondaryCount` ; badge `+N` ; intègre `ProvenanceMark` |
| `src/components/workspace/MultiLabelEditor.tsx` | **créer** | toggle Mono/Multi + chips primaire/secondaires + « + thème secondaire » |
| `src/components/workspace/InspectorPanel.tsx` | **modifier** | remplace la zone « Thème » mono par `MultiLabelEditor` |
| `src/store/workspace.ts` | **étendre** | action `setClauseThemes(localId, themes)` (I1–I6) |
| `tests/validationDisplay.test.ts` | **créer** | table de décision + `secondaryCount` |
| `tests/setClauseThemes.test.ts` | **créer** | invariants I1–I6 (refuge, primaire unique, dirty/undo) |
| `tests/multiLabelEditor.test.tsx` | **créer** | toggle, ajout/retrait secondaire, refuge bloqué, swap-primary |

**Non touché** : `src/lib/autosave.ts` (compare déjà `themes`), `swapClausePrimary` (existe),
back-end (aucune migration), `TRIAGE_LEVEL_META` / couleurs de niveau (canal conservé).

---

## 9. Stratégie de test (Vitest + Playwright)

- **Unitaire (pur)** — `validationDisplay` : un cas par ligne de la table 2.2 + combinaisons
  ambiguës (`seededFrom` + `triageLevel` → `engine` ; `validated=false` + C5 → `conflict`).
  `secondaryCount` : `undefined`/`[]`/mono/multi.
- **Store** — `setClauseThemes` : I1 (0/1/2 primaires), I2 (refuge rejeté), I3 (`theme` suit le
  primaire), I5 (un seul snapshot undo, `dirty`), I6 (doublons).
- **Composant** — `ProvenanceMark` rend la bonne forme/`data-*`/`aria-label` ; `ClauseChip`
  affiche `+N` ssi `secondaryCount>0` sans télescoper la marque ; `MultiLabelEditor` toggle
  réversible + refuge bloqué.
- **E2E (Playwright)** — valider C1/C2 en 1 clic (⚡) ; ajouter un secondaire hors C3 (≤ 2
  gestes) ; toggle Multi→Mono restaure l'état ; tentative refuge secondaire bloquée.
- **Grayscale / CVD** — snapshot en niveaux de gris : primaire vs secondaire et ON/OFF du toggle
  distinguables sans couleur (critères étapes 3/4/7).

---

## 10. Invariants à préserver (garde-fous)

- **INV-2** : 1 clause-début par phrase (anchorIndex unique) — `setClauseThemes` ne crée jamais
  de clause, n'altère pas `anchorIndex` (mute une clause existante uniquement).
- **Multi-label additif** : n'efface ni `boundary`, ni `triageLevel`, ni `validated`, ni la
  provenance dérivée.
- **Refuge jamais secondaire** : §5, trois niveaux.
- **Pas d'auto-validation C4/C5** : `validationDisplay` ne force jamais `state="validated"` sans
  `validated===true` ; seul un geste humain (✎) valide.
