"""API GOLD (V2) — cockpit, atelier (recompute), décision, auto-résolution, permissions.

Campagne réaliste : 3 annotateurs humains + 3 juges LLM (claude/codex/mistral) aux votes
DIVERGENTS contrôlés sur un document de 5 phrases, couvrant accord strict, majorité,
divergence et signal fort « humain ≠ LLM ».
"""

from datetime import timedelta

import pytest
from django.utils import timezone

from claire.annotations.models import (
    Annotation,
    AnnotationStatus,
    Clause,
    ClauseRole,
    ClauseTheme,
)
from claire.gold.models import (
    ArbitrationEvent,
    ArbitrationVerb,
    GoldResolution,
    GoldSentence,
)
from claire.imports.models import Judge, PreAnnotation, PreClause
from claire.projects.models import MembershipRole, ProjectMembership
from tests.conftest import UserFactory

pytestmark = pytest.mark.django_db


# ─────────────────────────────────────────────────────────────────────────────
# Campagne de test
# ─────────────────────────────────────────────────────────────────────────────
def _submitted_annotation(project, document, user, per_sentence):
    """Crée une annotation SUBMITTED avec une clause mono-label par phrase couverte.

    per_sentence : dict {index: code} (absent = phrase non couverte)."""
    ann = Annotation.objects.create(
        project=project, document=document, annotator=user,
        status=AnnotationStatus.SUBMITTED,
    )
    sents = {s.index: s for s in document.sentences.all()}
    themes = project.scheme.themes.all()
    code_to_theme = {t.code: t for t in themes}
    for idx, code in per_sentence.items():
        Clause.objects.create(
            annotation=ann, anchor_sentence=sents[idx], theme=code_to_theme[code],
        )
    return ann


def _judge(project, document, judge, per_sentence):
    pre = PreAnnotation.objects.create(
        project=project, document=document, judge=judge,
        schema_version="v1", raw={},
    )
    for idx, code in per_sentence.items():
        PreClause.objects.create(
            preannotation=pre, anchor_index=idx, theme_code=code, order=idx,
        )
    return pre


@pytest.fixture
def campaign(project, document_with_sentences):
    """3 annotateurs + 3 juges LLM, votes divergents contrôlés (5 phrases)."""
    doc = document_with_sentences
    alice = UserFactory(username="g_alice", role="annotator")
    bob = UserFactory(username="g_bob", role="annotator")
    carol = UserFactory(username="g_carol", role="annotator")
    lead = UserFactory(username="g_lead", role="annotator")
    rev = UserFactory(username="g_rev", role="reviewer")
    for u in (alice, bob, carol):
        ProjectMembership.objects.create(project=project, user=u, role=MembershipRole.ANNOTATOR)
    ProjectMembership.objects.create(project=project, user=lead, role=MembershipRole.LEAD)
    ProjectMembership.objects.create(project=project, user=rev, role=MembershipRole.REVIEWER)

    # s0 strict META ; s1 majorité TERMINATION ; s2 divergence ; s3 dissent humain≠LLM ; s4 strict (carol absent)
    _submitted_annotation(project, doc, alice, {0: "META", 1: "TERMINATION", 2: "META", 3: "META", 4: "META"})
    _submitted_annotation(project, doc, bob, {0: "META", 1: "TERMINATION", 2: "TERMINATION", 3: "META", 4: "META"})
    _submitted_annotation(project, doc, carol, {0: "META", 1: "META", 2: "PREAMBLE_SCOPE", 3: "META"})

    llm_votes = {0: "META", 1: "TERMINATION", 2: "META", 3: "TERMINATION", 4: "META"}
    for j in (Judge.CLAUDE, Judge.CODEX, Judge.MISTRAL):
        _judge(project, doc, j, llm_votes)

    return {
        "project": project, "doc": doc,
        "alice": alice, "bob": bob, "carol": carol, "lead": lead, "rev": rev,
    }


def _detail(auth, user, project, doc):
    client = auth(user)
    return client.get(f"/api/v1/projects/{project.slug}/gold/{doc.external_id}")


# ─────────────────────────────────────────────────────────────────────────────
# Atelier — recompute & propositions
# ─────────────────────────────────────────────────────────────────────────────
def test_detail_returns_per_sentence_votes_and_proposals(campaign, auth):
    c = campaign
    r = _detail(auth, c["lead"], c["project"], c["doc"])
    assert r.status_code == 200
    body = r.json()
    assert body["document"]["nSentences"] == 5
    sents = {s["index"]: s for s in body["sentences"]}

    # s0 : accord strict META, LLM concordants → auto_1click, auto-résolu.
    assert sents[0]["agreementClass"] == "strict"
    assert sents[0]["autoLevel"] == "auto_1click"
    assert sents[0]["decided"] is True
    assert sents[0]["autoResolved"] is True
    assert sents[0]["primary"] == "META"
    assert len(sents[0]["annotators"]) == 3
    assert len(sents[0]["llms"]) == 3

    # s1 : majorité TERMINATION + LLM unanimes → auto.
    assert sents[1]["agreementClass"] == "majority"
    assert sents[1]["autoLevel"] == "auto"
    assert sents[1]["decided"] is True

    # s2 : divergence totale → manuel, non décidé, risque haut.
    assert sents[2]["agreementClass"] == "divergence"
    assert sents[2]["autoLevel"] == "manual"
    assert sents[2]["decided"] is False
    assert sents[2]["riskBand"] == "high"

    # s3 : humains unanimes META mais LLM unanimes TERMINATION → signal fort.
    assert sents[3]["humanDissent"] is True
    assert sents[3]["autoLevel"] == "manual"
    assert sents[3]["decided"] is False
    assert sents[3]["riskBand"] == "high"

    # Avancement : 3 décidées (s0,s1,s4) / 5.
    assert body["status"] == "in_progress"
    assert body["pctResolved"] == pytest.approx(0.6)


def test_recompute_is_idempotent(campaign, auth):
    c = campaign
    _detail(auth, c["lead"], c["project"], c["doc"])
    res = GoldResolution.objects.get(project=c["project"], document=c["doc"])
    first = res.sentences.filter(decided=True).count()
    _detail(auth, c["lead"], c["project"], c["doc"])
    res.refresh_from_db()
    assert res.sentences.filter(decided=True).count() == first == 3


# ─────────────────────────────────────────────────────────────────────────────
# Décision humaine
# ─────────────────────────────────────────────────────────────────────────────
def test_arbiter_can_decide_divergent_sentence(campaign, auth):
    c = campaign
    _detail(auth, c["lead"], c["project"], c["doc"])  # crée la résolution
    client = auth(c["rev"])  # reviewer = arbitre par défaut
    r = client.post(
        f"/api/v1/projects/{c['project'].slug}/gold/{c['doc'].external_id}/decide",
        {"index": 2, "primary": "META", "comment": "tranché"},
        format="json",
    )
    assert r.status_code == 200, r.content
    body = r.json()
    assert body["decided"] is True
    assert body["autoResolved"] is False
    assert body["primary"] == "META"
    gs = GoldSentence.objects.get(resolution__document=c["doc"], index=2)
    assert gs.decided_by_id == c["rev"].id
    assert gs.comment == "tranché"
    # 4 décidées / 5 désormais.
    assert body["pctResolved"] == pytest.approx(0.8)


def test_plain_annotator_cannot_decide(campaign, auth):
    c = campaign
    _detail(auth, c["lead"], c["project"], c["doc"])
    client = auth(c["alice"])  # simple annotateur
    r = client.post(
        f"/api/v1/projects/{c['project'].slug}/gold/{c['doc'].external_id}/decide",
        {"index": 2, "primary": "META"},
        format="json",
    )
    assert r.status_code == 403


def test_decide_rejected_when_project_locked(campaign, auth):
    c = campaign
    _detail(auth, c["lead"], c["project"], c["doc"])
    c["project"].locked = True
    c["project"].save(update_fields=["locked"])
    client = auth(c["lead"])
    r = client.post(
        f"/api/v1/projects/{c['project'].slug}/gold/{c['doc'].external_id}/decide",
        {"index": 2, "primary": "META"},
        format="json",
    )
    assert r.status_code == 423


def test_decide_unknown_theme_is_400(campaign, auth):
    c = campaign
    _detail(auth, c["lead"], c["project"], c["doc"])
    client = auth(c["lead"])
    r = client.post(
        f"/api/v1/projects/{c['project'].slug}/gold/{c['doc'].external_id}/decide",
        {"index": 2, "primary": "NOT_IN_SCHEME"},
        format="json",
    )
    assert r.status_code == 400


def test_human_decision_survives_recompute(campaign, auth):
    c = campaign
    _detail(auth, c["lead"], c["project"], c["doc"])
    client = auth(c["lead"])
    client.post(
        f"/api/v1/projects/{c['project'].slug}/gold/{c['doc'].external_id}/decide",
        {"index": 2, "primary": "TERMINATION", "comment": "humain"},
        format="json",
    )
    # Recompute (nouveau GET) ne doit PAS écraser la décision humaine.
    _detail(auth, c["lead"], c["project"], c["doc"])
    gs = GoldSentence.objects.get(resolution__document=c["doc"], index=2)
    assert gs.decided is True
    assert gs.auto_resolved is False
    assert gs.primary_theme.code == "TERMINATION"
    assert gs.decided_by_id == c["lead"].id


# ─────────────────────────────────────────────────────────────────────────────
# Auto-résolution & cockpit
# ─────────────────────────────────────────────────────────────────────────────
def test_auto_resolve_endpoint(campaign, auth):
    c = campaign
    client = auth(c["lead"])
    r = client.post(
        f"/api/v1/projects/{c['project'].slug}/gold/{c['doc'].external_id}/auto-resolve",
        {}, format="json",
    )
    assert r.status_code == 200, r.content
    body = r.json()
    assert body["autoResolved"] == 3  # s0, s1, s4
    assert body["decided"] == 3
    assert body["status"] == "in_progress"


def test_cockpit_lists_documents_with_status(campaign, auth):
    c = campaign
    _detail(auth, c["lead"], c["project"], c["doc"])  # matérialise la résolution
    client = auth(c["lead"])
    r = client.get(f"/api/v1/projects/{c['project'].slug}/gold/documents")
    assert r.status_code == 200
    rows = r.json()["results"]
    row = next(x for x in rows if x["document"]["externalId"] == c["doc"].external_id)
    assert row["status"] == "in_progress"
    assert row["pctResolved"] == pytest.approx(0.6)
    assert row["counts"]["divergence"] == 1
    assert row["counts"]["majority"] == 1
    assert row["counts"]["decided"] == 3
    # s2 (divergence) + s3 (dissent) = 2 phrases à risque élevé.
    assert row["counts"]["highRisk"] == 2


def test_cockpit_unopened_document_is_unresolved(project, document_with_sentences, auth, annotator):
    ProjectMembership.objects.create(
        project=project, user=annotator, role=MembershipRole.LEAD
    )
    client = auth(annotator)
    r = client.get(f"/api/v1/projects/{project.slug}/gold/documents")
    assert r.status_code == 200
    rows = r.json()["results"]
    assert rows  # le document existe
    assert all(x["status"] == "unresolved" for x in rows)


# ─────────────────────────────────────────────────────────────────────────────
# Multi-label (secondaires)
# ─────────────────────────────────────────────────────────────────────────────
def test_secondary_label_surfaces_in_proposal(project, document_with_sentences, auth, annotator):
    """Un secondaire porté par ≥2 annotateurs apparaît dans la proposition."""
    doc = document_with_sentences
    a = UserFactory(username="ml_a", role="annotator")
    b = UserFactory(username="ml_b", role="annotator")
    lead = UserFactory(username="ml_lead", role="annotator")
    for u in (a, b):
        ProjectMembership.objects.create(project=project, user=u, role=MembershipRole.ANNOTATOR)
    ProjectMembership.objects.create(project=project, user=lead, role=MembershipRole.LEAD)
    themes = {t.code: t for t in project.scheme.themes.all()}
    sents = {s.index: s for s in doc.sentences.all()}

    for u in (a, b):
        ann = Annotation.objects.create(
            project=project, document=doc, annotator=u, status=AnnotationStatus.SUBMITTED
        )
        clause = Clause.objects.create(annotation=ann, anchor_sentence=sents[0], theme=themes["TERMINATION"])
        ClauseTheme.objects.create(clause=clause, theme=themes["TERMINATION"], role=ClauseRole.PRIMARY)
        ClauseTheme.objects.create(clause=clause, theme=themes["META"], role=ClauseRole.SECONDARY)

    client = auth(lead)
    r = client.get(f"/api/v1/projects/{project.slug}/gold/{doc.external_id}")
    body = r.json()
    s0 = next(s for s in body["sentences"] if s["index"] == 0)
    assert s0["primary"] == "TERMINATION"
    assert "META" in s0["proposedSecondaries"]


# ─────────────────────────────────────────────────────────────────────────────
# Robustesse (corrections de revue)
# ─────────────────────────────────────────────────────────────────────────────
def test_human_decision_on_tail_survives_document_shrink(campaign, auth):
    """Le recompute ne doit JAMAIS effacer une décision humaine, même hors plage."""
    c = campaign
    client = auth(c["lead"])
    # Décision HUMAINE sur la dernière phrase (override de l'auto).
    client.post(
        f"/api/v1/projects/{c['project'].slug}/gold/{c['doc'].external_id}/decide",
        {"index": 4, "primary": "TERMINATION"}, format="json",
    )
    # Le document rétrécit (réimport/recorrection) : 5 → 3 phrases.
    c["doc"].n_sentences = 3
    c["doc"].save(update_fields=["n_sentences"])
    _detail(auth, c["lead"], c["project"], c["doc"])  # recompute

    gs = GoldSentence.objects.get(resolution__document=c["doc"], index=4)
    assert gs.decided is True and gs.auto_resolved is False
    assert gs.decided_by_id == c["lead"].id
    assert gs.primary_theme.code == "TERMINATION"


def test_unauthorized_decide_does_not_create_resolution(campaign, auth):
    """Un refus (403/423) ne doit créer AUCUNE ligne de résolution."""
    c = campaign
    GoldResolution.objects.filter(document=c["doc"]).delete()
    client = auth(c["alice"])  # simple annotateur → 403
    r = client.post(
        f"/api/v1/projects/{c['project'].slug}/gold/{c['doc'].external_id}/decide",
        {"index": 2, "primary": "META"}, format="json",
    )
    assert r.status_code == 403
    assert GoldResolution.objects.filter(document=c["doc"]).count() == 0


def test_decide_rejects_unknown_or_refuge_secondary(campaign, auth):
    c = campaign
    _detail(auth, c["lead"], c["project"], c["doc"])
    client = auth(c["lead"])
    base = f"/api/v1/projects/{c['project'].slug}/gold/{c['doc'].external_id}/decide"
    # Secondaire hors schéma → 400.
    r1 = client.post(base, {"index": 2, "primary": "META", "secondaries": ["NOPE"]}, format="json")
    assert r1.status_code == 400
    # Refuge en secondaire → 400.
    r2 = client.post(base, {"index": 2, "primary": "META", "secondaries": ["PREAMBLE_SCOPE"]}, format="json")
    assert r2.status_code == 400


def test_recompute_writes_nothing_when_unchanged(campaign, auth, django_assert_num_queries):
    """Idempotence DB : un 2ᵉ recompute sans changement n'émet aucun INSERT/UPDATE de phrase."""
    from django.db import connection
    from django.test.utils import CaptureQueriesContext

    c = campaign
    _detail(auth, c["lead"], c["project"], c["doc"])  # 1ʳᵉ matérialisation
    with CaptureQueriesContext(connection) as ctx:
        _detail(auth, c["lead"], c["project"], c["doc"])  # 2ᵉ : doit être en lecture
    writes = [q["sql"] for q in ctx.captured_queries
              if q["sql"].lstrip().upper().startswith(("INSERT", "UPDATE"))
              and "gold_goldsentence" in q["sql"].lower()]
    assert writes == [], writes


def test_cockpit_query_count_does_not_grow_with_documents(project, scheme_with_themes, auth):
    """Anti-N+1 : le cockpit fait le même nombre de requêtes avec 1 ou 2 documents résolus."""
    from django.db import connection
    from django.test.utils import CaptureQueriesContext

    from claire.corpora.models import Sentence

    lead = UserFactory(username="cq_lead", role="annotator")
    ProjectMembership.objects.create(project=project, user=lead, role=MembershipRole.LEAD)
    corpus = project.corpus

    def add_doc(ext):
        from claire.corpora.models import Document
        d = Document.objects.create(corpus=corpus, external_id=ext, title=ext, n_sentences=2)
        for i in range(2):
            Sentence.objects.create(document=d, index=i, raw_text=f"{ext}-{i}")
        return d

    client = auth(lead)
    url = f"/api/v1/projects/{project.slug}/gold/documents"

    d1 = add_doc("CQ1")
    client.get(f"/api/v1/projects/{project.slug}/gold/{d1.external_id}")  # matérialise
    with CaptureQueriesContext(connection) as ctx1:
        client.get(url)
    q1 = len(ctx1.captured_queries)

    d2 = add_doc("CQ2")
    client.get(f"/api/v1/projects/{project.slug}/gold/{d2.external_id}")  # matérialise
    with CaptureQueriesContext(connection) as ctx2:
        client.get(url)
    q2 = len(ctx2.captured_queries)

    assert q2 == q1, f"N+1 suspecté : {q1} requêtes avec 1 doc, {q2} avec 2"


# ─────────────────────────────────────────────────────────────────────────────
# V3 — verrou d'arbitrage temps réel (bail auto-expirant)
# ─────────────────────────────────────────────────────────────────────────────
def _lock_url(c, suffix=""):
    return f"/api/v1/projects/{c['project'].slug}/gold/{c['doc'].external_id}/lock{suffix}"


def test_lock_acquire_grants_to_arbiter(campaign, auth):
    c = campaign
    r = auth(c["lead"]).post(_lock_url(c), {}, format="json")
    assert r.status_code == 200, r.content
    body = r.json()
    assert body["locked"] is True
    assert body["heldByMe"] is True
    assert body["lockedBy"] == c["lead"].username
    assert body["expiresAt"] is not None


def test_lock_exclusive_second_arbiter_gets_409(campaign, auth):
    c = campaign
    auth(c["lead"]).post(_lock_url(c), {}, format="json")
    r = auth(c["rev"]).post(_lock_url(c), {}, format="json")
    assert r.status_code == 409
    assert c["lead"].username in r.json()["detail"]


def test_lock_non_arbiter_forbidden(campaign, auth):
    c = campaign
    r = auth(c["alice"]).post(_lock_url(c), {}, format="json")
    assert r.status_code == 403


def test_lock_heartbeat_extends_lease(campaign, auth):
    c = campaign
    client = auth(c["lead"])
    first = client.post(_lock_url(c), {}, format="json").json()["expiresAt"]
    # Rapproche artificiellement l'expiration, puis heartbeat doit la repousser.
    res = GoldResolution.objects.get(document=c["doc"])
    res.lock_expires_at = timezone.now() + timedelta(seconds=5)
    res.save(update_fields=["lock_expires_at"])
    r = client.post(_lock_url(c, "/heartbeat"), {}, format="json")
    assert r.status_code == 200
    assert r.json()["expiresAt"] > first or r.json()["heldByMe"] is True


def test_lock_heartbeat_after_expiry_is_409(campaign, auth):
    c = campaign
    client = auth(c["lead"])
    client.post(_lock_url(c), {}, format="json")
    res = GoldResolution.objects.get(document=c["doc"])
    res.lock_expires_at = timezone.now() - timedelta(seconds=1)  # expiré
    res.save(update_fields=["lock_expires_at"])
    r = client.post(_lock_url(c, "/heartbeat"), {}, format="json")
    assert r.status_code == 409


def test_expired_lock_can_be_acquired_by_another(campaign, auth):
    c = campaign
    auth(c["lead"]).post(_lock_url(c), {}, format="json")
    res = GoldResolution.objects.get(document=c["doc"])
    res.lock_expires_at = timezone.now() - timedelta(seconds=1)
    res.save(update_fields=["lock_expires_at"])
    r = auth(c["rev"]).post(_lock_url(c), {}, format="json")
    assert r.status_code == 200
    assert r.json()["lockedBy"] == c["rev"].username


def test_release_frees_lock(campaign, auth):
    c = campaign
    auth(c["lead"]).post(_lock_url(c), {}, format="json")
    rel = auth(c["lead"]).post(_lock_url(c, "/release"), {}, format="json")
    assert rel.status_code == 200
    assert rel.json()["locked"] is False
    # Un autre arbitre peut alors prendre le verrou.
    r = auth(c["rev"]).post(_lock_url(c), {}, format="json")
    assert r.status_code == 200


def test_lead_can_steal_lock(campaign, auth):
    c = campaign
    auth(c["rev"]).post(_lock_url(c), {}, format="json")  # rev tient le verrou
    r = auth(c["lead"]).post(_lock_url(c, "/steal"), {}, format="json")
    assert r.status_code == 200
    assert r.json()["lockedBy"] == c["lead"].username
    ev = ArbitrationEvent.objects.filter(
        resolution__document=c["doc"], verb=ArbitrationVerb.STEAL
    ).first()
    assert ev is not None
    assert ev.payload.get("from") == c["rev"].username


def test_reviewer_cannot_steal_lock(campaign, auth):
    c = campaign
    auth(c["lead"]).post(_lock_url(c), {}, format="json")
    r = auth(c["rev"]).post(_lock_url(c, "/steal"), {}, format="json")
    assert r.status_code == 403


def test_decide_blocked_when_locked_by_another(campaign, auth):
    c = campaign
    auth(c["rev"]).post(_lock_url(c), {}, format="json")  # rev verrouille
    r = auth(c["lead"]).post(
        f"/api/v1/projects/{c['project'].slug}/gold/{c['doc'].external_id}/decide",
        {"index": 2, "primary": "META"}, format="json",
    )
    assert r.status_code == 409


def test_decide_allowed_for_lock_holder(campaign, auth):
    c = campaign
    auth(c["lead"]).post(_lock_url(c), {}, format="json")
    r = auth(c["lead"]).post(
        f"/api/v1/projects/{c['project'].slug}/gold/{c['doc'].external_id}/decide",
        {"index": 2, "primary": "META"}, format="json",
    )
    assert r.status_code == 200
    assert r.json()["decided"] is True


def test_atelier_payload_exposes_lock_state(campaign, auth):
    c = campaign
    auth(c["lead"]).post(_lock_url(c), {}, format="json")
    body = _detail(auth, c["rev"], c["project"], c["doc"]).json()
    assert body["lock"]["locked"] is True
    assert body["lock"]["lockedBy"] == c["lead"].username
    assert body["lock"]["heldByMe"] is False


def test_lock_acquire_blocked_when_project_frozen(campaign, auth):
    c = campaign
    c["project"].locked = True
    c["project"].save(update_fields=["locked"])
    r = auth(c["lead"]).post(_lock_url(c), {}, format="json")
    assert r.status_code == 423


# ─────────────────────────────────────────────────────────────────────────────
# V6 — stats de concordance + export gold
# ─────────────────────────────────────────────────────────────────────────────
def test_gold_stats_ranks_closest_to_gold(campaign, auth):
    c = campaign
    _detail(auth, c["lead"], c["project"], c["doc"])  # matérialise + auto-résout s0,s1,s4
    r = auth(c["lead"]).get(f"/api/v1/projects/{c['project'].slug}/gold/stats")
    assert r.status_code == 200, r.content
    body = r.json()
    anns = {a["username"]: a for a in body["annotators"]}
    # gold = [META, TERMINATION, None, None, META] → alice/bob 100%, carol 50%.
    assert anns["g_alice"]["pct"] == 100.0
    assert anns["g_bob"]["pct"] == 100.0
    assert anns["g_carol"]["pct"] == 50.0
    assert body["closestToGold"]["pct"] == 100.0
    # LLM↔GOLD présent (les 3 juges votent TERMINATION partout).
    assert any(j["judge"] in {"claude", "codex", "mistral"} for j in body["judges"])
    # A↔A (IAA) inclus.
    assert "iaa" in body


def test_gold_export_inline(campaign, auth, settings, tmp_path):
    import json
    import os

    from claire.exports.models import ExportJob
    from claire.exports.services import run_export

    c = campaign
    _detail(auth, c["lead"], c["project"], c["doc"])  # matérialise le gold
    settings.EXPORTS_DIR = str(tmp_path)
    job = ExportJob.objects.create(
        project=c["project"], format="jsonl", scope={"gold": True}, requested_by=c["lead"]
    )
    run_export(job)
    job.refresh_from_db()
    assert job.status == "done"
    assert job.manifest["kind"] == "gold"
    assert job.manifest["n_documents"] >= 1
    assert job.manifest["n_decided"] >= 3
    assert os.path.exists(job.artifact_path)
    lines = [json.loads(line) for line in open(job.artifact_path, encoding="utf-8") if line.strip()]
    atlas = next(r for r in lines if r["document"] == c["doc"].external_id)
    # Bloc d'arbitrage additif présent ; auto-résolu sur la phrase 0 (accord absolu).
    s0 = next(s for s in atlas["sentences"] if s["index"] == 0)
    assert s0["decided"] is True
    assert s0["arbitration"]["auto_resolved"] is True


def test_cockpit_hides_expired_lock(campaign, auth):
    c = campaign
    auth(c["lead"]).post(_lock_url(c), {}, format="json")
    res = GoldResolution.objects.get(document=c["doc"])
    res.lock_expires_at = timezone.now() - timedelta(seconds=1)  # bail expiré
    res.save(update_fields=["lock_expires_at"])
    r = auth(c["lead"]).get(f"/api/v1/projects/{c['project'].slug}/gold/documents")
    row = next(x for x in r.json()["results"] if x["document"]["externalId"] == c["doc"].external_id)
    assert row["locked"] is False  # l'expiration est prise en compte
    assert row["lockedBy"] is None
