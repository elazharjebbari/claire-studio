# Modale Export gold (overlay ExportJob)

## Fonctionnalités PRIMAIRES
- Toggle Base gold (scope.gold, data-testid=gold-scope) + portée lot (scope.documents) ou corpus (final)
- Checkbox Inclure la provenance d'arbitrage (scope.provenance, data-testid=gold-provenance)
- Choix du format (jsonl/csv/conll/xml/md/hf/iaa_matrix réutilisés) ; lancement async (202 non bloquant)

## Fonctionnalités SECONDAIRES (navigation / ergonomie / vitesse)
- Lien Voir mes exports (page exports existante, polling adaptatif, download gated)
- Distinction intermédiaire (gold_draft du lot) vs final (corpus figé après verrou projet)
- Notification en tâche de fond quand l'export est prêt
