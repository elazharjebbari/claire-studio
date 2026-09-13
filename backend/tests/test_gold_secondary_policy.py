"""Politique des secondaires — un réglage de PROTOCOLE, pilotable depuis l'interface.

En `advisory` (défaut), les secondaires consensuels ne sont JAMAIS promus dans le gold
auto-résolu : sur la campagne réelle, 444 phrases perdent ainsi 453 étiquettes. En
`required`, ils y entrent. Le changement est rétroactif tant qu'un document n'est pas
figé — et sans effet après. Encore faut-il que le recalcul soit déclenché : la config
seule ne réécrit rien.
"""

import pytest

from claire.annotations.models import (
    Annotation,
    AnnotationStatus,
    Clause,
    ClauseRole,
    ClauseTheme,
)
from claire.gold.config import save_resolution_config, validate_resolution_config
from claire.gold.services import get_or_create_resolution, recompute_document, secondary_impact
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


def _annotate(project, doc, username, primary, secondaries=()):
    """Annotateur assigné qui pose un thème primaire + des secondaires sur la phrase 0."""
    u = UserFactory(username=username, role="annotator")
    ProjectMembership.objects.create(project=project, user=u, role=MembershipRole.ANNOTATOR)
    Assignment.objects.create(project=project, document=doc, assignee=u)
    themes = {t.code: t for t in project.scheme.themes.all()}
    ann = Annotation.objects.create(
        project=project, document=doc, annotator=u, status=AnnotationStatus.SUBMITTED
    )
    clause = Clause.objects.create(
        annotation=ann, anchor_sentence=doc.sentences.get(index=0), theme=themes[primary]
    )
    ClauseTheme.objects.create(clause=clause, theme=themes[primary], role=ClauseRole.PRIMARY)
    for code in secondaries:
        ClauseTheme.objects.create(clause=clause, theme=themes[code], role=ClauseRole.SECONDARY)
    return u


def _campaign(scheme):
    """Deux annotateurs d'accord sur le primaire ET sur un secondaire (consensus réel)."""
    corpus = CorpusFactory()
    project, doc = _doc(corpus, scheme)
    lead = UserFactory(username="sp_lead", role="annotator")
    ProjectMembership.objects.create(project=project, user=lead, role=MembershipRole.LEAD)
    _annotate(project, doc, "sp_a1", "TERMINATION", ["META"])
    _annotate(project, doc, "sp_a2", "TERMINATION", ["META"])
    return project, doc, lead


def test_advisory_discards_consensual_secondaries(scheme_with_themes):
    """Le défaut de production : les secondaires consensuels N'ENTRENT PAS dans le gold."""
    project, doc, _ = _campaign(scheme_with_themes)
    resolution = get_or_create_resolution(project, doc)
    recompute_document(resolution)

    gs = resolution.sentences.get(index=0)
    assert gs.decided is True and gs.auto_resolved is True
    assert gs.proposed_secondaries == ["META"], "le moteur les PROPOSE"
    assert gs.secondaries == [], "…mais la politique 'advisory' ne les promeut pas"


def test_required_promotes_consensual_secondaries(scheme_with_themes):
    """⭐ En `required`, le gold devient réellement multi-étiquettes."""
    project, doc, lead = _campaign(scheme_with_themes)
    cfg = validate_resolution_config({"secondary_policy": "required"}, project)
    save_resolution_config(project, cfg, actor=lead)

    resolution = get_or_create_resolution(project, doc)
    recompute_document(resolution)
    assert resolution.sentences.get(index=0).secondaries == ["META"]


def test_policy_change_needs_a_recompute_to_take_effect(scheme_with_themes, auth):
    """⭐ Changer la config ne réécrit RIEN : l'action « appliquer » est indispensable."""
    project, doc, lead = _campaign(scheme_with_themes)
    resolution = get_or_create_resolution(project, doc)
    recompute_document(resolution)  # matérialisé en `advisory`
    assert resolution.sentences.get(index=0).secondaries == []

    base = f"/api/v1/projects/{project.slug}/gold"
    r = auth(lead).patch(f"{base}/config", {"secondaryPolicy": "required"}, format="json")
    assert r.status_code == 200
    # La config a changé… mais la phrase stockée est INCHANGÉE tant qu'on ne recalcule pas.
    assert resolution.sentences.get(index=0).secondaries == []

    r = auth(lead).post(f"{base}/recompute", {}, format="json")
    assert r.status_code == 200
    assert r.json()["recomputed"] == 1
    assert resolution.sentences.get(index=0).secondaries == ["META"]


def test_recompute_skips_finalized_documents(scheme_with_themes, auth):
    """Garantie « gold figé » : un document soumis n'est jamais réécrit par l'action."""
    project, doc, lead = _campaign(scheme_with_themes)
    base = f"/api/v1/projects/{project.slug}/gold"
    auth(lead).get(f"{base}/{doc.external_id}")
    auth(lead).post(f"{base}/{doc.external_id}/lock", {}, format="json")
    assert auth(lead).post(f"{base}/{doc.external_id}/submit", {}, format="json").status_code == 200

    auth(lead).patch(f"{base}/config", {"secondaryPolicy": "required"}, format="json")
    body = auth(lead).post(f"{base}/recompute", {}, format="json").json()
    # Réponse camélisée par DRF (contrat du wire) : skippedFinalized, pas skipped_finalized.
    assert body["skippedFinalized"] == 1 and body["recomputed"] == 0

    resolution = get_or_create_resolution(project, doc)
    assert resolution.sentences.get(index=0).secondaries == [], "un gold figé reste figé"


def test_recompute_is_reserved_to_arbiters(scheme_with_themes, auth):
    """Un annotateur simple ne peut pas déclencher un recalcul de projet."""
    project, doc, _ = _campaign(scheme_with_themes)
    intrus = UserFactory(username="sp_intrus", role="annotator")
    ProjectMembership.objects.create(project=project, user=intrus, role=MembershipRole.ANNOTATOR)
    r = auth(intrus).post(f"/api/v1/projects/{project.slug}/gold/recompute", {}, format="json")
    assert r.status_code == 403


def test_config_exposes_the_measured_impact(scheme_with_themes, auth):
    """⭐ Le studio reçoit de quoi DÉCIDER : combien de phrases sont concernées."""
    project, doc, lead = _campaign(scheme_with_themes)
    recompute_document(get_or_create_resolution(project, doc))

    impact = auth(lead).get(f"/api/v1/projects/{project.slug}/gold/config").json()["secondaryImpact"]
    assert impact["policy"] == "advisory"
    assert impact["sentencesWithProposed"] == 1
    assert impact["sentencesCarrying"] == 0  # advisory : proposés mais non promus
    assert impact["proposedLabels"] == 1
    assert impact["documentsFinalized"] == 0


def test_secondary_impact_is_pure_and_countable(scheme_with_themes):
    """La mesure lit l'état stocké (aucun recalcul déclenché par une simple lecture)."""
    project, doc, _ = _campaign(scheme_with_themes)
    assert secondary_impact(project)["sentences_with_proposed"] == 0  # rien de matérialisé
    recompute_document(get_or_create_resolution(project, doc))
    assert secondary_impact(project)["sentences_with_proposed"] == 1
