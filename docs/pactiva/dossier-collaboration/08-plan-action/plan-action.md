# Plan d'action — Sessions vs Collaboration (ADR-001)

> État au 2026-06-22. Les lots marqués ✅ sont **implémentés et testés** dans cette
> itération (backend 125/125 pytest, frontend 186/186 vitest, `tsc` vert). Les lots
> 🔜 sont planifiés et priorisés.

## Lot 1 — Supprimer la duplication & nommer la session ✅ (FAIT)

| # | Action | Fichiers | Statut |
|---|---|---|---|
| 1 | Endpoint document-centré `GET /projects/{slug}/documents` (1 ligne/doc, `mySession`, `sessions[]` admin) | `backend/claire/projects/views.py` | ✅ |
| 2 | Type `ProjectDocument`/`SessionRollup` + endpoint + hook `useProjectDocuments` (dédup défensive) | `frontend/src/types/contract.ts`, `lib/api/{endpoints,hooks}.ts` | ✅ |
| 3 | `DocumentSwitcher` → `useProjectDocuments({mine})` + ouverture via `createAnnotation` | `frontend/src/components/workspace/DocumentSwitcher.tsx` | ✅ |
| 4 | Dashboard projet + `docs` page → « Ma session » (1/doc) + `createAnnotation` | `frontend/src/app/(app)/projects/[slug]/{page,docs/page}.tsx` | ✅ |
| 5 | `admin/users` : suppression du « Bruno » codé en dur (données réelles) | `frontend/src/app/(app)/admin/users/page.tsx` | ✅ |
| 6 | Garde « mocks OFF en production » | `frontend/src/lib/env.ts` | ✅ |
| 7 | Handler MSW `/projects/:slug/documents` (démo + tests) | `frontend/src/mocks/handlers.ts` | ✅ |

**Critères d'acceptation Lot 1** — tous vérifiés par tests :
- Un annotateur voit **1 entrée par document** (jamais l'union des assignations).
- Cliquer « Annoter » ouvre **toujours MA** session (`createAnnotation`).
- `tests/documentList.test.tsx` : dédup du hook + unicité des options du switcher.
- `tests/test_sessions_documents.py` : endpoint renvoie 1 ligne/doc, `mySession` correct.

## Lot 2 — Robustesse recherche, exports & supervision ✅ (FAIT)

| # | Action | Fichiers | Statut |
|---|---|---|---|
| 8 | IAA `per_theme`/`boundary` N≥3 : moyenne des κ par paire (fin du double-comptage) | `backend/claire/projects/iaa.py` | ✅ |
| 9 | Export `scope.annotators` (export par session/annotateur) | `backend/claire/exports/services.py` | ✅ |
| 10 | Manifeste `format_requested`/`format_effective`/`warnings` (fin du repli silencieux) + format `md` | `backend/claire/exports/services.py` | ✅ |
| 11 | Export `iaa_matrix` (CSV de concordance) | `backend/claire/exports/{services,models}.py` | ✅ |
| 12 | `build_snapshot` enrichi : `source`, `validated`, `order`, `updated_at` (zéro perte d'info) | `backend/claire/annotations/services.py` | ✅ |
| 13 | Endpoint `/exports/{id}/download` (FileResponse, confiné `EXPORTS_DIR`) | `backend/claire/exports/views.py` | ✅ |

## Lot 3 — Isolation & indépendance (sécurité) ✅ (FAIT)

| # | Action | Fichiers | Statut |
|---|---|---|---|
| 14 | Un annotateur non-privilégié ne lit QUE ses annotations/clauses (anti-contamination IAA) | `backend/claire/annotations/views.py` | ✅ |
| 15 | `CommentViewSet` isolé par appartenance projet | `backend/claire/collaboration/views.py` | ✅ |
| 16 | `ActivityEventViewSet` isolé par appartenance projet | `backend/claire/audit/views.py` | ✅ |

> Décision de politique documentée dans `05-securite/permissions.md` : **indépendance
> d'abord** (un pair ne lit pas la session d'un autre ; admin/reviewer supervisent).
> Alternative « visibilité après soumission » notée pour arbitrage produit.

## Lot 4a/4b — Supervision & a11y ✅ (FAIT dans cette itération)

| # | Action | Fichiers | Statut |
|---|---|---|---|
| 17 | Onglet **« Suivi des sessions »** : matrice document × annotateur + icône **œil** ouvrant chaque session en **lecture seule** (supervision) | `frontend/src/app/(app)/admin/projects/[slug]/page.tsx` (SessionsTab) | ✅ |
| 18 | a11y : `role=status`/`aria-live` sur l'indicateur d'autosave | `frontend/src/components/workspace/WorkspaceToolbar.tsx` | ✅ |
| 19 | a11y : `@media (prefers-reduced-motion: reduce)` | `frontend/src/app/globals.css` | ✅ |
| 20 | Fix var CSS inexistante `--surface-line` → `--surface-border` | `DocumentPanel.tsx`, `ModelBoundaryRail.tsx` | ✅ |
| 21 | Handler MSW `/documents` enrichi (`sessions[]`/`sessionsSummary`) pour la démo/e2e | `frontend/src/mocks/handlers.ts` | ✅ |
| 22 | Bannière « Vue lecture » quand la source affichée est un juge LLM | `frontend/src/components/workspace/AnnotationWorkspace.tsx` | ✅ |
| 23 | Script thème **anti-FOUC** (bloquant, avant le 1er paint) | `frontend/src/app/layout.tsx` | ✅ |
| 24 | File de travail `/work` migrée sur `useProjectDocuments` (statut = `mySession`, fin du regroupement erroné sur `assignment.status`) | `frontend/src/app/(app)/work/page.tsx` | ✅ |
| 25 | Formats d'export **conll** + **xml** réellement implémentés (huggingface reste un repli jsonl TRACÉ) | `backend/claire/exports/services.py` | ✅ |
| 26 | Navigation **regroupée en espaces nommés** (Ma session / Corpus & projets / Collaboration) — lève l'ambiguïté | `frontend/src/components/shell/Sidebar.tsx` | ✅ |

## Lot 4c — Reste planifié 🔜 (priorisé)

| Priorité | Action | Origine (audit) |
|---|---|---|
| P1 | Export **asynchrone** (job PENDING + poll) + prefetch clauses + streaming jsonl — nécessite une file (Celery/RQ) | `export-synchronous-in-request` |
| P2 | Tokens sémantiques (StatusPill/SaveIndicator) — retrait des ~86 couleurs Tailwind en dur | `hardcoded-tailwind-state-colors` |
| P2 | Format **huggingface** réel (ou le retirer de l'UI) | `silent-format-fallback` |
| P3 | Hygiène prod : désactiver/supprimer comptes démo `@claire.local` + projet démo (**sur validation explicite**) | (audit prod) |
| P3 | `Assignment.status` synchronisé avec le statut de l'`Annotation` | `assignment-no-name` |

## Migrations

- `exports/migrations/0002_alter_exportjob_format.py` — ajout du choix `iaa_matrix`
  (champ `format`). **Sans impact schéma** (CharField), idempotent. Aucune autre
  migration (les changements de vues/services/permissions ne touchent pas le schéma).

## Risques & rollback

| Risque | Probabilité | Parade / Rollback |
|---|---|---|
| Régression duplication ailleurs | Faible | Dédup défensive dans `useProjectDocuments` + tests vitest/e2e dédiés ; rollback = `git revert` du commit front |
| Durcissement isolation casse un usage légitime | Faible | Suite pytest verte (125) + test `test_authz_isolation` mis à jour ; rollback ciblé du `get_queryset` |
| Build front KO | Faible | Gate `tsc --noEmit && vitest run` avant déploiement ; `--no-tests` interdit pour ce lot |
| Migration export | Très faible | No-op schéma ; rollback = migration inverse standard |

## Critères d'acceptation globaux (Definition of Done)

- [x] Aucune duplication de document (campagne, sélecteur) — 1 ligne/document.
- [x] « Ma session » vs « Collaboration » explicite (vocabulaire + bannières).
- [x] Export attribué par annotateur, sans perte (`validated`/`source`/`order`), téléchargeable, concordance exportable.
- [x] IAA correct pour N≥3.
- [x] Isolation des sessions (un pair ne lit pas la session d'un autre).
- [x] Tests verts (pytest 125, vitest 186, tsc).
- [ ] Déployé en prod + vérifs post-déploiement (voir `runbook.md`).
