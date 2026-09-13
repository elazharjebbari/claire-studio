"""Participants attendus de la résolution — la porte de sortie du blocage de campagne.

Reproduit la situation RÉELLE de production (13 septembre 2026) : un annotateur assigné
qui n'a jamais participé (`jc.lamirel`) bloquait définitivement les 50 documents, pendant
qu'un LEAD avait annoté à sa place. La règle « on ne résout qu'une fois tout le monde
fini » est conservée ; ce qui devient déclarable, c'est la LISTE des participants
attendus (`resolution.expected_annotators`), sur le modèle de la liste d'arbitres.
"""

import pytest

from claire.annotations.models import Annotation, AnnotationStatus, Clause
from claire.gold.config import save_resolution_config, validate_resolution_config
from claire.projects.models import Assignment, MembershipRole, ProjectMembership
from tests.conftest import CorpusFactory, DocumentFactory, ProjectFactory, UserFactory

pytestmark = pytest.mark.django_db


def _doc(corpus, scheme, n=1):
    project = ProjectFactory(corpus=corpus, scheme=scheme)
    d = DocumentFactory(corpus=corpus, n_sentences=n)
    from claire.corpora.models import Sentence

    for i in range(n):
        Sentence.objects.create(document=d, index=i, raw_text=f"s{i}")
    return project, d


def _annotate(project, doc, user, code):
    themes = {t.code: t for t in project.scheme.themes.all()}
    ann = Annotation.objects.create(
        project=project, document=doc, annotator=user, status=AnnotationStatus.SUBMITTED
    )
    Clause.objects.create(
        annotation=ann, anchor_sentence=doc.sentences.get(index=0), theme=themes[code]
    )
    return ann


def _campaign(scheme):
    """Réplique la campagne de prod : lead annotateur + 2 annotateurs + 1 assigné absent."""
    corpus = CorpusFactory()
    project, doc = _doc(corpus, scheme)

    lead = UserFactory(username="p_lead", role="annotator")
    ProjectMembership.objects.create(project=project, user=lead, role=MembershipRole.LEAD)
    Assignment.objects.create(project=project, document=doc, assignee=lead)
    _annotate(project, doc, lead, "META")  # le lead a RÉELLEMENT annoté

    actifs = []
    for name, code in (("p_a1", "META"), ("p_a2", "META")):
        u = UserFactory(username=name, role="annotator")
        ProjectMembership.objects.create(project=project, user=u, role=MembershipRole.ANNOTATOR)
        Assignment.objects.create(project=project, document=doc, assignee=u)
        _annotate(project, doc, u, code)
        actifs.append(u)

    absent = UserFactory(username="p_absent", role="annotator")
    ProjectMembership.objects.create(project=project, user=absent, role=MembershipRole.ANNOTATOR)
    Assignment.objects.create(project=project, document=doc, assignee=absent)  # jamais annoté

    return project, doc, lead, actifs, absent


def _detail(auth, user, project, doc):
    return auth(user).get(f"/api/v1/projects/{project.slug}/gold/{doc.external_id}")


# ── Le blocage ───────────────────────────────────────────────────────────────
def test_assigned_absent_annotator_blocks_everything(scheme_with_themes, auth):
    """⭐ Régression de prod : un assigné qui n'annote jamais gèle la résolution."""
    project, doc, lead, _, absent = _campaign(scheme_with_themes)

    body = _detail(auth, lead, project, doc).json()
    assert body["readiness"]["ready"] is False
    assert body["status"] == "awaiting"
    # Le lead qui a annoté n'est PAS compté comme participant attendu (rôle lead).
    assert body["readiness"]["expected"] == 3
    assert body["readiness"]["submitted"] == 2

    r = auth(lead).post(
        f"/api/v1/projects/{project.slug}/gold/{doc.external_id}/decide",
        {"index": 0, "primary": "META"}, format="json",
    )
    assert r.status_code == 409  # arbitrage impossible


def test_readiness_names_the_missing_participants(scheme_with_themes, auth):
    """⭐ Le blocage doit être DIAGNOSTIQUABLE : qui manque, et d'où vient la liste."""
    project, doc, lead, _, absent = _campaign(scheme_with_themes)

    readiness = _detail(auth, lead, project, doc).json()["readiness"]
    assert readiness["missingUsernames"] == [absent.username]
    assert set(readiness["expectedUsernames"]) == {"p_a1", "p_a2", absent.username}
    assert readiness["source"] == "assignment"


# ── La porte de sortie : déclarer les participants ───────────────────────────
def test_declared_participants_unblock_resolution(scheme_with_themes, auth):
    """⭐ Déclarer les participants réels (dont le lead) débloque — sans lever le garde-fou."""
    project, doc, lead, actifs, absent = _campaign(scheme_with_themes)

    cfg = validate_resolution_config(
        {"expected_annotators": [lead.username, "p_a1", "p_a2"]}, project
    )
    save_resolution_config(project, cfg, actor=lead)

    body = _detail(auth, lead, project, doc).json()
    assert body["readiness"]["ready"] is True
    assert body["readiness"]["source"] == "config"
    assert body["readiness"]["missingUsernames"] == []
    # Accord strict des 3 participants → auto-résolution effective.
    assert body["sentences"][0]["decided"] is True


def test_declared_participants_still_enforce_completeness(scheme_with_themes, auth):
    """Le garde-fou reste actif : un participant DÉCLARÉ qui n'a pas soumis bloque."""
    project, doc, lead, _, absent = _campaign(scheme_with_themes)

    cfg = validate_resolution_config(
        {"expected_annotators": [lead.username, "p_a1", "p_a2", absent.username]}, project
    )
    save_resolution_config(project, cfg, actor=lead)

    body = _detail(auth, lead, project, doc).json()
    assert body["readiness"]["ready"] is False
    assert body["readiness"]["missingUsernames"] == [absent.username]
    assert body["readiness"]["source"] == "config"


def test_empty_list_keeps_legacy_behaviour(scheme_with_themes, auth):
    """Liste vide = comportement historique (déduction par assignation) — non régressif."""
    project, doc, lead, _, _ = _campaign(scheme_with_themes)
    cfg = validate_resolution_config({"expected_annotators": []}, project)
    save_resolution_config(project, cfg, actor=lead)

    readiness = _detail(auth, lead, project, doc).json()["readiness"]
    assert readiness["ready"] is False
    assert readiness["source"] == "assignment"


def test_participants_must_be_members(scheme_with_themes):
    """Même garde que les arbitres : un non-membre est refusé (400 en amont)."""
    project, doc, lead, _, _ = _campaign(scheme_with_themes)
    with pytest.raises(ValueError):
        validate_resolution_config({"expected_annotators": ["inconnu"]}, project)


def test_cockpit_and_workshop_agree_on_readiness(scheme_with_themes, auth):
    """⭐ Source UNIQUE : le cockpit et l'atelier ne peuvent pas diverger."""
    project, doc, lead, _, _ = _campaign(scheme_with_themes)
    cfg = validate_resolution_config(
        {"expected_annotators": [lead.username, "p_a1", "p_a2"]}, project
    )
    save_resolution_config(project, cfg, actor=lead)

    atelier = _detail(auth, lead, project, doc).json()["readiness"]
    cockpit = auth(lead).get(f"/api/v1/projects/{project.slug}/gold/documents").json()
    row = next(r for r in cockpit["results"] if r["document"]["externalId"] == doc.external_id)

    assert row["readiness"]["ready"] == atelier["ready"] is True
    assert row["readiness"]["expected"] == atelier["expected"]
    assert row["readiness"]["missingUsernames"] == atelier["missingUsernames"]
    assert row["readiness"]["source"] == atelier["source"]
