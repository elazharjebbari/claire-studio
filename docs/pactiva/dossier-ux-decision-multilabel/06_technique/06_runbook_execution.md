# 06 — Runbook d'exécution (système 3-canaux multi-label)

> Document de **pilotage**. Il sert à piloter l'implémentation puis le déploiement
> sur `pactiva.legal`. Les statuts restent à ⏳ : l'**agent principal** exécute les
> étapes une par une et coche au fur et à mesure (⏳ → 🔄 → ✅ / ❌).
>
> Périmètre rappelé (cf. `00_synthese/synthese.md`) :
> - **Aucune migration backend.** La provenance est une **projection dérivée** côté front.
> - Source unique d'affichage : `frontend/src/lib/validationDisplay.ts` (pur, testable).
> - Présentationnel : `ProvenanceMark.tsx` (3 types : ⚡ moteur, ★ pré-annotation, ✎ manuel).
> - Surfaces : `ClauseChip` (plan/TocPanel, badge `+N` + mark) ; `InspectorPanel` (éditeur multi-label).
> - Store : `setClauseThemes(localId, themes)` transactionnel (undo/redo, dirty), autosave existant.
> - Invariants : INV-2 (1 clause-début/phrase), multi-label additif, **refuge jamais secondaire**.

---

## ✅ État réel d'exécution (agent principal)

Lots livrés dans le code (preuves : tsc clean + suite vitest **316** verte) :

| Lot | Contenu | Statut | Preuve |
| --- | --- | --- | --- |
| L1 | `lib/validationDisplay.ts` (pur : 3 types + `secondaryCount`) | ✅ | `tests/validationDisplay.test.ts` (6) |
| L2 | `ui/ProvenanceMark.tsx` | ✅ | utilisé par ClauseChip + inspecteur |
| L3 | `ClauseChip` (`+N` + ProvenanceMark) + `TocPanel` | ✅ | `tests/clauseChip.test.tsx` (5) |
| L4 | store `setClauseThemes` (sanitize 1 primaire/refuge≠2ⁿᵈ, undo, dirty) | ✅ | `tests/workspaceStore.test.ts` (+3) |
| L5 | `MultiLabelEditor` (toggle Mono/Multi + secondaires + « +secondaire » hors C3) dans `InspectorPanel` | ✅ | `tests/multiLabelEditor.test.tsx` (3) |
| L7 | tests d'intégration + e2e | ✅ | vitest 316 ; `e2e/triage.spec.ts` (multi-label) |
| L8 | revue adversariale + déploiement | ✅ | revue 26 agents/17 findings → 7 correctifs (dont miroir theme↔themes, provenance resolvedFrom, purge triageLevel) ; déployé `8921e45`, health 200 |

**Différé (⤵️, documenté dans `04_plan_developpement.md`)** : unification de la provenance dans
l'en-tête du document, indicateur de conflit C4/C5 (clignotement), carte de suggestion en
« toggle annuler » post-validation. Données back-end inchangées (provenance dérivée).

> Note réactivité : `InspectorPanel` passe le **draft réactif du store** (`selectSelectedDraft`)
> à `MultiLabelEditor` ; toute écriture (`setClauseThemes`) re-rend l'éditeur avec l'état frais
> (pas de prop figée en conditions réelles ; seul le test RTL fige et vérifie le store).

---

## 0. Légende des statuts

| Statut | Sens |
| --- | --- |
| ⏳ | À faire (non démarré) |
| 🔄 | En cours |
| ✅ | Fait + preuve attachée |
| ❌ | Échec / bloqué (note la cause) |
| ⤵️ | Reporté / hors scope de ce lot |

**Convention de preuve** : chaque ligne « faite » doit pointer une preuve *vérifiable*
(SHA de commit, sortie de commande tronquée, capture, lien CI). Pas de preuve → pas de ✅.

---

## 1. Pré-requis environnement (à vérifier une fois)

| # | Action | Commande / vérif | Critère de succès | Statut | Preuve |
| --- | --- | --- | --- | --- | --- |
| P1 | Branche de travail dédiée | `git checkout -b feat/ux-multilabel-3canaux` | branche créée, basée sur `main` à jour | ⏳ | |
| P2 | Toolchain front présente | `cd frontend && node_modules/.bin/tsc --version && node_modules/.bin/vitest --version` | versions affichées (pas d'install manquante) | ⏳ | |
| P3 | venv backend pour le gate | `ls backend/.venv/bin/python` | binaire présent (sinon gate pytest sauté par `deploy-claire.sh`) | ⏳ | |
| P4 | Env de test pytest | env conda `claire` actif (cf. mémoire `env-dev-test-backend`) | `python -m pytest --collect-only` ne casse pas | ⏳ | |
| P5 | Secret pour le deploy | `DJANGO_SECRET_KEY` exportable (valeur factice OK en pré-build) | variable disponible au lancement | ⏳ | |

---

## 2. Implémentation — ordre des lots (bottom-up, testable à chaque palier)

> Chaque lot est *atomique* et **vert avant le suivant** (`tsc --noEmit` + `vitest run` ciblé).
> On remonte du noyau pur vers les surfaces UI pour garder un feedback rapide et un blast radius minimal.

### Lot A — Noyau pur `validationDisplay.ts`

| # | Action | Critère de succès | Statut | Preuve |
| --- | --- | --- | --- | --- |
| A1 | Créer `frontend/src/lib/validationDisplay.ts` (module **pur**, sans React, sans store) | exporte les contrats du §3 ; aucun import UI | ⏳ | |
| A2 | Implémenter `deriveValidation(clause): ValidationView` (3 types + état couleur + glyphe) | priorité moteur > pré-annotation > manuel ; non-validé → `pending` | ⏳ | |
| A3 | Implémenter `secondaryCount(themes): number` | compte les `secondary`, exclut le primaire et les refuges | ⏳ | |
| A4 | Tests unitaires `validationDisplay.test.ts` (table-driven) | couvre les 3 types, validé/à-valider, 0/1/N secondaires, refuge ignoré | ⏳ | |
| A5 | Gate ciblé | `cd frontend && node_modules/.bin/vitest run src/lib/validationDisplay` vert | ⏳ | |

**Matrice de décision à figer dans le test A4 :**

| triageLevel | seededFrom | validated | Type | Glyphe | Couleur état |
| --- | --- | --- | --- | --- | --- |
| renseigné | — | true | moteur | ⚡ + `Cx` | emerald |
| renseigné | — | false | moteur | ⚡ + `Cx` | amber |
| — | renseigné | true | pré-annotation | ★ | emerald |
| — | renseigné | false | manuel¹ | ✎ | amber |
| — | — | true | manuel | ✎ | emerald |
| — | — | false | (à valider) | ◷ | amber |

> ¹ Règle de bordure à **trancher et figer dans le test** : pré-annotation = `seededFrom && validated`.
> Une graine non encore validée n'est PAS « pré-annotation validée » → retombe en manuel/à-valider.
> Verrouiller ce choix dans A4 avant d'écrire l'UI.

### Lot B — Présentationnel `ProvenanceMark.tsx`

| # | Action | Critère de succès | Statut | Preuve |
| --- | --- | --- | --- | --- |
| B1 | Créer `frontend/src/components/ui/ProvenanceMark.tsx` | props `{ view: ValidationView; size?; withLabel? }` ; **100% présentationnel** | ⏳ | |
| B2 | Rendu glyphe + couleur + `aria-label` + `title` (tooltip lisible) | accessible (role/label), pas de couleur seule | ⏳ | |
| B3 | Tests `ProvenanceMark.test.tsx` (rendu par type, a11y label) | snapshot/queries vertes pour les 3 types + état pending | ⏳ | |

### Lot C — `ClauseChip` (plan / TocPanel)

| # | Action | Critère de succès | Statut | Preuve |
| --- | --- | --- | --- | --- |
| C1 | Brancher `ClauseChip.tsx` sur `deriveValidation` + `ProvenanceMark` | remplace l'inline ✓/◷, conserve le thème primaire | ⏳ | |
| C2 | Badge multi-label `+N` = `secondaryCount(themes)` (masqué si 0) | `+N` affiché ssi secondaires > 0 | ⏳ | |
| C3 | Vérifier consommation dans `TocPanel.tsx` (pas de régression de layout) | rendu plan inchangé hors badge/mark | ⏳ | |
| C4 | Tests `ClauseChip.test.tsx` mis à jour | cas mono (pas de `+N`), multi (`+N`), 3 provenances | ⏳ | |

### Lot D — Éditeur multi-label `InspectorPanel`

| # | Action | Critère de succès | Statut | Preuve |
| --- | --- | --- | --- | --- |
| D1 | Action store `setClauseThemes(localId, themes: ThemeTag[])` | 1 seul primaire ; refuge jamais secondaire ; `theme` scalaire = primaire ; **push undo** ; `dirty` | ⏳ | |
| D2 | UI : chip primaire + chips secondaires (pointillé, retirables) | retrait d'un secondaire = appel store, feedback < 200 ms | ⏳ | |
| D3 | « + thème secondaire » → `ThemePalette` (refuges **exclus** de la liste) | impossible d'ajouter un refuge en secondaire | ⏳ | |
| D4 | Toggle **Mono / Multi** (réversible) | Mono→Multi conserve le primaire ; Multi→Mono retire les secondaires (via store, undo-able) | ⏳ | |
| D5 | `swap-primary` : promotion d'un secondaire en primaire | appel `POST /clauses/{id}/swap-primary` ou recomposition `themes[]` selon contrat existant | ⏳ | |
| D6 | Tests store `setClauseThemes` (invariants) | INV refuge≠secondaire, 1 primaire, undo/redo restaure l'état exact | ⏳ | |
| D7 | Tests composant inspecteur (ajout/retrait/toggle) | interactions vertes, dirty marqué, autosave déclenché | ⏳ | |

### Lot E — Intégration autosave / persistance (vérif, pas de réécriture)

| # | Action | Critère de succès | Statut | Preuve |
| --- | --- | --- | --- | --- |
| E1 | Vérifier que l'autosave PATCH `/clauses` envoie bien `themes[]` | `sameFields` compare `themesKey` ; pas de PATCH spurieux | ⏳ | |
| E2 | Vérifier round-trip MSW (handler PATCH /clauses) | mock renvoie `themes` modifiés, store réconcilie sans flicker | ⏳ | |
| E3 | Test bout-en-bout léger (vitest + MSW) édition → PATCH → réconciliation | 1 seul PATCH par changement effectif, payload correct | ⏳ | |

### Lot F — Réversibilité globale (undo/redo)

| # | Action | Critère de succès | Statut | Preuve |
| --- | --- | --- | --- | --- |
| F1 | `setClauseThemes` + toggle s'inscrivent dans la pile undo globale | Ctrl+Z restaure l'état des thèmes exact (primaire + secondaires) | ⏳ | |
| F2 | Test undo/redo transactionnel (ajout secondaire → undo → état initial) | aucune fuite d'état, dirty cohérent | ⏳ | |

---

## 3. Contrats de types (référence pour l'implémentation, pas de code complet)

```ts
// frontend/src/lib/validationDisplay.ts — SIGNATURES
type ValidationKind = 'engine' | 'preannotation' | 'manual';
type ValidationState = 'validated' | 'pending';

interface ValidationView {
  kind: ValidationKind;
  state: ValidationState;
  glyph: '⚡' | '★' | '✎' | '◷';
  triageCode?: string;          // « C1 »…« C5 », présent si kind === 'engine'
  tone: 'emerald' | 'amber';    // dérivé de state (validated→emerald, pending→amber)
  label: string;                // texte a11y / tooltip (FR)
}

declare function deriveValidation(clause: ClauseLike): ValidationView;
declare function secondaryCount(themes: ThemeTag[] | undefined): number;
```

```ts
// Entrée minimale attendue (sous-ensemble du type Clause réel) :
interface ClauseLike {
  triageLevel?: string | null;
  seededFrom?: string | null;
  resolvedFrom?: string | null;
  validated?: boolean;
  themes?: ThemeTag[];          // { tag, role: 'primary' | 'secondary', isRefuge? }
  theme?: string | null;        // legacy scalaire = primaire
}
```

> **Contrat dur** : `deriveValidation` est **total** (pas d'exception, pas de `undefined`
> de retour). Une clause vide/non-validée renvoie `{ kind:'manual', state:'pending', glyph:'◷', tone:'amber' }`.

---

## 4. Gate qualité local (OBLIGATOIRE avant push)

> Le gate reproduit exactement ce que fait `deploy/deploy-claire.sh` étape `[1/4]`.
> On le lance **à la main** d'abord pour itérer vite, puis le deploy le rejoue.

| # | Action | Commande | Critère de succès | Statut | Preuve |
| --- | --- | --- | --- | --- | --- |
| G1 | Typecheck front | `cd frontend && node_modules/.bin/tsc --noEmit` | sortie vide, exit 0 | ⏳ | |
| G2 | Tests front complets | `cd frontend && node_modules/.bin/vitest run` | tous verts, exit 0 | ⏳ | |
| G3 | Tests backend (non-régression PATCH/swap-primary) | `cd backend && .venv/bin/python -m pytest -p no:warnings -q` | tous verts, exit 0 | ⏳ | |
| G4 | Lint (si configuré) | `cd frontend && npm run lint` | exit 0 (ou justifier warnings) | ⏳ | |

**Règle de blocage** : si G1/G2/G3 ≠ exit 0 → **ne pas pousser**. Corriger, re-gater.

---

## 5. Déploiement `pactiva.legal`

> Flux du script (`deploy/deploy-claire.sh`) : **gate tests → git push → VPS pull →
> backend migrate/collectstatic + front build → restart 2 services → healthcheck →
> rollback auto si health ≠ 200**. Ici **aucune migration** n'est attendue (provenance dérivée).

| # | Action | Commande | Critère de succès | Statut | Preuve |
| --- | --- | --- | --- | --- | --- |
| D0 | Relire le diff avant commit | `git diff --stat` | uniquement les fichiers prévus (lib, ui, workspace, tests, doc) | ⏳ | |
| D1 | Commit | message conventionnel `feat(ux): système 3-canaux multi-label (provenance dérivée)` | commit créé sur la branche | ⏳ | |
| D2 | Noter le SHA prod courant (rollback ref) | le script l'affiche : `▶ SHA VPS courant : …` | SHA capturé | ⏳ | |
| D3 | Lancer le déploiement (gate + push + build + health) | `DJANGO_SECRET_KEY=x ./deploy/deploy-claire.sh` | sortie finale `✓ Déploiement OK … (health 200)` | ⏳ | |
| D4 | Vérif health post-deploy | `curl -s -o /dev/null -w '%{http_code}' https://pactiva.legal/api/v1/health` | `200` | ⏳ | |
| D5 | Smoke test UI prod | ouvrir un projet, surface plan + inspecteur | chips affichent ⚡/★/✎/◷ + `+N` ; éditeur multi-label fonctionne | ⏳ | |

> Variante sans re-gate (si gate déjà vert juste avant) : `DJANGO_SECRET_KEY=x ./deploy/deploy-claire.sh --no-tests`.
> À n'utiliser que si G1–G3 viennent de passer sur le **même** arbre de travail.

---

## 6. Critères de succès (Definition of Done)

- [ ] `validationDisplay.ts` est la **source unique** : aucune surface ne recompose la provenance à la main (grep : pas de logique triage/seeded dispersée dans les composants).
- [ ] `ClauseChip` affiche `ProvenanceMark` (3 types) + `+N` ; `InspectorPanel` permet ajout/retrait de secondaires + toggle Mono/Multi.
- [ ] Invariants respectés : 1 primaire, **refuge jamais secondaire**, INV-2 inchangé.
- [ ] Undo/redo restaure l'état exact des thèmes ; feedback UI < 200 ms.
- [ ] Autosave : **1 seul PATCH `/clauses`** par changement effectif (pas de PATCH spurieux via `sameFields`/`themesKey`).
- [ ] Gate vert : `tsc --noEmit` + `vitest run` + `pytest` (0 nouvelle régression).
- [ ] Prod : `health 200`, smoke test UI OK sur `pactiva.legal`.
- [ ] **Aucune migration** appliquée (vérifier l'absence de `migrate` produisant des changements).

---

## 7. Procédure de rollback

### 7.1 Rollback automatique (intégré au script)
Si le healthcheck ≠ 200 après build/restart, `deploy-claire.sh` exécute déjà :
`git reset --hard <PREV_SHA>` → `migrate` → `front build` → `restart` puis **abandonne** (`exit 1`).
→ Action : lire la sortie, confirmer `↩ rollback effectué`, vérifier `D4` = 200 sur l'ancien SHA.

### 7.2 Rollback manuel (si auto insuffisant ou régression UI non bloquante côté health)

| # | Action | Commande | Statut | Preuve |
| --- | --- | --- | --- | --- |
| R1 | Récupérer le SHA précédent | celui noté en `D2` (`PREV_SHA`) | ⏳ | |
| R2 | Revert front + reset VPS | `ssh <VPS> "cd /var/www/claire-studio && git reset --hard <PREV_SHA>"` | ⏳ | |
| R3 | Rebuild + restart | `ssh <VPS> "cd /var/www/claire-studio/frontend && npm run build && systemctl restart claire-studio claire-studio-web"` | ⏳ | |
| R4 | Vérif health | `curl -s -o /dev/null -w '%{http_code}' https://pactiva.legal/api/v1/health` = 200 | ⏳ | |
| R5 | Revert local + push | `git revert <SHA_feature>` puis re-deploy propre | ⏳ | |

> **Risque rollback faible** : aucune migration → pas de schéma à défaire. Le rollback est
> purement *code + build* (front/back), donc réversible sans perte de données.

---

## 8. Pièges connus (rappel mémoire prod / OLS)

- Le gate `pytest` est **sauté** si `backend/.venv/bin/python` absent (cf. script `[1/4]`) — vérifier P3.
- `DJANGO_SECRET_KEY` requis au lancement même en pré-build local — passer `DJANGO_SECRET_KEY=x` devant la commande.
- WebSocket / OpenLiteSpeed : ne pas toucher au vhost ici (changement purement front/back applicatif).
- Daphne peut mettre quelques secondes : le healthcheck boucle 10× (3 s) — un `health=000/502` transitoire n'est pas un échec tant que la boucle n'a pas épuisé ses essais.
- Commandes réseau côté agent (SSH/curl prod) : `dangerouslyDisableSandbox`.

---

## 9. Journal d'exécution (à remplir par l'agent principal)

| Horodatage | Étape | Statut | Note / preuve |
| --- | --- | --- | --- |
| | | ⏳ | |
