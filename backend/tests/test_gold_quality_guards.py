"""Garde-fous de QUALITÉ du gold — empêcher un gold faux mais plausible.

Deux failles vérifiées sur le moteur (audit du 13 septembre 2026) :

1. une phrase couverte par UN SEUL annotateur est classée « accord strict », auto-résolue
   en 1 clic avec une confiance de 1,0 — alors qu'il n'y a aucun accord à constater ;
2. sur une égalité (1-1-1), la proposition du moteur est le vainqueur ALPHABÉTIQUE.

Le moteur PUR n'est pas modifié (parité TS↔PY et cas d'or intacts) : le garde-fou est posé
dans la couche d'orchestration, là où la POLITIQUE d'auto-résolution est déjà décidée.
"""

import pytest

from claire.annotations.models import Annotation, AnnotationStatus, Clause
from claire.gold.services import get_or_create_resolution, recompute_document
from claire.projects.gold_scoring import Vote, score_sentence
from claire.projects.models import Assignment, MembershipRole, ProjectMembership
from tests.conftest import CorpusFactory, DocumentFactory, ProjectFactory, UserFactory

pytestmark = pytest.mark.django_db


def _doc(corpus, scheme, n=2):
    project = ProjectFactory(corpus=corpus, scheme=scheme)
    d = DocumentFactory(corpus=corpus, n_sentences=n)
    from claire.corpora.models import Sentence

    for i in range(n):
        Sentence.objects.create(document=d, index=i, raw_text=f"s{i}")
    return project, d


def _annotator(project, doc, username):
    u = UserFactory(username=username, role="annotator")
    ProjectMembership.objects.create(project=project, user=u, role=MembershipRole.ANNOTATOR)
    Assignment.objects.create(project=project, document=doc, assignee=u)
    return u


def _annotate(project, doc, user, per_index):
    """per_index : {index: code} — les index absents ne sont PAS couverts par cet annotateur."""
    themes = {t.code: t for t in project.scheme.themes.all()}
    ann = Annotation.objects.create(
        project=project, document=doc, annotator=user, status=AnnotationStatus.SUBMITTED
    )
    for index, code in per_index.items():
        Clause.objects.create(
            annotation=ann, anchor_sentence=doc.sentences.get(index=index), theme=themes[code]
        )
    return ann


# ── Le moteur reste INCHANGÉ (documentation exécutable de son comportement) ──
def test_engine_unchanged_single_voter_is_still_strict():
    """Le moteur pur continue de dire « strict » — c'est la POLITIQUE qui doit refuser."""
    s = score_sentence([Vote("a", "META", ()), Vote("b", None, ()), Vote("c", None, ())])
    assert s.agreement_class == "strict"
    assert s.auto_level == "auto_1click"
    assert s.confidence == 1.0


def test_engine_unchanged_tie_is_alphabetical():
    """Sur une égalité, la proposition reste le vainqueur alphabétique (déterminisme)."""
    votes = [Vote("a", "ZZZ", ()), Vote("b", "AAA", ()), Vote("c", "MMM", ())]
    s = score_sentence(votes)
    assert s.agreement_class == "divergence"
    assert s.primary == "AAA"  # ordre lexicographique, pas un consensus
    assert s.auto_level == "manual"


# ── Le garde-fou : pas d'auto-résolution sur une couverture solitaire ────────
def test_no_auto_resolution_on_single_covering_annotator(scheme_with_themes):
    """⭐ Une phrase vue par un seul annotateur ne peut pas être « accord » : reste à trancher."""
    corpus = CorpusFactory()
    project, doc = _doc(corpus, scheme_with_themes, n=2)
    a1 = _annotator(project, doc, "q_a1")
    a2 = _annotator(project, doc, "q_a2")
    # Phrase 0 : les deux annotateurs la couvrent et sont d'accord → auto.
    # Phrase 1 : SEUL a1 la couvre → pas d'accord constatable.
    _annotate(project, doc, a1, {0: "META", 1: "TERMINATION"})
    _annotate(project, doc, a2, {0: "META"})

    resolution = get_or_create_resolution(project, doc)
    recompute_document(resolution)

    s0 = resolution.sentences.get(index=0)
    s1 = resolution.sentences.get(index=1)
    assert s0.decided is True and s0.auto_resolved is True  # vrai accord à deux
    assert s1.decided is False, "une couverture solitaire ne doit jamais être auto-résolue"
    # `auto_level` reste l'écho du MOTEUR (sémantique inchangée) ; c'est `decided` qui porte
    # la vérité du travail restant, et la proposition demeure affichée à l'arbitre.
    assert s1.auto_level == "auto_1click"
    assert s1.proposed_primary == "TERMINATION"


def test_auto_resolution_still_works_with_two_annotators(scheme_with_themes):
    """Non-régression : le cas normal (≥ 2 annotateurs couvrants) s'auto-résout toujours."""
    corpus = CorpusFactory()
    project, doc = _doc(corpus, scheme_with_themes, n=1)
    a1 = _annotator(project, doc, "q_b1")
    a2 = _annotator(project, doc, "q_b2")
    _annotate(project, doc, a1, {0: "META"})
    _annotate(project, doc, a2, {0: "META"})

    resolution = get_or_create_resolution(project, doc)
    summary = recompute_document(resolution)
    assert summary["auto_resolved"] == 1
    assert resolution.sentences.get(index=0).auto_resolved is True


# ── Égalité : la « proposition » n'est qu'un départage alphabétique ──────────
def test_tie_is_flagged_in_payload(scheme_with_themes, auth):
    """⭐ Une égalité est SIGNALÉE : l'UI doit refuser la validation en 1 clic."""
    from claire.projects.models import ProjectMembership

    corpus = CorpusFactory()
    project, doc = _doc(corpus, scheme_with_themes, n=1)
    lead = UserFactory(username="q_tie_lead", role="annotator")
    ProjectMembership.objects.create(project=project, user=lead, role=MembershipRole.LEAD)
    a1 = _annotator(project, doc, "q_t1")
    a2 = _annotator(project, doc, "q_t2")
    _annotate(project, doc, a1, {0: "META"})
    _annotate(project, doc, a2, {0: "TERMINATION"})  # 1-1 → égalité parfaite

    body = auth(lead).get(
        f"/api/v1/projects/{project.slug}/gold/{doc.external_id}"
    ).json()
    s0 = body["sentences"][0]
    assert s0["autoLevel"] == "manual"
    assert s0["tie"] is True, "une égalité doit être signalée à l'UI"
    assert s0["nCovering"] == 2


def test_no_tie_flag_on_clear_majority(scheme_with_themes, auth):
    """Non-régression : une majorité nette n'est jamais signalée comme égalité."""
    from claire.projects.models import ProjectMembership

    corpus = CorpusFactory()
    project, doc = _doc(corpus, scheme_with_themes, n=1)
    lead = UserFactory(username="q_maj_lead", role="annotator")
    ProjectMembership.objects.create(project=project, user=lead, role=MembershipRole.LEAD)
    for name, code in (("q_m1", "META"), ("q_m2", "META"), ("q_m3", "TERMINATION")):
        _annotate(project, doc, _annotator(project, doc, name), {0: code})

    s0 = auth(lead).get(
        f"/api/v1/projects/{project.slug}/gold/{doc.external_id}"
    ).json()["sentences"][0]
    assert s0["tie"] is False
    assert s0["autoLevel"] == "auto"


# ── Sécurité de l'acte de FIGER le gold ─────────────────────────────────────
def _campaign_ready(scheme, n=1):
    """Document prêt, entièrement décidé (accord strict), avec un lead arbitre."""
    from claire.projects.models import ProjectMembership

    corpus = CorpusFactory()
    project, doc = _doc(corpus, scheme, n=n)
    lead = UserFactory(username="f_lead", role="annotator")
    ProjectMembership.objects.create(project=project, user=lead, role=MembershipRole.LEAD)
    for name in ("f_a1", "f_a2"):
        _annotate(project, doc, _annotator(project, doc, name), {i: "META" for i in range(n)})
    return project, doc, lead


def test_finalize_requires_the_arbitration_lock(scheme_with_themes, auth):
    """⭐ Figer le gold sous les doigts d'un autre arbitre est refusé (409)."""
    from claire.projects.models import ProjectMembership

    project, doc, lead = _campaign_ready(scheme_with_themes)
    other = UserFactory(username="f_other", role="annotator")
    ProjectMembership.objects.create(project=project, user=other, role=MembershipRole.LEAD)

    base = f"/api/v1/projects/{project.slug}/gold/{doc.external_id}"
    auth(lead).get(base)  # matérialise + auto-résout
    assert auth(other).post(f"{base}/lock", {}, format="json").status_code == 200

    r = auth(lead).post(f"{base}/submit", {}, format="json")
    assert r.status_code == 409, "finaliser sans détenir le verrou doit être refusé"


def test_finalize_is_idempotent(scheme_with_themes, auth):
    """Un second POST /submit ne réécrit ni la date de gel ni l'historique."""
    from claire.gold.models import ArbitrationEvent, GoldResolution

    project, doc, lead = _campaign_ready(scheme_with_themes)
    base = f"/api/v1/projects/{project.slug}/gold/{doc.external_id}"
    auth(lead).get(base)
    auth(lead).post(f"{base}/lock", {}, format="json")

    assert auth(lead).post(f"{base}/submit", {}, format="json").status_code == 200
    resolution = GoldResolution.objects.get(project=project, document=doc)
    first = resolution.finalized_at
    n_events = ArbitrationEvent.objects.filter(resolution=resolution, verb="finalize").count()

    assert auth(lead).post(f"{base}/submit", {}, format="json").status_code == 200
    resolution.refresh_from_db()
    assert resolution.finalized_at == first, "la date de gel ne doit jamais être réécrite"
    assert (
        ArbitrationEvent.objects.filter(resolution=resolution, verb="finalize").count()
        == n_events
    )
