# Cockpit GOLD — /projects/[slug]/gold

## Fonctionnalités PRIMAIRES
- Bandeau KPIs campagne (GoldKpiBar, data-testid=gold-kpi-bar) : % docs résolus, file restante par niveau de risque C1–C5, concordance moyenne annotateur↔GOLD, n auto-résolvables
- Table dense virtualisée des documents (GoldDocTable, role=grid) : colonnes statut (non résolu/en cours/résolu via GoldStatusBadge), % phrases arbitrées (DifficultyMeter), difficulté=kappa pairwise (réutilise project_iaa), niveau d'auto-résolution (badge accord absolu/peu risqué/risqué), arbitre(s) assigné(s) (avatars user_color), verrou live (en cours par X)
- Entrée vers résolution : ligne cliquable → /gold/[documentId], data-testid=open-gold-{externalId}, miroir du pattern open-doc
- Barre de filtres : statut, arbitre, niveau de risque C1–C5, recherche par titre ; tri par colonne (statut/%/difficulté/arbitre)

## Fonctionnalités SECONDAIRES (navigation / ergonomie / vitesse)
- Sélection multi-ligne (checkbox + shift-click) → GoldBatchBar ancrée sous le curseur (data-testid=gold-batch-bar) : assigner arbitre, verrouiller/déverrouiller en lot, marquer auto-résolvable, exporter gold partiel
- Onglet segmenté Liste | Stats (raccourci s/l)
- Bouton Config de campagne (lead) + bouton Exporter le gold (ouvre modale ExportJob)
- Mémoire tri/filtres/colonnes en prefs par compte (sync /me) ; lignes visitées marquées
- Indicateur goldStale si arbitrages postérieurs au dernier calcul de stats
