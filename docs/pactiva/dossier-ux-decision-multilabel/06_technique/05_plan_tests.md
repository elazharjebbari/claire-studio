# 06 — Technique · Plan de tests (système 3-canaux multi-label)

> Document de pilotage QA pour l'implémentation du design UX « 3 canaux orthogonaux »
> (provenance ★/⚡/✎ · état couleur · multi-label `+N`/toggle). On **ancre** la batterie sur
> l'infrastructure réelle du dépôt : Vitest (`tests/**/*.test.{ts,tsx}`, jsdom, `tests/setup.ts`),
> RTL + `@testing-library/user-event`, MSW (`src/mocks/handlers.ts`), Playwright (`e2e/*.spec.ts`),
> pytest côté backend. **Aucune migration, aucun champ stocké** : la provenance est une projection
> dérivée → l'essentiel du risque est en **front pur** et **composants**, d'où le poids mis sur
> Vitest/RTL.

## 0. Principe directeur — la pyramide pour ce lot

```
        e2e Playwright (3 scénarios bout-en-bout : plan ↔ inspecteur ↔ persistance)
      ────────────────────────────────────────────────────────
     RTL composants (ClauseChip +N/provenance · MultiLabelEditor toggle/secondaires)
   ──────────────────────────────────────────────────────────────────
  Vitest PUR (validationDisplay 3 types/états/secondaryCount · store setClauseThemes invariants)
```

Règle : **toute logique dérivée se teste en pur** (`validationDisplay`, sélecteurs store), le DOM
ne teste que le **câblage** (props → rendu, geste → action), l'e2e ne prouve que les **coutures
inter-couches** (store → autosave → MSW → re-render du plan). On ne re-teste pas en RTL ce qui est
déjà couvert en pur.

## 1. Surface impactée et état de départ (audit)

| Artefact | État actuel (dépôt) | Ce que ce lot change | Couche de test |
|---|---|---|---|
| `src/lib/validationDisplay.ts` | **Existe** : `validationDisplay`, `provenanceOf`, `secondaryCount`. | Aucun changement attendu — **on verrouille** par tests de non-régression. | Vitest pur |
| `src/components/ui/ProvenanceMark.tsx` | **Existe** : `data-testid="provenance-mark"`, `data-provenance`, `data-state`. | Réutilisé tel quel par ClauseChip. | RTL |
| `src/components/ui/ClauseChip.tsx` | Props `secondaryCount`/`seededFrom`/`triageLevel` **présentes mais inertes** ; rend encore `✓/◷` inline + libellé primaire. | Rend `ProvenanceMark` + badge `+N`. | RTL |
| `src/store/workspace.ts` | `setClauseThemes` **absent** ; undo via `pushUndo`, `dirty`, `redoStack=[]` (convention établie). | Nouvelle action `setClauseThemes(localId, themes)`. | Vitest store |
| `MultiLabelEditor` (zone Thèmes de `InspectorPanel`) | **À créer** (chips primaire/secondaire + toggle Mono/Multi + « + secondaire »). | Nouveau composant présentationnel. | RTL |
| `src/components/ui/ThemePalette.tsx` | Pas de `excludeRefuge`. | Ajout prop pour exclure le refuge en secondaire. | RTL |
| `src/mocks/handlers.ts` | `PATCH /clauses/:id` (themes) + `POST /clauses/:id/swap-primary` **déjà gérés**. | Aucun changement attendu — on **vérifie** que `themes[]` survit au round-trip. | MSW (via store/e2e) |

**Identité du refuge** : aujourd'hui connue côté `lib/triage/engine.ts` (`rules.refuges`), pas exposée
à l'UI. L'implémentation devra fournir un helper UI (p. ex. `isRefugeTheme(code)`); **le plan de
tests cible ce helper par son contrat**, indépendamment du nom final.

## 2. Matrice par couche

### 2.1 Vitest PUR — logique dérivée (zéro DOM, zéro réseau)

**A. `tests/validationDisplay.test.ts`** (nouveau) — verrou de la source unique.

| # | Cas | Entrée | Attendu (contrat) |
|---|---|---|---|
| VD-1 | Moteur validé | `{validated:true, triageLevel:"C2"}` | `provenance:"moteur"`, `glyph:"⚡"`, `state:"valide"`, `colorClass` emerald, `level:"C2"`, `label` contient « moteur » + « C2 ». |
| VD-2 | Pré-annotation validée | `{validated:true, seededFrom:"GPT-4"}` | `provenance:"pre_annotation"`, `glyph:"★"`, emerald. |
| VD-3 | Manuel validé | `{validated:true}` | `provenance:"manuel"`, `glyph:"✎"`, emerald. |
| VD-4 | À valider (toute provenance) | `validated` faux × {moteur, seed, ø} | `state:"a_valider"`, `glyph:"◷"`, amber, **mais `provenance` reste dérivée** (non « pending »). |
| VD-5 | Priorité de dérivation | `{triageLevel:"C3", seededFrom:"x"}` | `provenance:"moteur"` (moteur > pré-annotation > manuel). |
| VD-6 | `triageLevel:null` n'est pas moteur | `{validated:true, triageLevel:null, seededFrom:"x"}` | `pre_annotation`. |
| VD-7 | `secondaryCount` | `[{primary},{secondary},{secondary}]` | `2` ; `undefined`/`null`/`[]` → `0` ; jamais le primaire compté. |
| VD-8 | `accentHex` par provenance | les 3 types | `#3B82F6` / `#F59E0B` / `#22C55E` ; état non-validé → `#FBBF24`. |

> ⚠ **Non-régression** : VD-1→VD-8 figent le comportement **déjà codé**. Si un futur refactor
> change la priorité ou les glyphes, ces tests cassent volontairement (le design est arrêté).

**B. `tests/multiLabelStore.test.ts`** (nouveau) — action `setClauseThemes`.

Contrat visé (signature attendue) :
```
setClauseThemes(localId: string, themes: ThemeTag[]): void
```

| # | Cas | Précondition / Action | Attendu |
|---|---|---|---|
| ST-1 | Pose multi-label | clause mono → `setClauseThemes(id, [P, s1, s2])` | `themes` = 1 primaire + 2 secondaires ; `theme` scalaire = label du primaire (miroir). |
| ST-2 | **Invariant : 1 seul primaire** | passer 2 rôles `primary` | normalisé à **1** primaire (le 1ᵉʳ, ou règle documentée) ; surplus → rejeté ou rétrogradé — **pas d'état à 0 ou 2 primaires**. |
| ST-3 | **Refuge jamais secondaire** | `[P, refuge(secondary)]` | secondaire refuge **rejeté/filtré** ; `secondaryCount` ne le compte pas ; clause reste cohérente. |
| ST-4 | Refuge en **primaire** autorisé | `[refuge(primary)]` | accepté (l'interdit ne porte que sur `secondary`). |
| ST-5 | `dirty` + undo | après `setClauseThemes` | `dirty===true`, `undoStack` a **un** snapshot de plus, `redoStack` vidé (convention `pushUndo`). |
| ST-6 | Undo réversible | `setClauseThemes` puis `undo()` | état `themes`/`theme` **identique** à l'avant (deep-equal), `dirty` cohérent. |
| ST-7 | Mono via scalaire | `setClauseThemes(id, [P])` (0 secondaire) | `theme=P.label`, `themes` réduit au mono ou `[P]` ; `secondaryCount===0`. |
| ST-8 | No-op identique | mêmes `themes` que l'existant | **pas** de nouveau snapshot undo, `dirty` inchangé (aligné sur la logique « thème inchangé » de `setBoundary`). |
| ST-9 | `readOnly` | store `readOnly:true` | action ignorée (aucun changement), comme les autres mutations. |
| ST-10 | localId inconnu | id absent | no-op gracieux (pas d'exception, pas de dirty). |

> Convention store à respecter (cf. `setBoundary`/`applyTriageDecision`) : `set((s)=>{ if(s.readOnly) return {}; … undoStack: pushUndo(...), redoStack: [], dirty:true, actionLog: appendLog(...) })`.
> ST-8 et ST-10 verrouillent les sorties anticipées.

### 2.2 RTL — composants (DOM, sans réseau)

**C. `tests/clauseChip.test.tsx`** (nouveau) — badge `+N` + provenance.

| # | Cas | Props | Attendu |
|---|---|---|---|
| CC-1 | Provenance moteur | `validated, triageLevel:"C2"` | `getByTestId("provenance-mark")` présent, `data-provenance="moteur"`, glyphe ⚡ + code Cx. |
| CC-2 | Provenance pré-annotation | `validated, seededFrom` | `data-provenance="pre_annotation"`, ★. |
| CC-3 | Provenance manuelle | `validated` seul | `data-provenance="manuel"`, ✎. |
| CC-4 | À valider | `validated:false` | `data-state="a_valider"`, glyphe ◷. |
| CC-5 | Badge `+N` visible | `secondaryCount:3` | badge texte « +3 » présent (testid dédié, p. ex. `secondary-badge`), **distinct** de la provenance (pas de télescopage). |
| CC-6 | Pas de badge si 0 | `secondaryCount:0` | aucun « +N » dans le DOM. |
| CC-7 | A11y | n'importe quel état validé | `provenance-mark` porte `title`/`aria-label` non vide ; le glyphe brut est `aria-hidden`. |
| CC-8 | Non-régression libellé/couleur | thème quelconque | libellé thème en `text-ink` (AA), couleur de thème sur fond/bordure seulement. |

**D. `tests/multiLabelEditor.test.tsx`** (nouveau) — éditeur multi-label de l'inspecteur.

| # | Cas | Geste (user-event) | Attendu |
|---|---|---|---|
| ME-1 | Rendu primaire + secondaires | clause `[P, s1]` | 1 chip primaire (plein, ✓) + chips secondaires (pointillé, `+`, retirables). |
| ME-2 | Toggle Mono→Multi | clic toggle 🏷 | passe en « Multi-label » ; affordance « + thème secondaire » apparaît ; libellé Mono/Multi **lisible sans couleur**. |
| ME-3 | Toggle = annulation (Multi→Mono) | re-clic toggle | revient **exactement** à l'état initial (secondaires masqués/retirés selon contrat), via undo transactionnel. |
| ME-4 | Ajouter un secondaire | « + thème secondaire » → choisir T dans `ThemePalette` | `setClauseThemes` appelé avec T en `secondary` ; chip pointillé T rendu. |
| ME-5 | Retirer un secondaire | clic « ✕ » sur chip secondaire | `setClauseThemes` sans ce thème ; chip disparaît. |
| ME-6 | **Refuge non sélectionnable** | ouvrir la palette des secondaires | l'option refuge est **absente ou désactivée** + message ; tenter de l'ajouter ne mute pas le store. |
| ME-7 | Cible toggle ≥ 32 px | mesure attribut/classe | hit-zone inspecteur conforme (test structurel : classe/`min-h`/`min-w`). |
| ME-8 | Feedback < 200 ms (structurel) | toggle | transition câblée (classe d'animation présente) — la latence réelle est vérifiée en e2e/manuel, pas en jsdom. |
| ME-9 | A11y clavier | Tab/Enter/Espace | toggle et « + » atteignables au clavier, focus visible, `aria-pressed` cohérent. |

> Le test ME-6 cible le **contrat** « refuge exclu des secondaires » via la prop d'exclusion de
> `ThemePalette` (p. ex. `excludeRefuge`) — le nom final est libre, le test interroge le **rendu**
> (option absente/désactivée), pas l'implémentation interne.

**E. `tests/themePalette.test.tsx`** (à **étendre**, fichier existant) — exclusion refuge.

| # | Cas | Attendu |
|---|---|---|
| TP-1 | `excludeRefuge` retire le refuge | l'option refuge n'est pas rendue (ou `disabled` + non cliquable). |
| TP-2 | Sans la prop, comportement inchangé | non-régression des tests d'info-bulle existants. |

### 2.3 MSW — persistance des `themes[]` (déjà gérée)

Aucun nouveau handler. On **prouve le round-trip** que l'autosave persiste `themes` via
`PATCH /clauses/:id` (comparaison `sameFields`/`themesKey` côté autosave) et que `swap-primary`
réordonne primaire/secondaire.

**F. `tests/autosave.test.ts`** (à **étendre**, fichier existant).

| # | Cas | Attendu |
|---|---|---|
| MS-1 | `themes` change → PATCH déclenché | un PATCH `/clauses/:id` part avec `themes:[…]` (1 primaire + secondaires) ; `theme` scalaire = primaire. |
| MS-2 | `themes` identique → pas de PATCH | `themesKey` égal ⇒ `sameFields` vrai ⇒ aucun appel (anti-bavardage). |
| MS-3 | Round-trip MSW | après PATCH, le GET annotation renvoie les `themes` mis à jour (handler `PATCH /clauses/:id` merge). |
| MS-4 | `swap-primary` | `POST /clauses/:id/swap-primary` bascule l'ancien primaire en secondaire et le label visé en primaire (déjà dans le mock). |

> Si l'autosave ne compare pas encore `themes` (à vérifier dans `src/store/autosave.ts` lors de
> l'implémentation), MS-1/MS-2 deviennent **tests dirigeant l'implémentation** (ajout d'une clé
> `themesKey` dans `sameFields`).

### 2.4 Playwright e2e — coutures inter-couches

Mode démo MSW, document `ann-1` (propriétaire `u-alice`), viewport 1440×900, sélecteurs `getByTestId`
(conformes à `e2e/triage.spec.ts`).

**G. `e2e/multilabel.spec.ts`** (nouveau).

| # | Scénario | Étapes | Assertion |
|---|---|---|---|
| E2E-1 | Le plan montre `+N` | ouvrir un doc avec une clause multi-label (seed mock ou pose via inspecteur) | `clause-chip` correspondant affiche le badge `+N` ; `provenance-mark` visible. |
| E2E-2 | Ajout secondaire → reflet dans le plan | ouvrir inspecteur → toggle Multi → « + thème secondaire » → choisir T | le `ClauseChip` du plan passe à `+1` **sans rechargement** (store → re-render). |
| E2E-3 | Toggle Mono↔Multi réversible | activer Multi, ajouter, puis re-toggle Mono | retour à l'état mono (badge `+N` disparaît) ; aucun secondaire résiduel ; pas d'erreur console. |
| E2E-4 | Refuge bloqué (garde-fou) | tenter d'ajouter le refuge en secondaire | option indisponible/désactivée + message ; le plan reste à `+0`. |
| E2E-5 | Persistance | ajouter un secondaire puis attendre l'autosave (indicateur dirty→saved) | round-trip MSW OK ; l'état reste après navigation interne. |

> E2E volontairement **restreint à 3 parcours nominaux** (plan `+N`, ajout reflété, toggle) + 2
> garde-fous (refuge, persistance). Les états fins (8 combinaisons provenance×état, invariants store)
> sont déjà couverts en pur/RTL : on n'alourdit pas l'e2e.

### 2.5 pytest — backend (vérification de non-régression, pas de migration)

Aucune migration. On **confirme** que le contrat existant tient pour le multi-label.

**H. tests backend (à étendre dans la suite clauses existante)** :

| # | Cas | Attendu |
|---|---|---|
| PY-1 | `PATCH /clauses` avec `themes[]` | 1 primaire + N secondaires persistés ; `theme` scalaire = primaire. |
| PY-2 | Refuge en `secondary` refusé | rejet (400/validation) — invariant back-end. |
| PY-3 | `POST /clauses/{id}/swap-primary` | permutation primaire/secondaire ; refuge non promu en secondaire. |
| PY-4 | INV-2 | toujours 1 clause-début par phrase (multi-label additif, n'altère pas la frontière). |

## 3. Cas limites transverses (checklist anti-régression)

- **mono → multi → mono** : aucun thème fantôme, `secondaryCount` revient à 0, `theme` scalaire stable (ST-7, ME-3, E2E-3).
- **Refuge** : jamais secondaire, partout (store ST-3, palette TP-1/ME-6, e2e E2E-4, backend PY-2).
- **Undo/redo** : un seul snapshot par geste `setClauseThemes` ; lot/batch = snapshot unique (ST-5/ST-6, aligné sur `applyTriageBatch`).
- **Priorité de provenance** : moteur > pré-annotation > manuel, même quand plusieurs signaux coexistent (VD-5/VD-6).
- **Couleur ≠ seul signal** : glyphe + `aria-label` toujours présents (CC-7, ME-9), test grayscale couvert en revue manuelle (runbook étapes 1/7).
- **No-op** : `themes` identique ⇒ ni PATCH ni snapshot (ST-8, MS-2).

## 4. Liste nominative des fichiers de test

**À créer :**
- `frontend/tests/validationDisplay.test.ts` — Vitest pur (VD-1→VD-8).
- `frontend/tests/multiLabelStore.test.ts` — Vitest store `setClauseThemes` (ST-1→ST-10).
- `frontend/tests/clauseChip.test.tsx` — RTL `ClauseChip` `+N` + provenance (CC-1→CC-8).
- `frontend/tests/multiLabelEditor.test.tsx` — RTL éditeur multi-label inspecteur (ME-1→ME-9).
- `frontend/e2e/multilabel.spec.ts` — Playwright (E2E-1→E2E-5).

**À étendre (existants) :**
- `frontend/tests/themePalette.test.tsx` — exclusion refuge (TP-1/TP-2).
- `frontend/tests/autosave.test.ts` — persistance `themes` via PATCH (MS-1→MS-4).
- Suite pytest clauses backend — PY-1→PY-4 (pas de fichier front).

> Note : `ProvenanceMark` n'a **pas** de fichier dédié — il est couvert indirectement par
> `clauseChip.test.tsx` (il est déjà en prod et stable). En créer un seul si un comportement propre
> (ex. `showLevel=false`) doit être verrouillé.

## 5. Commandes & critères de sortie

| Couche | Commande | Critère |
|---|---|---|
| Vitest | `npm --prefix frontend run test` | 100 % vert ; **0 régression** sur la suite existante. |
| Couverture | `npm --prefix frontend run test:coverage` | `src/lib/validationDisplay.ts` et l'action store **100 % lignes/branches** (logique pure, exigence dure). |
| e2e | `npm --prefix frontend run e2e -- multilabel.spec.ts` | 5 scénarios verts, **0 erreur console**. |
| pytest | suite clauses backend (env conda `claire`) | PY-1→PY-4 verts. |

**Définition de « fait »** : toute la matrice §2 verte + checklist §3 cochée + couverture pure 100 %
+ 0 régression sur les suites Vitest/Playwright/pytest préexistantes. Les critères perceptifs
(latence < 200 ms, grayscale, daltonisme) relèvent du runbook (étapes 1/4/7) et **ne bloquent pas**
la CI automatisée, mais sont tracés en revue manuelle avant déploiement.
