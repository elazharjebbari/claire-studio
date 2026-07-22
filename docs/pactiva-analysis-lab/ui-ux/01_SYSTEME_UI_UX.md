# Système UI/UX, ergonomie et graphisme

## ADN Pactiva

Le module prolonge la charte existante : rigueur institutionnelle, souveraineté, précision
juridique et pédagogie. Il réutilise `frontend/design-tokens.json`, Tailwind, Outfit pour les titres,
Inter pour l’UI et la serif pour le texte contractuel. Sont proscrits : gradients décoratifs,
glassmorphism, ombres lourdes, néons, cartes surdimensionnées et jargon data-science non expliqué.

## Tokens et couleur

- navy Pactiva : structure, sélection, focus, liens et action primaire ;
- or Pactiva : accent rare ou point de décision, jamais grand aplat ;
- neutres : fonds, panneaux, bordures et hiérarchie ;
- succès/attention/danger/info : uniquement leur sens fonctionnel ;
- couleurs de thèmes : seulement lorsque le thème est encodé ;
- séries comparatives : palette additionnelle AA, documentée dans les tokens et doublée par motifs,
  libellés ou formes.

Pas de couleur hexadécimale dans un composant. Le contrôle `check:colors` est étendu au dossier
Analysis. Le mode clair est la référence analytique ; le mode sombre reste pleinement supporté.

## Layout desktop

```text
Sidebar 56/224 | Topbar + breadcrumbs
               | ContextBar sticky (40–48 px)
               | GuideDisclosure
               | Rail 184 | contenu fluide min 640 | méthodologie 280
```

Le panneau méthodologique devient un drawer sous 1180 px. Le rail devient une liste horizontale ou
un drawer sous 900 px. Sur mobile, consultation, filtres simples et tables essentielles restent
accessibles ; matrices et réseaux ouvrent une vue dédiée.

## Composants

| Composant                 | Responsabilité                     | Base existante            |
| ------------------------- | ---------------------------------- | ------------------------- |
| `AnalysisShell`           | layout et sous-navigation          | `AppShell`, `Panel`       |
| `AnalysisContextBar`      | filtres globaux + résumé           | `Field`, `Button`, badges |
| `AnalysisModeSelector`    | paramètres conditionnels           | primitives de formulaire  |
| `AnalysisGuideDisclosure` | aide structurée                    | `Disclosure`              |
| `MetricCard`              | valeur, support, tendance, statut  | `Panel`, `Badge`          |
| `VisualizationCard`       | titre, graphe, table, export       | nouveau                   |
| `DataTable`               | tri/pagination/virtualisation      | nouveau, HTML natif       |
| `CaseExplorer`            | file, contexte, comparaison/action | composants Gold à adapter |
| `MethodologyPanel`        | formule, limites, version          | `Panel`                   |
| `RunStatus`               | queued/running/stale/failed/ready  | `StatusPill` à étendre    |

## Ergonomie

- contrôles 32–38 px sur desktop, cibles tactiles au moins 40 px ;
- grille de 4 px, rayons 6–8 px, bordures plutôt qu’ombres ;
- maximum quatre KPI par ligne ; jamais un KPI sans dénominateur ;
- titres formulés comme questions ; nombres localisés et précision non trompeuse ;
- filtres actifs visibles et supprimables au clavier ;
- navigation retour conservant le scroll, les filtres et le cas sélectionné ;
- paramètres expert derrière divulgation progressive ;
- pas de recalcul à chaque frappe : bouton explicite si le coût est significatif.

## Visualisations

Le renderer est choisi par intention sémantique : barres pour fréquences, histogramme pour
distribution, ligne pour temps, matrice pour accord/confusion, Sankey pour transitions et table
pour précision. Donut limité à cinq catégories ; radar exclu des comparaisons précises. Chaque carte
possède titre, description, unité, légende, tooltip clavier, support, avertissements, table
alternative, export et drill-down.

## Accessibilité

- WCAG 2.2 AA, zoom 200 %, focus visible 2 px ;
- navigation clavier complète et ordre logique ;
- `aria-expanded`, `aria-controls`, labels et annonces `aria-live` des jobs ;
- graphiques décoratifs masqués aux lecteurs d’écran, résumé et table associés ;
- lignes/colonnes de matrices avec en-têtes sémantiques ;
- aucune information par couleur seule ;
- `prefers-reduced-motion`, animations 120–180 ms ;
- tests axe Playwright sur chaque route et état critique.

## Ton éditorial

Préférer « Accord calculé sur 386 phrases communes » à « κ = 0,71 ». Afficher ensuite la métrique
précise et sa méthode. Ne jamais écrire « meilleur annotateur » ; parler de couverture, stabilité,
écarts ou besoins de clarification dans un périmètre donné.
