"""Cycle de vie de la résolution GOLD :
- statuts précis (awaiting → ready → in_progress → resolved) avec gating sur la complétude
  des annotations (on ne résout qu'une fois TOUS les annotateurs assignés ont soumis) ;
- finalisation (soumission de la résolution) ;
- comptes annotateurs dérivés des LLM (claude/codex/mistral) ajoutables/retirables en config.
"""

import pytest

from claire.annotations.models import Annotation, AnnotationStatus, Clause
from claire.gold.models import GoldResolution
from claire.imports.models import Judge, PreAnnotation, PreClause
from claire.projects.models import (
    Assignment,
    MembershipRole,
    ProjectMembership,
)
from tests.conftest import CorpusFactory, DocumentFactory, ProjectFactory, UserFactory

pytestmark = pytest.mark.django_db


def _doc(corpus, scheme, n=1):
    project = ProjectFactory(corpus=corpus, scheme=scheme)
    d = DocumentFactory(corpus=corpus, n_sentences=n)
    from claire.corpora.models import Sentence

    for i in range(n):
        Sentence.objects.create(document=d, index=i, raw_text=f"s{i}")
    return project, d


def _lead(project):
    u = UserFactory(username="life_lead", role="annotator")
    ProjectMembership.objects.create(project=project, user=u, role=MembershipRole.LEAD)
    return u


def _assigned(project, doc, username, code=None):
    """Annotateur ASSIGNÉ ; soumet une annotation (code) ou reste en attente (None)."""
    u = UserFactory(username=username, role="annotator")
    ProjectMembership.objects.create(project=project, user=u, role=MembershipRole.ANNOTATOR)
    Assignment.objects.create(project=project, document=doc, assignee=u)
    if code is not None:
        themes = {t.code: t for t in project.scheme.themes.all()}
        sents = {s.index: s for s in doc.sentences.all()}
        ann = Annotation.objects.create(
            project=project, document=doc, annotator=u, status=AnnotationStatus.SUBMITTED
        )
        Clause.objects.create(annotation=ann, anchor_sentence=sents[0], theme=themes[code])
    return u


def _detail(auth, user, project, doc):
    return auth(user).get(f"/api/v1/projects/{project.slug}/gold/{doc.external_id}")


# ─────────────────────────────────────────────────────────────────────────────
# Statuts + gating
# ─────────────────────────────────────────────────────────────────────────────
def test_awaiting_blocks_resolution_until_all_submit(scheme_with_themes, auth):
    corpus = CorpusFactory()
    project, doc = _doc(corpus, scheme_with_themes)
    lead = _lead(project)
    _assigned(project, doc, "life_a1", code="META")
    a2 = _assigned(project, doc, "life_a2", code=None)  # assigné mais PAS soumis

    body = _detail(auth, lead, project, doc).json()
    assert body["status"] == "awaiting"
    assert body["readiness"] == {"expected": 2, "submitted": 1, "missing": 1, "ready": False}
    assert body["sentences"][0]["decided"] is False  # aucune auto-résolution prématurée

    # Décision refusée tant que la résolution n'est pas possible.
    r = auth(lead).post(
        f"/api/v1/projects/{project.slug}/gold/{doc.external_id}/decide",
        {"index": 0, "primary": "META"}, format="json",
    )
    assert r.status_code == 409

    # Le 2ᵉ annotateur soumet → la résolution devient possible (et s'auto-résout : accord strict).
    themes = {t.code: t for t in project.scheme.themes.all()}
    ann = Annotation.objects.create(
        project=project, document=doc, annotator=a2, status=AnnotationStatus.SUBMITTED
    )
    Clause.objects.create(annotation=ann, anchor_sentence=doc.sentences.get(index=0), theme=themes["META"])

    body2 = _detail(auth, lead, project, doc).json()
    assert body2["readiness"]["ready"] is True
    assert body2["sentences"][0]["decided"] is True  # accord strict auto-résolu


def test_ready_status_when_no_auto(scheme_with_themes, auth):
    corpus = CorpusFactory()
    project, doc = _doc(corpus, scheme_with_themes)
    lead = _lead(project)
    _assigned(project, doc, "rd_a1", code="META")
    _assigned(project, doc, "rd_a2", code="TERMINATION")  # divergence → rien d'auto

    body = _detail(auth, lead, project, doc).json()
    assert body["status"] == "ready"  # possible, pas commencé
    assert body["sentences"][0]["decided"] is False
    assert body["canFinalize"] is False


def test_finalize_resolution(scheme_with_themes, auth):
    corpus = CorpusFactory()
    project, doc = _doc(corpus, scheme_with_themes)
    lead = _lead(project)
    _assigned(project, doc, "fi_a1", code="META")
    _assigned(project, doc, "fi_a2", code="TERMINATION")  # divergence à arbitrer

    _detail(auth, lead, project, doc)
    base = _detail(auth, lead, project, doc).json()
    assert base["status"] == "ready"
    assert base["canFinalize"] is False

    # Arbitrer la divergence → toutes décidées → in_progress + finalisable.
    auth(lead).post(
        f"/api/v1/projects/{project.slug}/gold/{doc.external_id}/decide",
        {"index": 0, "primary": "META"}, format="json",
    )
    mid = _detail(auth, lead, project, doc).json()
    assert mid["status"] == "in_progress"
    assert mid["canFinalize"] is True

    # Soumettre la résolution → résolu + finalisé.
    r = auth(lead).post(f"/api/v1/projects/{project.slug}/gold/{doc.external_id}/submit", {}, format="json")
    assert r.status_code == 200, r.content
    res = GoldResolution.objects.get(document=doc)
    assert res.finalized_at is not None
    fin = _detail(auth, lead, project, doc).json()
    assert fin["status"] == "resolved"
    assert fin["finalized"] is True


def test_finalize_rejected_when_not_all_decided(scheme_with_themes, auth):
    corpus = CorpusFactory()
    project, doc = _doc(corpus, scheme_with_themes)
    lead = _lead(project)
    _assigned(project, doc, "fr_a1", code="META")
    _assigned(project, doc, "fr_a2", code="TERMINATION")  # divergence non tranchée
    _detail(auth, lead, project, doc)
    r = auth(lead).post(f"/api/v1/projects/{project.slug}/gold/{doc.external_id}/submit", {}, format="json")
    assert r.status_code == 409  # toutes les phrases doivent être décidées


def test_cockpit_reflects_statuses(scheme_with_themes, auth):
    corpus = CorpusFactory()
    project = ProjectFactory(corpus=corpus, scheme=scheme_with_themes)
    lead = _lead(project)
    from claire.corpora.models import Sentence

    # Doc A : incomplet → awaiting.
    a = DocumentFactory(corpus=corpus, external_id="LifeA", n_sentences=1)
    Sentence.objects.create(document=a, index=0, raw_text="s")
    _assigned(project, a, "ck_a1", code="META")
    _assigned(project, a, "ck_a2", code=None)
    # Doc B : complet + accord strict → s'auto-résout (in_progress).
    b = DocumentFactory(corpus=corpus, external_id="LifeB", n_sentences=1)
    Sentence.objects.create(document=b, index=0, raw_text="s")
    _assigned(project, b, "ck_b1", code="META")
    _assigned(project, b, "ck_b2", code="META")
    _detail(auth, lead, project, b)  # matérialise B

    rows = auth(lead).get(f"/api/v1/projects/{project.slug}/gold/documents").json()["results"]
    by_ext = {r["document"]["externalId"]: r for r in rows}
    assert by_ext["LifeA"]["status"] == "awaiting"
    assert by_ext["LifeA"]["readiness"]["submitted"] == 1
    assert by_ext["LifeB"]["status"] in ("in_progress", "ready")


# ─────────────────────────────────────────────────────────────────────────────
# Comptes annotateurs dérivés des LLM (ajout/retrait en config)
# ─────────────────────────────────────────────────────────────────────────────
def _judge_pre(project, doc, judge, code):
    pre = PreAnnotation.objects.create(project=project, document=doc, judge=judge, schema_version="v1", raw={})
    PreClause.objects.create(preannotation=pre, anchor_index=0, theme_code=code, order=0)
    return pre


def test_llm_annotators_list_add_remove(scheme_with_themes, auth):
    corpus = CorpusFactory()
    project, doc = _doc(corpus, scheme_with_themes)
    lead = _lead(project)
    _judge_pre(project, doc, Judge.CLAUDE, "META")

    base = f"/api/v1/projects/{project.slug}/gold/llm-annotators"
    # Liste : claude présent comme JUGE, pas encore annotateur.
    rows = auth(lead).get(base).json()["results"]
    claude = next(x for x in rows if x["judge"] == "claude")
    assert claude["added"] is False and claude["documents"] == 1

    # Ajout : crée le compte + annotation SOUMISE dérivée.
    r = auth(lead).post(base, {"judge": "claude", "action": "add"}, format="json")
    assert r.status_code == 200, r.content
    assert r.json()["annotationsCreated"] == 1
    from django.contrib.auth import get_user_model

    User = get_user_model()
    user = User.objects.get(username="claude")
    ann = Annotation.objects.get(project=project, annotator=user)
    assert ann.status == AnnotationStatus.SUBMITTED

    # Désormais annotateur ; n'apparaît PLUS en référence LLM (pas de double-comptage).
    body = _detail(auth, lead, project, doc).json()
    s0 = body["sentences"][0]
    assert any(a["voterId"] == "claude" for a in s0["annotators"])
    assert all(l["judge"] != "claude" for l in s0["llms"])
    assert auth(lead).get(base).json()["results"][0]["added"] is True

    # Retrait : redevient une référence LLM.
    r2 = auth(lead).post(base, {"judge": "claude", "action": "remove"}, format="json")
    assert r2.status_code == 200
    assert not Annotation.objects.filter(project=project, annotator=user).exists()
    body2 = _detail(auth, lead, project, doc).json()
    assert any(l["judge"] == "claude" for l in body2["sentences"][0]["llms"])


def test_llm_annotators_end_to_end_resolution(scheme_with_themes, auth):
    """Ajout des 3 juges comme annotateurs → résolution de bout en bout."""
    corpus = CorpusFactory()
    project, doc = _doc(corpus, scheme_with_themes)
    lead = _lead(project)
    _judge_pre(project, doc, Judge.CLAUDE, "META")
    _judge_pre(project, doc, Judge.CODEX, "META")
    _judge_pre(project, doc, Judge.MISTRAL, "TERMINATION")  # 2/3 majorité META

    base = f"/api/v1/projects/{project.slug}/gold/llm-annotators"
    for judge in ("claude", "codex", "mistral"):
        auth(lead).post(base, {"judge": judge, "action": "add"}, format="json")

    body = _detail(auth, lead, project, doc).json()
    assert body["readiness"] == {"expected": 3, "submitted": 3, "missing": 0, "ready": True}
    s0 = body["sentences"][0]
    assert len(s0["annotators"]) == 3
    assert s0["agreementClass"] == "majority"
    assert s0["decided"] is True  # majorité 2/3 → auto


def test_finalized_status_takes_priority_over_readiness_loss(scheme_with_themes, auth):
    corpus = CorpusFactory()
    project, doc = _doc(corpus, scheme_with_themes)
    lead = _lead(project)
    _assigned(project, doc, "fp_a1", code="META")
    _assigned(project, doc, "fp_a2", code="META")
    _detail(auth, lead, project, doc)  # auto-résolu (strict)
    auth(lead).post(f"/api/v1/projects/{project.slug}/gold/{doc.external_id}/submit", {}, format="json")

    # Un nouvel annotateur assigné non soumis ferait baisser la complétude…
    _assigned(project, doc, "fp_a3", code=None)
    body = _detail(auth, lead, project, doc).json()
    # …mais une résolution FINALISÉE reste « resolved » (pas de bandeaux contradictoires).
    assert body["status"] == "resolved"
    assert body["finalized"] is True


def test_stored_status_not_resolved_without_finalize(scheme_with_themes, auth):
    corpus = CorpusFactory()
    project, doc = _doc(corpus, scheme_with_themes)
    lead = _lead(project)
    _assigned(project, doc, "ss_a1", code="META")
    _assigned(project, doc, "ss_a2", code="META")  # accord strict → tout décidé (auto)
    body = _detail(auth, lead, project, doc).json()
    assert body["sentences"][0]["decided"] is True
    # Tout décidé mais NON soumis → statut effectif ET stocké = in_progress (jamais resolved).
    assert body["status"] == "in_progress"
    assert GoldResolution.objects.get(document=doc).status == "in_progress"


def test_promoting_judge_does_not_regress_unrelated_document(scheme_with_themes, auth):
    corpus = CorpusFactory()
    project = ProjectFactory(corpus=corpus, scheme=scheme_with_themes)
    lead = _lead(project)
    from claire.corpora.models import Sentence

    # docA : pas d'assignation, un humain a annoté+soumis → prêt.
    a = DocumentFactory(corpus=corpus, external_id="RegA", n_sentences=1)
    Sentence.objects.create(document=a, index=0, raw_text="s")
    human = UserFactory(username="reg_human", role="annotator")
    ProjectMembership.objects.create(project=project, user=human, role=MembershipRole.ANNOTATOR)
    themes = {t.code: t for t in project.scheme.themes.all()}
    ann = Annotation.objects.create(project=project, document=a, annotator=human, status=AnnotationStatus.SUBMITTED)
    Clause.objects.create(annotation=ann, anchor_sentence=a.sentences.get(index=0), theme=themes["META"])
    assert _detail(auth, lead, project, a).json()["readiness"]["ready"] is True

    # docB : claude a une pré-annotation ; on le promeut annotateur.
    b = DocumentFactory(corpus=corpus, external_id="RegB", n_sentences=1)
    Sentence.objects.create(document=b, index=0, raw_text="s")
    _judge_pre(project, b, Judge.CLAUDE, "META")
    auth(lead).post(f"/api/v1/projects/{project.slug}/gold/llm-annotators", {"judge": "claude", "action": "add"}, format="json")

    # docA (sans rapport avec claude) NE doit PAS régresser en « awaiting ».
    assert _detail(auth, lead, project, a).json()["readiness"]["ready"] is True


def test_add_llm_annotator_refuses_to_hijack_human_account(scheme_with_themes, auth):
    corpus = CorpusFactory()
    project, doc = _doc(corpus, scheme_with_themes)
    lead = _lead(project)
    _judge_pre(project, doc, Judge.CLAUDE, "META")
    # Un VRAI humain nommé « claude » (e-mail différent) existe déjà.
    UserFactory(username="claude", email="claude.human@univ.fr", role="annotator")
    r = auth(lead).post(
        f"/api/v1/projects/{project.slug}/gold/llm-annotators",
        {"judge": "claude", "action": "add"}, format="json",
    )
    assert r.status_code == 409  # refus : on ne détourne pas un compte humain


def test_llm_annotators_add_requires_lead_or_admin(scheme_with_themes, auth):
    corpus = CorpusFactory()
    project, doc = _doc(corpus, scheme_with_themes)
    _lead(project)
    _judge_pre(project, doc, Judge.CLAUDE, "META")
    plain = _assigned(project, doc, "na_plain", code="META")  # simple annotateur
    base = f"/api/v1/projects/{project.slug}/gold/llm-annotators"
    r = auth(plain).post(base, {"judge": "claude", "action": "add"}, format="json")
    assert r.status_code == 403
