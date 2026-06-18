"""Pre-annotation import endpoint + seed-from-preannotation API (feature 2)."""

import pytest

pytestmark = pytest.mark.django_db


@pytest.fixture
def admin_member_project(project, admin_user):
    from claire.projects.models import MembershipRole, ProjectMembership

    ProjectMembership.objects.create(
        project=project, user=admin_user, role=MembershipRole.LEAD
    )
    return project


def test_import_preannotation_endpoint(
    auth, admin_user, admin_member_project, document_with_sentences
):
    client = auth(admin_user)
    payload = {
        "document": document_with_sentences.external_id,
        "judge": "claude",
        "raw": {
            "doc": document_with_sentences.external_id,
            "judge": "claude",
            "version": "v9.4",
            "plan": {
                "clauses": [
                    {"clause_id": 0, "theme": "META", "open_span": "x",
                     "anchor_id": 0},
                ]
            },
        },
    }
    resp = client.post(
        f"/api/v1/projects/{admin_member_project.slug}/preannotations/import",
        payload, format="json",
    )
    assert resp.status_code == 201, resp.content
    assert resp.json()[0]["schema_version"] == "v9.4"
    assert resp.json()[0]["preclauses"][0]["anchor_index"] == 0


def test_create_annotation_seeded_from_preannotation(
    auth, annotator, project, document_with_sentences, admin_user
):
    from claire.imports.services import ingest_preannotation
    from claire.projects.models import MembershipRole, ProjectMembership

    ProjectMembership.objects.create(
        project=project, user=annotator, role=MembershipRole.ANNOTATOR
    )
    ingest_preannotation(
        project, document_with_sentences, "claude",
        {
            "doc": document_with_sentences.external_id, "judge": "claude",
            "version": "v9.4",
            "plan": {"clauses": [
                {"clause_id": 0, "theme": "META", "open_span": "x", "anchor_id": 0},
                {"clause_id": 1, "theme": "TERMINATION", "open_span": "y",
                 "anchor_id": 2},
            ]},
        },
    )
    client = auth(annotator)
    resp = client.post(
        "/api/v1/annotations",
        {
            "project": project.slug,
            "document": document_with_sentences.external_id,
            "seed": "preannotation:claude",
        },
        format="json",
    )
    assert resp.status_code == 201, resp.content
    data = resp.json()
    assert data["source"] == "preannotation_seed"
    assert len(data["clauses"]) == 2
