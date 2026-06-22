"""Export en tâche de fond (FSM, retry, self-heal, liste, download)."""

import pytest
from django.utils import timezone

from claire.annotations.models import AnnotationStatus, Clause
from claire.exports.models import ExportJob, ExportStatus

pytestmark = pytest.mark.django_db
API = "/api/v1"


def _submit(annotation, scheme):
    Clause.objects.create(
        annotation=annotation,
        anchor_sentence=annotation.document.sentences.get(index=0),
        theme=scheme.themes_map["META"],
    )
    annotation.status = AnnotationStatus.SUBMITTED
    annotation.save()


def test_post_export_is_non_blocking_202(auth, admin_user, annotation, scheme_with_themes, settings, tmp_path):
    settings.EXPORTS_DIR = tmp_path  # EXPORTS_RUN_INLINE=True en test → exécution inline
    _submit(annotation, scheme_with_themes)
    resp = auth(admin_user).post(
        f"{API}/projects/{annotation.project.slug}/exports",
        {"format": "jsonl"}, format="json",
    )
    assert resp.status_code == 202
    # Inline en test : le job est terminé au retour ; en prod il serait pending→running.
    assert resp.json()["status"] in ("pending", "running", "done")
    job = ExportJob.objects.get(pk=resp.json()["id"])
    assert job.status == ExportStatus.DONE
    assert job.manifest["n_annotations"] == 1


def test_export_list_history(auth, admin_user, annotation, scheme_with_themes, settings, tmp_path):
    settings.EXPORTS_DIR = tmp_path
    _submit(annotation, scheme_with_themes)
    client = auth(admin_user)
    client.post(f"{API}/projects/{annotation.project.slug}/exports", {"format": "jsonl"}, format="json")
    client.post(f"{API}/projects/{annotation.project.slug}/exports", {"format": "csv"}, format="json")
    body = client.get(f"{API}/projects/{annotation.project.slug}/exports").json()
    assert body["count"] == 2
    assert {r["format"] for r in body["results"]} == {"jsonl", "csv"}


def test_failed_status_persists_and_retry(auth, admin_user, project, settings, tmp_path):
    """Un export sans annotations soumises produit 0 enregistrement (done, 0).
    On force un échec via un scope invalide impossible ; ici on teste plutôt le RETRY
    d'un job marqué failed → repasse done."""
    settings.EXPORTS_DIR = tmp_path
    job = ExportJob.objects.create(
        project=project, format="jsonl", scope={}, status=ExportStatus.FAILED,
        error="boom", requested_by=admin_user,
    )
    resp = auth(admin_user).post(f"{API}/exports/{job.id}/retry")
    assert resp.status_code == 202
    job.refresh_from_db()
    assert job.status == ExportStatus.DONE  # inline en test
    assert job.error == ""


def test_self_heal_stale_running(auth, admin_user, project, settings, tmp_path):
    settings.EXPORTS_DIR = tmp_path
    settings.EXPORT_TIMEOUT_S = 1
    job = ExportJob.objects.create(
        project=project, format="jsonl", scope={}, status=ExportStatus.RUNNING,
        requested_by=admin_user,
    )
    # Vieillit le job au-delà du timeout (created_at est auto_now_add → update direct).
    old = timezone.now() - timezone.timedelta(seconds=120)
    ExportJob.objects.filter(pk=job.id).update(created_at=old)
    resp = auth(admin_user).get(f"{API}/exports/{job.id}")
    assert resp.status_code == 200
    assert resp.json()["status"] == "failed"
    assert "expiré" in resp.json()["error"]


def test_download_requires_done(auth, admin_user, project, settings, tmp_path):
    settings.EXPORTS_DIR = tmp_path
    job = ExportJob.objects.create(
        project=project, format="jsonl", scope={}, status=ExportStatus.RUNNING,
        requested_by=admin_user,
    )
    assert auth(admin_user).get(f"{API}/exports/{job.id}/download").status_code == 404
