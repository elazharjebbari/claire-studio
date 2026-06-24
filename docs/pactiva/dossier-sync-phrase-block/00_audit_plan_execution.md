# Synchro bidirectionnelle plan ↔ phrase — audit, plan & exécution

> Reproche : sélectionner une phrase dans la zone d'annotation NE met PAS en évidence le
> bloc (chip de clause) correspondant dans l'aside gauche (`TocPanel`). Le sens inverse
> (clic chip → focus + scroll de la phrase) fonctionne.

---

## 1. Audit (constat)

**Sens qui marche — block → phrase** : `TocPanel.onChipClick` → `selectClause(localId)` +
`focusSentence(anchorIndex)` ; le `DocumentPanel` défile vers la phrase focalisée
(effet de scroll sur `focused`).

**Sens défaillant — phrase → block** : `DocumentPanel.onActivate` (clic phrase) fait
`focusSentence(s.index)` puis `if (anchor) selectClause(anchor.localId) else selectClause(null)`
où `anchor = anchorByIndex.get(s.index)` — une `Map(anchorIndex → clause)` **clé par ancre
EXACTE** (`DocumentPanel.tsx:213-216, 1047`).

**Cause RÉELLE (après investigation)** : la sélection FONCTIONNAIT déjà côté donnée — clic
d'une phrase annotée → `selectClause(anchor.localId)` → le `TocPanel` marque bien le chip
`selected={selectedId === c.localId}` (ring + `aria-pressed`, `TocPanel.tsx:189`,
`ClauseChip.tsx:66,72`). MAIS le `TocPanel` **ne défile JAMAIS l'aside** vers ce chip : sur
un plan long, le chip sélectionné reste **hors écran** → l'utilisateur ne « voit » aucune
sélection (d'où « ça ne marche pas »). Le sens inverse, lui, défile le document.

Précision sur le modèle : les clauses sont **par phrase** (`runsFromDrafts` :
chaque ancre est son propre run `start===end` ; les inter-ancres sont des runs vides
`localId:null`, `lib/runs.ts:65-67`). Il n'y a donc pas de phrase « couverte non-ancre » :
`anchorByIndex.get(s.index)` suffit (et garantit un draft HUMAIN, donc un `localId` qui
matche le chip — plus sûr que `run.localId`, nul/étranger en vue-juge).

→ Correctif : **faire défiler l'aside vers le chip sélectionné** au changement de
`selectedClauseId` (parité avec le scroll document du sens inverse). La sélection
elle-même est conservée telle quelle (`anchor.localId`).

---

## 2. Plan de correction (frontend only, aucune donnée/backend)

- **`DocumentPanel.onActivate` / `onKeyActivate`** : remplacer la sélection par l'ancre
  exacte par la **clause couvrante** via le run déjà calculé :
  `const covering = run?.localId; selectClause(covering ?? null);`
  (idem pour `onKeyActivate`). Round-trip exact avec le sens inverse.
- **`TocPanel`** : au changement de `selectedClauseId`, **défiler le chip sélectionné dans
  la vue** (`scrollIntoView({ block: "nearest" })`) — symétrique du scroll document du
  sens inverse. Ne défile que pour la sélection SIMPLE (pas la multi-sélection).

---

## 3. Plan d'exécution
| # | Étape | Vérif |
|---|---|---|
| 1 | `DocumentPanel` : sélection de la clause COUVRANTE (run) au clic/clavier phrase | tsc |
| 2 | `TocPanel` : scroll auto du chip sélectionné dans l'aside | tsc |
| 3 | e2e : clic phrase (ancre ET non-ancre du run) → chip pressé + visible ; round-trip | e2e vert |
| 4 | vitest non-régression (store sélection, TocPanel) | vert |
| 5 | Gate tsc + vitest + e2e ; commit + deploy (health) | prod=local, 200 |

## 4. Critères d'acceptation
- Cliquer N'IMPORTE QUELLE phrase couverte par une clause → son chip est `aria-pressed`
  ET **défilé dans la vue** de l'aside. Cliquer une phrase non couverte → aucun chip
  pressé. Round-trip chip ↔ phrase symétrique. Zéro régression de la (multi-)sélection.
