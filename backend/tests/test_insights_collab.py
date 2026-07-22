"""Endpoints insights / collaboration / attribution (mode réel) — anti-404.

Vérifie que les endpoints consommés par le frontend en mode réel répondent 200
avec les formes camelCase attendues (rendu DRF camel-case). Skip propre si le
corpus de démo n'est pas chargé.
"""

from pathlib import Path

import pytest
from django.conf import settings
from django.core.management import call_command
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

pytestmark = pytest.mark.django_db

SLUG = "claudette-gold-v1"

_SENTENCES_DIR = Path(settings.CLAUDETTE_DIR) / "Sentences"
_HAS_DATA = _SENTENCES_DIR.is_dir() and any(_SENTENCES_DIR.iterdir())
requires_data = pytest.mark.skipif(
    not _HAS_DATA,
    reason="corpus CLAUDETTE absent (data/claudette_tos/Sentences)",
)


def _client(user):
    c = APIClient()
    token = str(RefreshToken.for_user(user).access_token)
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return c


def test_config_flags_no_auth():
    """GET /config/flags — sans auth, clés camelCase présentes."""
    body = APIClient().get("/api/v1/config/flags").json()
    assert "realtimeCollaboration" in body
    assert "presence" in body


@requires_data
def test_insights_and_collab_endpoints(admin_user):
    call_command("feed_db", "--max-docs", "3", "--seed-human", verbosity=0)
    client = _client(admin_user)

    # Insights corpus : KPI + documents avec approxPages.
    insights = client.get(f"/api/v1/projects/{SLUG}/insights").json()
    assert "kpi" in insights and "documents" in insights
    assert {"documentsAnnotated", "documentsTotal"} <= set(insights["kpi"].keys())
    assert insights["documents"], "au moins un document attendu"
    doc = insights["documents"][0]
    assert "approxPages" in doc

    # Insights document : approxPages + distribution + certitude par clause.
    doc_id = doc["documentId"]
    detail = client.get(f"/api/v1/projects/{SLUG}/insights/{doc_id}").json()
    assert detail["documentId"] == doc_id
    assert "approxPages" in detail
    assert "themeDistribution" in detail and "clauseCertainty" in detail

    # Contributeurs + sentence-history (par pk de document).
    from claire.corpora.models import Document

    document = Document.objects.get(external_id=doc_id)
    contribs = client.get(f"/api/v1/documents/{document.pk}/contributors").json()
    assert "results" in contribs
    sh = client.get(
        f"/api/v1/documents/{document.pk}/sentence-history?index=0"
    ).json()
    assert sh["index"] == 0 and "results" in sh

    # Lien de partage signé (HMAC) — 201 + token + url.
    share = client.post(
        f"/api/v1/projects/{SLUG}/share-links",
        {"role_granted": "annotator", "expires_at": "2030-01-01T00:00:00Z"},
        format="json",
    )
    assert share.status_code == 201, share.content
    assert share.json()["token"] and "/join/" in share.json()["url"]


@requires_data
def test_attribution_and_presence(admin_user):
    """Attribution + présence d'une annotation existante (200, formes camel)."""
    call_command("feed_db", "--max-docs", "3", "--seed-human", verbosity=0)
    from claire.annotations.models import Annotation

    ann = Annotation.objects.first()
    if ann is None:  # pas d'annotation seedée → rien à tester
        pytest.skip("aucune annotation seedée")
    client = _client(admin_user)

    attr = client.get(f"/api/v1/annotations/{ann.pk}/attribution?by=clause").json()
    assert attr["by"] == "clause" and "results" in attr

    pres = client.get(f"/api/v1/annotations/{ann.pk}/presence").json()
    assert pres["count"] >= 1
    assert {"userId", "name", "color"} <= set(pres["results"][0].keys())
