# Qualité, sécurité, robustesse, performance et tests

## Sécurité et confidentialité

- deny by default et contrôle objet projet sur chaque endpoint ;
- rôle global + membership projet + finalité de l’action ;
- identité pseudonymisée par défaut hors vue personnelle/admin autorisée ;
- seuil de support configurable pour réduire ré-identification et conclusions instables ;
- texte, evidence et rationale exclus des agrégats/logs ; export d’exemples sur opt-in ;
- liens de téléchargement courts, signés, usage contrôlé, artefacts privés ;
- validation stricte des filtres et bornes de pagination/calcul ;
- protection CSRF/JWT existante, rate limits sur création de runs/rapports ;
- audit : création, annulation, téléchargement, changement de visibilité et action métier.

Une revue DPIA/RGPD doit définir finalité, destinataires, rétention et droit d’accès avant toute vue
nominative. Le produit ne doit pas devenir un outil RH implicite.

## Robustesse des jobs

Création transactionnelle, idempotency key, contrainte d’unicité, heartbeat, timeout, retry borné et
état terminal persistant. Un worker ne publie un artefact qu’après écriture atomique et checksum.
Les étapes sont relançables. Le passage `succeeded` intervient après validation du schéma de sortie.
Un run échoué n’efface jamais le dernier run réussi.

## Objectifs de service initiaux

| Action                | Cible p95 | Comportement au-delà         |
| --------------------- | --------: | ---------------------------- |
| preview périmètre     |    500 ms | réponse bornée/avertissement |
| agrégat léger         |       2 s | bascule async                |
| liste paginée         |    800 ms | index/profilage              |
| run standard          |      60 s | progression + job            |
| rapport               |     120 s | job durable                  |
| interaction UI locale |    100 ms | profiler rendu               |

Les seuils de passage async combinent estimation d’unités, acteurs, complexité de métrique et mesure
historique. Ils sont configurables, pas codés dans les vues.

## Observabilité

Métriques : durée par calculator/version, files et ancienneté des jobs, taux d’échec/retry/cancel,
cache hit, taille des périmètres/artefacts, requêtes DB, stale runs, PDF. Logs structurés : requestId,
runId, projectId, metric code/version, étape et code d’erreur — jamais texte contractuel, rationale,
JWT ou identité nominative. Traces entre API, worker et stockage. Alertes sur queue bloquée, taux
d’échec, disque, run orphelin et health worker.

## Pyramide de tests

### Unitaires

Calculators purs, canonicalisation/fingerprint, permissions, transitions de jobs, mappers et
formatters. Jeux déterministes, property-based pour invariants statistiques.

### Intégration backend

ORM/adapters, isolation projet, statuts, versions, idempotence, concurrence, migrations,
ArtifactStore, worker eager et budgets de requêtes.

### Contrats

OpenAPI/exemples, serializers, camelCase, validation frontend et compatibilité N/N-1.

### Frontend

Composants, URL, états, accessibilité, table fallback, drill-down, erreurs et reprise de polling.

### E2E

1. individuel personnel ; 2. inter-humains pseudonymisé ; 3. humain–LLM ; 4. cas de désaccord ;
2. stale après changement ; 6. annulation/retry ; 7. rapport ; 8. matrice des permissions.

### Non fonctionnels

Tests de charge sur volumes réalistes, concurrence de runs, crash/reprise worker, expiration disque,
sécurité IDOR, export confidentiel, a11y et régression visuelle. Aucun test de production n’utilise
PostgreSQL prod : configuration SQLite/PostgreSQL de test dédiée.

## Gates CI/CD

Ruff + format + typecheck Python, migrations check, pytest, lint/typecheck/Vitest, contrats, build
Next, E2E critique, scan dépendances/secrets et vérification des couleurs. Migration revue avec SQL,
sauvegarde avant déploiement, déploiement SHA exact, migrate, build, restart, health API/frontend/
worker, smokes lecture seule et rollback code. Les migrations destructives utilisent expand/
contract sur au moins deux releases.

## Critères d’acceptation

- ajout d’une métrique sans modifier les pages ni le dispatcher central ;
- ajout d’un renderer sans changer les contrats métier ;
- mêmes sources/configurations/versions = même fingerprint et résultat ;
- aucune fuite inter-projet ou d’identité ;
- support et avertissements visibles partout ;
- run concurrent identique dédupliqué ;
- crash worker récupérable ;
- toute visualisation utilisable au clavier via sa table ;
- DB source inchangée par les calculs ;
- tous les budgets et tests ci-dessus verts.
