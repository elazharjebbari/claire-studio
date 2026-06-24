# Atelier de résolution — /projects/[slug]/gold/[documentId]

## Fonctionnalités PRIMAIRES
- ResolutionWorkspace sur ResizablePanels (gauche=GoldOutlinePanel, centre=fil contrat + cartouches de conflit, droite=InspectorPanel inchangé)
- Fil contrat factorisé : articles d'accord absolu repliés en 1 ligne (ContractArticle, en-tête ClauseChip catégorie + numéro Art. N.M), conflits ouverts en ConflictCartouche dense inline (fond bg-elevated, border-accent)
- Carte de vote (cœur décision) : une ligne par source — annotateurs d'abord (poids fort) puis LLM (désaturés) — chip primaire + chips secondaires pointillés + evidence/rationale au survol (RationaleHover) + boundary ; clic = adopter (data-testid=resolve-adopt-{sourceId})
- Décision GOLD multi-label : accord sur PRIMAIRE + SECONDAIRES séparément (deux sous-blocs de vote, role primary/secondary) ; écrite comme Annotation source=gold
- Niveaux d'auto-résolution dans le flux : accord absolu pré-coché, bouton 1 clic (data-testid=resolve-accept-unanimous) ; passage en rafale des C1 contigus
- Navigation conflit↔conflit (ConflictNav ◂ k/N ▸) et bloc↔bloc même catégorie ; élément suivant sous le curseur (useAnchoredPosition + scroll)
- Verrou d'arbitrage exclusif : bandeau Arbitré par X, lease auto-expirant, bouton Reprendre (steal, lead/reviewer)

## Fonctionnalités SECONDAIRES (navigation / ergonomie / vitesse)
- Mini-aperçu plein-texte (phrases voisines) pour ne jamais arbitrer hors-sol
- Badge signal fort : décision humaine ≠ consensus LLM (data-testid=resolve-llm-divergence)
- Barre de votes pondérés (annotateurs > LLM) avec score de confiance
- Commentaire d'arbitrage optionnel par décision (CommentsPanel réutilisé)
- Drawer Compare N-way (ComparePanel réutilisé, raccourci c), HistoryPanel/versions gold (AnnotationVersion)
- Panneau live de proximité au gold (concordance.ts) qui bouge à chaque décision
- Mode Focus tunnel (toggle f, prefs par document) ; DocumentSwitcher pour doc suivant/précédent du lot
