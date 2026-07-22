"""Multi-versions LLM (archive) — import + sélection de version + tolérance schéma.

Vérifie qu'on peut importer plusieurs versions (v9/v9.1/v9.2/v9.3) pour un même
(doc, juge), les lister, et les filtrer — en gérant des schémas hétérogènes.
Skip propre si les données réelles ne sont pas présentes.
"""

from pathlib import Path

import pytest
from django.conf import settings
from django.core.management import call_command
from rest_framework.test import APIClient

from claire.corpora.models import Document
from claire.imports.models import PreAnnotation

pytestmark = pytest.mark.django_db

_ARCHIVE_DIR = Path(settings.DATA_DIR) / "annotations_archive"
_SENTENCES_DIR = Path(settings.CLAUDETTE_DIR) / "Sentences"
_HAS_ARCHIVE = (
    _ARCHIVE_DIR.is_dir()
    and any(_ARCHIVE_DIR.rglob("*.json"))
    and _SENTENCES_DIR.is_dir()
    and any(_SENTENCES_DIR.iterdir())
)
requires_archive = pytest.mark.skipif(
    not _HAS_ARCHIVE,
    reason="archive multi-versions ou corpus CLAUDETTE absent",
)


@requires_archive
def test_archive_import_multiversion(admin_user):
    call_command("feed_db", "--max-docs", "12", "--seed-human", verbosity=0)
    call_command("import_annotations_archive", verbosity=0)

    # Au moins un document porte plusieurs versions pour un même juge.
    versions = set(
        PreAnnotation.objects.values_list("schema_version", flat=True).distinct()
    )
    assert len({v for v in versions if v.startswith("v9")}) >= 2, versions

    # Idempotence : un 2e import ne crée pas de doublon.
    before = PreAnnotation.objects.count()
    call_command("import_annotations_archive", verbosity=0)
    assert PreAnnotation.objects.count() == before

    # Endpoint annotation-versions + filtre ?version=
    from rest_framework_simplejwt.tokens import RefreshToken

    doc = (
        Document.objects.filter(preannotations__isnull=False).distinct().first()
    )
    client = APIClient()
    token = str(RefreshToken.for_user(admin_user).access_token)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    listing = client.get(f"/api/v1/documents/{doc.id}/annotation-versions").json()
    assert listing["versions"], listing
    assert {"version", "judge", "nClauses"} <= set(listing["results"][0].keys())

    v = listing["versions"][0]
    filtered = client.get(
        f"/api/v1/preannotations?document={doc.id}&version={v}"
    ).json()
    assert filtered["count"] >= 1
    assert all(p["schemaVersion"] == v for p in filtered["results"])
