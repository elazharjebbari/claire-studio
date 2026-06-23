# 06 · Technique — Data & Flux (système 3-canaux multi-label)

> Document de pilotage **dev**. Décrit le **modèle de données réel**, la **dérivation
> provenance → glyphe/couleur** (source unique `validationDisplay.ts`), et **3 flux** de bout
> en bout (moteur · pré-annotation · manuel hors C3). Pas de gros blocs de code : signatures,
> contrats de types, pseudo-flux, tableaux. L'implémentation suit ce contrat.
>
> Décision structurante : **aucune migration backend**. Les 3 types de validation et le
> multi-label sont une **PROJECTION dérivée** de champs déjà natifs. Le seul code applicatif
> nouveau côté store est l'action `setClauseThemes`.

---

## 1. Modèle de données (état réel du dépôt)

### 1.1 Contrat serveur — `Clause` / `ThemeTag` (`frontend/src/types/contract.ts`)

```ts
type ClauseRole = "primary" | "secondary";
type TriageLevel = "C1" | "C2" | "C3" | "C4" | "C5";

interface ThemeTag { label: string; role: ClauseRole; support?: number }

interface Clause {
  id: string;
  anchorIndex: number;          // INV-2 : ancre unique par annotation (clé de rapprochement)
  theme: string;                // miroir SCALAIRE du primaire (rétro-compat)
  themes?: ThemeTag[];          // multi-label additif (1 primaire + N secondaires)
  triageLevel?: TriageLevel | null;
  validated?: boolean;          // validation humaine explicite
  seededFrom?: string | null;   // provenance pré-annotation (juge)
  // boundary?, legalNature?, certainty?, rationale?, evidenceSpan?, order…
}

// Helper canonique : primaryThemeOf(c) = themes?.find(primary)?.label ?? c.theme
```

Champ `resolvedFrom` (juge dont la proposition a été **adoptée** lors d'un arbitrage) existe
**uniquement côté `DraftClause`** (store), pas sur le contrat `Clause` ; il n'entre pas dans
la dérivation de provenance du système 3-canaux (voir §2.3, note).

### 1.2 État local — `DraftClause` (`frontend/src/store/workspace.ts`)

`DraftClause` est le **brouillon éditable** (un par phrase couverte). Champs pertinents pour
ce dossier : `localId`, `serverId?`, `anchorIndex`, `theme`, `themes?`, `triageLevel?`,
`validated?`, `seededFrom?`, `resolvedFrom?`. Conversion `Clause → DraftClause` via
`fromClause` (recopie `themes`, `seededFrom`, `triageLevel`).

### 1.3 Invariants de données (non négociables)

| Inv. | Énoncé | Lieu d'application |
|---|---|---|
| **INV-2** | 1 clause-début (1 ancre) par phrase ; `anchorIndex` unique par annotation | upsert par ancre dans le store + diff autosave par ancre |
| **Multi-label additif** | absence de `themes` ⇔ mono = `[{theme, primary, 0}]` | `themesKey` traite le primaire trivial comme « absent » |
| **1 primaire** | exactement un `role:"primary"` dans `themes` | `setClauseThemes` (garde-fou) + `swap-primary` serveur |
| **Refuge jamais secondaire** | un thème-refuge (`PREAMBLE_SCOPE`, `MISC_BOILERPLATE`) ne peut être `secondary` | `setClauseThemes` (filtrage) + ThemePalette (exclusion) + back-end |
| **Miroir scalaire** | `theme` = label du primaire | `setClauseThemes`, `upsertDecision`, mocks PATCH/swap |

Source des refuges : `frontend/src/lib/triage/rules.ts` → `refuges: ["PREAMBLE_SCOPE", "MISC_BOILERPLATE"]`
(helper `isRefuge` dans `triage/engine.ts`). `setClauseThemes` doit consommer cette **même
liste** (ne pas redéfinir un littéral).

---

## 2. Dérivation provenance → glyphe / couleur (SOURCE UNIQUE)

Module **pur, sans React** : `frontend/src/lib/validationDisplay.ts` (déjà implémenté).
Réutilisé par `ProvenanceMark.tsx` (présentationnel), lui-même monté dans `ClauseChip.tsx`
(plan + inspecteur) et la piste de validation.

### 2.1 Signatures

```ts
type ValidationProvenance = "moteur" | "pre_annotation" | "manuel";

interface ValidationInput { validated?: boolean; seededFrom?: string | null; triageLevel?: TriageLevel | null }

interface ValidationDisplay {
  validated: boolean;
  state: "valide" | "a_valider";
  provenance: ValidationProvenance;   // toujours défini, même non validé
  level: TriageLevel | null;
  glyph: string;                      // ⚡ / ★ / ✎ si validé ; ◷ sinon
  colorClass: string;                 // état (emerald / amber)
  accentHex: string;
  label: string;                      // title + aria-label
}

function provenanceOf(c: ValidationInput): ValidationProvenance;
function validationDisplay(c: ValidationInput): ValidationDisplay;
function secondaryCount(themes?: ThemeTag[] | null): number;   // = themes.filter(secondary).length
```

### 2.2 Table de dérivation (canal « provenance » × canal « état »)

`provenanceOf` applique une **priorité** : `triageLevel` renseigné → moteur ; sinon
`seededFrom` → pré-annotation ; sinon → manuel.

| `validated` | `triageLevel` | `seededFrom` | provenance | glyphe | couleur (état) | accent | label |
|:--:|:--:|:--:|---|:--:|---|---|---|
| `true` | `Cx` | * | **moteur** | ⚡ (+ Cx) | emerald `text-emerald-400` | `#3B82F6` | « Validé par le moteur · Cx … » |
| `true` | — | `Juge` | **pré-annotation** | ★ | emerald | `#F59E0B` | « Validé (pré-annotation) » |
| `true` | — | — | **manuel** | ✎ | emerald | `#22C55E` | « Validé manuellement » |
| `false` | * | * | (dérivée, non affichée) | **◷** | amber `text-amber-400` | `#FBBF24` | « À valider » |

Lecture des **3 canaux orthogonaux** (rappel synthèse) :
- **forme** = provenance (★/⚡/✎) — stable, dit *qui* ;
- **couleur du glyphe** = état (emerald validé / amber à-valider) — dit *où on en est* ;
- **couleur du chip + badge `+N`** = niveau Cx & multi-label — canal séparé (`ClauseChip`).

⚠ **Précision vs brief UX.** Le brief décrivait la pré-annotation comme `seededFrom &&
validated`. L'implémentation retenue est plus simple et strictement compatible : tant que
`validated=false`, on affiche **toujours ◷** (la provenance n'est pas peinte). La distinction
★/⚡/✎ n'apparaît donc **qu'à l'état validé**, exactement comme spécifié. Le champ `provenance`
reste calculé en non-validé seulement pour l'info-bulle. Ne pas réintroduire de condition
`seededFrom && validated` ailleurs : `validationDisplay` est la **seule** autorité.

### 2.3 Pourquoi une projection (pas de champ stocké)

Aucun champ « provenance » n'est persisté : il est **recalculé** depuis `validated` /
`triageLevel` / `seededFrom` à chaque rendu. Conséquences :
- zéro migration, zéro risque de désynchronisation projection↔stockage ;
- toute action qui change un de ces 3 champs change l'affichage **sans code d'affichage dédié** ;
- testable en isolation (table de vérité ci-dessus = matrice de tests unitaires).

> Note `resolvedFrom` : utilisé par le **voyant d'arbitrage** existant (en-tête de clause),
> pas par le trio 3-canaux. Ne pas le mélanger à `provenanceOf` pour éviter une 4ᵉ forme.

---

## 3. Trois flux détaillés

Pile commune : geste UI → action store (snapshot undo + `dirty=true`) → `useAutosave`
calcule `planClauseSync(draft, persisted)` → `patchClause` / `addClause` → resnapshot
référence. Boucle d'autosave : `frontend/src/components/workspace/useAutosave.ts` ;
diff pur : `frontend/src/lib/autosave.ts`.

### 3.1 Flux 1 — Acceptation d'un triage (provenance **moteur**, ⚡ + Cx)

Geste : annotateur accepte une décision C1–C5 (file de triage / SuggestionCard / lot).

```
Accept(decision: TriageDecision{ anchorIndex, themes[1 primary +N], boundary?, triageLevel })
  → store.applyTriage / applyTriageBatch
      → upsertDecision(drafts, decision)            // PUR, upsert PAR ANCRE (INV-2)
          existe(anchorIndex) ? PATCH en place : create
          set: theme=primaryOf(themes), themes, triageLevel, boundary, validated=true
      → push undo (1 snapshot pour tout le lot), dirty=true
  → useAutosave : planClauseSync → updates/creates → PATCH /clauses (themes[], triageLevel, validated)
  → projection : triageLevel renseigné ⇒ provenanceOf = "moteur" ⇒ ⚡ emerald + Cx
```

- **Idempotence** : `upsertDecision` est un upsert par `anchorIndex` ; réaccepter la même
  décision recalcule des champs **identiques** → `sameFields` vrai → **plan vide** → aucun
  PATCH. Pas de doublon de clause (INV-2 garanti par la clé d'ancre).
- **Seed → moteur** : si l'ancre venait d'un seed (`seededFrom` posé), l'acceptation **met à
  jour en place** (pas de 409) ; `triageLevel` prend la priorité → glyphe ⚡ (et non ★).
- **C4/C5** : jamais auto-validés (cf. runbook §6) ; ce flux ne s'applique qu'aux décisions
  que l'humain accepte explicitement.

### 3.2 Flux 2 — Valider une pré-annotation (provenance **pré-annotation**, ★)

Geste : une clause issue d'un seed LLM (`seededFrom="…"`, `triageLevel` absent,
`validated=false` → affichée ◷ amber) est confirmée par l'annotateur (« Valider »).

```
ValidatePreAnnotation(localId)
  → store : updateDraft(localId, { validated: true })   // seededFrom CONSERVÉ, triageLevel absent
      → push undo, dirty=true
  → useAutosave : planClauseSync → PATCH /clauses { validated: true }   (themes inchangés)
  → projection : !triageLevel && seededFrom ⇒ provenanceOf = "pre_annotation" ⇒ ★ emerald
```

- **Transition d'état pur** : seul `validated` passe `false→true`. La forme ◷ devient ★ par
  recalcul (aucun champ de provenance écrit).
- **Idempotence** : revalider une clause déjà `validated=true` → `sameFields` vrai → plan vide.
- **Ne pas** effacer `seededFrom` à la validation : il porte l'origine (★). L'effacer
  basculerait à tort la provenance vers « manuel » (✎).

### 3.3 Flux 3 — Ajout d'un secondaire **hors C3** (provenance **manuel**, ✎ / inchangée)

Geste : dans l'inspecteur, « + thème secondaire » (ThemePalette, refuges exclus) sur une
clause sans conflit C3. Cœur du chantier : la **nouvelle action** `setClauseThemes`.

#### Signature (à ajouter au store)

```ts
setClauseThemes(localId: string, themes: ThemeTag[]): void
```

Contrat (garde-fous appliqués DANS l'action, pas dans l'UI) :
1. **1 primaire** : si 0 ou ≥2 `primary` → normaliser (le 1ᵉʳ `primary`, sinon le 1ᵉʳ tag,
   devient l'unique primaire) ; refuser silencieusement un set vide (no-op).
2. **Refuge jamais secondaire** : filtrer tout tag `secondary` dont `isRefuge(label)` (liste
   `rules.refuges`). Un refuge **en primaire** reste autorisé.
3. **Miroir scalaire** : `theme = primaryOf(themes)`.
4. **Effets transversaux** : `push undo`, `dirty=true`, `redoStack=[]`. **No-op** si `readOnly`.
5. **Provenance inchangée** : `setClauseThemes` ne touche **ni** `validated`, `triageLevel`,
   `seededFrom` → le glyphe reste celui dérivé (souvent ✎ pour une clause manuelle).

#### Pseudo-flux

```
AddSecondary(localId, label)             // depuis ThemePalette (refuges déjà exclus côté UI)
  → next = [...current.themes (ou [{theme,primary,0}]), { label, role:"secondary" }]
  → store.setClauseThemes(localId, next) // garde-fous §3.3 (1 primaire, isRefuge → drop)
      → push undo, dirty=true
  → useAutosave : planClauseSync → themesKey(d.themes) ≠ themesKey(p.themes)
      → PATCH /clauses { themes:[…], theme: primaire }
  → projection ClauseChip : secondaryCount(themes) ⇒ badge "+N"
  → projection provenance : inchangée (validated/triageLevel/seededFrom intacts)
```

- **Indistinguable de C3** : un secondaire ajouté à la main produit le **même `ThemeTag
  {role:"secondary"}`** qu'un secondaire issu d'une suggestion C3 acceptée → rendu identique
  (badge `+N`, chip pointillé). Aucun marqueur d'origine sur le secondaire.
- **Toggle Mono/Multi** = `setClauseThemes` avec, respectivement, `[primaire]` (Multi→Mono :
  on droppe les secondaires) ou la réintégration des secondaires (Mono→Multi). Réversibilité :
  re-cliquer revient à l'état précédent ; le filet est l'undo/redo global (transactionnel,
  1 snapshot par geste). Feedback < 200 ms : mutation store synchrone, re-render local.
- **`swap-primary`** : permuter primaire↔secondaire passe par `POST /clauses/{id}/swap-primary`
  (endpoint dédié, mock présent) plutôt que par `setClauseThemes`, pour rester atomique côté
  serveur et conserver l'ancre. UI : action « définir comme primaire » sur un chip secondaire.

---

## 4. Aller-retour serveur & autosave (`themesKey` trivial)

Endpoints (aucune migration) :

| Geste | Endpoint | Corps | Effet serveur (mock + prod) |
|---|---|---|---|
| Flux 1/2/3 (champs) | `PATCH /clauses/{id}` | `{ themes?, theme?, validated?, triageLevel?, … }` | `theme = primary(themes) ?? theme` ; renvoie la `Clause` à jour |
| Création (ancre neuve) | `POST /clauses` | idem + `anchorIndex` | crée ; `themes` par défaut `[{theme, primary}]` |
| Permuter primaire | `POST /clauses/{id}/swap-primary` | `{ label }` | `label` devient `primary`, l'ancien primaire `secondary` |

### 4.1 `themesKey` : éviter le PATCH parasite

`frontend/src/lib/autosave.ts` compare via `sameFields`, qui inclut
`themesKey(d.themes) === themesKey(p.themes)`. `themesKey` est **canonique** (tri des tags,
indépendant de l'ordre) **et** neutralise le **miroir trivial** :

- `themes` absent **ou** `[{role:"primary", support:0}]` → clé `""` (= « pas de multi-label »).

C'est l'aller-retour serveur clé : le backend renvoie **toujours** au moins
`[{label, primary, 0}]` ; sans cette normalisation, une clause mono créée localement
(`themes: undefined`) différerait en permanence de la même clause rechargée → **PATCH à
chaque tick**. Avec `themesKey`, mono-local ≡ mono-serveur → plan vide. Idem `boundaryKey`
(frontière `hard/1` triviale → `""`).

### 4.2 Boucle complète

```
draftClauses (store) ──planClauseSync(draft, persisted)──▶ { creates, updates, deletes }
        ▲                                                          │
        │ resnapshot(draftsToPersisted)              patchClause / addClause / deleteClause
        └──────────────── réponse serveur (Clause) ◀──────────────┘
```

- **Diff par ancre** (`anchorIndex`) : déterministe, indépendant d'un mapping
  `localId↔serverId` fragile (re-thématiser ne change pas l'ancre → update ; supprimer →
  delete ; nouvelle ancre → create). Cohérent INV-2.
- **Idempotence globale** : après succès, le snapshot de référence (`draftsToPersisted`) est
  réaligné → un second tick sans nouvelle édition produit `isEmptyPlan = true`.
- **Débogage** : les 3 flux n'écrivent que `themes`/`validated`/`triageLevel`/`seededFrom` ;
  un PATCH inattendu se trace en comparant `themesKey`/`boundaryKey` côté draft vs persisted
  (mêmes fonctions pures, rejouables en test).

---

## 5. Points de vigilance (résumé dev)

- `setClauseThemes` est le **seul** point d'entrée multi-label libre ; il applique les
  garde-fous (1 primaire, refuge≠secondary, miroir scalaire) — ne pas les dupliquer dans l'UI
  autrement que comme confort (exclusion visuelle des refuges dans ThemePalette).
- `validationDisplay` est la **seule** autorité d'affichage provenance/état : tout composant
  (chip, piste, en-tête) la consomme via `ProvenanceMark`. Ne jamais recoder la table §2.2.
- La provenance est **dérivée**, jamais stockée → aucune migration, aucun champ « provenance ».
- Tests à couvrir : table de vérité §2.2 (unitaire `validationDisplay`) ; garde-fous
  `setClauseThemes` (1 primaire, refuge drop, no-op readOnly, undo) ; idempotence des 3 flux
  (`planClauseSync` → plan vide au 2ᵉ passage) ; `themesKey` trivial (mono local ≡ serveur).
