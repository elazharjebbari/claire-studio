"""La command `create_annotator` crée un compte sûr et idempotent."""

import json

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError

from claire.corpora.models import Document
from claire.projects.models import Assignment, MembershipRole, Project, ProjectMembership

User = get_user_model()
pytestmark = pytest.mark.django_db


@pytest.fixture
def seeded(settings):
    settings.SEED_HUMAN_FROM_LLM = False
    call_command("seed_demo", max_docs=2, verbosity=0)


def test_creates_hashed_annotator_member_and_assignments(seeded, tmp_path):
    out = tmp_path / "creds.json"
    call_command(
        "create_annotator", "fatima.ouali",
        email="oualifatima082@gmail.com", password="Pactiva2026!",
        assign=True, out=str(out), verbosity=0,
    )

    user = User.objects.get(username="fatima.ouali")
    assert user.email == "oualifatima082@gmail.com"
    assert user.role == "annotator"
    assert user.is_email_verified is True
    assert user.is_superuser is False
    # Mot de passe HACHÉ (jamais stocké en clair) et vérifiable.
    assert user.password != "Pactiva2026!"
    assert user.check_password("Pactiva2026!")

    project = Project.objects.get(slug="campagne-pactiva")
    membership = ProjectMembership.objects.get(project=project, user=user)
    assert membership.role == MembershipRole.ANNOTATOR

    n_docs = Document.objects.filter(corpus=project.corpus).count()
    assert n_docs > 0
    assert Assignment.objects.filter(project=project, assignee=user).count() == n_docs

    # Le JSON d'identifiants est écrit avec le mot de passe, chmod 600.
    assert oct(out.stat().st_mode & 0o777) == "0o600"
    payload = json.loads(out.read_text(encoding="utf-8"))
    assert payload["account"]["password"] == "Pactiva2026!"
    assert payload["login_url"].endswith("/login")


def test_second_run_is_noop_and_never_resets_password(seeded, tmp_path):
    call_command("create_annotator", "fatima.ouali", email="oualifatima082@gmail.com",
                 password="Pactiva2026!", assign=True, verbosity=0)
    before = User.objects.get(username="fatima.ouali").password
    n_assign = Assignment.objects.filter(assignee__username="fatima.ouali").count()

    # Second passage avec un AUTRE mot de passe : doit être ignoré (compte déjà présent).
    call_command("create_annotator", "fatima.ouali", email="oualifatima082@gmail.com",
                 password="autre-mdp-XYZ", assign=True, verbosity=0)

    user = User.objects.get(username="fatima.ouali")
    assert user.password == before
    assert user.check_password("Pactiva2026!")
    assert not user.check_password("autre-mdp-XYZ")
    assert ProjectMembership.objects.filter(user=user).count() == 1
    assert Assignment.objects.filter(assignee=user).count() == n_assign


def test_email_clash_with_other_user_is_refused(seeded):
    call_command("create_annotator", "fatima.ouali", email="oualifatima082@gmail.com", verbosity=0)
    with pytest.raises(CommandError):
        call_command("create_annotator", "autre.compte", email="oualifatima082@gmail.com", verbosity=0)


def test_no_campaign_creates_bare_user(seeded):
    call_command("create_annotator", "solo.user", email="solo@example.com",
                 password="x-temp-123", no_campaign=True, verbosity=0)
    user = User.objects.get(username="solo.user")
    assert ProjectMembership.objects.filter(user=user).count() == 0
