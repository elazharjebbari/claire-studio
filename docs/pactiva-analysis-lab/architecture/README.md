# Diagrammes d’architecture

- `01_ARCHITECTURE_GLOBALE.puml` : composants frontend, API, domaine Analysis, domaines existants,
  worker, PostgreSQL, Redis et artefacts.
- `02_FLUX_MULTI_ANNOTATIONS.puml` : sélection dynamique des six modes jusqu’à l’action métier.
- `03_SEQUENCE_ANALYSIS_RUN.puml` : autorisation, résolution du scope, cache, déduplication, worker,
  publication atomique et polling.
- `04_MODELE_DONNEES.puml` : entités analytiques persistantes et références aux sources immuables.

Les diagrammes sont des sources PlantUML versionnables. Ils décrivent la cible recommandée et non
un état déjà implémenté. La notation en pointillés vers les versions sources indique une référence
dans le manifeste du run, pas nécessairement une table de liaison matérialisée au MVP.
