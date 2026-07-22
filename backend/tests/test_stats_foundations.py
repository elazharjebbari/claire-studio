"""Socle fiable pour les futures statistiques d'annotateurs.

Ces tests verrouillent la traçabilité des mutations sans contenu sensible et
l'exactitude du périmètre « annotateurs » des agrégats de progression.
"""

import pytest
from rest_framework.test import APIClient

from claire.annotations.models import Annotation
from claire.audit.models import ActivityEvent
from claire.corpora.models import Sentence
from claire.projects.models import Assignment, MembershipRole, ProjectMembership
from tests.conftest import CorpusFactory, DocumentFactory, ProjectFactory, UserFactory

pytestmark = pytest.mark.django_db
API = "/api/v1"


def _client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def stats_campaign(scheme_with_themes):
    corpus = CorpusFactory()
    document = DocumentFactory(corpus=corpus, external_id="StatsDoc", n_sentences=3)
    for index in range(3):
        Sentence.objects.create(document=document, index=index, raw_text=f"phrase {index}")
    project = ProjectFactory(corpus=corpus, scheme=scheme_with_themes)
    annotator = UserFactory(username="stats_annotator", role="annotator")
    lead = UserFactory(username="stats_lead", role="annotator")
    reviewer = UserFactory(username="stats_reviewer", role="reviewer")
    ProjectMembership.objects.create(
        project=project, user=annotator, role=MembershipRole.ANNOTATOR
    )
    ProjectMembership.objects.create(project=project, user=lead, role=MembershipRole.LEAD)
    ProjectMembership.objects.create(
        project=project, user=reviewer, role=MembershipRole.REVIEWER
    )
    Assignment.objects.create(project=project, document=document, assignee=annotator)
    Assignment.objects.create(project=project, document=document, assignee=lead)
    return project, document, annotator, lead, reviewer


def _open_annotation(client, project, document):
    response = client.post(
        f"{API}/annotations",
        {"project": project.slug, "document": document.external_id},
        format="json",
    )
    assert response.status_code in (200, 201), response.content
    return response.json()["id"]


def _events(annotation, verb):
    return ActivityEvent.objects.filter(
        target_type="annotations.annotation",
        target_id=str(annotation.pk),
        verb=verb,
    ).order_by("id")


def test_clause_lifecycle_is_audited_without_sensitive_content(stats_campaign):
    project, document, annotator, *_ = stats_campaign
    client = _client(annotator)
    annotation_id = _open_annotation(client, project, document)
    annotation = Annotation.objects.get(pk=annotation_id)

    create_body = {
        "anchorIndex": 0,
        "theme": "META",
        "clientOpId": "stats-op-1",
        "evidenceSpan": "texte juridique sensible",
        "rationale": "raisonnement sensible",
    }
    created = client.post(
        f"{API}/annotations/{annotation_id}/clauses", create_body, format="json"
    )
    assert created.status_code == 201, created.content
    clause_id = created.json()["id"]
    assert _events(annotation, "clause.added").count() == 1

    # Un retry idempotent retrouve la clause sans gonfler artificiellement l'activité.
    retry = client.post(
        f"{API}/annotations/{annotation_id}/clauses", create_body, format="json"
    )
    assert retry.status_code == 200
    assert _events(annotation, "clause.added").count() == 1

    patched = client.patch(
        f"{API}/clauses/{clause_id}",
        {"certainty": 3, "evidenceSpan": "autre texte sensible"},
        format="json",
    )
    assert patched.status_code == 200, patched.content
    assert _events(annotation, "clause.updated").count() == 1

    deleted = client.delete(f"{API}/clauses/{clause_id}")
    assert deleted.status_code == 204
    assert _events(annotation, "clause.deleted").count() == 1

    forbidden_values = {"texte juridique sensible", "raisonnement sensible", "autre texte sensible"}
    for event in ActivityEvent.objects.filter(target_id=str(annotation.pk)):
        serialized_payload = str(event.payload)
        assert not any(value in serialized_payload for value in forbidden_values)
        assert set(event.payload) <= {"clause_id", "anchor_index", "fields", "project", "document", "source", "from", "to", "version", "label"}


def test_batch_audits_only_effective_mutations(stats_campaign):
    project, document, annotator, *_ = stats_campaign
    client = _client(annotator)
    annotation_id = _open_annotation(client, project, document)
    annotation = Annotation.objects.get(pk=annotation_id)

    body = {
        "clauses": [
            {"anchorIndex": 0, "theme": "META", "clientOpId": "batch-0"},
            {"anchorIndex": 1, "theme": "TERMINATION", "clientOpId": "batch-1"},
        ]
    }
    response = client.post(
        f"{API}/annotations/{annotation_id}/clauses/batch", body, format="json"
    )
    assert response.status_code == 201, response.content
    assert _events(annotation, "clause.added").count() == 2

    retry = client.post(
        f"{API}/annotations/{annotation_id}/clauses/batch", body, format="json"
    )
    assert retry.status_code == 201
    assert _events(annotation, "clause.added").count() == 2

    upsert = client.post(
        f"{API}/annotations/{annotation_id}/clauses/batch",
        {"upsert": True, "clauses": [{"anchorIndex": 1, "theme": "META"}]},
        format="json",
    )
    assert upsert.status_code == 201
    assert _events(annotation, "clause.updated").count() == 1


def test_theme_swap_and_boundary_are_audited(stats_campaign):
    project, document, annotator, *_ = stats_campaign
    client = _client(annotator)
    annotation_id = _open_annotation(client, project, document)
    annotation = Annotation.objects.get(pk=annotation_id)
    created = client.post(
        f"{API}/annotations/{annotation_id}/clauses",
        {
            "anchorIndex": 0,
            "themes": [
                {"label": "META", "role": "primary"},
                {"label": "TERMINATION", "role": "secondary"},
            ],
        },
        format="json",
    )
    assert created.status_code == 201, created.content
    clause_id = created.json()["id"]

    swap = client.post(
        f"{API}/clauses/{clause_id}/swap-primary",
        {"label": "TERMINATION"},
        format="json",
    )
    assert swap.status_code == 200, swap.content
    boundary = client.post(
        f"{API}/clauses/{clause_id}/boundary",
        {"op": "set_soft", "validatedBy": "human"},
        format="json",
    )
    assert boundary.status_code == 200, boundary.content

    updates = list(_events(annotation, "clause.updated"))
    assert len(updates) == 2
    assert updates[0].payload["fields"] == ["theme", "themes"]
    assert updates[1].payload["fields"] == ["boundary_type", "validated"]


def test_annotator_progress_excludes_reviewers(stats_campaign, admin_user):
    project, _document, annotator, lead, reviewer = stats_campaign
    response = _client(admin_user).get(f"{API}/projects/{project.slug}/annotators-progress")
    assert response.status_code == 200, response.content
    usernames = {row["username"] for row in response.json()["results"]}
    assert usernames == {annotator.username, lead.username}
    assert reviewer.username not in usernames
