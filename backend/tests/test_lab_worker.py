"""Boucle du worker (`claire/lab/worker.py`) — reprise de zombie, sonde Grid'5000,
annulation coopérative. Ce module était le moins couvert du Lab (42 %) : `_wait_remote`
n'était jamais exercé, ni le repli « aucun identifiant configuré », ni la boucle elle-même.
"""

from pathlib import Path

import pytest

from claire.lab.models import Experiment, ExperimentRun, RunStatus, Task
from claire.lab.runners.base import ExecutionBackend
from claire.lab.worker import _wait_remote, execute_run, loop, run_once
from claire.projects.models import MembershipRole, ProjectMembership
from tests.conftest import CorpusFactory, DocumentFactory, ProjectFactory, UserFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def queued_run(scheme_with_themes, settings, tmp_path):
    """Un run QUEUED prêt à être réclamé, avec un dataset minimal déjà construit."""
    from claire.annotations.models import Annotation, Clause, ClauseTheme
    from claire.corpora.models import Sentence
    from claire.lab.services import build_dataset, queue_run

    settings.LAB_DIR = str(tmp_path / "lab")
    corpus = CorpusFactory()
    project = ProjectFactory(corpus=corpus, scheme=scheme_with_themes)
    lead = UserFactory(username="worker_lead", role="annotator")
    ProjectMembership.objects.create(project=project, user=lead, role=MembershipRole.LEAD)

    themes = list(scheme_with_themes.themes_map.values())
    for d in range(5):
        document = DocumentFactory(corpus=corpus, n_sentences=8)
        sentences = [
            Sentence.objects.create(document=document, index=i, raw_text=f"clause {i} .")
            for i in range(8)
        ]
        for username in ("worker_a1", "worker_a2"):
            user = UserFactory(username=f"{username}_{d}", role="annotator")
            annotation = Annotation.objects.create(
                project=project, document=document, annotator=user, status="submitted"
            )
            for i, sentence in enumerate(sentences):
                theme = themes[i % len(themes)]
                clause = Clause.objects.create(
                    annotation=annotation, anchor_sentence=sentence,
                    theme=theme, order=i, validated=True,
                )
                ClauseTheme.objects.create(clause=clause, theme=theme, role="primary")

    dataset = build_dataset(project=project, user=lead, maturity="complete", k=5)
    config = {
        "version": 1, "task": "T1_primary", "seed": 42, "dataset_id": str(dataset.id),
        "preprocess": {"detokenize": "regex_rules"},
        "model": {"family": "tfidf_linear"},
        "evaluation": {"split": {"scheme": "group_kfold_document", "k": 5}},
    }
    experiment = Experiment.objects.create(
        project=project, dataset=dataset, created_by=lead, name="w", task=Task.T1,
        config=config,
    )
    return queue_run(experiment=experiment)


class FakeBackend(ExecutionBackend):
    """Backend factice : scénarios de sonde pilotés à la main, sans réseau ni sous-processus."""

    kind = "fake"

    def __init__(self, *, states=(), submit_job_id="ext-1", fetch_result=True, raise_on=None):
        self.states = list(states)
        self.submit_job_id = submit_job_id
        self.fetch_result = fetch_result
        self.raise_on = raise_on or {}
        self.cancel_called = False
        self.submitted = False

    def submit(self, run, dataset_dir, out_dir):
        self.submitted = True
        if "submit" in self.raise_on:
            raise self.raise_on["submit"]
        return self.submit_job_id

    def poll(self, run):
        if "poll" in self.raise_on:
            raise self.raise_on["poll"]
        return self.states.pop(0) if self.states else "stopped"

    def fetch(self, run, out_dir):
        if "fetch" in self.raise_on:
            raise self.raise_on["fetch"]
        return self.fetch_result

    def cancel(self, run):
        self.cancel_called = True


# --------------------------------------------------------------------------- #
# run_once / loop
# --------------------------------------------------------------------------- #

def test_run_once_sans_run_en_file_renvoie_false(db):
    assert run_once() is False


def test_loop_s_arrete_apres_max_iterations(db, monkeypatch):
    """`max_iterations` existe précisément pour rendre la boucle testable — sans lui,
    ce serait une boucle infinie."""
    calls = []
    monkeypatch.setattr("claire.lab.worker.run_once", lambda: calls.append(1) or False)
    monkeypatch.setattr("claire.lab.worker.time.sleep", lambda _seconds: None)
    loop(interval=0, max_iterations=3)
    assert len(calls) == 3


def test_run_once_transforme_un_crash_en_echec_sans_arreter_le_worker(queued_run, monkeypatch):
    """⭐ Un run qui explose au milieu de `execute_run` (bug modèle, disque plein…) ne
    doit jamais faire tomber le worker : il échoue PROPREMENT, et le worker continue."""
    def boom(run):
        raise RuntimeError("panne simulée")

    monkeypatch.setattr("claire.lab.worker.execute_run", boom)
    assert run_once() is True
    queued_run.refresh_from_db()
    assert queued_run.status == RunStatus.FAILED
    assert queued_run.error_code == "worker_crash"


# --------------------------------------------------------------------------- #
# _backend_for — repli local, refus explicite si G5K sans identifiant
# --------------------------------------------------------------------------- #

def test_execute_run_cible_g5k_sans_identifiant_echoue_proprement(queued_run):
    queued_run.config = {**queued_run.config, "compute": {"target": "g5k"}}
    queued_run.save(update_fields=["config"])
    result = execute_run(queued_run)
    assert result.status == RunStatus.FAILED
    assert result.error_code == "credentials_missing"


# --------------------------------------------------------------------------- #
# _wait_remote — sonde Grid'5000
# --------------------------------------------------------------------------- #

def test_wait_remote_suit_running_puis_stopped(queued_run, monkeypatch, tmp_path):
    monkeypatch.setattr("claire.lab.worker.time.sleep", lambda _s: None)
    monkeypatch.setattr("claire.lab.runners.g5k.poll_interval", lambda _elapsed: 0)
    queued_run.storage_path = str(tmp_path)
    queued_run.status = RunStatus.WAITING
    queued_run.save(update_fields=["storage_path", "status"])

    backend = FakeBackend(states=["waiting", "running", "stopped"])
    ok = _wait_remote(queued_run, backend)
    assert ok is True
    queued_run.refresh_from_db()
    assert queued_run.status == RunStatus.RUNNING  # dernier état écrit avant "stopped"
    assert queued_run.heartbeat_at is not None


def test_wait_remote_annulation_cooperative(queued_run, monkeypatch):
    monkeypatch.setattr("claire.lab.worker.time.sleep", lambda _s: None)
    queued_run.cancel_requested = True
    queued_run.status = RunStatus.WAITING
    queued_run.save(update_fields=["cancel_requested", "status"])

    backend = FakeBackend(states=["running"])
    ok = _wait_remote(queued_run, backend)
    assert ok is False
    assert backend.cancel_called is True
    queued_run.refresh_from_db()
    assert queued_run.status == RunStatus.CANCELLED


def test_wait_remote_erreur_de_sonde_echoue_le_run(queued_run, monkeypatch):
    monkeypatch.setattr("claire.lab.worker.time.sleep", lambda _s: None)
    queued_run.status = RunStatus.WAITING
    queued_run.save(update_fields=["status"])

    backend = FakeBackend(raise_on={"poll": RuntimeError("g5k injoignable")})
    ok = _wait_remote(queued_run, backend)
    assert ok is False
    queued_run.refresh_from_db()
    assert queued_run.status == RunStatus.FAILED
    assert queued_run.error_code == "g5k_unreachable"


def test_wait_remote_timeout_quand_le_delai_est_depasse(queued_run, monkeypatch):
    """⭐ Sans ce garde-fou, un job Grid'5000 bloqué (nœud en panne, file d'attente
    infinie) laisserait le run indéfiniment en `waiting`."""
    monkeypatch.setattr("claire.lab.worker.time.sleep", lambda _s: None)
    monkeypatch.setattr("claire.lab.runners.g5k.poll_interval", lambda _elapsed: 0)

    class NeverEndingBackend(FakeBackend):
        def poll(self, run):
            return "waiting"  # ne se termine jamais tout seul

    from django.test import override_settings

    queued_run.status = RunStatus.WAITING
    queued_run.save(update_fields=["status"])
    with override_settings(LAB_G5K_MAX_WAIT=0):
        ok = _wait_remote(queued_run, NeverEndingBackend())
    assert ok is False
    queued_run.refresh_from_db()
    assert queued_run.status == RunStatus.FAILED
    assert queued_run.error_code == "g5k_timeout"


# --------------------------------------------------------------------------- #
# execute_run — bout en bout avec un backend distant factice
# --------------------------------------------------------------------------- #

def test_execute_run_g5k_bout_en_bout_avec_backend_factice(queued_run, monkeypatch, tmp_path):
    """Le seul test qui exerce le chemin `job_id` non vide de `execute_run` (la branche
    G5K) : jusqu'ici uniquement le chemin local (job_id vide) était couvert."""
    from claire.lab import crypto
    from claire.lab.models import ComputeCredential

    monkeypatch.setenv(crypto.ENV_KEY, __import__(
        "cryptography.fernet", fromlist=["Fernet"]
    ).Fernet.generate_key().decode())
    ComputeCredential.objects.create(
        user=queued_run.experiment.created_by, kind="g5k", login="alice",
        secret_encrypted=crypto.encrypt_secret("s3cret"),
    )
    queued_run.config = {**queued_run.config, "compute": {"target": "g5k"}}
    queued_run.save(update_fields=["config"])

    monkeypatch.setattr("claire.lab.worker.time.sleep", lambda _s: None)
    monkeypatch.setattr("claire.lab.runners.g5k.poll_interval", lambda _elapsed: 0)

    fake = FakeBackend(states=["stopped"], submit_job_id="oar-123", fetch_result=False)
    monkeypatch.setattr("claire.lab.worker._backend_for", lambda run: fake)

    result = execute_run(queued_run)
    assert fake.submitted is True
    assert result.external_job_id == "oar-123"
    # `fetch_result=False` : pas de _SENTINEL → ingestion en `partial`, jamais un succès
    # silencieux sur un résultat tronqué par le walltime.
    assert result.status in (RunStatus.FAILED, RunStatus.PARTIAL)
