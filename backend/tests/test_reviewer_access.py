"""Accès reviewer JURIX 2026 : compte partagé en lecture sur la campagne verrouillée, bac à sable
annotable, nos annotations intouchables, pseudonymes à l'écran."""
from io import StringIO

import pytest
from django.core.management import call_command

from claire.projects.models import Assignment, MembershipRole, Project, ProjectMembership
from tests.conftest import UserFactory


@pytest.fixture
def campaign(db, project):
    # `project` (conftest) : projet avec corpus + schéma ; on y met trois annotatrices fictives.
    from claire.annotations.models import Annotation
    doc = project.corpus.documents.first()
    for name in ("zoe.test", "anna.test", "mila.test"):
        u = UserFactory(username=name)
        ProjectMembership.objects.get_or_create(project=project, user=u, defaults={"role": MembershipRole.ANNOTATOR})
        Annotation.objects.get_or_create(project=project, document=doc, annotator=u)
    # un membre annotateur SANS session (co-auteur) : pas renommé
    lead = UserFactory(username="lead.test")
    ProjectMembership.objects.get_or_create(project=project, user=lead, defaults={"role": MembershipRole.ANNOTATOR})
    return project


@pytest.mark.django_db
def test_reviewer_access_creates_account_locks_campaign_and_sandbox(campaign, api_client):
    out = StringIO()
    call_command("reviewer_access", campaign=campaign.slug, sandbox="jurix-sandbox-test", password="Rev!ew-2026", stdout=out)
    text = out.getvalue()
    assert "identifiant : jurix-reviewer" in text and "mot de passe : Rev!ew-2026" in text

    campaign.refresh_from_db()
    assert campaign.locked is True
    reviewer = ProjectMembership.objects.get(project=campaign, user__username="jurix-reviewer")
    assert reviewer.role == MembershipRole.REVIEWER
    assert reviewer.user.role == "reviewer"
    assert not Assignment.objects.filter(project=campaign, assignee=reviewer.user).exists()

    sandbox = Project.objects.get(slug="jurix-sandbox-test")
    assert sandbox.locked is False and sandbox.corpus_id == campaign.corpus_id and sandbox.scheme_id == campaign.scheme_id
    assert ProjectMembership.objects.get(project=sandbox, user=reviewer.user).role == MembershipRole.ANNOTATOR
    assert Assignment.objects.filter(project=sandbox, assignee=reviewer.user).count() == campaign.corpus.documents.count()

    # pseudonymes à l'écran, ordre alphabétique des identifiants
    names = dict(ProjectMembership.objects.filter(project=campaign, role=MembershipRole.ANNOTATOR)
                 .values_list("user__username", "user__display_name"))
    assert names["anna.test"] == "Annotator A1" and names["mila.test"] == "Annotator A2" and names["zoe.test"] == "Annotator A3"
    assert not names["lead.test"].startswith("Annotator")

    # rejouable : même compte, même mot de passe remplacé, pas de doublon
    call_command("reviewer_access", campaign=campaign.slug, sandbox="jurix-sandbox-test", password="Other-1", stdout=StringIO())
    assert ProjectMembership.objects.filter(user__username="jurix-reviewer").count() == 2

    # le compte se connecte et ne peut pas écrire dans la campagne verrouillée
    r = api_client.post("/api/v1/auth/login", {"username": "jurix-reviewer", "password": "Other-1"}, format="json")
    assert r.status_code == 200
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {r.json()['access']}")
    doc = campaign.corpus.documents.first()
    r = api_client.post("/api/v1/annotations", {"project": campaign.slug, "document": doc.external_id}, format="json")
    assert r.status_code in (403, 409, 423), r.status_code
    # …mais peut ouvrir une session dans le bac à sable
    r = api_client.post("/api/v1/annotations", {"project": "jurix-sandbox-test", "document": doc.external_id}, format="json")
    assert r.status_code in (200, 201), r.status_code

    # restauration des noms d'affichage
    call_command("reviewer_access", campaign=campaign.slug, sandbox="jurix-sandbox-test", password="x", restore_display_names=True, stdout=StringIO())
    assert not any(n.startswith("Annotator A") for n in ProjectMembership.objects.filter(project=campaign, role=MembershipRole.ANNOTATOR)
                   .values_list("user__display_name", flat=True))
