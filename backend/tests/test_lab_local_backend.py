"""`LocalBackend.submit()` — sonde `progress.json` pendant l'exécution.

Avant ce changement, `subprocess.run()` bloquait jusqu'à la fin : le fichier
`progress.json` (déjà écrit par le runner à chaque pli) n'était jamais lu tant que le
run n'était pas terminé — la barre de progression sautait de 0 à 100 % d'un coup. Les
tests mockent `subprocess.Popen` : la logique de sonde doit être vérifiable sans
dépendre du package `research/` réel (torch, etc.), qui a son propre bout-en-bout dans
`test_lab_runs.py`.
"""

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from claire.lab.models import Experiment, ExperimentRun, RunStatus, Task
from claire.lab.runners.local import LocalBackend
from claire.projects.models import MembershipRole, ProjectMembership
from tests.conftest import CorpusFactory, ProjectFactory, UserFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def a_run(scheme_with_themes, settings, tmp_path):
    from claire.lab.models import LabDataset

    settings.LAB_DIR = str(tmp_path / "lab")
    project = ProjectFactory(corpus=CorpusFactory(), scheme=scheme_with_themes)
    lead = UserFactory(username="localbackend_lead", role="annotator")
    ProjectMembership.objects.create(project=project, user=lead, role=MembershipRole.LEAD)
    dataset = LabDataset.objects.create(
        project=project, created_by=lead, maturity="complete", aggregation="consensus",
        scope={}, manifest={}, splits={}, fingerprint="f" * 64, status="ready",
        n_documents=5, n_sentences=50, n_annotations=5, storage_path=str(tmp_path / "ds"),
    )
    experiment = Experiment.objects.create(
        project=project, dataset=dataset, created_by=lead, name="x", task=Task.T1,
        config={"version": 1, "task": "T1_primary"},
    )
    run = ExperimentRun.objects.create(
        experiment=experiment, config=experiment.config, fingerprint="g" * 64,
        status=RunStatus.RUNNING, heartbeat_at=None, progress=0,
    )
    return run


def _fake_process(poll_sequence):
    """Simule un `Popen` : `poll()` renvoie None puis 0, comme un process qui se termine
    après N sondes."""
    process = MagicMock()
    process.poll.side_effect = poll_sequence
    process.returncode = 0
    return process


def test_submit_relit_progress_json_et_appelle_heartbeat(a_run, tmp_path, monkeypatch):
    monkeypatch.setattr("claire.lab.runners.local.time.sleep", lambda _s: None)
    out_dir = tmp_path / "out"
    out_dir.mkdir()
    progress_path = out_dir / "progress.json"

    # Trois sondes : rien encore écrit, puis pli 1/2, puis le process se termine.
    calls = {"n": 0}

    def fake_read_text(*args, **kwargs):
        calls["n"] += 1
        if calls["n"] == 1:
            raise FileNotFoundError
        return json.dumps({"fold": 1, "folds": 2, "percent": 50})

    with patch("claire.lab.runners.local.subprocess.Popen") as popen:
        popen.return_value = _fake_process([None, None, 0])
        with patch.object(Path, "read_text", fake_read_text):
            LocalBackend().submit(a_run, tmp_path / "data", out_dir)

    a_run.refresh_from_db()
    assert a_run.progress == 50
    assert a_run.phase == "pli 1/2"
    assert a_run.heartbeat_at is not None


def test_submit_ignore_un_progress_json_absent_sans_planter(a_run, tmp_path, monkeypatch):
    monkeypatch.setattr("claire.lab.runners.local.time.sleep", lambda _s: None)
    out_dir = tmp_path / "out"
    out_dir.mkdir()

    with patch("claire.lab.runners.local.subprocess.Popen") as popen:
        popen.return_value = _fake_process([None, 0])
        LocalBackend().submit(a_run, tmp_path / "data", out_dir)

    a_run.refresh_from_db()
    assert a_run.progress == 0  # jamais écrit : aucun fichier progress.json n'est apparu


def test_submit_n_ecrit_pas_deux_fois_le_meme_pourcentage(a_run, tmp_path, monkeypatch):
    """La garde `percent == last_reported` évite une écriture DB à chaque sonde de 2 s
    pour un run qui stagne sur le même pli — seul un changement réel compte."""
    monkeypatch.setattr("claire.lab.runners.local.time.sleep", lambda _s: None)
    out_dir = tmp_path / "out"
    out_dir.mkdir()
    (out_dir / "progress.json").write_text(json.dumps({"fold": 1, "folds": 4, "percent": 25}))

    with patch("claire.lab.runners.local.subprocess.Popen") as popen:
        popen.return_value = _fake_process([None, None, None, 0])
        with patch("claire.lab.runners.local.heartbeat") as fake_heartbeat:
            LocalBackend().submit(a_run, tmp_path / "data", out_dir)

    # Le pourcentage ne change jamais entre les sondes : un seul appel malgré 3 sondes.
    assert fake_heartbeat.call_count == 1


def test_submit_depasse_le_delai_leve_timeout_expired(a_run, tmp_path, monkeypatch, settings):
    settings.LAB_LOCAL_TIMEOUT = 0
    monkeypatch.setattr("claire.lab.runners.local.time.sleep", lambda _s: None)
    out_dir = tmp_path / "out"
    out_dir.mkdir()

    import subprocess as subprocess_module

    with patch("claire.lab.runners.local.subprocess.Popen") as popen:
        process = _fake_process([None, None, None])
        popen.return_value = process
        with pytest.raises(subprocess_module.TimeoutExpired):
            LocalBackend().submit(a_run, tmp_path / "data", out_dir)
    process.kill.assert_called_once()
