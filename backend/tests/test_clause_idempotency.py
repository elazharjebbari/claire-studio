"""Idempotence des écritures de clause (chantier C) — client_op_id.

Un retry réseau (même client_op_id) ne doit pas créer de doublon : la 2e requête
retombe sur la clause existante (200), pas un 409 ni une 2e ligne.
"""

import pytest

pytestmark = pytest.mark.django_db


def _post_clause(client, annotation_id, **body):
    return client.post(
        f"/api/v1/annotations/{annotation_id}/clauses", body, format="json"
    )


def test_add_clause_idempotent_on_client_op_id(auth, annotator, annotation):
    client = auth(annotator)
    payload = {"anchorIndex": 0, "theme": "META", "clientOpId": "op-1"}

    r1 = _post_clause(client, annotation.id, **payload)
    assert r1.status_code == 201, r1.content

    # Rejeu exact (retry) → même clause, 200, aucun doublon.
    r2 = _post_clause(client, annotation.id, **payload)
    assert r2.status_code == 200, r2.content
    assert r2.json()["id"] == r1.json()["id"]
    assert annotation.clauses.count() == 1


def test_distinct_client_op_ids_create_distinct_clauses(auth, annotator, annotation):
    client = auth(annotator)
    r1 = _post_clause(client, annotation.id, anchorIndex=0, theme="META", clientOpId="op-1")
    r2 = _post_clause(
        client, annotation.id, anchorIndex=1, theme="TERMINATION", clientOpId="op-2"
    )
    assert r1.status_code == 201
    assert r2.status_code == 201
    assert annotation.clauses.count() == 2


def test_add_clause_without_op_id_still_works(auth, annotator, annotation):
    client = auth(annotator)
    r = _post_clause(client, annotation.id, anchorIndex=0, theme="META")
    assert r.status_code == 201
    assert annotation.clauses.count() == 1
