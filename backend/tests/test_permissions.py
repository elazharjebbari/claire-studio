"""Role/project permission tests + API flow smoke tests."""

import pytest

pytestmark = pytest.mark.django_db


def test_unauthenticated_is_rejected(api_client):
    assert api_client.get("/api/v1/me").status_code == 401


def test_me_returns_current_user(auth, annotator):
    resp = auth(annotator).get("/api/v1/me")
    assert resp.status_code == 200
    assert resp.json()["username"] == "alice"


def test_non_admin_cannot_create_scheme(auth, annotator):
    resp = auth(annotator).post(
        "/api/v1/schemes", {"slug": "x", "name": "X", "version": "1"},
        format="json",
    )
    assert resp.status_code == 403


def test_admin_can_create_scheme(auth, admin_user):
    resp = auth(admin_user).post(
        "/api/v1/schemes", {"slug": "x", "name": "X", "version": "1"},
        format="json",
    )
    assert resp.status_code == 201


def test_annotator_cannot_edit_others_annotation(
    auth, annotation, scheme_with_themes
):
    from tests.conftest import UserFactory

    other = UserFactory(username="mallory", role="annotator")
    resp = auth(other).patch(
        f"/api/v1/annotations/{annotation.id}",
        {"global_certainty": 2}, format="json",
    )
    assert resp.status_code == 403


def test_owner_can_add_clause_and_submit(auth, annotation, scheme_with_themes):
    client = auth(annotation.annotator)
    resp = client.post(
        f"/api/v1/annotations/{annotation.id}/clauses",
        {"anchor_index": 0, "theme_code": "META", "certainty": 2},
        format="json",
    )
    assert resp.status_code == 201, resp.content
    # duplicate anchor -> 409 (INV-2)
    dup = client.post(
        f"/api/v1/annotations/{annotation.id}/clauses",
        {"anchor_index": 0, "theme_code": "TERMINATION"},
        format="json",
    )
    assert dup.status_code == 409
    sub = client.post(f"/api/v1/annotations/{annotation.id}/submit")
    assert sub.status_code == 200
    assert sub.json()["status"] == "submitted"


def test_reviewer_can_review_and_drive_state(
    auth, annotation, scheme_with_themes, reviewer
):
    # owner submits first
    owner = auth(annotation.annotator)
    owner.post(
        f"/api/v1/annotations/{annotation.id}/clauses",
        {"anchor_index": 0, "theme_code": "META"}, format="json",
    )
    owner.post(f"/api/v1/annotations/{annotation.id}/submit")

    rc = auth(reviewer)
    resp = rc.post(
        f"/api/v1/annotations/{annotation.id}/reviews",
        {"score": 4, "decision": "approve"}, format="json",
    )
    assert resp.status_code == 201
    annotation.refresh_from_db()
    assert annotation.status == "approved"


def test_annotator_cannot_review(auth, annotation, scheme_with_themes):
    resp = auth(annotation.annotator).post(
        f"/api/v1/annotations/{annotation.id}/reviews",
        {"score": 5, "decision": "approve"}, format="json",
    )
    assert resp.status_code == 403
