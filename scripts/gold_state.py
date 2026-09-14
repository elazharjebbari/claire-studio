"""Produit l'état du GOLD attendu par la campagne d'expériences.

POURQUOI UN SCRIPT. Le JSON attendu par `run_campaign.py --gold-state` était saisi à la
main, et une erreur de saisie s'y est glissée le 14 septembre 2026 : `undecided` y portait
le nombre de RÉSOLUTIONS non finalisées (50) alors que le contrôle `gold_complete` compte
les PHRASES non tranchées (0). Quatre expériences étaient donc bloquées par un contrôle qui
aurait dû passer. Un chiffre qui décide du statut publiable d'une expérience ne se saisit
pas à la main.

Usage (sur le serveur de production) :
    python manage.py shell < scripts/gold_state.py > gold_state.json
"""

import json

from claire.gold.models import GoldResolution, GoldSentence
from claire.projects.models import Project

SLUG = "campagne-pactiva"

project = Project.objects.get(slug=SLUG)
resolutions = GoldResolution.objects.filter(project=project)
sentences = GoldSentence.objects.filter(resolution__project=project)

print(json.dumps({
    "project": SLUG,
    "resolutions": resolutions.count(),
    "finalized": resolutions.filter(finalized_at__isnull=False).count(),
    # `gold_complete` compte des PHRASES, pas des documents.
    "undecided": sentences.filter(decided=False).count(),
    # Informatif : ce que le gold doit à l'arbitrage humain plutôt qu'à la cascade.
    "sentences": sentences.count(),
    "humanArbitrations": sentences.filter(auto_resolved=False, decided=True).count(),
}, ensure_ascii=False, indent=1))
