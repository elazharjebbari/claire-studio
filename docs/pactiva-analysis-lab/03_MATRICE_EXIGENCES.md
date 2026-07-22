# Matrice de couverture des exigences

Cette matrice transforme les intentions en éléments contrôlables. « Couvert » signifie documenté ;
la garantie effective n’existera qu’après implémentation et passage des gates associés.

| Axe demandé            | Décision/livrable                                    | Preuve attendue à l’implémentation     | Document            |
| ---------------------- | ---------------------------------------------------- | -------------------------------------- | ------------------- |
| UI/interface           | shell, context bar, rail, guide, KPI, table, cases   | tests composants + E2E                 | UI/UX, frontend     |
| UX/ergonomie           | question→support→cas→action, divulgation progressive | tests parcours et utilisateurs         | produit, UI/UX      |
| design/graphisme/style | tokens Pactiva, navy/or, sobriété, clair/sombre      | color gate + régression visuelle       | UI/UX               |
| accessibilité          | WCAG 2.2 AA, clavier, table alternative              | axe + Playwright + audit manuel        | UI/UX, qualité      |
| frontend               | feature boundary, URL, Query, registry               | typecheck, Vitest, budgets bundle      | frontend            |
| backend                | `claire.analysis`, services/selectors/calculators    | Ruff, pytest, règles dépendance        | backend             |
| DB                     | runs/manifests/artifacts/cases, indexes mesurés      | migration check + explain + backup     | database            |
| API                    | namespace, DTO, problems typés, versions             | OpenAPI + contract tests N/N-1         | API                 |
| statistiques           | catalogue versionné, supports et cas dégénérés       | références indépendantes + properties  | metrics             |
| multi-annotations      | six modes, projection à provenance stricte           | fixtures human/LLM/reviewer/Gold       | produit, diagrammes |
| rapports               | job durable, manifeste, checksum, PDF privé          | tests PDF et permissions               | reports             |
| modularité             | registres et ports d’infrastructure                  | ajout plugin sans modifier le cœur     | backend/frontend    |
| évolutivité            | monolithe modulaire extractible, artefact store      | charge + boundaries stables            | audit/backend       |
| robustesse             | idempotence, retry, cancel, heartbeat                | crash/reprise et concurrence           | qualité             |
| fiabilité/précision    | fingerprint, versions, formules explicites           | tests déterministes et audit manifeste | metrics/database    |
| optimisation           | sync/async par coût, chunks, pagination              | SLO p95, query budgets, profiling      | qualité             |
| sécurité/RGPD          | policy, pseudonymisation, support minimal            | matrice rôles + tests IDOR/DPIA        | qualité             |
| déploiement            | worker/health/migrations expand-contract             | runbook, smoke et rollback             | qualité/plan        |
| ADN Pactiva            | charte actuelle comme source unique                  | revue design et vocabulaire            | UI/UX               |

## Gates de garantie

Une release Analysis Lab ne peut être déclarée conforme que si les gates suivantes passent :

1. dépendances architecturales et contrats stables ;
2. migrations sans perte et sauvegarde validée ;
3. tests métriques contre valeurs de référence ;
4. tests permissions/isolement/pseudonymisation ;
5. tests frontend, a11y et E2E critiques ;
6. budgets SQL, mémoire, bundle et latence ;
7. crash/reprise/idempotence des workers ;
8. manifeste reproductible et détection stale ;
9. PDF privé, checksumé et expirant ;
10. revue visuelle conforme à la charte Pactiva.
