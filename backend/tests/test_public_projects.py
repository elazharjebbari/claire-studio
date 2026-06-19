"""Publication publique de projet (chantier F) — confidentialité par défaut.

Privé par défaut : non listé, agrégats 404 publiquement. Seul un admin peut publier ;
une fois public, les agrégats (lecture seule) sont accessibles sans authentification.
"""

import pytest

from claire.projects.models import ProjectVisibility

pytestmark = pytest.mark.django_db


def test_project_is_private_by_default(project):
    assert project.visibility == ProjectVisibility.PRIVATE


def test_public_list_excludes_private_no_auth(api_client, project):
    r = api_client.get("/api/v1/public/projects")
    assert r.status_code == 200  # accessible sans auth
    slugs = [p["slug"] for p in r.json()["results"]]
    assert project.slug not in slugs


def test_public_detail_404_for_private(api_client, project):
    # Confidentialité : privé indistinguable d'inexistant.
    r = api_client.get(f"/api/v1/public/projects/{project.slug}")
    assert r.status_code == 404


def test_public_detail_aggregates_when_published(api_client, project):
    project.visibility = ProjectVisibility.PUBLIC
    project.save(update_fields=["visibility"])
    r = api_client.get(f"/api/v1/public/projects/{project.slug}")
    assert r.status_code == 200, r.content
    body = r.json()
    assert body["slug"] == project.slug
    assert "kpi" in body
    assert "themeDistribution" in body
    # Listé désormais.
    listed = [p["slug"] for p in api_client.get("/api/v1/public/projects").json()["results"]]
    assert project.slug in listed


def test_admin_can_publish(auth, admin_user, project):
    client = auth(admin_user)
    r = client.patch(
        f"/api/v1/projects/{project.slug}", {"visibility": "public"}, format="json"
    )
    assert r.status_code == 200, r.content
    project.refresh_from_db()
    assert project.visibility == ProjectVisibility.PUBLIC


def test_non_admin_cannot_publish(auth, annotator, project):
    client = auth(annotator)
    r = client.patch(
        f"/api/v1/projects/{project.slug}", {"visibility": "public"}, format="json"
    )
    assert r.status_code in (403, 404)
    project.refresh_from_db()
    assert project.visibility == ProjectVisibility.PRIVATE
