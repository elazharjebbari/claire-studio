# Plan d'action & couverture — batterie multi-annotation

## Suites livrées (toutes vertes)
| Suite | Fichier | Cas | Couvre |
|---|---|---|---|
| Invariants intégration | `backend/tests/test_multi_annotation_battery.py` | 10 tests | INV‑4, OWN, READ, IDEM, 2, COLLAB, DOC‑UNIQUE, VER, FSM, IAA, STATS, LOSS |
| Simulation de campagne | `backend/tests/test_campaign_simulation.py` | 12 seeds × ~140 ops ≈ **1700 opérations** réconciliées | LOSS, READ, OWN, IDEM, 2, 4 (en continu) |
| Property IAA | idem (hypothesis) | **700 exemples** (300+400) | κ borné, identité, symétrie |
| Export async | `backend/tests/test_export_async.py` | 5 tests | EXPORT (202, failed persistant, retry, self‑heal, download gated) |
| Isolation store (front) | `frontend/tests/multiSessionStore.test.ts` | 3 tests | READ/OWN côté client (reset, readOnly no‑op) |
| Anti‑duplication (front) | `frontend/tests/documentList.test.tsx` | 2 tests | DOC‑UNIQUE |
| E2E multi‑utilisateur | `frontend/e2e/multi-annotation.spec.ts`, `no-duplicate-documents.spec.ts` | 4 tests | bannière session, matrice supervision, 0 doublon |

Total exécuté : **backend 158 tests** (dont ~1700 ops simulées + 700 ex. property) · **frontend 208 tests**.

## Ordre d'exécution
1. Backend invariants + simulation + property + export (gate bloquant).
2. Frontend `tsc` + `vitest` (gate bloquant).
3. E2E Playwright (mode MSW) — non bloquant pour le déploiement, exécuté en validation manuelle/CI.

## Critères « GO campagne »
- [x] Backend 158/158, frontend 208/208, `tsc` vert.
- [x] Simulation : réconciliation à chaque pas sur 12 seeds (zéro perte/écart/fuite).
- [x] Tous les invariants `01-invariants.md` couverts (mapping `02-scenarios.csv`).
- [ ] (optionnel) `--hypothesis-seed` étendu (`max_examples=1000`) en pré‑campagne.
- [ ] (optionnel) E2E Playwright exécutés sur navigateur réel.

## Gestion des échecs
- Property/simulation → hypothesis fournit un **contre‑exemple minimal** ; reproduire
  avec le `seed` imprimé, corriger l'invariant, re‑run.
- Un invariant cassé = **NO‑GO** : on ne lance pas la campagne tant qu'il n'est pas vert.

## Renforcements futurs (hors périmètre, faible priorité)
- Concurrence réelle (threads/process simultanés sur Postgres) en plus de l'interleaving séquentiel.
- Tests de charge (50 docs × 3 annotateurs × N clauses) + budget de requêtes (N+1).
- E2E 3 navigateurs simultanés (contextes Playwright isolés) avec vrais JWT.
