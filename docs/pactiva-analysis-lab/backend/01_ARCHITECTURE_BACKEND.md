# Architecture backend

## Nouveau domaine

```text
backend/claire/analysis/
├── api/              # serializers, views, pagination
├── calculators/      # métriques pures
├── comparisons/      # modes et alignement des observations
├── contracts/        # dataclasses/enums/protocols
├── filters/          # validation et configuration canonique
├── migrations/
├── models.py
├── observations/     # adapters human/llm/reviewer/gold
├── reports/
├── selectors/        # ORM lecture seule
├── services/         # orchestration métier
├── tasks/            # entrypoints worker
└── tests/
```

## Règles de dépendance

`api → services → selectors/calculators/contracts`. Les calculators ne dépendent ni de DRF ni des
modèles Django. Les adapters dépendent des modèles sources mais retournent des contrats immuables.
Le domaine Analysis peut appeler les domaines sources en lecture et leurs services publics pour une
action ; il ne modifie jamais leurs tables directement.

## Observation analytique

Contrat immuable recommandé : provenance, actor type/id/version, project/document, unité et ancre,
thèmes primaire/secondaires, nature, frontière, certitude, validation, evidence disponible (booléen
ou référence autorisée), statut source et timestamps. Le texte contractuel et les rationales ne
sont chargés que pour un drill-down autorisé, pas pour les calculs globaux.

## ScopeResolver

1. valide projet, rôle, mode et compatibilité métrique ;
2. résout les documents et versions immuables ;
3. applique statuts et période dans un ordre déterministe ;
4. calcule supports et recouvrement ;
5. produit configuration canonique + source manifest + fingerprint ;
6. refuse ou avertit si le support est insuffisant.

## MetricRegistry

Chaque plugin déclare `code`, `version`, modes/unités, champs requis, paramètres, seuil de support,
coût estimé, calculator et schéma de sortie. L’enregistrement échoue au démarrage en cas de code
dupliqué ou contrat invalide. Une version de formule ne change jamais silencieusement : changement
de comportement = nouvelle version.

## Calcul et cache

Le service cherche un run `succeeded` par `(project, fingerprint, metric_manifest_hash)`. Sinon il
crée atomiquement un run unique. Les petits calculs peuvent être exécutés dans la requête avec un
timeout strict ; les autres passent au worker. Le résultat résumé est borné ; les grandes séries
sont écrites via `ArtifactStore` puis référencées par checksum.

## Worker durable

Celery + Redis séparé de Channels, avec une unité systemd dédiée. États : `queued`, `running`,
`succeeded`, `failed`, `cancel_requested`, `cancelled`, `stale`. Les retries concernent uniquement
les erreurs transitoires, avec backoff borné. L’annulation est coopérative entre étapes. Un lock DB
ou une contrainte unique empêche deux runs identiques. Un watchdog marque les jobs orphelins.

## Reporting

`ReportComposer` assemble des résultats de runs ; `ReportRenderer` transforme un modèle neutre en
HTML/PDF ; `ArtifactStore` persiste. Le rendu Playwright tourne dans un processus isolé, avec réseau
désactivé et ressources locales. Les erreurs d’un rapport ne changent pas les runs sources.

## Permissions

Objet central `AnalysisPolicy` : `can_view_aggregate`, `can_view_identity`, `can_view_text`,
`can_create_run`, `can_export`, `can_manage`. Les selectors appliquent le projet avant toute autre
condition. Les identifiants pseudonymes sont stables dans un projet et non corrélables entre
projets. Les exports réappliquent la policy au moment de la génération et du téléchargement.

## Optimisation

Utiliser `select_related/prefetch_related`, agrégations PostgreSQL et itération par chunks. Aucun N+1
par document/acteur. Les calculators travaillent sur des structures compactes ; la mémoire est
bornée. Les requêtes critiques ont un budget testé et sont analysées par `EXPLAIN` avant index.
