# Plan de tests

## Niveaux
- **vitest (unit/logique)** : filtre `mine` (assignments → mes assignations, dédup 1/doc),
  garde mocks prod, helpers d'ouverture de session.
- **MSW (intégration front)** : handler `/projects/:slug/assignments` renvoyant l'**union**
  (3 annotateurs) → le composant n'affiche que les miennes ; handler `/members` réel.
- **playwright (e2e)** : sélecteur de documents ne montre plus de doublon ; clic → `/annotate`
  de MA session (bannière « Ma session »).
- **pytest (backend)** : isolation (A n'édite pas l'annotation de B → 403) ; submit isolé ;
  IAA pairwise (κ par paire) ; export contient `annotator` + scope annotateur ; progress admin.

## Cas (voir 04-test-cases.csv)
Couvre F1–F12. Priorité Lot1 = T01..T06.

## Données de test
- Fixture MSW : 1 document, 3 assignations (alice/bob/me) → l'UI ne doit afficher que « me ».
- Backend pytest : projet à 3 annotateurs, 2 documents, clauses par phrase divergentes →
  κ pairwise calculable, export 3 annotateurs.
