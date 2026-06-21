# 05 — Plan de tests

> Stratégie et cas de tests pour l'intégration de Mistral. Les cas détaillés (≥ 20)
> sont dans `05-cas-de-tests.csv`. Objectif double : **verrouiller** le comportement
> Mistral **et prouver la non-régression** de Claude/Codex (dont le mode compare,
> resté pairwise).

## 1. Pyramide & outils

```
        ▲  Playwright (e2e)        parcours réels : réglette 3 pistes, prefill Mistral
        │  ──────────────         + non-régression compare (pairwise)
        │  MSW + vitest (intégration UI)  hook preByJudge, réglette, ghosts, menu
        │  ──────────────
        │  vitest (unitaire)       llmJudges, themeByIndex, divergence (pairwise)
        ▼  pytest (backend)        enum, import idempotent, normalize_v92, API ?judge=
```

| Outil | Périmètre | Commande |
|-------|-----------|----------|
| pytest | backend (enum, import, loaders, API) | `cd backend && pytest -q` |
| vitest | front unitaire + intégration (jsdom + MSW) | `cd frontend && npm run test` |
| MSW | mock HTTP des handlers preannotations | (via vitest / dev) |
| Playwright | parcours e2e bout-en-bout | `cd frontend && npm run e2e` |
| tsc | typage (garde-fou compat) | `cd frontend && npm run typecheck` |

## 2. Principes

1. **Non-régression d'abord** : la suite claude/codex existante (vitest + e2e
   `llm-compare.spec.ts`, `prefill.spec.ts`) doit rester **verte sans modification**
   (hors ajout de cas).
2. **Idempotence prouvée** : tout test d'import vérifie le **re-run sans doublon**.
3. **État « absence »** testé explicitement (piste Mistral **grisée**, pas masquée).
4. **Data-driven** : testids générés `…-${judge.id}` → les testids claude/codex
   restent stables, ceux de Mistral apparaissent « gratuitement ».
5. **Compat hook** : test que `useLlmAgreement` expose **à la fois** `preByJudge` et
   `claudePre/codexPre`.

## 3. Données de test

- **Backend** : payload Mistral v9.2 réaliste (`document_plan.segments[*]` =
  `{start_id, theme, rationale, evidence_span}`), p. ex. extrait de
  `data/preannotations/mistral/Fitbit_mistral.json`. Écrit en `tmp_path/mistral/<ext>_mistral.json`.
- **Frontend (MSW)** : `FIXTURE_PREANNOTATION_MISTRAL` ajouté à `FIXTURE_PREANNOTATIONS`
  (`frontend/src/mocks/fixtures.ts`) — `judge:"mistral"`, `schemaVersion:"v9.2"`, clauses
  cohérentes avec le doc `doc-fitbit` ; **+ un doc sans entrée Mistral** pour tester
  l'absence (réutiliser un doc existant non couvert).
- Handlers `handlers.ts` **inchangés** (itèrent la fixture) — on vérifie seulement que
  `?judge=mistral` renvoie la fixture, et `[]` pour un doc non couvert.

## 4. Couverture par lot

| Lot | Tests clés | Réf cas CSV |
|-----|-----------|-------------|
| L0 | enum, import idempotent, normalize v9.2, GET `?judge=mistral` | TC-01..TC-06 |
| L1 | `llmJudges` config, hook `preByJudge` + compat | TC-07..TC-10 |
| L2 | réglette 3 pistes, piste vide grisée, tooltip, toggle | TC-11..TC-15 |
| L3 | ghostJudges, prefill Mistral, menu Mistral, switch, resolvedFrom | TC-16..TC-22 |
| L4/L5 | e2e réglette 3 pistes, e2e prefill Mistral, non-régression compare, smoke | TC-23..TC-27 |

## 5. Critères de sortie (gate de livraison)

- `pytest -q` : **vert** (dont nouveau cas import `mistral/` idempotent).
- `npm run typecheck` : **vert** (compat hook prouvée par compilation).
- `npm run test` (vitest) : **vert**, dont réglette 3 pistes + ghostJudges + prefill
  Mistral.
- `npm run e2e` (Playwright) : **vert**, dont `prefill-mistral`, réglette 3 pistes, et
  `llm-compare.spec.ts` **inchangé** (garde-fou pairwise).
- Aucune nouvelle occurrence littérale `"claude"/"codex"` hors `lib/llmJudges.ts` et
  fichiers de test (revue manuelle / grep).

## 6. Risques de test & parades

| Risque | Parade |
|--------|--------|
| E2E instables (timing réglette/tooltip) | réutiliser les sélecteurs/patterns de `llm-compare.spec.ts` ; attendre testids |
| Faux « vert » (Mistral jamais rendu) | TC-11 vérifie explicitement la **présence** de la 3ᵉ piste + testid `gutter-cell-mistral-*` |
| Régression silencieuse compare | rejouer `llm-compare.spec.ts` **sans le modifier** |
| Idempotence non vérifiée | TC-02 ré-exécute l'import et compte les lignes (égalité stricte) |
| Couleur/daltonisme non testable auto | revue manuelle a11y + assertion que l'info = lettre + label (pas couleur) |

## 7. Cas de tests

Voir `05-cas-de-tests.csv` (27 cas : pytest, vitest, MSW, Playwright). Colonnes :
`id, niveau, périmètre, titre, préconditions, étapes, attendu`.
