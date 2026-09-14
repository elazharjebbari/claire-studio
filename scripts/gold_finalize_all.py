"""Fige (finalise) toutes les résolutions GOLD d'un projet dont l'arbitrage est terminé.

CE QUE FAIT CETTE OPÉRATION — et ce qu'elle ne fait PAS. Elle ne décide rien : elle ne
change aucun thème, aucun secondaire, aucune décision d'arbitre. Elle pose une date de
finalisation qui rend la résolution IMMUABLE (`assert_not_finalized` refuse ensuite toute
écriture). Elle est réversible par le dégel explicite (`reopen`, réservé aux leads).

Elle suit exactement la séquence de l'atelier — prendre le verrou, soumettre, relâcher —
plutôt que d'écrire en base : le service `finalize_resolution` porte les garde-fous
(complétude des annotateurs attendus, toutes les phrases décidées, exclusivité
d'arbitrage), et les contourner reviendrait à figer un gold que l'interface aurait refusé.

Un document dont l'arbitrage n'est pas terminé est REFUSÉ par le serveur (409) et
simplement compté : le script ne force rien.

Usage (sur le serveur de production) :
    python manage.py shell < scripts/gold_finalize_all.py
"""

import hashlib
import json
from collections import Counter

from django.test import Client
from rest_framework_simplejwt.tokens import RefreshToken

from claire.accounts.models import User
from claire.gold.models import GoldResolution, GoldSentence
from claire.projects.models import Project

SLUG = "campagne-pactiva"
ACTOR = "elazhar.jebbari"


def decisions_fingerprint(project) -> tuple[int, str]:
    """Empreinte des DÉCISIONS elles-mêmes, pour prouver que figer ne les modifie pas."""
    rows = list(
        GoldSentence.objects.filter(resolution__project=project)
        .order_by("resolution__document_id", "index")
        .values_list("resolution__document_id", "index", "primary_theme_id",
                     "secondaries", "decided", "auto_level")
    )
    blob = json.dumps([[str(a), b, str(c), d, e, f] for a, b, c, d, e, f in rows],
                      ensure_ascii=False, sort_keys=True)
    return len(rows), hashlib.sha256(blob.encode()).hexdigest()[:32]


project = Project.objects.get(slug=SLUG)
actor = User.objects.get(username=ACTOR)
before_n, before_sha = decisions_fingerprint(project)

client = Client(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(actor).access_token}",
                SERVER_NAME="pactiva.legal")
base = f"/api/v1/projects/{project.slug}"

codes, refused = Counter(), []
for resolution in GoldResolution.objects.filter(project=project).select_related("document"):
    # Les routes gold adressent le document par son identifiant EXTERNE
    # (`get_object_or_404(..., external_id=document_id)`), jamais par la clé primaire —
    # c'est aussi ce qu'utilise l'atelier côté interface.
    document_id = resolution.document.external_id
    client.post(f"{base}/gold/{document_id}/lock", "{}", content_type="application/json")
    response = client.post(f"{base}/gold/{document_id}/submit", "{}",
                           content_type="application/json")
    codes[response.status_code] += 1
    if response.status_code >= 400:
        refused.append({"document": str(document_id)[:8], "code": response.status_code,
                        "detail": response.content.decode()[:160]})
    client.post(f"{base}/gold/{document_id}/lock/release", "{}",
                content_type="application/json")

after_n, after_sha = decisions_fingerprint(project)
resolutions = GoldResolution.objects.filter(project=project)

print(json.dumps({
    "codesHttp": dict(codes),
    "refusees": refused[:5],
    "finalisees": resolutions.filter(finalized_at__isnull=False).count(),
    "total": resolutions.count(),
    "statuts": dict(Counter(resolutions.values_list("status", flat=True))),
    "decisions": {"avant": [before_n, before_sha], "apres": [after_n, after_sha],
                  "inchangees": (before_n, before_sha) == (after_n, after_sha)},
}, ensure_ascii=False, indent=1))
