# Audit du cadrage et décisions structurantes

## 1. Diagnostic des trois fichiers fournis

Les fichiers sont cohérents sur les objectifs, la séparation des sources, les six modes, la
reproductibilité et l’architecture par registres. Ils forment un excellent cahier des charges. Ils
ne suffisent toutefois pas tels quels à démarrer le code : les chemins backend ne correspondent pas
au dépôt, le mécanisme de jobs n’est pas choisi, le fingerprint n’est pas défini techniquement et
plusieurs propositions visuelles contredisent la charte actuelle.

## 2. Matrice existant / adaptation / création

| Domaine          | Existant                                 | À adapter                            | À créer                                |
| ---------------- | ---------------------------------------- | ------------------------------------ | -------------------------------------- |
| Navigation       | `AppShell`, `Sidebar`, projet courant    | entrée « Analyse & qualité »         | rail interne Analysis Lab              |
| UI               | primitives, `Disclosure`, tokens, thèmes | variantes data dense, badges support | charts, MetricCard, CaseExplorer       |
| Données humaines | Annotation/Clause/Version                | adapters et requêtes optimisées      | observation analytique commune         |
| LLM              | PreAnnotation/PreClause versionnées      | mapping frontières/multi-label       | métadonnées modèle/prompt mieux typées |
| Gold             | GoldResolution/Sentence/Run              | adapter GoldRun                      | comparaison GoldRun↔GoldRun            |
| Statistiques     | IAA, MASI, concordance, Gold stats       | extraire les calculs réutilisables   | MetricRegistry + runs                  |
| Jobs             | export par thread local                  | conserver l’API métier               | worker durable, cancel/retry           |
| API              | DRF ViewSets + permissions               | serializers explicites               | namespace analysis v1                  |
| Frontend         | Query, Zustand, MSW                      | génération/validation DTO            | feature analysis isolée                |
| Déploiement      | Redis, systemd, VPS                      | nouvelle unité worker                | health/readiness worker                |

## 3. Contradictions résolues

### Organisation backend

Le brief propose `backend/apps/analysis`. Le dépôt utilise `backend/claire/<domaine>`. La cible est
donc `backend/claire/analysis`, enregistrée dans les settings et l’API existante.

### Couleur analytique

Le brief historique cite le violet comme accent d’analyse. La charte actuelle fixe le navy
`#0C447C` comme accent d’action et l’or `#BA7517` comme accent rare. Décision : navy pour sélection,
liens et focus ; couleurs sémantiques pour les états ; couleurs de thèmes uniquement quand la
catégorie est la donnée. Une palette de séries accessible peut être ajoutée aux tokens, sans créer
une seconde identité violette.

### Freeze et verrou projet

`Project.locked` empêche l’écriture mais ne constitue pas un snapshot reproductible. Un run doit
pointer vers les versions immuables incluses (`AnnotationVersion`, `PreAnnotation`, `GoldRun`) et
conserver un manifeste. Le verrou peut faciliter un freeze, mais ne remplace pas le manifeste.

### Asynchronisme

Les threads daemon utilisés aujourd’hui par les exports ne garantissent ni reprise après crash ni
exécution unique. Décision : introduire un port `TaskDispatcher` et un worker Celery/Redis dédié.
Redis doit utiliser un namespace/DB distinct de Channels. Les tests utilisent un dispatcher inline.

### Graphiques

Le dépôt ne possède pas de librairie de graphiques générale. Décision : Apache ECharts chargé par
`dynamic import`, encapsulé derrière `VisualizationRegistry`. Cette option couvre heatmap, Sankey,
réseau et matrices avec moins de code métier qu’une construction D3/Visx. Chaque rendu garde une
table HTML alternative ; le domaine backend ne retourne jamais des options ECharts.

### PDF

Décision : HTML/CSS + Playwright dans le worker, car Playwright est déjà connu du projet et permet
de réutiliser les composants/graphismes. Le navigateur tourne isolé, sans accès Internet et sans
HTML utilisateur brut. `ReportRenderer` garde la possibilité de remplacer le moteur par WeasyPrint.

## 4. Choix de persistance

| Question            | Décision recommandée                  | Motif                                   |
| ------------------- | ------------------------------------- | --------------------------------------- |
| Observation commune | projection applicative au MVP         | pas de duplication ni migration massive |
| Vue matérialisée    | seulement après profilage             | complexité d’invalidation prématurée    |
| Résumé de run       | JSONB borné                           | lecture rapide des KPI                  |
| Grandes séries      | artefact JSON gzip/Parquet + checksum | évite des JSONB géants                  |
| Cas de désaccord    | lignes normalisées                    | filtrage, statut et action métier       |
| Cache               | fingerprint + versions métriques      | réutilisation exacte et explicite       |
| Artifacts           | filesystem privé MVP, interface objet | compatible VPS puis S3/MinIO            |

## 5. Lacunes à traiter avant les métriques avancées

1. `Clause` n’a pas de timestamp de modification propre ; les nouveaux événements de mutation
   permettent un audit mais pas encore tous les calculs temporels précis.
2. Les métadonnées LLM décrivent surtout `judge` et `schema_version` ; prompt, modèle exact et
   paramètres doivent être versionnés pour comparer des générations.
3. Les endpoints insights actuels choisissent parfois une annotation représentative : inutilisable
   pour une comparaison exhaustive.
4. L’IAA est recalculé dans les requêtes ; il faut extraire des calculators purs et profiler.
5. Les permissions actuelles exposent parfois les identités ; l’Analysis Lab exige une politique de
   pseudonymisation et un support minimal.
6. Aucun ordonnanceur durable ni stockage d’artefacts abstrait n’existe.
7. OpenAPI n’est pas encore la source de types TypeScript ; les contrats devront rester testés tant
   que la génération n’est pas introduite.

## 6. Architecture évolutive retenue

Le monolithe modulaire est conservé jusqu’à preuve mesurée qu’un composant doit être extrait. Les
frontières (`ObservationProvider`, `MetricCalculator`, `TaskDispatcher`, `ArtifactStore`,
`ReportRenderer`) sont des interfaces applicatives. Elles rendent une extraction ultérieure possible
sans imposer aujourd’hui réseau, duplication et cohérence distribuée.
