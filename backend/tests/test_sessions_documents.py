"""Sessions vs Collaboration (ADR-001) — endpoint document-centré, exports, IAA N>=3.

Couvre :
- GET /projects/{slug}/documents : 1 ligne PAR document (anti-duplication), my_session,
  sessions[]/sessionsSummary réservés admin/lead, pas de fuite pour un annotateur.
- export scope.annotators ; manifeste format_requested/effective + warnings ; iaa_matrix.
- IAA détaillé sans double-comptage pour N>=3 annotateurs.
"""

from pathlib import Path

import pytest

from claire.annotations.models import Annotation, AnnotationStatus, Clause
from claire.corpora.models import Document, Sentence
from claire.exports.models import ExportFormat, ExportJob, ExportStatus
from claire.exports.services import run_export
from claire.projects.models import (
    Assignment,
    MembershipRole,
    ProjectMembership,
)
from tests.conftest import UserFactory

pytestmark = pytest.mark.django_db

API = "/api/v1"


def _doc(corpus, ext, n=5):
    d = Document.objects.create(corpus=corpus, external_id=ext, title=f"Doc {ext}", n_sentences=n)
    for i in range(n):
        Sentence.objects.create(document=d, index=i, raw_text=f"s{i}")
    return d


def _setup_campaign(project):
    """3 annotateurs membres + 2 documents + assignations croisées (l'union 'gonflerait'
    une liste dérivée des assignations à 6 lignes ; l'endpoint doit en rendre 2)."""
    corpus = project.corpus
    docs = list(corpus.documents.all())
    if len(docs) < 2:
        _doc(corpus, "DocB", 5)
    docs = list(corpus.documents.all().order_by("external_id"))
    annotators = [UserFactory(username=u, role="annotator") for u in ("jc.lamirel", "zahra.boulaich", "carla")]
    for u in annotators:
        ProjectMembership.objects.create(project=project, user=u, role=MembershipRole.ANNOTATOR)
    for d in docs:
        for u in annotators:
            Assignment.objects.create(project=project, document=d, assignee=u)
    return docs, annotators


def test_documents_endpoint_no_duplication(auth, admin_user, project):
    docs, annotators = _setup_campaign(project)
    client = auth(admin_user)
    resp = client.get(f"{API}/projects/{project.slug}/documents")
    assert resp.status_code == 200
    body = resp.json()
    # 1 ligne PAR document — jamais l'union des assignations (qui ferait 6).
    assert body["count"] == len(docs) == 2
    ids = [r["document"]["id"] for r in body["results"]]
    assert len(ids) == len(set(ids)), "documents dupliqués dans la réponse"


def test_documents_admin_sees_sessions_matrix(auth, admin_user, project):
    docs, annotators = _setup_campaign(project)
    # Une session soumise pour mesurer le rollup.
    a = Annotation.objects.create(
        project=project, document=docs[0], annotator=annotators[0],
        status=AnnotationStatus.SUBMITTED,
    )
    client = auth(admin_user)
    body = client.get(f"{API}/projects/{project.slug}/documents").json()
    row0 = next(r for r in body["results"] if r["document"]["id"] == docs[0].id)
    # admin/superuser -> sessions[] + sessionsSummary exposés (camelCase).
    assert "sessions" in row0
    assert len(row0["sessions"]) == 3
    assert row0["sessionsSummary"]["assigned"] == 3
    assert row0["sessionsSummary"]["submitted"] == 1
    submitted_session = next(s for s in row0["sessions"] if s["annotatorId"] == annotators[0].id)
    assert submitted_session["status"] == "submitted"
    assert submitted_session["annotationId"] == a.id


def test_documents_annotator_no_session_leak(auth, project):
    docs, annotators = _setup_campaign(project)
    me = annotators[0]
    # Ma session sur docs[0].
    Annotation.objects.create(project=project, document=docs[0], annotator=me, status=AnnotationStatus.DRAFT)
    client = auth(me)
    body = client.get(f"{API}/projects/{project.slug}/documents").json()
    row0 = next(r for r in body["results"] if r["document"]["id"] == docs[0].id)
    # Un annotateur NE voit PAS les sessions des autres (pas de matrice).
    assert "sessions" not in row0
    assert "sessionsSummary" not in row0
    # Mais voit SA session, correctement rattachée.
    assert row0["mySession"]["annotatorId"] == me.id
    assert row0["mySession"]["status"] == "draft"


def test_documents_admin_mine_flag_hides_sessions(auth, admin_user, project):
    _setup_campaign(project)
    client = auth(admin_user)
    body = client.get(f"{API}/projects/{project.slug}/documents?mine=1").json()
    assert all("sessions" not in r for r in body["results"])  # vue annotateur forcée


# ── Exports ────────────────────────────────────────────────────────────────────
def _submit_with_clause(project, document, annotator, scheme, theme_code="META"):
    a = Annotation.objects.create(
        project=project, document=document, annotator=annotator,
        status=AnnotationStatus.SUBMITTED,
    )
    Clause.objects.create(
        annotation=a, anchor_sentence=document.sentences.get(index=0),
        theme=scheme.themes_map[theme_code],
    )
    return a


def test_export_scope_annotators(auth, admin_user, project, scheme_with_themes, settings, tmp_path):
    settings.EXPORTS_DIR = tmp_path
    docs, annotators = _setup_campaign(project)
    _submit_with_clause(project, docs[0], annotators[0], scheme_with_themes)
    _submit_with_clause(project, docs[0], annotators[1], scheme_with_themes)
    job = ExportJob.objects.create(
        project=project, format=ExportFormat.JSONL,
        scope={"annotators": [annotators[0].username]}, requested_by=admin_user,
    )
    run_export(job)
    assert job.manifest["n_annotations"] == 1
    assert job.manifest["annotators"] == [annotators[0].username]


def _seed_one(annotation, scheme):
    Clause.objects.create(
        annotation=annotation, anchor_sentence=annotation.document.sentences.get(index=0),
        theme=scheme.themes_map["META"], validated=True,
    )
    annotation.status = AnnotationStatus.SUBMITTED
    annotation.save()


def test_export_format_fallback_traced(annotation, scheme_with_themes, admin_user, settings, tmp_path):
    settings.EXPORTS_DIR = tmp_path
    _seed_one(annotation, scheme_with_themes)
    # huggingface : non implémenté → repli TRACÉ (jamais silencieux), jamais 404.
    job = ExportJob.objects.create(
        project=annotation.project, format=ExportFormat.HUGGINGFACE, requested_by=admin_user,
    )
    run_export(job)
    assert job.manifest["format_requested"] == "huggingface"
    assert job.manifest["format_effective"] == "jsonl"
    assert any("huggingface" in w for w in job.manifest["warnings"])


def test_export_conll(annotation, scheme_with_themes, admin_user, settings, tmp_path):
    settings.EXPORTS_DIR = tmp_path
    _seed_one(annotation, scheme_with_themes)
    job = ExportJob.objects.create(
        project=annotation.project, format=ExportFormat.CONLL, requested_by=admin_user,
    )
    run_export(job)
    assert job.manifest["format_effective"] == "conll"
    assert job.manifest["warnings"] == []
    content = Path(job.artifact_path).read_text()
    assert job.artifact_path.endswith(".conll")
    assert "# annotator =" in content
    assert "\tMETA\t" in content  # colonne thème (TAB)


def test_export_xml(annotation, scheme_with_themes, admin_user, settings, tmp_path):
    settings.EXPORTS_DIR = tmp_path
    _seed_one(annotation, scheme_with_themes)
    job = ExportJob.objects.create(
        project=annotation.project, format=ExportFormat.XML, requested_by=admin_user,
    )
    run_export(job)
    assert job.manifest["format_effective"] == "xml"
    content = Path(job.artifact_path).read_text()
    assert job.artifact_path.endswith(".xml")
    assert content.startswith("<?xml")
    assert "<clause" in content and 'theme="META"' in content


def test_export_iaa_matrix(auth, admin_user, project, scheme_with_themes, settings, tmp_path):
    settings.EXPORTS_DIR = tmp_path
    docs, annotators = _setup_campaign(project)
    _submit_with_clause(project, docs[0], annotators[0], scheme_with_themes)
    _submit_with_clause(project, docs[0], annotators[1], scheme_with_themes)
    job = ExportJob.objects.create(
        project=project, format=ExportFormat.IAA_MATRIX, requested_by=admin_user,
    )
    run_export(job)
    assert job.status == ExportStatus.DONE
    content = Path(job.artifact_path).read_text()
    assert "annotator_a" in content.splitlines()[0]
    assert job.artifact_path.endswith(".csv")


# ── IAA N>=3 (anti double-comptage) ──────────────────────────────────────────────
def test_iaa_detail_no_double_count_n3(project, document_with_sentences, scheme_with_themes):
    """3 annotateurs en accord parfait → tous les κ (global, frontières, par thème) = 1.0.

    L'ancienne version concaténait les observations des 3 paires : un κ par thème
    restait correct à 1.0 dans le cas parfait, mais le `support` était gonflé. On
    vérifie ici que la mesure est cohérente et que perTheme moyenne bien par paire.
    """
    from claire.projects.iaa import project_iaa_detail

    document_with_sentences.n_sentences = 5
    document_with_sentences.save()
    meta = scheme_with_themes.themes_map["META"]
    term = scheme_with_themes.themes_map["TERMINATION"]
    users = [UserFactory(username=f"ann{i}") for i in range(3)]
    s = {i: document_with_sentences.sentences.get(index=i) for i in range(5)}
    for u in users:
        a = Annotation.objects.create(
            project=project, document=document_with_sentences, annotator=u,
            status=AnnotationStatus.SUBMITTED,
        )
        Clause.objects.create(annotation=a, anchor_sentence=s[0], theme=meta)
        Clause.objects.create(annotation=a, anchor_sentence=s[3], theme=term)

    detail = project_iaa_detail(project)
    assert detail is not None
    # 3 annotateurs => C(3,2) = 3 paires.
    assert detail["annotator_pairs"] == 3
    # Accord parfait sur toutes les paires : moyennes = 1.0 (pas d'effet de bord N>=3).
    assert detail["global_kappa"] == 1.0
    assert detail["boundary_kappa"] == 1.0
    assert all(t["kappa"] == 1.0 for t in detail["per_theme"])
