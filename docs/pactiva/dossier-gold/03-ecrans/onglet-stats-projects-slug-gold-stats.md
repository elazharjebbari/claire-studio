# Onglet Stats — /projects/[slug]/gold/stats

## Fonctionnalités PRIMAIRES
- Matrice de concordance annotateur↔annotateur (heatmap kappa symétrique, ConcordanceMatrix, échelle Landis & Koch réutilisée d'IaaDashboard) — data-testid=gold-stats-matrix-aa
- Matrice annotateur↔LLM (rectangulaire, annotateurs en lignes, juges en colonnes, AnnotatorLlmMatrix, réutilise llmJudgeColor/Label) — data-testid=gold-stats-matrix-allm
- Classement proximité au gold (GoldProximityRanking, barres triées + médaille top-3, qui est le plus proche du gold) — data-testid=gold-ranking-row-{id}

## Fonctionnalités SECONDAIRES (navigation / ergonomie / vitesse)
- État goldStale (recalcul nécessaire) + horodatage computedAt
- Filtre/tri des matrices, regroupement si >10 annotateurs
- Export des matrices via format iaa_matrix existant (ExportJob)
- Lien vers le panneau live temps réel dans l'atelier
