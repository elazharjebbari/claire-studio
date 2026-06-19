# 07 — Écran d'exploration des annotations humaines (point 5)

## But

Un écran qui **qualifie, comprend et explore** les annotations humaines, à deux
échelles : **corpus** (vue agrégée) et **document** (vue détaillée), avec possibilité
de **commenter/laisser des remarques**.

## Vue Corpus (`/projects/{slug}/insights`)

- **Bandeau KPI** : #documents annotés / total, #annotateurs actifs, #versions,
  certitude moyenne, κ inter-annotateurs moyen.
- **Couverture** : barre d'avancement par document (statuts draft/submitted/validated).
- **Distribution des thèmes** : histogramme (couleurs de thème), filtrable par annotateur.
- **Accord inter-annotateurs** : matrice/heatmap κ par catégorie ; repère les catégories
  litigieuses.
- **Activité** : timeline d'événements (volume/jour, par verbe), top contributeurs.
- **Conflits** : #détectés / résolus / escaladés (collaboratif).

## Vue Document (`/projects/{slug}/insights/{documentId}`)

- **En-tête** : titre, statut, annotateurs ayant contribué (pastilles couleur), #versions.
- **Carte de chaleur des clauses** : par phrase, certitude + densité de modifications +
  présence de commentaires/divergences.
- **Distribution locale des thèmes** + comparaison aux juges LLM (réutilise l'accord).
- **Historique d'activité** du document (lien vers l'explorateur de versions, point 6).
- **Remarques** : zone de commentaires `scope=document` dédiée à la qualification
  (distincte des commentaires d'annotation in-situ, mais même backend `Comment`).

## Données & performance

- Lectures via **AnalyticsSnapshot** (agrégats matérialisés) pour éviter de recalculer ;
  invalidation à la soumission + tâche planifiée (rafraîchissement périodique).
- Métriques définies dans `metrics.csv` (nom, formule, granularité, source).
- Export CSV/PNG des graphiques (réutilise la pipeline d'export existante).

## UX
- Filtres persistants (localStorage) : annotateur, plage de dates, catégorie.
- Graphiques Plotly (exploration zoomable) ; rendu publication via export.
- Accessibilité : tableaux de données sous chaque graphe, libellés ARIA.

## API (cf. `12_api_contract.md`)
- `GET /projects/{slug}/insights` → KPI + distributions + activité agrégée.
- `GET /projects/{slug}/insights/{documentId}` → métriques document + heatmap.
