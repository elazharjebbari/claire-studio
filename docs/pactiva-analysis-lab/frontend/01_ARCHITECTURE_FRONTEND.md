# Architecture frontend

## Structure cible

```text
frontend/src/features/analysis/
├── api/            # query keys, client, mappers
├── charts/         # registry et renderers chargés à la demande
├── components/     # composants métier Analysis
├── filters/        # schémas URL et contrôles conditionnels
├── hooks/          # orchestration UI uniquement
├── schemas/        # validation runtime des DTO
├── state/          # préférences éphémères seulement
├── tables/         # colonnes et cellules
├── types/          # contrats générés/partagés
└── utils/          # formatage et fonctions pures
```

Les routes sous `app/(app)/projects/[slug]/analysis/` sont de minces adapters. Elles chargent la
feature, gèrent les boundaries Next.js et ne contiennent ni calcul statistique ni parsing de DTO.

## État et URL

- **URL** : module, mode, unité, acteurs, statuts, période, documents, métrique et run ;
- **React Query** : toutes les données serveur, polling des runs et pagination ;
- **Zustand/prefs** : panneaux, densité, guide ouvert, mode guidé/expert ;
- **état local** : brouillon de filtres avant application et sélection visuelle temporaire.

Les query keys sont construites depuis une configuration normalisée, jamais depuis un objet mutable.
Une navigation ou un partage d’URL doit reconstruire la même analyse.

## Contrats

Le frontend consomme le camelCase produit par DRF. Les DTO sont validés à la frontière avec un
schéma runtime (Zod à ajouter ou validation générée OpenAPI). Le mapping vers les view models est
isolé. Un champ inconnu est ignoré ; l’absence d’un champ obligatoire produit un état d’erreur
typé, pas une page blanche.

## Registre de visualisations

```ts
type Renderer = React.ComponentType<VisualizationProps>;
registry.register("horizontal_bar", () => import("./HorizontalBar"));
```

Le contrat contient dimensions, mesures, lignes et métadonnées sémantiques. Les options ECharts
restent internes au renderer. Chaque renderer expose `renderTable`, `getAccessibleSummary` et
`exportSnapshot`. Un renderer inconnu retombe sur `DataTable`.

## Performance

- pagination serveur dès 100 lignes ; virtualisation après mesure, typiquement 500 lignes ;
- ECharts et modules lourds chargés dynamiquement ;
- annulation via `AbortSignal` et debounce de 250–400 ms pour previews légères ;
- aucune réponse complète de milliers de cas dans un dashboard ;
- prefetch du drill-down au focus intentionnel ;
- skeletons de dimensions stables ;
- budget indicatif : JS additionnel initial < 80 Ko gzip, interaction locale < 100 ms.

## Fiabilité

Error boundaries par visualisation, reprise du polling après reconnexion, statut stale explicite et
actions idempotentes avec clé client. Le frontend n’infère jamais qu’un job est terminé à partir du
pourcentage : seul l’état serveur fait foi.

## Tests frontend

1. parsers URL et compatibilité des modes ;
2. validation/mapping des DTO ;
3. chaque état de `AnalysisRun` ;
4. table alternative et navigation clavier ;
5. drill-down et conservation des filtres ;
6. permissions et données masquées ;
7. polling, annulation, retry et stale ;
8. MSW pour succès, support insuffisant, 403, 409, 422 et 500 ;
9. Playwright : individuel, inter-humains, humain–LLM, désaccord et rapport ;
10. axe + régression visuelle clair/sombre/viewport.
