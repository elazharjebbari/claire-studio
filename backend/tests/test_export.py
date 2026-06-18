"""Export formats (jsonl + csv) and manifest (feature 5)."""

import json
from pathlib import Path

import pytest

from claire.annotations.models import AnnotationStatus, Clause
from claire.exports.models import ExportFormat, ExportJob, ExportStatus
from claire.exports.services import run_export

pytestmark = pytest.mark.django_db


def _seed_submitted(annotation, scheme):
    s0 = annotation.document.sentences.get(index=0)
    Clause.objects.create(
        annotation=annotation, anchor_sentence=s0,
        theme=scheme.themes_map["META"], evidence_span="posted",
    )
    annotation.status = AnnotationStatus.SUBMITTED
    annotation.save()


def test_jsonl_export(annotation, scheme_with_themes, admin_user, settings, tmp_path):
    settings.EXPORTS_DIR = tmp_path
    _seed_submitted(annotation, scheme_with_themes)
    job = ExportJob.objects.create(
        project=annotation.project, format=ExportFormat.JSONL,
        requested_by=admin_user,
    )
    run_export(job)
    assert job.status == ExportStatus.DONE
    lines = Path(job.artifact_path).read_text().strip().splitlines()
    assert len(lines) == 1
    rec = json.loads(lines[0])
    assert rec["doc"] == annotation.document.external_id
    assert rec["clauses"][0]["theme"] == "META"
    assert job.manifest["n_annotations"] == 1
    assert job.manifest["n_clauses"] == 1


def test_csv_export(annotation, scheme_with_themes, admin_user, settings, tmp_path):
    settings.EXPORTS_DIR = tmp_path
    _seed_submitted(annotation, scheme_with_themes)
    job = ExportJob.objects.create(
        project=annotation.project, format=ExportFormat.CSV,
        requested_by=admin_user,
    )
    run_export(job)
    content = Path(job.artifact_path).read_text()
    assert "anchor_index" in content.splitlines()[0]  # header
    assert "META" in content


def test_export_scope_filters_statuses(
    annotation, scheme_with_themes, admin_user, settings, tmp_path
):
    settings.EXPORTS_DIR = tmp_path
    # annotation stays draft -> default scope excludes it.
    Clause.objects.create(
        annotation=annotation,
        anchor_sentence=annotation.document.sentences.get(index=0),
        theme=scheme_with_themes.themes_map["META"],
    )
    job = ExportJob.objects.create(
        project=annotation.project, format=ExportFormat.JSONL,
        requested_by=admin_user,
    )
    run_export(job)
    assert job.manifest["n_annotations"] == 0
