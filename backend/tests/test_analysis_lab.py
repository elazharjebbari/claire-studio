"""Pactiva Analysis Lab : snapshots de brouillons et historique reproductible."""

import pytest
from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.db import connection
from django.test import override_settings
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from claire.analysis.models import (
    AnalysisPreset,
    AnalysisReport,
    AnalysisReportArtifact,
    AnalysisSnapshot,
    ArtifactStatus,
    RunStatus,
)
from claire.analysis.reports import create_report_artifact, render_report_artifact
from claire.analysis.services import compare_reports, create_report, execute_run, queue_run
from claire.analysis.snapshots import create_snapshot
from claire.annotations.models import (
    Annotation,
    AnnotationStatus,
    AnnotationVersion,
    Clause,
    ClauseTheme,
)
from claire.corpora.models import ReferenceLabel, Sentence
from claire.gold.models import GoldResolution, GoldSentence
from claire.imports.models import PreAnnotation, PreClause
from claire.projects.models import Assignment, MembershipRole, ProjectMembership
from tests.conftest import CorpusFactory, DocumentFactory, ProjectFactory, UserFactory

pytestmark = pytest.mark.django_db
API = "/api/v1"


@pytest.fixture
def analysis_campaign(scheme_with_themes):
    corpus = CorpusFactory()
    document = DocumentFactory(corpus=corpus, n_sentences=5, title="Contrat secret")
    sentences = [
        Sentence.objects.create(
            document=document,
            index=index,
            raw_text=f"texte contractuel secret {index}",
        )
        for index in range(5)
    ]
    project = ProjectFactory(corpus=corpus, scheme=scheme_with_themes)
    alice = UserFactory(username="analysis_alice", role="annotator")
    bob = UserFactory(username="analysis_bob", role="annotator")
    reviewer = UserFactory(username="analysis_reviewer", role="reviewer")
    lead = UserFactory(username="analysis_lead", role="annotator")
    outsider = UserFactory(username="analysis_outsider", role="annotator")
    for user, role in [
        (alice, MembershipRole.ANNOTATOR),
        (bob, MembershipRole.ANNOTATOR),
        (reviewer, MembershipRole.REVIEWER),
        (lead, MembershipRole.LEAD),
    ]:
        ProjectMembership.objects.create(project=project, user=user, role=role)
    for user in [alice, bob]:
        Assignment.objects.create(project=project, document=document, assignee=user)
    alice_annotation = Annotation.objects.create(
        project=project, document=document, annotator=alice
    )
    bob_annotation = Annotation.objects.create(project=project, document=document, annotator=bob)
    Clause.objects.create(
        annotation=alice_annotation,
        anchor_sentence=sentences[2],
        theme=scheme_with_themes.themes_map["META"],
        evidence_span="ne doit jamais entrer dans le snapshot",
        rationale="raisonnement confidentiel",
        certainty=2,
        validated=True,
    )
    Clause.objects.create(
        annotation=bob_annotation,
        anchor_sentence=sentences[0],
        theme=scheme_with_themes.themes_map["TERMINATION"],
        certainty=1,
    )
    return {
        "project": project,
        "document": document,
        "sentences": sentences,
        "alice": alice,
        "bob": bob,
        "reviewer": reviewer,
        "lead": lead,
        "outsider": outsider,
        "alice_annotation": alice_annotation,
        "bob_annotation": bob_annotation,
    }


def _client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def test_annotator_can_snapshot_unpublished_work_without_peer_leak(analysis_campaign):
    ctx = analysis_campaign
    snapshot = create_snapshot(project=ctx["project"], user=ctx["alice"], label="Mon brouillon")

    assert snapshot.includes_drafts is True
    assert snapshot.visibility == "personal"
    assert snapshot.annotation_count == 1
    assert snapshot.draft_count == 1
    assert snapshot.manifest["annotationIds"] == [ctx["alice_annotation"].id]
    serialized = str(snapshot.payload)
    assert "analysis_bob" not in serialized
    assert "Contrat secret" not in serialized
    assert "texte contractuel secret" not in serialized
    assert "raisonnement confidentiel" not in serialized
    assert "ne doit jamais entrer" not in serialized


def test_lead_sees_drafts_but_reviewer_only_sees_published_peers(analysis_campaign):
    ctx = analysis_campaign
    lead_snapshot = create_snapshot(project=ctx["project"], user=ctx["lead"])
    assert lead_snapshot.annotation_count == 2
    assert lead_snapshot.draft_count == 2

    ctx["bob_annotation"].status = AnnotationStatus.SUBMITTED
    ctx["bob_annotation"].save(update_fields=["status", "updated_at"])
    reviewer_snapshot = create_snapshot(project=ctx["project"], user=ctx["reviewer"])
    ids = reviewer_snapshot.manifest["annotationIds"]
    assert ids == [ctx["bob_annotation"].id]
    assert reviewer_snapshot.draft_count == 0


def test_snapshot_fingerprint_is_stable_and_run_ignores_later_edits(analysis_campaign):
    ctx = analysis_campaign
    first = create_snapshot(project=ctx["project"], user=ctx["alice"])
    same_state = create_snapshot(project=ctx["project"], user=ctx["alice"])
    assert first.fingerprint == same_state.fingerprint

    run = execute_run(snapshot=first, user=ctx["alice"])
    original = run.result["overview"]
    assert original["draftAnnotations"] == 1
    assert original["coverageRate"] == 0.6

    Clause.objects.create(
        annotation=ctx["alice_annotation"],
        anchor_sentence=ctx["sentences"][0],
        theme=ctx["project"].scheme.themes.get(code="TERMINATION"),
        certainty=3,
        validated=True,
    )
    run.refresh_from_db()
    assert run.result["overview"] == original

    newer = create_snapshot(project=ctx["project"], user=ctx["alice"])
    newer_run = execute_run(snapshot=newer, user=ctx["alice"])
    assert newer.fingerprint != first.fingerprint
    assert newer_run.result["overview"]["coverageRate"] == 1.0


def test_snapshot_cannot_be_mutated_after_creation(analysis_campaign):
    snapshot = create_snapshot(
        project=analysis_campaign["project"], user=analysis_campaign["alice"]
    )
    snapshot.label = "tentative de réécriture"

    with pytest.raises(ValidationError, match="immuable"):
        snapshot.save()

    snapshot.refresh_from_db()
    assert snapshot.label == ""


def test_snapshot_query_budget_is_bounded(analysis_campaign):
    with CaptureQueriesContext(connection) as queries:
        snapshot = create_snapshot(
            project=analysis_campaign["project"], user=analysis_campaign["lead"]
        )

    assert snapshot.annotation_count == 2
    assert len(queries) <= 25


def test_reports_keep_history_and_compare_evolution(analysis_campaign):
    ctx = analysis_campaign
    old_snapshot = create_snapshot(project=ctx["project"], user=ctx["alice"])
    old_run = execute_run(snapshot=old_snapshot, user=ctx["alice"])
    old_report = create_report(run=old_run, user=ctx["alice"], title="Avant")

    Clause.objects.create(
        annotation=ctx["alice_annotation"],
        anchor_sentence=ctx["sentences"][0],
        theme=ctx["project"].scheme.themes.get(code="META"),
        validated=True,
    )
    new_snapshot = create_snapshot(project=ctx["project"], user=ctx["alice"])
    new_run = execute_run(snapshot=new_snapshot, user=ctx["alice"])
    new_report = create_report(run=new_run, user=ctx["alice"], title="Après")

    delta = compare_reports(new_report, old_report)["delta"]
    assert delta["coveredSentences"] == 2
    assert delta["coverageRate"] == pytest.approx(0.4)
    assert AnalysisReport.objects.count() == 2
    assert AnalysisSnapshot.objects.count() == 2


def test_analysis_api_history_and_project_isolation(analysis_campaign):
    ctx = analysis_campaign
    slug = ctx["project"].slug
    alice_client = _client(ctx["alice"])
    created = alice_client.post(
        f"{API}/projects/{slug}/analysis/snapshots",
        {"label": "État non publié", "includeDrafts": True},
        format="json",
    )
    assert created.status_code == 201, created.content
    assert created.json()["draftCount"] == 1

    run = alice_client.post(
        f"{API}/projects/{slug}/analysis/runs",
        {"snapshotId": created.json()["id"]},
        format="json",
    )
    assert run.status_code == 201, run.content
    report = alice_client.post(
        f"{API}/projects/{slug}/analysis/reports",
        {"runId": run.json()["id"], "title": "Rapport brouillon"},
        format="json",
    )
    assert report.status_code == 201, report.content

    history = alice_client.get(f"{API}/projects/{slug}/analysis/reports")
    assert history.status_code == 200
    assert history.json()["count"] == 1
    assert history.json()["next"] is None
    assert history.json()["previous"] is None
    assert history.json()["results"][0]["title"] == "Rapport brouillon"

    invalid_snapshot = alice_client.post(
        f"{API}/projects/{slug}/analysis/snapshots",
        {"includeDrafts": "false"},
        format="json",
    )
    assert invalid_snapshot.status_code == 400

    outsider = _client(ctx["outsider"]).get(f"{API}/projects/{slug}/analysis/snapshots")
    assert outsider.status_code == 404


def test_multi_actor_gold_quality_and_taxonomy_metrics(analysis_campaign):
    ctx = analysis_campaign
    for number, theme in [(1, "META"), (2, "TERMINATION")]:
        AnnotationVersion.objects.create(
            annotation=ctx["alice_annotation"],
            number=number,
            author=ctx["alice"],
            snapshot={"clauses": [{"anchor_index": 2, "theme": theme}]},
        )
    pre = PreAnnotation.objects.create(
        project=ctx["project"],
        document=ctx["document"],
        judge="codex",
        schema_version="v1",
        raw={},
    )
    PreClause.objects.create(preannotation=pre, anchor_index=0, theme_code="META")
    resolution = GoldResolution.objects.create(project=ctx["project"], document=ctx["document"])
    GoldSentence.objects.create(
        resolution=resolution,
        index=2,
        decided=True,
        primary_theme=ctx["project"].scheme.themes.get(code="META"),
        agreement_class="majority",
        risk_band="low",
    )
    GoldSentence.objects.create(
        resolution=resolution,
        index=3,
        decided=False,
        agreement_class="divergence",
        risk_band="high",
    )

    snapshot = create_snapshot(project=ctx["project"], user=ctx["lead"])
    run = execute_run(snapshot=snapshot, user=ctx["lead"])

    pairwise = run.result["pairwise_agreement"]
    assert {row["mode"] for row in pairwise["pairs"]} == {
        "inter_human",
        "human_llm",
    }
    assert pairwise["caseCount"] > 0
    assert run.result["intra_annotator"]["comparisons"][0]["changedUnits"] == 3
    assert run.result["gold_analysis"]["readinessRate"] == 0.5
    assert run.result["gold_analysis"]["actorScores"]
    assert run.result["quality"]["clauses"] == 2
    assert run.result["taxonomy"]["primaryThemes"]


def test_durable_worker_claims_queued_run(analysis_campaign, settings):
    settings.ANALYSIS_DISPATCH_MODE = "worker"
    snapshot = create_snapshot(
        project=analysis_campaign["project"], user=analysis_campaign["alice"]
    )
    run = queue_run(snapshot=snapshot, user=analysis_campaign["alice"])
    assert run.status == RunStatus.QUEUED

    call_command("analysis_worker", "--once")

    run.refresh_from_db()
    assert run.status == RunStatus.SUCCEEDED
    assert run.attempt == 1
    assert run.heartbeat_at is not None


def test_scope_preview_presets_cancel_and_cases_api(analysis_campaign, settings):
    ctx = analysis_campaign
    client = _client(ctx["alice"])
    slug = ctx["project"].slug
    preview = client.post(
        f"{API}/projects/{slug}/analysis/scopes/preview",
        {"includeDrafts": True},
        format="json",
    )
    assert preview.status_code == 200
    assert preview.json()["drafts"] == 1
    assert preview.json()["personalOnly"] is True

    preset = client.post(
        f"{API}/projects/{slug}/analysis/presets",
        {"name": "Mon suivi", "configuration": {"metrics": ["quality"]}},
        format="json",
    )
    assert preset.status_code == 201
    assert AnalysisPreset.objects.count() == 1

    settings.ANALYSIS_DISPATCH_MODE = "worker"
    snapshot = create_snapshot(project=ctx["project"], user=ctx["alice"])
    run = queue_run(snapshot=snapshot, user=ctx["alice"])
    canceled = client.post(f"{API}/projects/{slug}/analysis/runs/{run.id}/cancel")
    assert canceled.status_code == 200
    assert canceled.json()["status"] == "canceled"

    completed = execute_run(
        snapshot=snapshot,
        user=ctx["alice"],
        metric_codes=["pairwise_agreement"],
    )
    cases = client.get(f"{API}/projects/{slug}/analysis/runs/{completed.id}/cases")
    assert cases.status_code == 200
    assert "results" in cases.json()


def test_private_pdf_artifact_has_checksum_and_manifest(analysis_campaign, tmp_path):
    ctx = analysis_campaign
    snapshot = create_snapshot(project=ctx["project"], user=ctx["alice"])
    run = execute_run(snapshot=snapshot, user=ctx["alice"])
    report = create_report(run=run, user=ctx["alice"], title="Rapport qualité")

    with override_settings(ANALYSIS_ARTIFACTS_DIR=tmp_path):
        artifact = create_report_artifact(report, ctx["alice"])
        render_report_artifact(artifact.id)
        artifact.refresh_from_db()
        reused = create_report_artifact(report, ctx["alice"])

    assert artifact.status == ArtifactStatus.READY
    assert reused.id == artifact.id
    assert artifact.checksum and len(artifact.checksum) == 64
    assert artifact.size_bytes > 1000
    assert artifact.manifest["snapshotFingerprint"] == snapshot.fingerprint
    assert open(artifact.file_path, "rb").read(4) == b"%PDF"
    assert AnalysisReportArtifact.objects.count() == 1


def test_pdf_api_health_and_taxonomy_proposal_permissions(analysis_campaign, tmp_path):
    ctx = analysis_campaign
    slug = ctx["project"].slug
    snapshot = create_snapshot(project=ctx["project"], user=ctx["lead"])
    run = execute_run(snapshot=snapshot, user=ctx["lead"])
    report = create_report(run=run, user=ctx["lead"], title="Rapport projet")
    lead = _client(ctx["lead"])

    with override_settings(ANALYSIS_ARTIFACTS_DIR=tmp_path):
        rendered = lead.post(f"{API}/projects/{slug}/analysis/reports/{report.id}/render")
        assert rendered.status_code == 201
        artifact_id = rendered.json()["id"]
        download = lead.get(f"{API}/projects/{slug}/analysis/artifacts/{artifact_id}/download")
        assert download.status_code == 200
        assert b"".join(download.streaming_content).startswith(b"%PDF")

    health = lead.get(f"{API}/projects/{slug}/analysis/health")
    assert health.status_code == 200
    assert health.json()["runs"]["failed"] == 0

    proposal = lead.post(
        f"{API}/projects/{slug}/analysis/taxonomy-proposals",
        {
            "report": str(report.id),
            "kind": "merge",
            "themeCode": "META",
            "title": "Étudier un regroupement",
            "evidence": {"support": 4},
        },
        format="json",
    )
    assert proposal.status_code == 201
    denied = _client(ctx["alice"]).get(f"{API}/projects/{slug}/analysis/taxonomy-proposals")
    assert denied.status_code == 404


# --------------------------------------------------------------------------- #
# Enrichissement Lab (docs/pactiva-lab/) : 8 métriques ajoutées au registre.
# --------------------------------------------------------------------------- #

def test_lab_metrics_are_computed_by_default(analysis_campaign):
    """Un run sans metric_codes explicites calcule aussi les 8 métriques du Lab —
    additivement, sans toucher aux clés existantes."""
    ctx = analysis_campaign
    snapshot = create_snapshot(project=ctx["project"], user=ctx["lead"])
    run = execute_run(snapshot=snapshot, user=ctx["lead"])

    for code in (
        "alpha_masi",
        "boundary_agreement",
        "label_distribution",
        "cooccurrence",
        "human_llm_matrix",
        "annotator_audit",
        "gold_progress",
        "campaign_readiness",
    ):
        assert code in run.result, code
    # Les métriques historiques restent présentes et inchangées dans leur forme.
    assert "quality" in run.result
    assert "taxonomy" in run.result


def test_cooccurrence_metric_reads_unfair_index_from_snapshot(analysis_campaign):
    """⭐ Le pont vers l'objectif B : une clause multi-thèmes marquée abusive doit
    apparaître dans `cooccurrence.pairs` avec un lift calculé — ce qui exige que le
    snapshot embarque `unfairIndex` (ReferenceLabel alignées par phrase)."""
    ctx = analysis_campaign
    themes = ctx["project"].scheme.themes
    Clause.objects.filter(pk=ctx["alice_annotation"].clauses.get().pk).update(
        theme=themes.get(code="META")
    )
    alice_clause = ctx["alice_annotation"].clauses.get()
    ClauseTheme.objects.create(clause=alice_clause, theme=themes.get(code="META"), role="primary")
    ClauseTheme.objects.create(
        clause=alice_clause, theme=themes.get(code="TERMINATION"), role="secondary"
    )
    ReferenceLabel.objects.create(
        sentence=ctx["sentences"][2], category="LTD", level=1, source="claudette"
    )

    snapshot = create_snapshot(project=ctx["project"], user=ctx["lead"])
    assert snapshot.payload["unfairIndex"], "unfairIndex doit être présent dans le snapshot"

    run = execute_run(snapshot=snapshot, user=ctx["lead"])
    cooc = run.result["cooccurrence"]
    assert cooc["pairs"], "la clause multi-label doit produire au moins une paire"
    pair = cooc["pairs"][0]
    assert set(pair["themes"]) == {"META", "TERMINATION"}
    assert pair["unfair"] == 1
    assert pair["lift"] is not None


def test_boundary_agreement_metric_never_reports_a_kappa_of_one_by_construction(
    analysis_campaign,
):
    """Régression du correctif : sur ce fixture (deux annotateurs, ancres à des index
    différents), l'accord de segmentation doit rester une vraie mesure — jamais
    l'artefact 1,0 de l'ancien `boundaryKappa`."""
    ctx = analysis_campaign
    snapshot = create_snapshot(project=ctx["project"], user=ctx["lead"])
    run = execute_run(snapshot=snapshot, user=ctx["lead"])

    boundary = run.result["boundary_agreement"]
    assert boundary["documentsCompared"] >= 1
    assert boundary["meanJaccard"] is not None
    assert "replaces" in boundary and "boundary_kappa" in boundary["replaces"]


def test_campaign_readiness_metric_lists_documents_and_blockers(analysis_campaign):
    ctx = analysis_campaign
    snapshot = create_snapshot(project=ctx["project"], user=ctx["lead"])
    run = execute_run(snapshot=snapshot, user=ctx["lead"])

    readiness = run.result["campaign_readiness"]
    assert readiness["documentsTotal"] == 1
    assert isinstance(readiness["blockers"], list)
    # Aucun gold décidé dans ce fixture : c'est un bloquant attendu.
    assert any(b["code"] == "no_gold_finalized" for b in readiness["blockers"])
