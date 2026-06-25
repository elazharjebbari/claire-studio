# Stratégie de tests

## Pyramide

Base large : tests purs Vitest sur stores/lib (la majorité des ~470 tests — logique métier sans DOM, rapides, déterministes). Milieu : composants Testing Library + MSW Node pour les fondations réutilisées (Button, Disclosure, chip, accordéon) et l'intégration React Query. Sommet étroit : Playwright pour les flux critiques et l'a11y AA (axe) en conditions réelles avec MSW navigateur. Règle : toute fondation transverse (Button, Disclosure, helper contraste, registre raccourcis, garde anti-hex) est couverte au niveau le plus bas possible + un test E2E de bout en bout. La garde anti-hex tourne en CI (lint/script) comme un test à part entière.

## MSW (mocks réseau)

MSW comme couche réseau unique partagée unit↔E2E. Handlers Node (src/mocks/server.ts + handlers.ts avec resetDb entre tests, déjà câblé dans tests/setup.ts) pour les tests composants qui touchent React Query (annotation, document, scheme, /me, pré-annotations, lock/unlock, PATCH clauses). Handlers navigateur (src/mocks/browser.ts) activés en E2E via NEXT_PUBLIC_ENABLE_MOCKS=true (front MVP autonome, déjà dans playwright.config). Étendre fixtures.ts pour les nouveaux scénarios des lots (prefs layout serveur, états de bouton pending/erreur via réponses lentes/500, arbitrage C1→C5). Toujours onUnhandledRequest:'bypass'.

## Vitest (unitaire + composant)

Cible primaire : logique PURE et composants UI isolés. Tests purs sur stores (workspaceStore.test.ts, prefsStore.test.ts) et lib (tokens, triageEngine, planCoverage, concordance) — invariants miroir theme↔themes, sanitize, undo/redo atomique, readableTextColor AA, idempotence prefs. Tests composants (Testing Library + jsdom) pour les fondations : matrice d'états <Button> (pending non recliquable, success/error transitoires, aria-pressed), <Disclosure> (aria-expanded/controls, clavier), badge 'N actifs', accordéon inspecteur, chip icône-monochrome. Coverage déjà ciblé src/lib + src/store + src/components/ui. Tous les nouveaux composants interactifs portent un data-testid stable.

## Playwright (E2E + a11y)

E2E sur les parcours bout-en-bout et la non-régression a11y (@axe-core/playwright, e2e/a11y.spec.ts). Couvre : cadre dock (repli bilatéral en rail, plancher de lecture, drawers overlay, persistance layout par compte au rechargement), mode rafale clavier-first (valider+suivant, adoption 1/2, modale '?'), menu express, arbitrage C1→C5 révélé à la demande, feedback de bouton sur Soumettre (pending→succès) sous MSW lent. Réutiliser/étendre les ~28 specs existants (annotate, document-ux, triage, unfairness-overlay, sync-toc). baseURL localhost:3001, axe sur chaque écran clé.
