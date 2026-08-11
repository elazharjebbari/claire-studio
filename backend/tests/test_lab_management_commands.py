"""Commandes `manage.py lab_*` — jamais exercées avant cet audit (0 % de couverture sur
les trois). Ce sont les points d'entrée réels utilisés pendant la préparation de
l'article (voir le docstring de `lab_preflight`), donc les casser silencieusement
serait découvert seulement en production.
"""

import json
from io import StringIO

import pytest
from django.core.management import CommandError, call_command

from claire.lab.models import LabDataset
from claire.projects.models import MembershipRole, ProjectMembership
from tests.conftest import CorpusFactory, DocumentFactory, ProjectFactory, UserFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def campaign(scheme_with_themes, settings, tmp_path):
    from claire.annotations.models import Annotation, Clause, ClauseTheme
    from claire.corpora.models import Sentence

    settings.LAB_DIR = str(tmp_path / "lab")
    corpus = CorpusFactory()
    project = ProjectFactory(corpus=corpus, scheme=scheme_with_themes)
    admin = UserFactory(username="cmd_admin", role="admin", is_superuser=True, is_staff=True)
    ProjectMembership.objects.create(project=project, user=admin, role=MembershipRole.LEAD)

    themes = list(scheme_with_themes.themes_map.values())
    for d in range(5):
        document = DocumentFactory(corpus=corpus, n_sentences=8)
        sentences = [
            Sentence.objects.create(document=document, index=i, raw_text=f"clause {i} .")
            for i in range(8)
        ]
        for username in ("cmd_a1", "cmd_a2"):
            user = UserFactory(username=f"{username}_{d}", role="annotator")
            annotation = Annotation.objects.create(
                project=project, document=document, annotator=user, status="submitted"
            )
            for i, sentence in enumerate(sentences):
                theme = themes[i % len(themes)]
                clause = Clause.objects.create(
                    annotation=annotation, anchor_sentence=sentence,
                    theme=theme, order=i, validated=True,
                )
                ClauseTheme.objects.create(clause=clause, theme=theme, role="primary")
    return project


def _run(command, *args, **kwargs):
    out = StringIO()
    call_command(command, *args, stdout=out, **kwargs)
    return out.getvalue()


# --------------------------------------------------------------------------- #
# lab_build_dataset
# --------------------------------------------------------------------------- #

def test_lab_build_dataset_construit_et_rapporte(campaign):
    output = _run("lab_build_dataset", project=campaign.slug, maturity="complete", k=5)
    assert "Jeu de données" in output
    assert LabDataset.objects.count() == 1


def test_lab_build_dataset_projet_introuvable(db):
    with pytest.raises(CommandError, match="introuvable"):
        _run("lab_build_dataset", project="ne-existe-pas")


def test_lab_build_dataset_doublon_previent_sans_erreur(campaign):
    _run("lab_build_dataset", project=campaign.slug, maturity="complete", k=5)
    output = _run("lab_build_dataset", project=campaign.slug, maturity="complete", k=5)
    assert "identique déjà présent" in output
    assert LabDataset.objects.count() == 1  # pas de second dataset créé


def test_lab_build_dataset_force_recree_malgre_le_doublon(campaign):
    _run("lab_build_dataset", project=campaign.slug, maturity="complete", k=5)
    _run("lab_build_dataset", project=campaign.slug, maturity="complete", k=5, force=True)
    assert LabDataset.objects.count() == 2


# --------------------------------------------------------------------------- #
# lab_preflight
# --------------------------------------------------------------------------- #

def test_lab_preflight_rapport_texte(campaign):
    output = _run("lab_preflight", project=campaign.slug, maturity="complete")
    assert LabDataset.objects.count() == 0  # simule sans jamais persister


def test_lab_preflight_sortie_json_est_parseable(campaign):
    output = _run("lab_preflight", project=campaign.slug, maturity="complete", json=True)
    report = json.loads(output)
    assert report["n_documents"] == 5


def test_lab_preflight_compare_les_quatre_maturites(campaign):
    output = _run("lab_preflight", project=campaign.slug, compare=True)
    for maturity in ("any", "complete", "submitted", "gold"):
        assert maturity in output


def test_lab_preflight_projet_introuvable(db):
    with pytest.raises(CommandError, match="introuvable"):
        _run("lab_preflight", project="ne-existe-pas")


# --------------------------------------------------------------------------- #
# lab_worker
# --------------------------------------------------------------------------- #

def test_lab_worker_once_sans_run_en_attente(db):
    output = _run("lab_worker", once=True)
    assert "aucun run en attente" in output


def test_lab_worker_once_traite_un_run(campaign, monkeypatch):
    monkeypatch.setattr("claire.lab.management.commands.lab_worker.run_once", lambda: True)
    output = _run("lab_worker", once=True)
    assert "run traité" in output


def test_lab_worker_boucle_respecte_max_iterations(db, monkeypatch):
    calls = []
    monkeypatch.setattr(
        "claire.lab.management.commands.lab_worker.loop",
        lambda **kwargs: calls.append(kwargs),
    )
    _run("lab_worker", interval=0, max_iterations=2)
    assert calls == [{"interval": 0.0, "max_iterations": 2}]
