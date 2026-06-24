# Studio de config de campagne — section /admin/projects/[slug]#resolution

## Fonctionnalités PRIMAIRES
- PresetPicker en tête (Confiance annotateurs / Équilibré / Audit strict) qui pré-remplit tout (data-testid=resolution-preset) ; défaut = Confiance annotateurs
- Pondération LLM par mode (ignore | tiebreak | signal | full) + poids (data-testid=llm-role-select)
- Seuils d'auto-résolution par niveau de risque (accord absolu = 1 clic ; C1–C2 auto ; C3–C5 manuel)
- Choix des arbitres (cases userIds, défaut leads+reviewers, data-testid=arbiter-checkbox-{userId}) vs visualiseurs
- Partage des arbitrages auto révocable (autoShare toggle) ; secondaires obligatoires/advisory (secondary-policy)
- Enregistrer (data-testid=save-resolution-config) ; gel via Project.locked (read-only + bandeau si verrouillé)

## Fonctionnalités SECONDAIRES (navigation / ergonomie / vitesse)
- Progressive-disclosure : réglages avancés repliés (pondération par annotateur en curseurs tokenisés, override par juge, signalBonus)
- Journal append-only des changements de config (configChanges horodaté)
- Validation serveur (poids∈[0,1], seuils cohérents, userIds membres du projet)
- Bandeau Campagne verrouillée — config figée (tokens, zéro hex)
