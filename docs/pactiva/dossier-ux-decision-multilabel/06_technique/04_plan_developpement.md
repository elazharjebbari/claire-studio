# 04 — Plan de développement (système 3-canaux multi-label)

Document de pilotage technique. Implémente le design du dossier UX (système visuel à
3 canaux : **provenance**, **multi-label**, **état de validation**) de façon robuste,
modulaire, débogable et testée. Pas de gros blocs de code ici : signatures, contrats de
types, pseudo-flux et `definition of done` par lot. L'implémentation suit.

Stack ciblée : Next.js App Router + Zustand (`src/store/workspace.ts`) + React Query +
MSW (`src/mocks/handlers.ts`) + Vitest (`src/lib/__tests__/`) + Playwright (`e2e/`).

---

## 0. Cadre, invariants et ancrage code

### 0.1 Décisions arrêtées (rappel — ne pas contredire)

- **Source unique d'affichage** : module **pur** `frontend/src/lib/validationDisplay.ts`.
  Aucune logique de dérivation provenance/validation ailleurs. La provenance est une
  **projection** : aucun champ stocké, aucune migration backend.
- **3 types de validation** dérivés d'une clause :
  | Type | Condition de dérivation (sur la clause) | Glyphe |
  |------|------------------------------------------|--------|
  | `engine` (moteur) | `triageLevel` renseigné | ⚡ + `Cx` |
  | `preannotation` (pré-annotation) | `seededFrom` présent **et** `validated` | ★ |
  | `manual` (manuel) | `validated` sans les deux ci-dessus | ✎ |
- **État couleur** : `validated` → emerald ; à-valider → amber + glyphe `◷`.
- **Composant présentationnel** unique : `ProvenanceMark.tsx`, réutilisé dans
  `ClauseChip` et l'inspecteur (`InspectorPanel`).
- **Multi-label** : `ClauseChip` ajoute un badge `+N` (= `secondaryCount(themes)`) +
  `ProvenanceMark`. L'éditeur multi-label vit dans l'inspecteur (chip primaire + chips
  secondaires pointillés retirables + « + thème secondaire » + toggle Mono/Multi).
- **Store** : nouvelle action `setClauseThemes(localId, themes: ThemeTag[])`
  (1 seul `primary`, **refuge jamais `secondary`**, push undo, `dirty`, miroir scalaire
  `theme` = primaire). L'autosave persiste déjà `themes` (PATCH `/clauses`,
  `sameFields` compare `themesKey`).
- **Backend** : aucune migration. Données natives `ClauseTheme` (primary/secondary,
  refuge≠secondary), champs `validated`/`seededFrom`/`resolvedFrom`/`triageLevel` ;
  endpoints PATCH `/clauses` (`themes[]`), POST `/clauses/{id}/swap-primary`.
- **Réversibilité** : toggle Mono/Multi + undo/redo global transactionnel ;
  feedback < 200 ms.

### 0.2 Invariants (à protéger par tests)

- **INV-2** : 1 clause-début par phrase (`anchorIndex` unique). Inchangé — le
  multi-label est **additif** sur une clause existante, jamais une nouvelle ancre.
- **INV-ML-1** : `themes` contient **exactement un** `role: "primary"`.
- **INV-ML-2** : un **refuge** (`triage/rules.ts → refuges`) n'apparaît **jamais** en
  `secondary`. Il peut rester primaire.
- **INV-ML-3** : miroir scalaire — `theme === primaryThemeOf(clause)` à tout instant.
- **INV-ML-4** : pas de doublon de `label` dans `themes`.

### 0.3 Ancrage code (existant, vérifié)

| Élément | Emplacement | État |
|---------|-------------|------|
| `ThemeTag {label, role, support?}`, `ClauseRole`, `primaryThemeOf()` | `src/types/contract.ts:294-335` | existe |
| `DraftClause` (`themes?`, `seededFrom?`, `resolvedFrom?`, `triageLevel?`, `validated?`) | `src/store/workspace.ts:45-78` | existe |
| `validation.ts` (par phrase : `validationByIndex`, `validationSummary`) | `src/lib/validation.ts` | existe — **NE PAS confondre** avec `validationDisplay.ts` (par clause) |
| `themesKey` / `sameFields` (autosave) | `src/lib/autosave.ts:40-72` | persiste déjà `themes` |
| Refuges | `src/lib/triage/rules.ts:25` (`refuges: ["PREAMBLE_SCOPE","MISC_BOILERPLATE"]`) ; type `triage/types.ts:90` | existe |
| `getThemeToken` (couleur/label) | `src/lib/tokens.ts` | existe |
| `ClauseChip` (✓/◷ inline + thème primaire) | `src/components/ui/ClauseChip.tsx` | **à enrichir** (L3) |
| `InspectorPanel` (thème mono via `ThemePalette`) | `src/components/workspace/InspectorPanel.tsx` | **à enrichir** (L5) |
| `ThemePalette` (sélecteur thème, `themeCodes`, grid, describeOnHover) | `src/components/ui/ThemePalette.tsx` | réutilisé tel quel (L5) |
| `setValidated`, `updateDraft`, `setBoundary`, `undo`/`redo`, `pushUndo` | `src/store/workspace.ts` | patterns à suivre pour `setClauseThemes` |

> **Note de nommage** : `validation.ts` (existant) calcule la validation *par phrase*
> pour la complétude de soumission. `validationDisplay.ts` (nouveau) dérive l'*affichage*
> provenance/état *par clause*. Deux responsabilités distinctes, deux fichiers.

---

## 1. Vue d'ensemble des lots

```
L1 validationDisplay (pur+tests) ──┬─► L2 ProvenanceMark ──┬─► L3 ClauseChip +N & TocPanel ─┐
                                   │                       └─► L5 MultiLabelEditor ──────────┤
L4 store setClauseThemes (+tests) ─────────────────────────────► L5 ───────────────────────┤
                                                                                            ▼
                                                                  L7 intégration + e2e ─► L8 revue + déploiement
                                                                                            │
                                                              L6 (DIFFÉRÉ : en-tête doc, conflit C4/C5, carte-suggestion)
```

| Lot | Dépend de | Livrable immédiat ? |
|-----|-----------|---------------------|
| L1 `validationDisplay.ts` (pur + tests) | — | ✅ immédiat |
| L2 `ProvenanceMark.tsx` | L1 | ✅ immédiat |
| L3 `ClauseChip` `+N`/provenance + `TocPanel` | L1, L2 | ✅ immédiat |
| L4 store `setClauseThemes` (+ tests) | — (parallèle de L1–L3) | ✅ immédiat |
| L5 `MultiLabelEditor` (inspecteur) | L2, L4 | ✅ immédiat |
| L6 en-tête doc + conflit C4/C5 + carte-suggestion toggle-undo | L1, L2, L5 | ⏸ **différé** |
| L7 intégration + e2e | L3, L5 | ✅ après L5 |
| L8 revue adversariale + déploiement | L7 | ✅ après L7 |

**Chemin critique** : L1 → L2 → L5 (l'éditeur multi-label). L4 est parallélisable
immédiatement (indépendant de l'UI). L3 et L4 peuvent avancer en parallèle dès L1/L2.

---

## 2. Lots détaillés

### L1 — Module `validationDisplay.ts` (pur, source unique)

**Fichier** : `src/lib/validationDisplay.ts` (PUR — aucune dépendance React/store ;
import type uniquement). Tests : `src/lib/__tests__/validationDisplay.test.ts`.

**Contrats de types** :

```
export type ValidationKind = "engine" | "preannotation" | "manual";
export type ValidationTone = "validated" | "to-validate";   // emerald | amber

export interface ValidationDisplay {
  kind: ValidationKind;       // canal provenance
  tone: ValidationTone;       // canal état
  glyph: "⚡" | "★" | "✎";    // glyphe provenance (alimente ProvenanceMark)
  triageLevel?: TriageLevel;  // présent ssi kind === "engine"
  // glyphe d'état pour le canal validation (◷ si to-validate), géré par le rendu.
}

// Entrée minimale (Pick sur Clause/DraftClause) — découplée du type complet.
type ClauseLike = Pick<Clause, "themes" | "theme" | "validated" | "seededFrom" | "triageLevel">;

export function deriveValidationDisplay(c: ClauseLike): ValidationDisplay;
export function secondaryCount(themes?: ThemeTag[]): number; // nb de role === "secondary"
```

**Pseudo-flux `deriveValidationDisplay`** (ordre de priorité = ordre du tableau §0.1) :

```
tone = c.validated ? "validated" : "to-validate"
if (c.triageLevel != null)            → kind="engine",        glyph="⚡", triageLevel
else if (c.seededFrom && c.validated) → kind="preannotation", glyph="★"
else                                  → kind="manual",        glyph="✎"
```

> Subtilité figée : la pré-annotation **non encore validée** (`seededFrom` mais
> `!validated`, `triageLevel` nul) tombe dans `manual` + `to-validate`. C'est voulu :
> tant qu'elle n'est pas validée elle se présente comme « à valider » (cohérent avec
> `validation.ts`, pré-annotation ≠ référence). On documente ce cas dans les tests.

`secondaryCount` : `themes?.filter(t => t.role === "secondary").length ?? 0` (tolère
`undefined` → 0). C'est la source du badge `+N`.

**Definition of done L1** :
- [ ] Fonctions pures, zéro import runtime React/Zustand (vérifié par lint d'import).
- [ ] Table de vérité couverte : 3 `kind` × 2 `tone` = 6 cas + cas limites (themes vide,
      `triageLevel` + `seededFrom` simultanés → `engine` gagne, pré-annot non validée).
- [ ] `secondaryCount` : `undefined`, `[]`, mono, multi, multi avec primaire seul.
- [ ] 100 % branches du module en couverture Vitest.

---

### L2 — `ProvenanceMark.tsx` (présentationnel)

**Fichier** : `src/components/ui/ProvenanceMark.tsx`. Test : couvert par
`components.test.tsx` (ou `src/lib/__tests__/provenanceMark.test.tsx`).

Composant **présentationnel pur** (props in, JSX out ; aucun accès store). Réutilisé par
`ClauseChip` et l'inspecteur.

```
export interface ProvenanceMarkProps {
  display: ValidationDisplay;     // sortie de deriveValidationDisplay (jamais re-dérivé ici)
  size?: "sm" | "md";
  withLabel?: boolean;            // texte lisible à côté du glyphe (inspecteur) vs glyphe seul (chip)
  className?: string;
}
export function ProvenanceMark({ display, ... }: ProvenanceMarkProps): JSX.Element;
```

Rendu :
- glyphe = `display.glyph` ; si `kind==="engine"`, suffixe `display.triageLevel` (`⚡ C4`).
- couleur de **tonalité** : emerald si `validated`, amber si `to-validate` (+ glyphe `◷`
  d'état si `to-validate`, séparé du glyphe de provenance).
- `data-testid="provenance-mark"`, `data-kind`, `data-tone`, `data-triage` pour les tests.
- **A11y** : `title`/`aria-label` textuel explicite (« Validé par le moteur — C4 »,
  « Pré-annotation validée », « Manuel — à valider »). Jamais couleur seule.

**DoD L2** :
- [ ] Reçoit le `display` déjà dérivé (aucune logique métier dans le composant).
- [ ] 3 `kind` × 2 `tone` rendus distincts (glyphe + couleur + aria-label).
- [ ] `withLabel` on/off ; `size` sm/md.
- [ ] Test a11y : `aria-label` présent et distinct par état.

---

### L3 — `ClauseChip` (`+N` + provenance) + `TocPanel`

**Fichiers** : `src/components/ui/ClauseChip.tsx` (enrichi),
`src/components/workspace/TocPanel.tsx` (passe les nouvelles props).

État actuel : `ClauseChip` n'affiche que ✓/◷ inline (prop `validated?: boolean`) + le
thème primaire. On **remplace** le rendu ✓/◷ ad hoc par `ProvenanceMark` et on **ajoute**
le badge `+N`.

Évolution de l'API (rétro-compatible) :

```
export interface ClauseChipProps {
  themeCode: string;            // = thème primaire (inchangé)
  anchorIndex?: number;
  // NOUVEAU : on passe la clause-like pour dériver provenance + secondaryCount.
  // Option A (préférée) : props dérivées explicites, le parent appelle validationDisplay :
  display?: ValidationDisplay;  // si fourni → ProvenanceMark (remplace `validated`)
  secondaryCount?: number;      // si > 0 → badge "+N"
  // ... selected, ghost, size, onClick, onContextMenu, className (inchangés)
}
```

> **Choix d'architecture** : le chip reste **présentationnel**. La dérivation
> (`deriveValidationDisplay`, `secondaryCount`) est faite **par le parent** (`TocPanel`,
> inspecteur) à partir de la clause/draft. Le chip ne dépend pas du store. La prop
> `validated?: boolean` legacy est **dépréciée** : si `display` absent et `validated`
> présent, fallback transitoire vers l'ancien rendu (à supprimer en fin de L3).

Rendu chip :
- pastille couleur (inchangée, `getThemeToken`) ;
- `<ProvenanceMark display size="sm" />` à la place du ✓/◷ inline ;
- libellé du thème primaire (inchangé) ;
- badge `+N` (`secondaryCount`) : `data-testid="multilabel-badge"`, `title="N thème(s)
  secondaire(s)"`, style discret (pastille neutre, pas de couleur de thème).

`TocPanel` : pour chaque clause de la TOC, calcule
`deriveValidationDisplay(clause)` + `secondaryCount(clause.themes)` et passe à `ClauseChip`.

**DoD L3** :
- [ ] `ClauseChip` rend `ProvenanceMark` (3 types) + `+N` quand secondaires.
- [ ] Pas de `+N` quand mono (`secondaryCount === 0`).
- [ ] `TocPanel` dérive depuis la clause, aucune logique provenance dupliquée.
- [ ] Prop legacy `validated` retirée (ou marquée `@deprecated` + fallback) ; tests
      existants `ClauseChip` adaptés.
- [ ] `data-testid` stables (`clause-chip`, `provenance-mark`, `multilabel-badge`).

---

### L4 — Store `setClauseThemes` (+ tests) — *parallélisable*

**Fichier** : `src/store/workspace.ts` (nouvelle action + type dans `WorkspaceState`).
Tests : `src/lib/__tests__/workspaceStore.test.ts`.

```
setClauseThemes: (localId: string, themes: ThemeTag[]) => void;
```

**Contrat (sanitisation + invariants)** — la fonction **normalise** l'entrée avant
d'écrire (jamais confiance aveugle à l'appelant) :

1. **INV-ML-1** : garantir exactement un `primary`. Si plusieurs `primary` reçus → garder
   le premier, rétrograder les autres en `secondary`. Si aucun → promouvoir le premier
   de la liste en `primary`.
2. **INV-ML-2** : retirer de `secondary` tout label présent dans `refuges`
   (`triage/rules.ts`). Un refuge **primaire** est conservé.
3. **INV-ML-4** : dédupliquer par `label` (le `primary` gagne sur un doublon `secondary`).
4. **INV-ML-3** : `theme` (scalaire) ← `primaryThemeOf({themes})`.
5. Liste **vide** → no-op défensif (ne jamais effacer le thème ; on ne désannote pas via
   cette action — la désannotation passe par `removeBoundary`).
6. `dirty = true` ; `undoStack = pushUndo(undoStack, draftClauses)` ; `redoStack = []`
   (transactionnel, comme `setValidated`/`updateDraft`).
7. `actionLog` : une entrée lisible (`label: "Thèmes → PRIMARY +N @anchor"`).

Helper pur extrait et testable (réutilisé par L5) :

```
export function normalizeThemes(themes: ThemeTag[], refuges: string[]): ThemeTag[];
```

> `normalizeThemes` est **pur** et exporté pour être testé hors store et réutilisé par
> l'éditeur (validation côté UI avant dispatch). Les refuges sont **injectés** (pas
> d'import en dur depuis le store → testabilité, et évite un couplage cyclique).

**Interaction avec `swap-primary`** : changer le primaire depuis l'UI passe par
`setClauseThemes` (réordonnancement des rôles) côté local + l'autosave émet le PATCH
`/clauses` (themes[]). L'endpoint POST `/clauses/{id}/swap-primary` reste disponible si on
veut une mutation atomique serveur dédiée ; **décision** : pour la V1 on s'appuie sur
PATCH `themes[]` (déjà câblé via `sameFields`/`themesKey`), `swap-primary` non requis.
À noter dans le runbook.

**DoD L4** :
- [ ] `normalizeThemes` pur : tests des 4 invariants (multi-primary, refuge en secondary,
      doublons, promotion auto, liste vide).
- [ ] `setClauseThemes` : pousse 1 snapshot undo, `dirty`, `theme` mirroir mis à jour,
      `redoStack` vidé.
- [ ] undo/redo restaure `themes` **et** `theme` de façon cohérente (1 transaction).
- [ ] Autosave : après `setClauseThemes`, `sameFields` détecte le diff via `themesKey`
      (test `autosave.test.ts` étendu — mono→multi déclenche bien un PATCH).
- [ ] No-op sur liste vide (pas de désannotation silencieuse).

---

### L5 — `MultiLabelEditor` dans l'inspecteur

**Fichiers** : `src/components/workspace/MultiLabelEditor.tsx` (nouveau, monté dans
`InspectorPanel.tsx`). Tests : `uiuxWorkspace.test.tsx` / `components.test.tsx`.

Remplace, dans `InspectorPanel`, le bloc `Field "Thème"` actuel (mono `ThemePalette`) par
l'éditeur multi-label. Garde le fallback création de clause (Q2) inchangé.

Composition UI :
- **Toggle Mono/Multi** (`data-testid="multilabel-toggle"`) :
  - Mono → Multi : aucune écriture, ouvre simplement la zone secondaires.
  - Multi → Mono : `setClauseThemes(localId, [primary])` (purge des secondaires) — undo
    le restaure. Confirmation légère si secondaires non vides (« retirer N secondaires ? »
    inline, pas de modale bloquante).
- **Chip primaire** : `ClauseChip` (couleur thème) + `ProvenanceMark`. Cliquer ouvre la
  `ThemePalette` pour **re-thématiser le primaire** (réutilise le toggle existant :
  re-cliquer le primaire = désannote via `removeBoundary`, cohérent C3).
- **Chips secondaires** : chips **pointillés** (`ghost`/`border-dashed`), chacun avec
  bouton « ✕ retirer » (`data-testid="remove-secondary-{label}"`). Retirer →
  `setClauseThemes` sans ce label.
- **« + thème secondaire »** : ouvre `ThemePalette` avec `themeCodes` = thèmes **hors
  refuges** et **hors thèmes déjà posés** (primaire + secondaires). Sélection →
  `setClauseThemes([...themes, {label, role:"secondary"}])` (normalisé).
- **Promouvoir un secondaire en primaire** (échange de rôles) : action sur le chip
  secondaire → `setClauseThemes` qui réordonne (ancien primaire devient secondaire).

**Garde C3 / refuge** :
- Le `+ secondaire` **exclut** les refuges de la palette (filtrage `themeCodes`).
- Si la clause primaire **est** un refuge, le multi-label reste possible (refuge primaire +
  secondaires non-refuges) — INV-ML-2 ne porte que sur les secondaires.
- « hors C3 » : la suggestion automatique d'ajout de secondaire (carte-suggestion) est en
  L6 (différé) ; en L5 l'ajout est **manuel** uniquement.

**Performance / feedback < 200 ms** : toutes les mutations sont synchrones (Zustand,
optimiste local) ; l'autosave/PATCH est asynchrone et non bloquant. Aucune attente réseau
dans le chemin d'interaction.

**DoD L5** :
- [ ] Toggle Mono/Multi réversible (undo restaure les secondaires purgés).
- [ ] Ajout/retrait de secondaire via `setClauseThemes` (1 transaction undo chacun).
- [ ] Palette « + secondaire » exclut refuges + thèmes déjà posés.
- [ ] Promotion secondaire→primaire (échange de rôles) fonctionnelle.
- [ ] Chip primaire = couleur ; secondaires = pointillés retirables.
- [ ] `ProvenanceMark` affiché en tête de l'éditeur (réutilise L2, `withLabel`).
- [ ] Refuge jamais ajoutable en secondaire (testé UI + bloqué au store par INV-ML-2).
- [ ] Mono reste le comportement par défaut (clause mono = `themes` `undefined`/single).

---

### L6 — DIFFÉRÉ : en-tête document, conflit C4/C5, carte-suggestion toggle-undo

**Statut** : ⏸ différé (post-V1). Ne bloque pas le déploiement L1–L5.

- **Unification provenance en-tête document** : un récap en haut du document agrège les
  `ValidationDisplay` des clauses (compte par `kind`/`tone`), source = `validationDisplay`.
  But : voir d'un coup « X moteur / Y pré-annot / Z manuel ; W à valider ».
- **Indicateur conflit C4/C5** : badge dédié sur les clauses `triageLevel ∈ {C4, C5}`
  (désaccord fort/éclaté) — invite à arbitrage. Réutilise `triage/levels.ts`.
- **Carte-suggestion toggle-undo** : suggestion proactive d'ajout d'un secondaire
  (issue moteur), acceptable/annulable en un geste (toggle), branchée sur undo global.

**DoD L6** (quand activé) : récap dérivé exclusivement de `validationDisplay` ; conflit
C4/C5 testé ; carte-suggestion accept/undo < 200 ms et transactionnelle.

---

### L7 — Tests d'intégration + e2e

**Vitest (intégration composant + store)** :
- `validationDisplay.test.ts` (L1), `workspaceStore.test.ts` (L4, `setClauseThemes` +
  `normalizeThemes`), `autosave.test.ts` (mono→multi déclenche PATCH `themes[]`).
- Intégration inspecteur (`uiuxWorkspace.test.tsx` / `components.test.tsx`) : monter
  `InspectorPanel` avec un draft, basculer Multi, ajouter/retirer secondaires, vérifier
  store + chips + `ProvenanceMark`.

**Playwright (e2e)** — nouveau spec `e2e/multilabel.spec.ts` (s'appuyer sur MSW handlers,
patterns de `annotate.spec.ts` / `triage.spec.ts`) :
1. Ouvrir une clause, basculer Mono→Multi, ajouter 1 secondaire, vérifier badge `+N` dans
   la TOC (`multilabel-badge`).
2. Retirer le secondaire → badge disparaît ; undo (Cmd/Ctrl+Z) le restaure.
3. Vérifier l'exclusion des refuges dans la palette « + secondaire ».
4. Provenance : clause moteur (`triageLevel`) montre `⚡ Cx` ; pré-annot validée montre
   `★` ; manuelle montre `✎` ; couleur emerald/amber selon `validated`.
5. Persistance : après ajout secondaire, le PATCH `/clauses` part avec `themes[]`
   (assert sur la requête MSW / handler).

**DoD L7** :
- [ ] Suites Vitest et Playwright vertes en CI.
- [ ] Couverture des invariants INV-ML-1..4 + INV-2 par au moins un test chacun.
- [ ] Pas de régression sur `validation.test.ts` (validation par phrase) ni
      `triageUi.test.tsx`.

---

### L8 — Revue adversariale + déploiement

**Revue adversariale** (avant merge) :
- [ ] Aucune dérivation provenance/validation hors `validationDisplay.ts` (grep
      `triageLevel|seededFrom`+`validated` dans les composants → seul le parent dérive).
- [ ] `ProvenanceMark` ne contient **aucune** logique métier (re-dérivation interdite).
- [ ] `setClauseThemes` ne peut **jamais** produire 0 ou 2 primaires, ni un refuge
      secondaire, quel que soit l'input (fuzz/property test sur `normalizeThemes`).
- [ ] undo/redo transactionnel : 1 snapshot par mutation multi-label ; pas de demi-état.
- [ ] A11y : `ProvenanceMark` et badges `+N` jamais couleur-seule ; `aria-label` distincts.
- [ ] Rétro-compat : clause mono (`themes` absent) s'affiche et s'édite comme avant ;
      `theme` scalaire toujours synchronisé (INV-ML-3).
- [ ] Aucune migration / aucun champ stocké de provenance (vérifié côté backend).

**Déploiement** :
- [ ] L1–L5 + L7 livrables ensemble (cohérence visuelle du système 3-canaux).
- [ ] L6 derrière son propre lot ultérieur (pas de feature flag requis — composants non
      montés tant que L6 n'est pas livré).
- [ ] Suivre le runbook `05_runbook/etapes.md` (build front, `npm run test`,
      `npm run e2e`, déploiement OLS prod selon procédure habituelle).
- [ ] Smoke prod : ouvrir une annotation réelle, vérifier provenance + `+N` + édition
      multi-label + undo.

---

## 3. Risques & parades

| Risque | Parade |
|--------|--------|
| Dérivation provenance dupliquée (drift visuel) | Source unique `validationDisplay.ts` ; revue grep L8 ; composant `ProvenanceMark` ne re-dérive pas |
| Refuge ajouté en secondaire | `normalizeThemes` (store) + filtrage palette (UI) — double garde, refuges injectés depuis `rules.ts` |
| Désync `theme` scalaire / `themes[]` | INV-ML-3 imposé dans `setClauseThemes`, testé sur undo/redo |
| Autosave ne détecte pas le diff multi-label | `themesKey`/`sameFields` déjà câblés ; test mono→multi en L4/L7 |
| Régression sur clause mono existante | `themes` `undefined` = mono ; fallback rendu ; suite `validation.test.ts` intacte |
| Feedback > 200 ms | Mutations 100 % synchrones (Zustand) ; réseau hors chemin d'interaction |
| Confusion `validation.ts` (phrase) vs `validationDisplay.ts` (clause) | Nommage + en-têtes de fichier explicites ; responsabilités séparées |

---

## 4. Récapitulatif livrables

**Immédiat (V1)** : L1 `validationDisplay.ts` · L2 `ProvenanceMark.tsx` · L3 `ClauseChip`
`+N`/provenance + `TocPanel` · L4 `setClauseThemes`/`normalizeThemes` · L5
`MultiLabelEditor` (inspecteur) · L7 tests · L8 revue + déploiement.

**Différé** : L6 en-tête document unifié + indicateur conflit C4/C5 + carte-suggestion
toggle-undo.
