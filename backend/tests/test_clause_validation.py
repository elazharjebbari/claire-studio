"""Validation humaine explicite des clauses (point d) — champ `validated`.

Une pré-annotation ne vaut jamais référence : seule une clause validated=True compte
pour la soumission complète. Le champ doit faire l'aller-retour POST/PATCH et défaut
à False.
"""

import pytest

pytestmark = pytest.mark.django_db


def _post_clause(client, annotation_id, **body):
    return client.post(
        f"/api/v1/annotations/{annotation_id}/clauses", body, format="json"
    )


def test_clause_validated_defaults_false(auth, annotator, annotation):
    client = auth(annotator)
    r = _post_clause(client, annotation.id, anchorIndex=0, theme="META")
    assert r.status_code == 201, r.content
    assert r.json()["validated"] is False


def test_clause_validated_set_on_create(auth, annotator, annotation):
    client = auth(annotator)
    r = _post_clause(client, annotation.id, anchorIndex=0, theme="META", validated=True)
    assert r.status_code == 201, r.content
    assert r.json()["validated"] is True


def test_clause_validated_toggle_via_patch(auth, annotator, annotation):
    client = auth(annotator)
    r = _post_clause(client, annotation.id, anchorIndex=0, theme="META")
    clause_id = r.json()["id"]

    r2 = client.patch(
        f"/api/v1/clauses/{clause_id}", {"validated": True}, format="json"
    )
    assert r2.status_code == 200, r2.content
    assert r2.json()["validated"] is True

    r3 = client.patch(
        f"/api/v1/clauses/{clause_id}", {"validated": False}, format="json"
    )
    assert r3.status_code == 200, r3.content
    assert r3.json()["validated"] is False
