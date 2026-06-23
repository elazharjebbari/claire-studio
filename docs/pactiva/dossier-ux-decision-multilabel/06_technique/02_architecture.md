# Architecture — système 3-canaux (provenance · multi-label · état)

> Document technique (dev). Cible le code réel de `frontend/` (Next.js App Router,
> Zustand, React Query, MSW, Vitest/Playwright) et le backend Django REST déjà en place.
> Principe directeur : **une seule source de vérité de dérivation visuelle** (`lib/validationDisplay`),
> consommée par des composants **présentationnels purs** (`ui/ProvenanceMark`, `ui/ClauseChip`),
> eux-mêmes pilotés par le **store transactionnel** (`store/workspace`) et persistés par
> l'**autosave incrémental** déjà éprouvé. **Aucune migration backend** : la provenance est
> une *projection* dérivée de champs déjà natifs.

---

## 1. Où vit quoi (carte des modules)

| Couche | Fichier | Rôle | Statut |
|---|---|---|---|
| **Dérivation pure** | `frontend/src/lib/validationDisplay.ts` | Source UNIQUE : `clause → {validationType, state, mark, level?}` + `secondaryCount(themes)`. Sans React, sans réseau. | **nouveau** |
| **Présentation provenance** | `frontend/src/components/ui/ProvenanceMark.tsx` | Glyphe ★/⚡/✎/◷ + couleur d'état + `title`/`aria-label`. Stateless. | **nouveau** |
| **Plan / TOC** | `frontend/src/components/ui/ClauseChip.tsx` | Ajoute `ProvenanceMark` + badge `+N`. Remplace le `✓/◷` inline et le seul thème primaire. | **à faire évoluer** |
| **Inspecteur** | `frontend/src/components/workspace/InspectorPanel.tsx` | Éditeur multi-label : chip primaire + secondaires (pointillé, retirables) + « + thème secondaire » + toggle Mono/Multi. | **à faire évoluer** |
| **Piste de validation** | `frontend/src/components/workspace/DocumentPanel.tsx` (barre `w-1`) | Réutilise `ProvenanceMark` une fois validé ; `◷` reste l'état « à valider ». | **à faire évoluer** |
| **Store** | `frontend/src/store/workspace.ts` | Nouvelle action `setClauseThemes(localId, themes)` (1 primaire, refuge jamais secondaire, push undo, dirty, `theme` scalaire ← primaire). `undo/redo` global déjà transactionnels. | **à faire évoluer** |
| **Diff de synchro (pur)** | `frontend/src/lib/autosave.ts` | `themesKey` compare déjà l'ensemble multi-label dans `sameFields`. Inchangé. | **existant, réutilisé** |
| **Persistance** | `frontend/src/components/workspace/useAutosave.ts` | Débounce → `planClauseSync` → `patchClause`/`addClause` avec `themes[]`. Inchangé. | **existant, réutilisé** |
| **Endpoints HTTP** | `frontend/src/lib/api/endpoints.ts` | `patchClause` (PATCH `/clauses/{id}`, sérialise `themes`), `swapPrimary` (POST `/clauses/{id}/swap-primary`). Inchangé. | **existant** |
| **Hooks React Query** | `frontend/src/lib/api/hooks.ts` | `useAnnotation(id)` (chargement initial), invalidation `qk.annotation(id)`. Inchangé. | **existant** |
| **Mocks** | `frontend/src/mocks/` (MSW) | Handlers PATCH `/clauses`, POST `/swap-primary` renvoient un `Clause` avec `themes[]` normalisés (1 primaire, refuge≠secondaire). | **à compléter** |

### Contrats de types (déjà dans `src/types/contract.ts`)

```ts
type ClauseRole = "primary" | "secondary";
type TriageLevel = "C1" | "C2" | "C3" | "C4" | "C5";
interface ThemeTag { label: string; role: ClauseRole; support?: number }
// Clause.themes?: ThemeTag[]; Clause.theme (scalaire = miroir du primaire)
// Clause.validated?, seededFrom?, resolvedFrom?, triageLevel?
```

Le `lib/validationDisplay.ts` n'introduit AUCUN nouveau champ persistant : il dérive.

---

## 2. Contrat du module pur `validationDisplay.ts`

Signatures (l'implémentation suit ; ici on fige le **contrat**, pas le corps) :

```ts
export type ValidationType = "engine" | "preannotation" | "manual" | "none";
export type ValidationState = "validated" | "to_validate"; // emerald | amber
export interface ProvenanceDescriptor {
  type: ValidationType;        // qui/quoi → la FORME
  state: ValidationState;      // état → la COULEUR
  glyph: "★" | "⚡" | "✎" | "◷";
  level?: TriageLevel;         // présent ssi type === "engine"
  tone: "emerald" | "amber";   // jeton de surface (mappé sur les vars d'app)
  label: string;               // texte accessible (title/aria-label), ex. "Validé via le triage — C2"
}

// Entrée minimale = sous-ensemble de DraftClause | Clause (structurel, pas de dépendance store)
export interface ProvenanceInput {
  validated?: boolean;
  seededFrom?: string | null;
  triageLevel?: TriageLevel | null;
}

export function deriveProvenance(c: ProvenanceInput): ProvenanceDescriptor;
export function secondaryCount(themes?: ThemeTag[]): number; // nb de role === "secondary"
```

### Règle de dérivation (priorité descendante, déterministe)

| Condition (évaluée dans l'ordre) | `type` | `glyph` | `state` |
|---|---|---|---|
| `triageLevel` renseigné | `engine` | `⚡` (+ `level`) | `validated` si `validated`, sinon `to_validate` |
| `seededFrom` ET `validated` | `preannotation` | `★` | `validated` |
| `validated` (sans les deux ci-dessus) | `manual` | `✎` | `validated` |
| sinon (proposé/non confirmé) | `none` | `◷` | `to_validate` |

Notes de robustesse :
- **Fonction totale et pure** : pas d'exception, toute entrée a une sortie (le cas `none` est le défaut).
- `tone` = `emerald` ssi `state === "validated"`, sinon `amber` → la couleur n'encode JAMAIS la provenance (accessibilité : forme = qui, couleur = état).
- `secondaryCount` ignore le primaire et un éventuel ensemble trivial (`[{primary, support 0}]` ⇒ 0), aligné avec `themesKey` de `lib/autosave.ts`.
- Testable isolément (Vitest) sans monter de composant ni de store.

---

## 3. Diagramme de dépendances (ASCII)

```
                         ┌───────────────────────────────────┐
                         │  lib/validationDisplay.ts (PUR)    │
                         │  deriveProvenance / secondaryCount  │
                         └───────────────────────────────────┘
                            ▲                 ▲            ▲
              (descriptor)  │                 │            │ (count + descriptor)
                            │                 │            │
        ┌───────────────────┴──┐   ┌──────────┴──────┐   ┌─┴───────────────────┐
        │ ui/ProvenanceMark.tsx│   │ DocumentPanel    │   │ ui/ClauseChip.tsx   │
        │ (présentationnel)    │   │ (piste validation│   │ (+N badge +         │
        └──────────▲───────────┘   │  w-1)            │   │  ProvenanceMark)    │
                   │               └──────────────────┘   └─────────▲───────────┘
                   │ réutilisé par                                    │
        ┌──────────┴───────────────────────────────┐                 │ consommé par
        │ workspace/InspectorPanel.tsx              │                 │
        │  - chip primaire + secondaires pointillés │     ┌───────────┴───────────┐
        │  - « + thème secondaire » (ThemePalette)  │     │ workspace/TocPanel.tsx │
        │  - toggle Mono/Multi                      │     └───────────────────────┘
        └──────────┬───────────────────────────────┘
                   │ dispatch action
                   ▼
        ┌──────────────────────────────────────────────┐
        │ store/workspace.ts (Zustand, transactionnel)  │
        │  setClauseThemes(localId, themes[])           │
        │  + undo/redo global (snapshots)               │
        └──────────┬─────────────────────────────────────┘
                   │ s.draftClauses change (dirty)
                   ▼
        ┌──────────────────────────────────────────────┐
        │ workspace/useAutosave.ts  (débounce 1200 ms)  │
        │   planClauseSync ← lib/autosave.ts (PUR)      │
        │   themesKey() détecte le delta multi-label    │
        └──────────┬─────────────────────────────────────┘
                   │ patchClause(serverId, { themes })
                   ▼
        ┌──────────────────────────────────────────────┐
        │ lib/api/endpoints.ts → PATCH /clauses/{id}    │
        │ (MSW en test/dev · DRF en prod)               │
        └──────────┬─────────────────────────────────────┘
                   │ réponse Clause normalisée (themes[])
                   ▼
        ┌──────────────────────────────────────────────┐
        │ React Query — qk.annotation(id)               │
        │ persistedRef ← réponse serveur (pas le draft) │
        └──────────────────────────────────────────────┘
```

Sens de lecture : la dérivation visuelle est **en haut, sans dépendance entrante** (aucun composant ne la modifie) ; le flux d'écriture descend du composant vers le serveur ; React Query/`persistedRef` ferment la boucle d'état persisté. Aucune dépendance circulaire : les composants importent `validationDisplay`, jamais l'inverse.

---

## 4. Diagramme de séquence — valider un set multi-label via l'inspecteur

```
Annotateur   InspectorPanel        store/workspace        useAutosave        endpoints/PATCH      React Query
   │              │                      │                     │                   │                  │
   │ clic « + thème secondaire » / toggle│                     │                   │                  │
   │─────────────▶│                      │                     │                   │                  │
   │              │ setClauseThemes(localId, themes)            │                   │                  │
   │              │─────────────────────▶│                     │                   │                  │
   │              │                      │ valide invariants:  │                   │                  │
   │              │                      │  • 1 primaire       │                   │                  │
   │              │                      │  • refuge∉secondary │                   │                  │
   │              │                      │  • theme ← primaire │                   │                  │
   │              │                      │ pushUndo(snapshot)  │                   │                  │
   │              │                      │ dirty=true          │                   │                  │
   │              │◀─────────────────────│ (re-render < 200 ms)│                   │                  │
   │   chips secondaires apparaissent     │                     │                   │                  │
   │   ProvenanceMark + badge +N à jour   │                     │                   │                  │
   │              │                      │ s.draftClauses ⟳    │                   │                  │
   │              │                      │────────────────────▶│ effect débounce   │                  │
   │              │                      │                     │ (1200 ms)         │                  │
   │              │                      │                     │ planClauseSync()  │                  │
   │              │                      │                     │  themesKey delta  │                  │
   │              │                      │                     │──────────────────▶│ PATCH /clauses/  │
   │              │                      │                     │                   │   {id}{themes}   │
   │              │                      │                     │                   │─────────────────▶│
   │              │                      │                     │                   │  Clause normalisé│
   │              │                      │                     │◀──────────────────│ (themes[])       │
   │              │                      │                     │ persistedRef ←    │                  │
   │              │                      │                     │   réponse serveur │                  │
   │              │                      │                     │ markSaved/markClean│                 │
   │              │                      │                     │ invalidateQueries(qk.annotation(id)) │
   │              │                      │                     │──────────────────────────────────────▶│
   │              │                      │                     │                   │   refetch éventuel│
```

Points de robustesse hérités du flux existant :
- **Optimiste** : le store est la vérité UI immédiate ; la persistance suit (feedback < 200 ms garanti côté store, indépendant du réseau).
- **Idempotence** : créations portent `clientOpId = localId` ; un retry ne duplique pas (INV-2 préservé).
- **Convergence** : `persistedRef` est rechargé depuis la **réponse serveur** (normalisation `themes` : support/rôle), pas depuis le draft → pas de faux diff au tick suivant.
- **Anti-PATCH parasite** : `themesKey([{primary, support 0}]) === themesKey(undefined) === ""` → une clause mono ne déclenche pas d'écriture fantôme.
- **Annulation immédiate** : le toggle Mono/Multi est un appel `setClauseThemes` réversible ; le `undo/redo` global reste le filet transactionnel (un snapshot par mutation).

---

## 5. Backend existant (aucune migration)

Ancré sur `backend/claire/annotations/models.py` :

| Élément backend | Détail | Conséquence frontend |
|---|---|---|
| `Clause` | champs `validated` (BooleanField), `seeded_from`, `resolved_from`, `triage_level` (CharField C1–C5) | source des 3 types de validation, **dérivés** côté `validationDisplay` |
| `ClauseTheme` | FK Clause + `role` (`ClauseRole.PRIMARY`/`SECONDARY`) + `support` | porte la vérité multi-label ; mono = exactement 1 `primary` |
| `REFUGE_CODES` | `{"PREAMBLE_SCOPE", "MISC_BOILERPLATE"}` | refuge **jamais** secondaire — invariant à dupliquer côté `setClauseThemes` (défense en profondeur) |
| `validate_clause_theme_set` | exactement 1 primary ; aucun refuge en secondary | le backend rejette (4xx) un set invalide → autosave classe en erreur `client` (terminal, pas de boucle) |
| PATCH `/clauses/{id}` | accepte `themes[]` ({label, role, support}) | déjà sérialisé par `patchClause` / `useAutosave` |
| POST `/clauses/{id}/swap-primary` | promeut un secondaire en primaire | `swapPrimary(id, label)` déjà exposé dans `endpoints.ts` |

La **provenance n'est PAS stockée** : `engine`/`preannotation`/`manual` se déduisent de `triage_level`/`seeded_from`/`validated`. C'est précisément pourquoi la dérivation doit être unique et pure (`validationDisplay.ts`) — pas de champ à migrer, pas d'incohérence stockée à corriger.

---

## 6. React Query / MSW

- **Lecture** : `useAnnotation(id)` (`qk.annotation(id)`) charge la clause complète, incluant `themes[]`, `validated`, `seededFrom`, `triageLevel`. Le store hydrate `draftClauses` au montage.
- **Écriture** : passe par `useAutosave` (et non par une mutation React Query directe), pour conserver le diff incrémental et l'idempotence. À la fin d'une synchro réussie, `invalidateQueries(qk.annotation(id))` réaligne le cache serveur.
- **MSW (test/dev)** : les handlers `PATCH /clauses/{id}` et `POST /clauses/{id}/swap-primary` doivent **normaliser** `themes` comme le backend (1 primaire, refuge écarté du secondaire, `support` par défaut), afin que `persistedRef` et les tests reflètent la réponse serveur réelle. Le handler `swap-primary` inverse les rôles `primary`/`secondary` du label visé.

---

## 7. Invariants garantis par l'architecture

| Invariant | Où il est tenu |
|---|---|
| **INV-2** : 1 clause-début par phrase | clé de diff = `anchorIndex` (`lib/autosave.ts`) + `clientOpId` idempotent |
| **Multi-label additif** | `theme` scalaire reste le miroir du primaire ; `themes` optionnel |
| **Refuge jamais secondaire** | `setClauseThemes` (frontend, défense) + `validate_clause_theme_set` (backend, autorité) |
| **Exactement 1 primaire** | normalisation dans `setClauseThemes` + rejet backend |
| **Couleur ≠ provenance** | `tone` dérivé de `state` seul ; `glyph`/`type` portent la provenance |
| **Réversibilité < 200 ms** | mutation store optimiste + `undo/redo` transactionnel (un snapshot/mutation) |

---

## 8. Débogabilité

- `validationDisplay.ts` est pur et stateless : un test de table (Vitest) couvre les 4 branches + les cas limites (`triageLevel` ET `seededFrom`, set trivial).
- `data-*` sur `ClauseChip`/`ProvenanceMark` (`data-validation-type`, `data-state`, `data-secondary-count`) → assertions Playwright/MSW lisibles sans dépendre du glyphe rendu.
- L'autosave expose son état (`store/autosave.ts` : `saving`/`retrying`/`error`/`offline`) → un PATCH `themes` raté est observable, jamais silencieux.
- `actionLog` du store journalise chaque `setClauseThemes` (label lisible) → reconstitution d'une session.
