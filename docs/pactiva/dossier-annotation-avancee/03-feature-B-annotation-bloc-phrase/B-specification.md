# Feature B — Annotation bloc/phrase — Spécification

> Conception **niveau agence**, à valider **avant implémentation**. Décision actée
> (cf. `B-choix.md`) : modèle **hybride « phrase atomique + bloc dérivé »**, **sans
> migration de schéma**. La phrase reste l'unité de stockage (1 `Clause` par phrase) ;
> le **bloc** est une **vue dérivée** côté frontend (suite contiguë de clauses de même
> thème). Cette spec détaille les besoins B1–B9, la définition formelle du bloc, les
> règles split / merge / extend, la désannotation, la cohérence IAA et la performance.

## 0. Cadre et invariants non négociables

| Réf | Invariant | Source (code réel) |
|-----|-----------|--------------------|
| INV-2 | Une clause-start **unique par phrase** par annotation | `annotations/models.py` → `UniqueConstraint(fields=["annotation", "anchor_sentence"], name="uniq_clause_annotation_anchor")` |
| INV-4 | Une annotation **unique** par (projet, document, annotateur) | doc modèle + `annotations/models.py` |
| INV-6 | `certainty ∈ {null, 0..3}` | `models.py` → `ck_clause_certainty_range` |
| C4 | Annotation **humaine par phrase** (pas de débordement) | `lib/runs.ts::computeRuns(..., {perSentence:true})` ; `projects/iaa.py::_theme_vector` |
| R1 | Lecture seule de l'annotation d'autrui | `store/workspace.ts::readOnly` (mutateurs no-op) |

**Conséquence directrice** : B n'introduit **aucun nouvel objet persistant** et
**aucun champ** (`end_index`, `block_id`, …). Tout ce qui suit se construit au-dessus de
`draftClauses` (store) et de `computeRuns(..., {perSentence:true})` (rendu). Le « bloc »
n'existe que comme **agrégation calculée** ; la vérité reste « une `Clause` = une phrase ».

---

## 1. Définition formelle d'un « bloc » dérivé

Soit l'annotation courante représentée par `draftClauses` (store `workspace.ts`),
chaque `DraftClause` portant `(anchorIndex, theme, localId, …)`. Soit `N = nSentences`.

On construit les **runs par phrase** (déjà fait, C4) :

```ts
const runs = computeRuns(drafts, N, { perSentence: true }); // lib/runs.ts
// → suite ordonnée de Run{ start, end:start, theme, localId }
//   pour chaque phrase annotée, intercalée de runs neutres {theme:null}.
```

### 1.1 Bloc (Block)

> **Un bloc est un intervalle maximal `[i..j]` de phrases CONSÉCUTIVES toutes annotées
> du MÊME thème `t`**, où chaque phrase `k ∈ [i..j]` porte exactement une `Clause` de
> thème `t`, et où ni `i-1` ni `j+1` ne portent une clause de thème `t` (maximalité).

Formellement, à partir des runs par phrase, en ignorant les runs neutres :

```ts
interface Block {
  start: number;        // index 1re phrase
  end: number;          // index dernière phrase (end >= start)
  theme: string;        // thème commun
  localIds: string[];   // une entrée par phrase, ordonnée (length === end-start+1)
  size: number;         // end - start + 1
}
```

Propriétés garanties par construction :

- **B-DEF-1 (couverture)** : toute clause appartient à exactement un bloc ; un bloc d'une
  seule phrase est un bloc de taille 1 (le cas « phrase isolée » n'est pas un cas
  particulier, c'est `size === 1`).
- **B-DEF-2 (contiguïté stricte)** : une **rupture d'index** (une phrase neutre entre deux
  clauses) **interrompt** le bloc, même à thème égal — il y a alors **deux blocs** du même
  thème non adjacents.
- **B-DEF-3 (homogénéité)** : un changement de thème interrompt le bloc.
- **B-DEF-4 (dérivation pure)** : `deriveBlocks` est une fonction **pure** de `(drafts, N)`,
  sans état, donc recalculée à la volée (mémoïsée) — jamais persistée. Aucun `block_id`
  n'est stocké : l'identité d'un bloc est sa **paire `(start, theme)`** au moment du rendu.

### 1.2 Algorithme de dérivation (nouvelle fonction PURE, `lib/blocks.ts`)

S'appuie sur les runs C4 existants — **ne réimplémente pas** le découpage :

```ts
// lib/blocks.ts  (PUR, testable comme lib/runs.ts)
export function deriveBlocks(runs: Run[]): Block[] {
  const blocks: Block[] = [];
  let cur: Block | null = null;
  for (const r of runs) {
    if (r.theme == null || r.localId == null) { cur = null; continue; } // run neutre = rupture
    const contiguous = cur && r.start === cur.end + 1 && r.theme === cur.theme;
    if (contiguous) {
      cur!.end = r.end; cur!.localIds.push(r.localId); cur!.size += 1;
    } else {
      cur = { start: r.start, end: r.end, theme: r.theme, localIds: [r.localId], size: 1 };
      blocks.push(cur);
    }
  }
  return blocks;
}

export function blockAt(blocks: Block[], index: number): Block | undefined {
  return blocks.find((b) => index >= b.start && index <= b.end);
}
```

Complexité : **O(R)** où `R` = nombre de runs (≤ `2N+1`). Voir §8.

---

## 2. Besoins fonctionnels détaillés (B1–B9)

### B1 — Annoter une phrase précisément *(déjà livré C4)*
- Geste : **clic** sur la phrase → popover `SentenceMenu` → choix d'un thème.
- Effet store : `toggleBoundary(i, theme)` (crée / re-thématise / retire).
- Bloc : la phrase forme un bloc de taille 1, ou **fusionne** (§3.2) avec un voisin de
  même thème → on perçoit un bloc plus grand **sans aucune écriture supplémentaire**.
- Acceptation : 1 `Clause` créée à l'ancre `i` ; IAA inchangée (vecteur par phrase).

### B2 — Annoter une plage (bloc) en un geste
- Geste : **glisser** sur les phrases `i..j`, ou **Maj+clic** de `i` à `j` → sélection
  multi-phrases (`selectedSentences`), puis choix d'un thème dans la `SelectionToolbar`.
- Effet store : pour **chaque** phrase `k ∈ [i..j]`, `setBoundary(k, theme)` (ou
  `updateDraft` si une clause existe déjà) — **une `Clause` par phrase** (déjà le
  comportement de `SelectionToolbar::annotate`, conforme C4).
- Résultat : un **bloc dérivé** `[i..j]` apparaît immédiatement (runs recalculés).
- Acceptation : `j-i+1` clauses ; INV-2 respecté (une par ancre) ; **aucune** clause-span.
- Atomicité : la pose de plage est **une seule transaction d'undo** (§5) malgré N créations.

### B3 — Surcharger une phrase d'un bloc (override → split)
- Geste : **clic-droit** sur une phrase `k` interne au bloc → re-thématiser `k` en `t'`
  (ou la désannoter). C'est l'usage cœur de `SentenceMenu` (déjà par phrase).
- Effet store : `setBoundary(k, t')` (re-theme d'une seule clause) **ou** `removeBoundary(k)`.
- Bloc : `k` quitte le bloc d'origine → le bloc **se scinde** en au plus trois blocs
  dérivés (§3.1) : `[start..k-1]` (thème `t`), `[k..k]` (thème `t'`), `[k+1..end]` (thème
  `t`). **Zéro écriture** sur les phrases voisines : seul `k` change.
- Acceptation : une seule clause modifiée ; les frontières des sous-blocs sont **dérivées**,
  pas matérialisées.

### B4 — Étendre / réduire un bloc par ses bords (poignées)
- Geste : **poignées de bord** (haut/bas du bloc dans le rail) glissées vers l'extérieur
  (étendre) ou l'intérieur (réduire) ; ou **re-sélection** d'une plage puis ré-application.
- Étendre `[i..j] → [i..j+p]` : `setBoundary(j+1..j+p, t)` (clauses créées au thème du bloc).
- Réduire `[i..j] → [i..j-q]` : `removeBoundary(j-q+1..j)` (clauses retirées).
- Effet : **lot atomique** (undo unique). Si l'extension rencontre une clause d'un autre
  thème, voir §3.3 (politique de collision).
- Acceptation : seules les phrases du delta sont touchées ; le reste du bloc intact.

### B5 — Fusionner / diviser des blocs intelligemment
- **Fusion (merge)** : **automatique et implicite** (§3.2). Dès que deux blocs de même
  thème deviennent adjacents (contiguïté d'index restaurée), `deriveBlocks` les rend
  comme **un seul** bloc — aucune action, aucune écriture. Pas de bouton « fusionner ».
- **Division (split)** : conséquence d'un override (B3) ou d'une désannotation interne
  (B6) ; également **implicite** via la re-dérivation.
- Acceptation : merge/split sont des **propriétés émergentes** du modèle dérivé, jamais
  des opérations persistées → impossibles à désynchroniser de la donnée.

### B6 — Désannoter (toggle) une phrase ou un bloc
- **Phrase** : re-choisir **le même thème** sur une phrase annotée → `toggleBoundary`
  supprime la clause (`removeBoundary`). Comportement existant (C3).
- **Bloc** : action « Désannoter le bloc » (depuis `SelectionToolbar` en mode bloc, ou
  raccourci) → `removeBoundary(k)` pour chaque `k ∈ block.localIds` en **un lot atomique**.
- Bloc résultant : le trou créé devient des runs neutres → split éventuel des voisins.
- Acceptation : désannotation réversible (undo), conforme au toggle déjà documenté.

### B7 — Cohérence IAA : stockage par phrase
- **Stockage inchangé** : `deriveBlocks` n'écrit jamais ; le backend ne voit que des
  `Clause` par phrase. `projects/iaa.py::_theme_vector` continue de produire
  `[starts.get(i) for i in range(n_sentences)]`, et `cohen_kappa` reste **par phrase**.
- Garantie : annoter « par bloc » (B2) ou « par phrase » (B1) produit **exactement le
  même état stocké** pour le même résultat visuel → κ identique. Le bloc est neutre vis-à-vis
  de l'IAA (B-IAA-1).
- Acceptation : un test prouve que « plage de 5 phrases via bloc » et « 5 clics phrase »
  donnent le **même `draftClauses`** (à `localId`/horodatage près) et le même vecteur thème.

### B8 — Découpage propre, indépendant des LLM
- L'annotateur peut bâtir **son** découpage de zéro (B1/B2) **ou** partir d'un modèle via
  le pré-remplissage existant `replacePrefill(clauses, judge)` — qui **déplie déjà** les
  segments LLM en **clauses par phrase** (cf. `store/workspace.ts`, boucle `seg.anchor_index
  → end`). Les blocs dérivés s'appliquent **identiquement** au prérempli et à l'humain.
- Override d'une phrase préremplie : `seededFrom` reste informatif ; le bloc se scinde
  comme pour de l'humain. La distinction humain/prérempli reste **orthogonale** au bloc.
- Acceptation : aucun couplage bloc ↔ provenance ; un bloc peut mélanger des phrases
  `seededFrom` et humaines (il est défini par `theme` + contiguïté, pas par la provenance).

### B9 — Ergonomie experte (souris + clavier, feedback, undo/redo)
- Gestes souris/clavier : table exhaustive dans `B-interactions.md`.
- Feedback visuel : un **bloc** (size > 1) se distingue d'une **phrase** (size 1) par
  l'unification du rail coloré et l'affichage des **poignées** seulement sur un bloc
  sélectionné ; voir §6.
- Undo/redo : déjà fourni par le store (`undoStack`/`redoStack` = snapshots de
  `draftClauses`). Les **lots** (B2, B4, B6-bloc) poussent **un seul** snapshot (§5).

---

## 3. Règles split / merge / extend (sémantique complète)

> Toutes les règles ci-dessous portent sur `draftClauses`. Le bloc est recalculé après
> chaque mutation. **Aucune règle ne crée d'objet « bloc »**.

### 3.1 SPLIT (override d'une phrase interne)
Soit un bloc `B = [start..end]` de thème `t` et `k` strictement interne (`start < k < end`).
Re-thématiser `k` en `t' ≠ t` (ou la désannoter) produit :

```
avant :  [ start .......... k .......... end ]   (thème t, 1 bloc)
après :  [ start .. k-1 ] [ k ] [ k+1 .. end ]   (t)      (t')      (t)
```

- Écritures : **1** (la clause `k`). Les sous-blocs `[start..k-1]` et `[k+1..end]` sont
  **dérivés**, pas matérialisés.
- Cas bord : `k === start` → 2 blocs (`[k]` t', `[start+1..end]` t). `k === end` → symétrique.
- Désannotation interne (`removeBoundary(k)`) : même découpe, mais `[k]` devient **neutre**
  (trou), donc 2 blocs `t` séparés par une phrase non annotée.

### 3.2 MERGE (fusion automatique)
Deux blocs `B1 = [a..b]` (t) et `B2 = [c..d]` (t) **fusionnent** ssi `c === b + 1` **et**
même thème `t`. La fusion est **implicite** : il suffit que l'état atteigne cette
configuration (par extension B4, override ramenant `k` au thème `t`, ou pose d'une phrase
manquante) pour que `deriveBlocks` retourne un bloc unique `[a..d]`.

- Écritures : aucune **propre à la fusion** (seule l'action déclenchante écrit).
- Non-merge : si un **trou neutre** subsiste entre `b` et `c`, **pas** de fusion (B-DEF-2) —
  combler le trou (annoter la phrase intermédiaire au thème `t`) déclenche la fusion.

### 3.3 EXTEND (poignées) et politique de COLLISION
Étendre `[i..j]` vers `j+1..j+p` :

- Phrase cible **neutre** → `setBoundary(target, t)` (création). Cas nominal.
- Phrase cible **déjà du thème `t`** → no-op (déjà couverte ; la fusion l'absorbe).
- Phrase cible **d'un autre thème `t''`** → **collision**. Politique retenue :
  **« écraser sur extension explicite »** — l'extension par poignée est un geste
  intentionnel, donc `setBoundary(target, t)` **re-thématise** la cible (l'undo restaure).
  *Rationale* : la sélection-plage (B2) écrase déjà ; cohérence des gestes « de plage ».
  *Garde-fou* : l'extension s'arrête à `nSentences-1` et ne **franchit jamais** une borne
  hors document. (Variante « buter sur collision » écartée : voir `B-choix.md` §Alternatives.)

Réduire `[i..j]` vers `i..j-q` : `removeBoundary` sur les `q` phrases de queue. La réduction
ne touche jamais d'autres blocs.

### 3.4 Idempotence et ordre
- Réappliquer la **même** plage au **même** thème = no-op net (chaque phrase déjà au thème →
  `setBoundary` retourne juste la sélection sans `dirty`, cf. `workspace.ts` ligne ~299).
- L'ordre d'application au sein d'un lot n'affecte pas l'état final (opérations par ancre
  indépendantes) — important pour l'atomicité d'undo (§5).

---

## 4. Désannotation (récapitulatif normatif)
| Cible | Geste | Action store | Effet bloc |
|-------|-------|--------------|------------|
| Phrase | re-choisir **même thème** | `toggleBoundary` → `removeBoundary` | trou → split éventuel |
| Phrase | clic-droit → « Retirer » | `removeBoundary(k)` | idem |
| Bloc entier | `SelectionToolbar` (mode bloc) → « Désannoter » | lot `removeBoundary` (atomique) | bloc disparaît, voisins inchangés |
| Plage partielle | sélection puis « Désannoter » | lot `removeBoundary` sur la plage | split / réduction |

Toute désannotation est **réversible** (1 entrée undo). En `readOnly`, tous ces mutateurs
sont **no-op** (R1) — déjà garanti par les gardes `if (s.readOnly) return {}` du store.

---

## 5. Atomicité, undo/redo et journal

Le store snapshote `draftClauses` **avant chaque mutation** (`pushUndo`) et vide `redoStack`.
Pour les **lots** (B2 pose de plage, B4 extend, B6 désannotation de bloc), il faut **un seul**
snapshot pour tout le lot, sinon l'undo défait phrase par phrase (mauvaise UX).

**Décision** : introduire une primitive de lot **dans le store** (sans casser l'existant) :

```ts
// nouvelle action store : applique une suite de mutations comme UNE transaction undo.
applyBlockOp(op: { kind: "annotateRange" | "extend" | "shrink" | "clearBlock";
                   anchors: number[]; theme?: string }): void
```

- Pousse **un** snapshot `pushUndo(undoStack, draftClauses)` au début, puis mute en place,
  puis **une** entrée `actionLog` (`kind: "block.annotate" | "block.extend" | …`) avec un
  `label` du type « Bloc Obligation 12–18 (7 phrases) ». La taxonomie de verbes reste
  alignée sur l'audit serveur (préfixe `block.*`, sœur de `clause.*`).
- `undo()`/`redo()` existants fonctionnent **sans modification** : ils restaurent le
  snapshot complet `draftClauses` → un bloc posé/retiré est annulé d'un coup.
- Les gestes **unitaires** (B1, B3) continuent d'utiliser `toggleBoundary`/`setBoundary`
  (un snapshot chacun) — inchangés.

> Sans cette primitive, l'alternative serait de garder les appels unitaires existants ; on
> aurait alors N entrées d'undo pour une plage. La primitive `applyBlockOp` est le **seul**
> ajout au store requis par B (le reste réutilise l'API existante).

---

## 6. Feedback visuel (contrat UI, détaillé en 05-design)
- **Phrase (size 1)** : rail coloré sur une ligne, pas de poignée.
- **Bloc (size > 1)** : rail coloré **continu** sur `[start..end]`, coin haut/bas arrondis ;
  au **survol** : léger liseré ; à la **sélection** (double-clic) : **2 poignées** (bord
  haut/bord bas) + contour accentué.
- **Override** : la phrase surchargée rompt visuellement la couleur du bloc (sous-bloc
  d'une autre teinte) → le split est **lisible sans action**.
- **Distinction bloc vs phrase** garantie aussi en non-couleur (forme + contour) pour l'a11y
  daltonisme (cf. besoin transverse). Tooltips : « Bloc <thème> · phrases i–j · n phrases ».
- Source de vérité du rendu : `computeRuns(..., {perSentence:true})` + `deriveBlocks` ; la
  réglette **Feature A** (frontières par modèle) reste indépendante et lit ses propres runs.

---

## 7. Cohérence IAA par phrase (preuve d'innocuité)
- Le backend ne reçoit que des `Clause(anchor_sentence, theme)`. `deriveBlocks` est **pur
  frontend** et **lecture seule** sur `draftClauses`.
- `_theme_vector(annotation, n)` → `[theme@i ou None]` ; `cohen_kappa(vec_a, vec_b)` par
  phrase. Le bloc **n'apparaît nulle part** dans ce calcul.
- **Invariant B-IAA-1** : pour tout état atteignable par gestes-bloc, il existe une suite de
  gestes-phrase produisant le **même** `draftClauses` → κ **identique**. Le bloc est un
  *sucre d'interaction*, pas une donnée. (Test d'équivalence requis, cf. `06-plan-tests`.)

---

## 8. Performance (jusqu'à ~300 phrases)

Cible : document **≤ 300 phrases**, plusieurs modèles, interactions fluides (60 fps perçu).

| Aspect | Coût | Maîtrise |
|--------|------|----------|
| `computeRuns(perSentence)` | O(C log C) tri + O(N) | C ≤ N ≤ 300 → négligeable ; déjà en place |
| `deriveBlocks(runs)` | O(R), R ≤ 2N+1 ≤ 601 | une passe linéaire, pure |
| Re-dérivation par frappe | mémoïsée sur `[draftClauses, nSentences]` | `useMemo` ; ne recalcule que si le brouillon change |
| Pose de plage (B2, p=300) | 300 mutations en **1** set Zustand | `applyBlockOp` mute un tableau local puis **un seul** `set()` → **un** rendu, **un** snapshot undo |
| Snapshots undo | O(C) copie de tableau, borné `UNDO_DEPTH=200` | inchangé ; un lot = **un** snapshot (pas 300) |
| Autosave d'une plage | diff par ancre `planClauseSync` → `p` creates | **debounce 1200 ms** + idempotence `clientOpId` (cf. `useAutosave`) ; les `p` POST sont séquencés mais hors chemin critique UI |

Règles de perf à respecter à l'implémentation :
- **B-PERF-1** : `deriveBlocks` mémoïsée ; **jamais** appelée dans une boucle de rendu par
  phrase (la calculer **une fois** par rendu et indexer via `blockAt`).
- **B-PERF-2** : les lots (B2/B4/B6-bloc) passent par `applyBlockOp` → **un** `set()` et **un**
  snapshot, pas N. Interdiction d'itérer `setBoundary` dans un handler pour une plage large.
- **B-PERF-3** : le rendu des phrases reste **virtualisable** si besoin ; `deriveBlocks`
  fournit `blockAt(index)` en O(R) (ou O(log R) si on indexe par dichotomie sur `start`).
- **B-PERF-4** : autosave inchangé ; le pic de `p` créations est absorbé par le debounce et
  la convergence post-synchro déjà implémentés (`useAutosave`).

Budget mesuré attendu : dérivation + rendu d'un document de 300 phrases **< 5 ms** par frappe
(hors peinture). À valider par un bench vitest (cf. `06-plan-tests`).

---

## 9. Hors-périmètre (pour cadrer)
- Pas d'objet `Block` persistant, pas d'`end_index`, pas de hiérarchie sections/clauses
  (analysé et écarté : `B-etude-comparative.md`, `B-choix.md`).
- Pas de modification du contrat API ni des serializers (`anchor_index`, `theme`, …) — voir
  `B-migration.md` (stratégie **sans migration**).
- La réglette multi-modèles (Feature A) est traitée séparément ; B ne consomme que ses
  propres runs humains.

---

## 10. Critères d'acceptation (résumé)
1. B1–B6 opérationnels via les gestes de `B-interactions.md`, sans `end_index`.
2. Pose de plage, extend, désannotation de bloc = **un seul** undo chacun.
3. État stocké d'un bloc == état stocké des phrases équivalentes (B-IAA-1 testé).
4. κ de Cohen inchangé par l'introduction des blocs (vecteur par phrase).
5. Document 300 phrases fluide ; dérivation < 5 ms/frappe (bench vert).
6. `readOnly` neutralise tout mutateur de bloc (R1).
