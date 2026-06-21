# Feature B — Stratégie SANS migration de schéma

> Principe directeur : **aucune migration de base, aucun champ ajouté, aucun changement de
> contrat API**. Le bloc est **dérivé** des clauses par phrase existantes. Ce document
> décrit comment dériver les blocs, la compatibilité avec l'autosave incrémental et
> l'undo/redo, et les impacts précis sur `SelectionToolbar`, `SentenceMenu` et `runs`.

## 1. Pourquoi « sans migration » est suffisant ET correct

- Le modèle `Clause` couvre **déjà** B : `anchor_sentence` (phrase), `theme`, INV-2
  (`uniq_clause_annotation_anchor`), idempotence (`client_op_id`). **Rien à ajouter.**
- L'IAA (`projects/iaa.py::_theme_vector` + `cohen_kappa`) est **par phrase** : un bloc
  dérivé ne la touche pas (B-IAA-1). Toute migration vers `end_index`/sections **régresserait**
  C4 (cf. `B-choix.md` §2). Donc on **s'abstient**.
- Conséquence : **zéro** `makemigrations`, **zéro** backfill, **zéro** modification de
  `annotations/serializers.py` ni du contrat camelCase. Déploiement = build frontend seul.

## 2. Dériver les blocs depuis les clauses contiguës

Le bloc se calcule **à la volée**, sans état persistant, en réutilisant les runs C4.

### 2.1 Nouveau module pur `frontend/src/lib/blocks.ts`
S'appuie sur `computeRuns(drafts, n, {perSentence:true})` (existant) — **ne réimplémente
pas** le découpage :

```ts
import { type Run } from "@/lib/runs";

export interface Block { start: number; end: number; theme: string; localIds: string[]; size: number; }

/** Agrège les runs par phrase en blocs maximaux contigus de même thème. PUR, O(R). */
export function deriveBlocks(runs: Run[]): Block[] {
  const out: Block[] = [];
  let cur: Block | null = null;
  for (const r of runs) {
    if (r.theme == null || r.localId == null) { cur = null; continue; } // rupture (neutre)
    if (cur && r.start === cur.end + 1 && r.theme === cur.theme) {
      cur.end = r.end; cur.localIds.push(r.localId); cur.size += 1;
    } else {
      cur = { start: r.start, end: r.end, theme: r.theme, localIds: [r.localId], size: 1 };
      out.push(cur);
    }
  }
  return out;
}

export function blockAt(blocks: Block[], i: number): Block | undefined {
  return blocks.find((b) => i >= b.start && i <= b.end);
}
```

- **Pureté** → testable comme `lib/runs.ts` (`tests/blocks.test.ts`), aucun mock réseau.
- **Mémoïsation** côté composant : `useMemo(() => deriveBlocks(runs), [runs])`, `runs` lui-même
  mémoïsé sur `[draftClauses, nSentences]` (perf, spec §8 B-PERF-1).
- **Identité** d'un bloc = `(start, theme)` au rendu ; aucun `block_id`.

### 2.2 Cas couverts par la dérivation (sans donnée nouvelle)
- **Merge** : deux runs de même thème adjacents → un bloc (boucle ci-dessus). Implicite.
- **Split** : un run de thème différent (override) ou neutre (désannotation) **rompt** la
  séquence → blocs séparés. Implicite.
- **Phrase isolée** : `size === 1` (pas un cas particulier).

## 3. Compatibilité avec l'autosave incrémental

L'autosave (`components/workspace/useAutosave.ts` + `lib/autosave.ts`) diffe par **ancre**
(`planClauseSync` : clé = `anchorIndex`) et produit `creates`/`updates`/`deletes` idempotents
(`clientOpId = localId`). **B n'y change rien** car les gestes-bloc ne produisent que des
mutations de **clauses par phrase** :

| Geste-bloc | Mutations clauses | Vu par `planClauseSync` |
|------------|-------------------|--------------------------|
| Annoter plage `[i..j]` (S6) | N `setBoundary` (via `applyBlockOp`) | N `creates` (ou `updates` si déjà présentes) |
| Étendre (S9) | p `setBoundary` | p `creates` |
| Réduire (S10) | q `removeBoundary` | q `deletes` |
| Override (S11) | 1 `setBoundary` | 1 `update` |
| Désannoter bloc (S15) | m `removeBoundary` | m `deletes` |

- **Aucune nouvelle route**, aucun nouveau corps de requête : `addClause`/`patchClause`/
  `deleteClause` inchangés.
- **Pic d'écritures** d'une grande plage absorbé par le **debounce 1200 ms**, la séquentialité
  et la **convergence post-synchro** déjà implémentées (`useAutosave` : reprise si des modifs
  arrivent pendant la synchro ; reprise `online`).
- **Idempotence** : un retry réseau d'une création de plage ne duplique pas (contrainte
  `uniq_clause_client_op` côté DB + `clientOpId`).
- **Point d'attention (à implémenter)** : `applyBlockOp` doit muter `draftClauses` puis
  déclencher **un seul** `set()` Zustand → l'effet d'autosave (`useEffect` sur `[drafts]`)
  ne se programme **qu'une fois** pour tout le lot (évite N planifications).

## 4. Compatibilité avec l'undo/redo

L'undo/redo du store snapshote `draftClauses` (`undoStack`/`redoStack`, borne `UNDO_DEPTH=200`)
et restaure le tableau complet — donc **agnostique au bloc** : restaurer le snapshot d'avant
une pose de plage **défait tout le bloc d'un coup**.

- **Gestes mono-phrase** (S1, S11, S12) : un `pushUndo` chacun (comportement existant).
- **Gestes-bloc** (S6, S9, S10, S15) : `applyBlockOp` pousse **un seul** `pushUndo` au début
  du lot puis mute, puis **une** entrée `actionLog` (`block.*`). `undo()`/`redo()` **non
  modifiés** fonctionnent tels quels.
- **Sélection après undo** : `undo()` revalide déjà `selectedClauseId` ; côté bloc, la
  sélection de blocs (`selectedClauseIds`) référant des `localId` disparus est simplement
  ignorée au rendu (les `localId` absents → pas de bloc). Recommandation : `applyBlockOp`
  appelle `clearClauseSelection()` après un `clearBlock` pour éviter une sélection orpheline.

## 5. Impacts précis sur les composants existants

### 5.1 `lib/runs.ts` — **inchangé** (consommé tel quel)
- `computeRuns(perSentence)` reste la source des runs ; `runAt`, `runThemeAt`,
  `clauseRangeBetween` réutilisés. **Aucune** modification. `blocks.ts` se branche **au-dessus**.

### 5.2 `store/workspace.ts` — **un seul ajout** : `applyBlockOp`
- **Ajout** : action `applyBlockOp(op)` (lot atomique, `readOnly`-safe, un `pushUndo`, un
  `actionLog` `block.*`). Réutilise la logique de `setBoundary`/`removeBoundary` mais en
  **une** transaction.
- **Inchangé** : `setBoundary`, `toggleBoundary`, `removeBoundary`, `updateDraft`,
  `selectRange`, `toggleSelected`, `setSelectedClauses`, `clearSelection`,
  `clearClauseSelection`, `undo`, `redo`, `replacePrefill` (déplie déjà par phrase → blocs
  dérivés gratuits).

### 5.3 `components/workspace/SelectionToolbar.tsx` — **réutilise**, optimise
- **Mode phrases (P4)** : la boucle `annotate()` qui itère `setBoundary`/`updateDraft` est
  **remplacée** par **un** appel `applyBlockOp({kind:"annotateRange", anchors:sorted, theme})`
  → un undo au lieu de N (corrige R-B1). Le rendu et les `data-testid` restent.
- **Mode blocs (P8)** : « Annoter les blocs » passe de la boucle `updateDraft` à `applyBlockOp`
  (atomicité). **Ajout** d'un bouton « Désannoter le bloc » → `applyBlockOp({kind:"clearBlock"})`.
- **Inchangé** : structure, `ThemePalette`, accessibilité.

### 5.4 `components/workspace/SentenceMenu.tsx` — **inchangé** (override déjà par phrase)
- L'override (B3) **est déjà** ce que fait le menu : `toggleBoundary(sentenceIndex, code)` agit
  sur **une** phrase → split dérivé automatique. **Aucune** modification fonctionnelle requise.
- (Option UI mineure, non bloquante) afficher « fait partie d'un bloc <thème> i–j » si la
  phrase appartient à un bloc dérivé `size > 1`, via `blockAt`.

### 5.5 Composant document (rail/poignées) — **câblage UI** (nouveau)
- Calcule `blocks = useMemo(deriveBlocks(runs))` ; rend le rail **continu** sur chaque bloc et
  affiche les **poignées** quand le bloc est sélectionné (double-clic S7) ; gère le drag des
  poignées → `applyBlockOp(extend/shrink)`. C'est le **gros** du travail UI (pas de logique
  données nouvelle).

## 6. Données existantes : aucune reprise nécessaire
- Les annotations en base (corpus CLAUDETTE déjà annoté/prérempli) sont **déjà** des clauses
  par phrase → elles **deviennent automatiquement** des blocs dérivés au premier rendu, sans
  conversion. Le prérempli LLM (`replacePrefill`) est **déjà** déplié par phrase.
- **Rollback** trivial : retirer le rendu des blocs (et `applyBlockOp`) ne touche aucune
  donnée ; on revient au comportement C4 par phrase.

## 7. Checklist d'implémentation (sans migration)
- [ ] `lib/blocks.ts` (`deriveBlocks`, `blockAt`) + tests purs (`tests/blocks.test.ts`).
- [ ] `store/workspace.ts` : action `applyBlockOp` (lot atomique, `readOnly`-safe, un undo, un
      `actionLog` `block.*`) + tests store (atomicité undo, équivalence bloc/phrase B-IAA-1).
- [ ] `SelectionToolbar.tsx` : basculer P4 et « Annoter les blocs » sur `applyBlockOp` ;
      ajouter « Désannoter le bloc ».
- [ ] Document : rendu rail continu + poignées + drag → `applyBlockOp(extend/shrink)` ;
      double-clic → `setSelectedClauses(blockAt.localIds)`.
- [ ] Raccourcis clavier K5/K8/K9/K10/K11 (cf. `B-interactions.md`).
- [ ] **Aucun** fichier backend, **aucune** migration, **aucun** changement de contrat/MSW.
- [ ] Bench perf 300 phrases (dérivation < 5 ms/frappe) + Playwright des parcours B2/B3/B4/B6.
