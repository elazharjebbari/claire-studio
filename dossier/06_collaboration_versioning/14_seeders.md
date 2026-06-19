# 14 — Seeders & jeux de données de démonstration

Objectif : `make feed-all` doit produire un état **réaliste et collaboratif** prêt à la
démo et aux tests, sans données privées.

## Commande backend (étendre `feed_db`)
1. **Projet de démo** `claudette-gold-v1` avec **3 membres** : Alice (annotator, #06B6D4),
   Bruno (annotator, #F59E0B), Camille (reviewer, #A78BFA) — couleurs accessibles.
2. **Documents** : corpus UNFAIR-ToS (déjà importé) ; annotations sur ≥ 3 documents.
3. **Multi-versions LLM** : import archive v9/v9.1/v9.2/v9.3 (déjà en place).
4. **Annotations humaines** : pour 2 documents, créer 2 annotateurs avec des clauses qui
   **divergent** sur quelques phrases (pour l'attribution, l'historique, l'analytics).
5. **Versions** : pour 1 document, créer 3 `AnnotationVersion` (snapshot_manuel ×2 +
   soumission ×1) avec name/description, pour alimenter l'explorateur de versions.
6. **ActivityEvent** : générer un historique cohérent (create/retheme/set_certainty/
   adopt/comment/version.submit) horodaté, avec before/after et sentence_index.
7. **Commentaires** : quelques fils multi-niveaux (sentence/clause/range/document),
   résolus et non résolus.
8. **CollaborationSession** + **ShareLink** de démo (non révoqué, valide 7 j).
9. **AnalyticsSnapshot** : recalcul initial (`recompute_insights`).

## Idempotence
- Upsert par clés naturelles (déjà le cas) ; relancer `feed-all` ne duplique pas.
- `--reset` pour repartir d'une base saine en dev.

## Front (mode mock)
- Fixtures MSW miroir : 3 membres + couleurs, 2 annotations humaines divergentes, 3
  versions nommées, historique d'événements, commentaires multi-niveaux, share-link,
  flags. Les `data-testid` couvrent les parcours e2e.

## Vérification
- `make feed-all` → `GET /projects/claudette-gold-v1/insights` renvoie des KPI non vides ;
  `GET /documents/{id}/sentence-history?index=12` renvoie ≥ 2 entrées d'auteurs différents.
