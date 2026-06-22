# Plan d'action — exécution

## Lot 1 — Débloquer la campagne (fait + déployé)
Objectif : que jc.lamirel & zahra annotent proprement, chacun sa session, sans triple ni ambiguïté.

1. **Filtrer les listes par l'utilisateur courant** (F1/F2/F3) — `DocumentSwitcher`,
   `projects/[slug]/page.tsx`, `projects/[slug]/docs/page.tsx` : ne garder que
   `assigneeId === me.id` (dédup 1/doc = ma session). Réutilise le pattern `/work`.
2. **Ouvrir toujours MA session** (F4) — au clic d'un document, `createAnnotation({project,
   document: externalId})` puis `/annotate/{id}` (au lieu de `assignment.annotationId`).
3. **Supprimer « Bruno » codé en dur** (F5) — `admin/users/page.tsx` branché sur la liste
   réelle (membres) ou neutralisé.
4. **Interdire les mocks en production** (F6) — garde `NODE_ENV !== "production"` dans `env.ts`.
5. **Vérifs prod** (F11) — login des 3 comptes (fait : 200), smoke d'annotation.

Tests : vitest (filtre `mine`, dédup), build, e2e ciblé ; deploy + smoke.

## Lot 2 — Robustesse recherche & supervision
6. **IAA `per_theme`/`boundary` N≥3** (F7) — moyenner les κ par paire (corrige le double‑comptage) ; test pytest.
7. **Export scope annotateur** (F8) — `scope.annotators` optionnel ; test pytest.
8. **Vue « sessions par annotateur »** (F12) — table admin (assigned/started/submitted + lien œil
   lecture seule vers chaque session) ; clarifie collaboration vs solo.
9. **Hygiène prod** (F10) — désactiver/supprimer comptes démo `@claire.local` + projet démo
   (sur validation explicite — donnée prod).
10. **Formats d'export** (F9) — implémenter conll/md ou les masquer dans l'UI.

## Critères d'acceptation
- Un annotateur voit **50** documents (pas 150), chacun ouvrant **sa** session.
- L'admin voit l'avancement des 3 + peut ouvrir chaque session **en lecture seule** (icône).
- Soumettre un document le persiste (`submitted` + snapshot) isolément.
- Export projet inclut les 3 annotateurs ; IAA pairwise correct.
- Aucune donnée de démo visible (Bruno/Alice) en prod.
