"""Simulation EXHAUSTIVE de la résolution GOLD — du bootstrap de campagne à l'export.

Conformément aux instructions : on crée des **annotateurs dérivés des LLM** (claude/codex/
mistral), dont les annotations proviennent de LEURS pré-annotations
(`seed_annotation_from_preannotation`), et on simule **tous les scénarios** de résolution.

Rappel de fond : la résolution est PUREMENT inter-annotateurs. Les LLM qui restent en
RÉFÉRENCE (PreAnnotation) ne doivent JAMAIS changer le gold — c'est vérifié explicitement.
"""

import json
import os

import pytest

from claire.annotations.models import (
    AnnotationStatus,
    Clause,
    ClauseRole,
    ClauseTheme,
)
from claire.annotations.services import transition_status
from claire.corpora.models import Document, Sentence
from claire.gold.models import GoldResolution, GoldSentence
from claire.imports.models import Judge, PreAnnotation, PreClause
from claire.imports.services import seed_annotation_from_preannotation
from claire.projects.models import Assignment, MembershipRole, ProjectMembership
from tests.conftest import CorpusFactory, DocumentFactory, ProjectFactory, UserFactory

pytestmark = pytest.mark.django_db

JUDGES = [Judge.CLAUDE, Judge.CODEX, Judge.MISTRAL]


# ─────────────────────────────────────────────────────────────────────────────
# Helpers — bootstrap + « annotateurs à partir des LLM »
# ─────────────────────────────────────────────────────────────────────────────
def _make_document(corpus, scheme, n_sentences):
    project = ProjectFactory(corpus=corpus, scheme=scheme)
    doc = DocumentFactory(corpus=corpus, n_sentences=n_sentences)
    for i in range(n_sentences):
        Sentence.objects.create(document=doc, index=i, raw_text=f"sentence {i}")
    return project, doc


def llm_annotator(project, document, judge, per_sentence_codes, *, submit=True):
    """Crée un COMPTE ANNOTATEUR « <judge> » dont l'annotation est DÉRIVÉE de sa
    pré-annotation LLM (« créer des annotateurs à partir des LLM en utilisant leurs
    annotations »). La PreAnnotation source est supprimée ensuite pour ne pas doubler
    le juge en référence (l'annotateur EST désormais ce vote)."""
    user = UserFactory(username=f"llm_{judge}", email=f"{judge}@claire.local", role="annotator")
    ProjectMembership.objects.get_or_create(
        project=project, user=user, defaults={"role": MembershipRole.ANNOTATOR}
    )
    Assignment.objects.get_or_create(project=project, document=document, assignee=user)

    pre = PreAnnotation.objects.create(
        project=project, document=document, judge=judge, schema_version="v1", raw={}
    )
    for order, (idx, code) in enumerate(sorted(per_sentence_codes.items())):
        PreClause.objects.create(preannotation=pre, anchor_index=idx, theme_code=code, order=order)

    annotation = seed_annotation_from_preannotation(pre, user)
    pre.delete()  # l'annotation incarne désormais ce vote ; pas de double-comptage
    if submit:
        transition_status(annotation, AnnotationStatus.SUBMITTED, user)
    return user, annotation


def reference_judge(project, document, judge, per_sentence_codes):
    """Juge LLM en RÉFÉRENCE pure (PreAnnotation) — ne doit jamais changer le gold."""
    pre = PreAnnotation.objects.create(
        project=project, document=document, judge=judge, schema_version="ref", raw={}
    )
    for order, (idx, code) in enumerate(sorted(per_sentence_codes.items())):
        PreClause.objects.create(preannotation=pre, anchor_index=idx, theme_code=code, order=order)
    return pre


def arbiter(project):
    lead = UserFactory(username="sim_lead", role="annotator")
    ProjectMembership.objects.create(project=project, user=lead, role=MembershipRole.LEAD)
    return lead


def detail(auth, user, project, doc):
    return auth(user).get(f"/api/v1/projects/{project.slug}/gold/{doc.external_id}")


# ─────────────────────────────────────────────────────────────────────────────
# 1. Matrice de scénarios (1 phrase) — TOUS les cas de résolution
# ─────────────────────────────────────────────────────────────────────────────
# (nom, votes annotateurs {judge: code|None}, refs LLM {judge: code}, attendu)
SCENARIOS = [
    ("accord_strict",
     {Judge.CLAUDE: "META", Judge.CODEX: "META", Judge.MISTRAL: "META"}, {},
     {"agreementClass": "strict", "autoLevel": "auto_1click", "decided": True, "riskBand": "low", "primary": "META"}),
    ("accord_strict_malgre_llm_divergents",
     {Judge.CLAUDE: "META", Judge.CODEX: "META", Judge.MISTRAL: "META"},
     {Judge.CLAUDE: "TERMINATION", Judge.CODEX: "TERMINATION", Judge.MISTRAL: "TERMINATION"},
     {"agreementClass": "strict", "autoLevel": "auto_1click", "decided": True, "riskBand": "low", "primary": "META"}),
    ("majorite_deux_tiers",
     {Judge.CLAUDE: "META", Judge.CODEX: "META", Judge.MISTRAL: "TERMINATION"}, {},
     {"agreementClass": "majority", "autoLevel": "auto", "decided": True, "riskBand": "medium", "primary": "META"}),
    ("divergence_totale",
     {Judge.CLAUDE: "META", Judge.CODEX: "TERMINATION", Judge.MISTRAL: "PREAMBLE_SCOPE"}, {},
     {"agreementClass": "divergence", "autoLevel": "manual", "decided": False, "riskBand": "high"}),
    ("egalite_deux_annotateurs",
     {Judge.CLAUDE: "META", Judge.CODEX: "TERMINATION", Judge.MISTRAL: None}, {},
     {"agreementClass": "divergence", "autoLevel": "manual", "decided": False, "riskBand": "high"}),
    ("annotateur_unique",
     {Judge.CLAUDE: "META", Judge.CODEX: None, Judge.MISTRAL: None}, {},
     {"agreementClass": "strict", "autoLevel": "auto_1click", "decided": True, "riskBand": "low", "primary": "META"}),
    ("phrase_partiellement_couverte",
     {Judge.CLAUDE: "META", Judge.CODEX: "META", Judge.MISTRAL: None}, {},
     {"agreementClass": "strict", "autoLevel": "auto_1click", "decided": True, "riskBand": "low", "primary": "META"}),
    ("code_llm_hors_schema_rabattu_sur_refuge",
     {Judge.CLAUDE: "LIABILITY", Judge.CODEX: "LIABILITY", Judge.MISTRAL: "LIABILITY"}, {},
     {"agreementClass": "strict", "autoLevel": "auto_1click", "decided": True, "primary": "MISC_BOILERPLATE"}),
]


@pytest.mark.parametrize("name,votes,refs,expect", SCENARIOS, ids=[s[0] for s in SCENARIOS])
def test_scenario_resolution(scheme_with_themes, auth, name, votes, refs, expect):
    corpus = CorpusFactory()
    project, doc = _make_document(corpus, scheme_with_themes, n_sentences=1)
    lead = arbiter(project)
    for judge, code in votes.items():
        if code is not None:
            llm_annotator(project, doc, judge, {0: code})
    for judge, code in refs.items():
        reference_judge(project, doc, judge, {0: code})

    body = detail(auth, lead, project, doc).json()
    s0 = body["sentences"][0]
    for key, val in expect.items():
        assert s0[key] == val, f"[{name}] {key}: {s0[key]!r} != {val!r}"
    # INVARIANT : aucun « conflit humain vs LLM » — humanDissent toujours faux.
    assert s0["humanDissent"] is False


# ─────────────────────────────────────────────────────────────────────────────
# 2. Les LLM en RÉFÉRENCE ne changent JAMAIS le gold
# ─────────────────────────────────────────────────────────────────────────────
def test_reference_llms_never_change_gold(scheme_with_themes, auth):
    corpus = CorpusFactory()
    # Sans référence.
    p1, d1 = _make_document(corpus, scheme_with_themes, 1)
    lead1 = arbiter(p1)
    for j in JUDGES:
        llm_annotator(p1, d1, j, {0: "META"})
    s_plain = detail(auth, lead1, p1, d1).json()["sentences"][0]

    # Mêmes annotateurs, mais avec 3 juges LLM de référence en désaccord total.
    p2, d2 = _make_document(corpus, scheme_with_themes, 1)
    lead2 = arbiter(p2)
    for j in JUDGES:
        llm_annotator(p2, d2, j, {0: "META"})
    reference_judge(p2, d2, Judge.CLAUDE, {0: "TERMINATION"})
    reference_judge(p2, d2, Judge.CODEX, {0: "PREAMBLE_SCOPE"})
    reference_judge(p2, d2, Judge.MISTRAL, {0: "MISC_BOILERPLATE"})
    s_ref = detail(auth, lead2, p2, d2).json()["sentences"][0]

    for key in ("agreementClass", "autoLevel", "decided", "riskBand", "primary", "confidence"):
        assert s_ref[key] == s_plain[key]
    assert len(s_ref["llms"]) == 3 and len(s_plain["llms"]) == 0  # référence présente mais inerte


# ─────────────────────────────────────────────────────────────────────────────
# 3. Flux END-TO-END : bootstrap → annotateurs LLM → recompute → arbitrage → export
# ─────────────────────────────────────────────────────────────────────────────
def test_full_flow_bootstrap_to_export(scheme_with_themes, auth, settings, tmp_path):
    corpus = CorpusFactory()
    project, doc = _make_document(corpus, scheme_with_themes, n_sentences=4)
    lead = arbiter(project)

    # 3 annotateurs DÉRIVÉS DES LLM, divergence contrôlée :
    #  s0 accord strict ; s1 majorité 2/3 ; s2 divergence ; s3 strict.
    llm_annotator(project, doc, Judge.CLAUDE, {0: "META", 1: "TERMINATION", 2: "META", 3: "META"})
    llm_annotator(project, doc, Judge.CODEX, {0: "META", 1: "TERMINATION", 2: "TERMINATION", 3: "META"})
    llm_annotator(project, doc, Judge.MISTRAL, {0: "META", 1: "META", 2: "PREAMBLE_SCOPE", 3: "META"})

    # Recompute (matérialise + auto-résout s0,s1,s3) ; s2 (divergence) reste à arbitrer.
    body = detail(auth, lead, project, doc).json()
    sents = {s["index"]: s for s in body["sentences"]}
    assert sents[0]["decided"] and sents[0]["autoLevel"] == "auto_1click"
    assert sents[1]["decided"] and sents[1]["autoLevel"] == "auto"
    assert not sents[2]["decided"] and sents[2]["agreementClass"] == "divergence"
    assert sents[3]["decided"]
    assert body["pctResolved"] == pytest.approx(0.75)

    # Arbitrage humain de la divergence restante.
    r = auth(lead).post(
        f"/api/v1/projects/{project.slug}/gold/{doc.external_id}/decide",
        {"index": 2, "primary": "META", "comment": "tranché par l'arbitre"}, format="json",
    )
    assert r.status_code == 200, r.content
    assert r.json()["pctResolved"] == pytest.approx(1.0)
    gs = GoldSentence.objects.get(resolution__document=doc, index=2)
    assert gs.decided and not gs.auto_resolved and gs.decided_by_id == lead.id

    # Export du gold.
    from claire.exports.models import ExportJob
    from claire.exports.services import run_export

    settings.EXPORTS_DIR = str(tmp_path)
    job = ExportJob.objects.create(
        project=project, format="jsonl", scope={"gold": True}, requested_by=lead
    )
    run_export(job)
    job.refresh_from_db()
    assert job.status == "done"
    assert job.manifest["kind"] == "gold"
    assert job.manifest["n_decided"] == 4
    assert os.path.exists(job.artifact_path)
    rows = [json.loads(l) for l in open(job.artifact_path, encoding="utf-8") if l.strip()]
    doc_row = next(r for r in rows if r["document"] == doc.external_id)
    by_idx = {s["index"]: s for s in doc_row["sentences"]}
    assert by_idx[2]["arbitration"]["decided_by"] == lead.username  # décision humaine tracée
    assert by_idx[0]["arbitration"]["auto_resolved"] is True


# ─────────────────────────────────────────────────────────────────────────────
# 4. La config pilote l'auto-résolution (majorité désactivée)
# ─────────────────────────────────────────────────────────────────────────────
def test_config_majority_off_keeps_majority_manual(scheme_with_themes, auth):
    corpus = CorpusFactory()
    project, doc = _make_document(corpus, scheme_with_themes, 1)
    lead = arbiter(project)
    llm_annotator(project, doc, Judge.CLAUDE, {0: "META"})
    llm_annotator(project, doc, Judge.CODEX, {0: "META"})
    llm_annotator(project, doc, Judge.MISTRAL, {0: "TERMINATION"})

    auth(lead).patch(
        f"/api/v1/projects/{project.slug}/gold/config",
        {"autoResolve": {"majority": False}}, format="json",
    )
    s0 = detail(auth, lead, project, doc).json()["sentences"][0]
    assert s0["agreementClass"] == "majority"
    assert s0["decided"] is False  # la bascule a désactivé l'auto sur les majorités


# ─────────────────────────────────────────────────────────────────────────────
# 5. Multi-label : secondaire porté par ≥2 annotateurs (issu des LLM)
# ─────────────────────────────────────────────────────────────────────────────
def _seed_multilabel(project, doc, judges, primary, secondary):
    """Annotateurs (dérivés LLM) portant `primary` + un `secondary` multi-label."""
    themes = {t.code: t for t in project.scheme.themes.all()}
    for judge in judges:
        user, ann = llm_annotator(project, doc, judge, {0: primary}, submit=False)
        clause = ann.clauses.get(anchor_sentence__index=0)
        ClauseTheme.objects.create(clause=clause, theme=themes[primary], role=ClauseRole.PRIMARY)
        ClauseTheme.objects.create(clause=clause, theme=themes[secondary], role=ClauseRole.SECONDARY)
        transition_status(ann, AnnotationStatus.SUBMITTED, user)


def test_multilabel_secondary_from_llm_annotators(scheme_with_themes, auth):
    corpus = CorpusFactory()
    project, doc = _make_document(corpus, scheme_with_themes, 1)
    lead = arbiter(project)
    _seed_multilabel(project, doc, (Judge.CLAUDE, Judge.CODEX), "META", "TERMINATION")
    llm_annotator(project, doc, Judge.MISTRAL, {0: "META"})

    s0 = detail(auth, lead, project, doc).json()["sentences"][0]
    assert s0["primary"] == "META"
    assert "TERMINATION" in s0["proposedSecondaries"]


def test_secondary_policy_required_promotes_advisory_does_not(scheme_with_themes, auth):
    corpus = CorpusFactory()
    # ADVISORY (défaut) : le secondaire est PROPOSÉ mais pas promu dans le gold auto.
    p1, d1 = _make_document(corpus, scheme_with_themes, 1)
    lead1 = arbiter(p1)
    _seed_multilabel(p1, d1, (Judge.CLAUDE, Judge.CODEX), "META", "TERMINATION")
    llm_annotator(p1, d1, Judge.MISTRAL, {0: "META"})
    s_adv = detail(auth, lead1, p1, d1).json()["sentences"][0]
    assert "TERMINATION" in s_adv["proposedSecondaries"]
    assert s_adv["decided"] is True
    assert s_adv["secondaries"] == []  # advisory : non promu d'office

    # REQUIRED : le secondaire porté par ≥2 annotateurs est promu dans le gold auto.
    p2, d2 = _make_document(corpus, scheme_with_themes, 1)
    lead2 = arbiter(p2)
    _seed_multilabel(p2, d2, (Judge.CLAUDE, Judge.CODEX), "META", "TERMINATION")
    llm_annotator(p2, d2, Judge.MISTRAL, {0: "META"})
    auth(lead2).patch(f"/api/v1/projects/{p2.slug}/gold/config", {"secondaryPolicy": "required"}, format="json")
    s_req = detail(auth, lead2, p2, d2).json()["sentences"][0]
    assert s_req["secondaries"] == ["TERMINATION"]  # required : promu


def test_per_annotator_weighting_changes_gold_end_to_end(scheme_with_themes, auth):
    corpus = CorpusFactory()
    project, doc = _make_document(corpus, scheme_with_themes, 1)
    lead = arbiter(project)
    llm_annotator(project, doc, Judge.CLAUDE, {0: "META"})
    llm_annotator(project, doc, Judge.CODEX, {0: "TERMINATION"})
    llm_annotator(project, doc, Judge.MISTRAL, {0: "TERMINATION"})

    # Sans pondération : majorité TERMINATION (2/3) → auto.
    base = detail(auth, lead, project, doc).json()["sentences"][0]
    assert base["proposedPrimary"] == "TERMINATION"

    # Surpondérer l'annotateur « claude » → le primaire bascule vers META (bout-en-bout config→moteur).
    auth(lead).patch(
        f"/api/v1/projects/{project.slug}/gold/config",
        {"annotatorWeights": {"llm_claude": 10}}, format="json",
    )
    weighted = detail(auth, lead, project, doc).json()["sentences"][0]
    assert weighted["proposedPrimary"] == "META"
    assert weighted["agreementClass"] == "majority"
    assert weighted["decided"] is False  # 1/3 des annotateurs seulement → reste manuel


def test_gold_csv_export(scheme_with_themes, auth, settings, tmp_path):
    from claire.exports.models import ExportJob
    from claire.exports.services import run_export

    corpus = CorpusFactory()
    project, doc = _make_document(corpus, scheme_with_themes, 1)
    lead = arbiter(project)
    for j in JUDGES:
        llm_annotator(project, doc, j, {0: "META"})
    detail(auth, lead, project, doc)  # matérialise + auto-résout

    settings.EXPORTS_DIR = str(tmp_path)
    job = ExportJob.objects.create(project=project, format="csv", scope={"gold": True}, requested_by=lead)
    run_export(job)
    job.refresh_from_db()
    assert job.status == "done"
    assert job.artifact_path.endswith(".csv")
    content = open(job.artifact_path, encoding="utf-8").read()
    header = content.splitlines()[0]
    assert "document" in header and "primary" in header and "decided_by" in header
    assert "META" in content


def test_multi_document_aggregation(scheme_with_themes, auth):
    corpus = CorpusFactory()
    project = ProjectFactory(corpus=corpus, scheme=scheme_with_themes)
    lead = arbiter(project)
    docs = []
    for k in range(2):
        d = DocumentFactory(corpus=corpus, external_id=f"Doc_{k}", n_sentences=1)
        Sentence.objects.create(document=d, index=0, raw_text="s")
        docs.append(d)
        for j in JUDGES:
            llm_annotator(project, d, j, {0: "META"})  # accord strict → résolu
        detail(auth, lead, project, d)  # matérialise chaque document

    # Toutes les phrases décidées (accord strict auto) → finalisables ; on les soumet.
    for d in docs:
        r = auth(lead).post(f"/api/v1/projects/{project.slug}/gold/{d.external_id}/submit", {}, format="json")
        assert r.status_code == 200, r.content

    # Cockpit : 2 documents résolus (finalisés).
    rows = auth(lead).get(f"/api/v1/projects/{project.slug}/gold/documents").json()["results"]
    resolved = [r for r in rows if r["document"]["externalId"].startswith("Doc_")]
    assert len(resolved) == 2
    assert all(r["status"] == "resolved" and r["pctResolved"] == 1.0 for r in resolved)

    # Finalisation persistée en DB.
    for d in docs:
        assert GoldResolution.objects.get(project=project, document=d).finalized_at is not None

    # Stats agrégées multi-documents : les annotateurs sont à 100 % du gold.
    stats = auth(lead).get(f"/api/v1/projects/{project.slug}/gold/stats").json()
    assert stats["documentsCompared"] == 2
    assert stats["closestToGold"]["pct"] == 100.0
