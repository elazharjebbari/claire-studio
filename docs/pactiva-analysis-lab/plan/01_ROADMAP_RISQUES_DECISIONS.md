# Roadmap, lots, risques et décisions

## État d’exécution au 22 juillet 2026

La première tranche opérationnelle est livrée sur `codex/analysis-lab-roadmap` : snapshots
immuables incluant les brouillons autorisés, permissions et pseudonymisation, runs idempotents,
registre de métriques v1, API, overview, profils, rapports historiques paginés, comparaison et
interface Pactiva. Les détails et preuves sont dans
[`../04_IMPLEMENTATION_SOCLE_SNAPSHOTS_RAPPORTS.md`](../04_IMPLEMENTATION_SOCLE_SNAPSHOTS_RAPPORTS.md).

| Lot | État                | Livré / prochain gate                                                          |
| --- | ------------------- | ------------------------------------------------------------------------------ |
| 0   | livré techniquement | contrats, privacy rules, fixtures ; validation métier des seuils restante      |
| 1   | livré               | runs persistés, worker, heartbeat, reprise, annulation et health               |
| 2   | livré               | overview, qualité, couverture, certitude, thèmes, presets, scope et drill-down |
| 3   | livré techniquement | intra/inter, humain-LLM, inter-LLM ; revue scientifique métier restante        |
| 4   | livré               | readiness/proximité Gold et propositions taxonomiques séparées                 |
| 5   | livré               | historique, deltas, PDF privé, checksum et rétention                           |
| 6   | livré techniquement | métriques de durée, health, benchmark, purge et runbook                        |

## Lots d’implémentation

### Lot 0 — contrats et preuves (1–2 sprints)

Inventaire exact des sources, dictionnaire d’observation, politique d’accès/pseudonymisation,
catalogue métriques v1, fixtures synthétiques versionnées, prototypes UI et ADR jobs/charts/PDF.
Gate : formules approuvées, menace/privacy review et contrat API testable.

### Lot 1 — socle Analysis

App Django, modèles Run/Preset/Artifact, ScopeResolver, fingerprint, registry, API run/catalog,
worker, feature frontend, shell/context/guide et overview. Gate : run idempotent de bout en bout,
crash/reprise, droits et health worker.

### Lot 2 — qualité, atlas et individuel

Qualité de données, distributions, couverture, certitude, multi-label, tables/drill-down et presets.
Gate : budgets ORM, support explicite, a11y et aucune métrique RH opaque.

### Lot 3 — fiabilité et multi-annotations

Extraction des calculs IAA existants, intra, inter-humains, humain–LLM, inter-LLM, matrices et
DisagreementCase. Gate : validation scientifique indépendante et recouvrement explicite.

### Lot 4 — taxonomie et Gold

Propositions, comparaison GoldRuns, liens vers arbitrage et readiness. Gate : séparation des
sources et décisions humaines jamais écrasées.

### Lot 5 — rapports

Templates, assistant, worker Playwright, manifeste, historique, rétention et téléchargement privé.
Gate : PDF multi-pages, confidentialité, checksum et reprise.

### Lot 6 — industrialisation

Profilage, indexes mesurés, charge, stockage objet optionnel, traces, alertes, runbooks et purge.

## Risques majeurs

| Risque                       | Impact                     | Maîtrise                                     |
| ---------------------------- | -------------------------- | -------------------------------------------- |
| métrique mal interprétée     | décision erronée           | support, méthode, validation scientifique    |
| outil perçu comme scoring RH | confiance/RGPD             | vues personnelles, agrégats, pas de ranking  |
| mélange humain/LLM           | perte de provenance        | adapters typés et badges obligatoires        |
| fingerprint incomplet        | résultat non reproductible | manifeste immuable et tests de mutation      |
| calculs synchrones lourds    | indisponibilité            | estimation coût, worker et timeouts          |
| artefacts volumineux         | disque saturé              | quotas, TTL, monitoring et stockage abstrait |
| explosion de composants      | maintenance                | feature boundaries et registres              |
| divergence de charte         | produit incohérent         | tokens uniques et garde-fou couleurs         |
| migrations bloquantes        | risque prod                | expand/contract, backup, répétition staging  |

## Décisions actées

1. projection applicative au MVP ; matérialisation après mesure ;
2. résultats résumés DB, grandes séries en artefacts ;
3. Celery/Redis derrière `TaskDispatcher` ;
4. Apache ECharts derrière un registre ;
5. Playwright derrière `ReportRenderer` ;
6. app `claire.analysis` dans le monolithe ;
7. navy Pactiva, pas de nouvel accent violet ;
8. phrase pour classification, frontière pour segmentation, clause pour attributs de clause ;
9. pseudonymisation par défaut et aucun classement ;
10. migration progressive sans data warehouse initial.

## Décisions à valider avec le métier

- support minimal exact selon métrique et visibilité ;
- personnes autorisées à lever la pseudonymisation ;
- inclusion de drafts dans certaines analyses exploratoires ;
- définition opérationnelle du consensus humain/LLM ;
- métadonnées obligatoires d’un modèle et d’un prompt ;
- durée de conservation des runs/rapports ;
- export d’extraits contractuels et watermark ;
- définition du Gold souple ;
- seuils de calcul async après benchmark du corpus cible.

## Première tranche recommandée

Construire d’abord `catalog + scope preview + AnalysisRun + overview/quality`, avec trois métriques
simples (`coverage`, `completion`, `certainty_distribution`). Cette tranche éprouve architecture,
permissions, fingerprint, jobs, UI et déploiement sans engager immédiatement les formules les plus
sensibles. Ajouter ensuite κ/α en extrayant et testant le code existant.
