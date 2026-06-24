# Sidebar GoldOutlinePanel (partition de contrat)

## Fonctionnalités PRIMAIRES
- Liste unifiée sommaire de contrat : blocs d'accord continus regroupés (deriveBlocks) factorisés en articles (catégorie en avant), conflits incrustés en sous-entrées ambre cliquables (data-testid=gold-outline-entry)
- Repli/dépli divergences seules (toggle, data-testid=gold-outline-toggle-divergences, mémorisé par document) : transforme la liste en file de désaccords
- Pastille d'état par entrée (non résolu/en cours/résolu/%) + badge sévérité (accord absolu / LLM-only / humain fort) + badge votes (humains/LLM)
- Clic = selectClause+focusSentence (sync centre+inspecteur), chip suivant ramené sous le curseur (scrollIntoView block:nearest)

## Fonctionnalités SECONDAIRES (navigation / ergonomie / vitesse)
- Compteur k/N des conflits en tête (fusionne le rôle de DivergenceNav)
- Status-dot en cours alimenté par le verrou via WebSocket de présence (avatar arbitre)
- Filtre par catégorie de thème ; barre de % global du document
- Deux pastilles primaire/secondaire quand divergence primaireOK/secondaireKO
