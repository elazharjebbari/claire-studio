"""Boucle du worker (`claire/lab/worker.py`) — reprise de zombie, sonde Grid'5000,
annulation coopérative. Ce module était le moins couvert du Lab (42 %) : `_wait_remote`
n'était jamais exercé, ni le repli « aucun identifiant configuré », ni la boucle elle-même.
"""

import json
from pathlib import Path

import pytest

from claire.lab.g5k_client import G5KError
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


def test_backend_for_construit_un_vrai_grid5000backend_avec_les_deux_secrets(queued_run, monkeypatch):
    """Seul le repli `credentials_missing` était testé jusqu'ici — jamais le chemin
    normal de `_backend_for` qui déchiffre les DEUX secrets et construit le backend réel
    (tous les autres tests G5K de ce fichier monkeypatchent `_backend_for` lui-même)."""
    from claire.lab.runners.g5k import Grid5000Backend
    from claire.lab.worker import _backend_for

    _configure_g5k_credential(queued_run, monkeypatch)
    from claire.lab.models import ComputeCredential
    from claire.lab import crypto

    ComputeCredential.objects.filter(user=queued_run.experiment.created_by, kind="g5k").update(
        ssh_key_encrypted=crypto.encrypt_secret("clé-privée-ssh"),
    )

    backend = _backend_for(queued_run)
    assert isinstance(backend, Grid5000Backend)
    assert backend.login == "alice"
    assert backend.password == "s3cret"
    assert backend.ssh_key == "clé-privée-ssh"


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


def test_wait_remote_detecte_une_annulation_posee_par_un_autre_processus(queued_run, monkeypatch):
    """⭐ BUG RÉEL trouvé en préparant cette batterie : le worker (`manage.py lab_worker`)
    tourne dans un process séparé de celui qui sert `POST .../cancel` (le process web).
    Sans rafraîchissement explicite, `run` reste l'instance figée chargée une fois par
    `claim_next_run()` — une annulation demandée pendant l'attente d'un job Grid'5000 de
    plusieurs heures ne serait jamais vue avant le prochain redémarrage du worker.
    Reproduit ici en modifiant une INSTANCE SÉPARÉE de `ExperimentRun` (même PK), comme
    le fait réellement la vue `run_cancel` via `get_object_or_404`."""
    monkeypatch.setattr("claire.lab.worker.time.sleep", lambda _s: None)
    monkeypatch.setattr("claire.lab.runners.g5k.poll_interval", lambda _elapsed: 0)
    queued_run.status = RunStatus.WAITING
    queued_run.save(update_fields=["status"])

    class CancellingMidWayBackend(FakeBackend):
        """Au 2ᵉ sondage, une requête HTTP concurrente annule le run — simulée par une
        instance Django séparée, comme le ferait un vrai process web distinct."""

        def __init__(self):
            super().__init__(states=["waiting", "running", "running", "stopped"])
            self.calls = 0

        def poll(self, run):
            self.calls += 1
            if self.calls == 2:
                other = ExperimentRun.objects.get(id=run.id)
                other.cancel_requested = True
                other.save(update_fields=["cancel_requested"])
            return super().poll(run)

    backend = CancellingMidWayBackend()
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


def _configure_g5k_credential(run, monkeypatch):
    """Identifiants factices déchiffrables — les 3 tests ci-dessous exercent
    `_backend_for` réel (pas un `monkeypatch` direct de `worker._backend_for`), donc un
    `ComputeCredential` déchiffrable est requis même si le backend distant est ensuite
    remplacé par un `FakeBackend`."""
    from cryptography.fernet import Fernet

    from claire.lab import crypto
    from claire.lab.models import ComputeCredential

    monkeypatch.setenv(crypto.ENV_KEY, Fernet.generate_key().decode())
    ComputeCredential.objects.create(
        user=run.experiment.created_by, kind="g5k", login="alice",
        secret_encrypted=crypto.encrypt_secret("s3cret"),
    )
    run.config = {**run.config, "compute": {"target": "g5k"}}
    run.save(update_fields=["config"])


def test_execute_run_g5k_succes_complet_ingere_et_marque_succeeded(queued_run, monkeypatch, tmp_path):
    """⭐ Le chemin heureux complet, jusqu'ici jamais exercé bout en bout pour G5K : le
    seul test existant (`..._bout_en_bout_avec_backend_factice`) couvrait uniquement le
    cas `fetch_result=False` (partiel). Sans ce test, un succès G5K réel pourrait
    échapper à toute assertion de non-régression."""
    _configure_g5k_credential(queued_run, monkeypatch)
    monkeypatch.setattr("claire.lab.worker.time.sleep", lambda _s: None)
    monkeypatch.setattr("claire.lab.runners.g5k.poll_interval", lambda _elapsed: 0)

    def fake_fetch(self, run, out_dir):
        Path(out_dir).mkdir(parents=True, exist_ok=True)
        (Path(out_dir) / "results.json").write_text(
            json.dumps({"task": "T1_primary", "metrics": {"macro_f1": 0.5}, "environment": {}})
        )
        return True  # _SENTINEL présent — fin normale, pas une coupure walltime

    fake = FakeBackend(states=["stopped"], submit_job_id="oar-succes")
    monkeypatch.setattr(FakeBackend, "fetch", fake_fetch)
    monkeypatch.setattr("claire.lab.worker._backend_for", lambda run: fake)

    result = execute_run(queued_run)
    assert result.status == RunStatus.SUCCEEDED
    assert result.external_job_id == "oar-succes"
    assert result.metrics["metrics"]["macro_f1"] == 0.5


def test_execute_run_retente_le_rapatriement_si_le_resultat_n_est_pas_encore_visible(
    queued_run, monkeypatch,
):
    """Bug réel trouvé le 14 août 2026 (5 runs G5K sur 8, même sweep) : `results.json`
    existait bel et bien côté Grid'5000 (vérifié à la main) mais le PREMIER
    rapatriement ne le voyait pas — une course entre la fin du job côté nœud de calcul
    et la visibilité NFS de son écriture depuis le frontal d'où part le rsync (deux
    machines distinctes, cohérence "close-to-open" NFS non instantanée). Une nouvelle
    tentative quelques secondes plus tard absorbe cette course."""
    _configure_g5k_credential(queued_run, monkeypatch)
    monkeypatch.setattr("claire.lab.worker.time.sleep", lambda _s: None)
    monkeypatch.setattr("claire.lab.runners.g5k.poll_interval", lambda _elapsed: 0)

    calls = {"n": 0}

    def fake_fetch(self, run, out_dir):
        calls["n"] += 1
        if calls["n"] < 2:
            return False  # 1er essai : rien n'est encore visible (course NFS)
        Path(out_dir).mkdir(parents=True, exist_ok=True)
        (Path(out_dir) / "results.json").write_text(
            json.dumps({"task": "T1_primary", "metrics": {"macro_f1": 0.5}, "environment": {}})
        )
        return True

    fake = FakeBackend(states=["stopped"], submit_job_id="oar-course")
    monkeypatch.setattr(FakeBackend, "fetch", fake_fetch)
    monkeypatch.setattr("claire.lab.worker._backend_for", lambda run: fake)

    result = execute_run(queued_run)
    assert result.status == RunStatus.SUCCEEDED
    assert calls["n"] == 2


def test_execute_run_ne_retente_pas_indefiniment_un_resultat_genuinement_absent(
    queued_run, monkeypatch, settings,
):
    """Un job réellement coupé par le walltime (jamais de résultat) doit finir par
    échouer proprement — les nouvelles tentatives ne doivent pas devenir une boucle
    infinie ni masquer un vrai échec derrière un faux espoir de course NFS."""
    settings.LAB_FETCH_RETRIES = 3
    _configure_g5k_credential(queued_run, monkeypatch)
    monkeypatch.setattr("claire.lab.worker.time.sleep", lambda _s: None)
    monkeypatch.setattr("claire.lab.runners.g5k.poll_interval", lambda _elapsed: 0)

    calls = {"n": 0}

    def fake_fetch(self, run, out_dir):
        calls["n"] += 1
        return False  # jamais de résultat, à aucun essai

    fake = FakeBackend(states=["stopped"], submit_job_id="oar-coupe")
    monkeypatch.setattr(FakeBackend, "fetch", fake_fetch)
    monkeypatch.setattr("claire.lab.worker._backend_for", lambda run: fake)

    result = execute_run(queued_run)
    assert result.status == RunStatus.FAILED
    assert result.error_code == "result_missing"
    assert calls["n"] == 3


def test_execute_run_ne_retente_pas_si_le_resultat_est_deja_la_au_premier_essai(
    queued_run, monkeypatch,
):
    """Le chemin normal (résultat déjà visible dès le premier rapatriement, l'immense
    majorité des cas) ne doit JAMAIS attendre inutilement — un seul appel à `fetch`."""
    _configure_g5k_credential(queued_run, monkeypatch)
    monkeypatch.setattr("claire.lab.worker.time.sleep", lambda _s: None)
    monkeypatch.setattr("claire.lab.runners.g5k.poll_interval", lambda _elapsed: 0)

    calls = {"n": 0}

    def fake_fetch(self, run, out_dir):
        calls["n"] += 1
        Path(out_dir).mkdir(parents=True, exist_ok=True)
        (Path(out_dir) / "results.json").write_text(
            json.dumps({"task": "T1_primary", "metrics": {"macro_f1": 0.5}, "environment": {}})
        )
        return True

    fake = FakeBackend(states=["stopped"], submit_job_id="oar-direct")
    monkeypatch.setattr(FakeBackend, "fetch", fake_fetch)
    monkeypatch.setattr("claire.lab.worker._backend_for", lambda run: fake)

    result = execute_run(queued_run)
    assert result.status == RunStatus.SUCCEEDED
    assert calls["n"] == 1


def test_execute_run_propage_le_code_metier_d_un_echec_de_soumission(queued_run, monkeypatch):
    """Sans clé SSH, `Grid5000Backend.submit` lève `G5KError('g5k_ssh_key_missing', …)`
    AVANT tout transfert (docs/pactiva-g5k/07_ARCHITECTURE.md §1) — le worker doit
    afficher CE code précis, pas un `submit_failed` générique qui masquerait la cause
    réelle (l'utilisateur irait chercher du côté de l'API alors que le problème est la
    clé SSH absente)."""
    _configure_g5k_credential(queued_run, monkeypatch)

    class RaisingSubmitBackend(FakeBackend):
        def submit(self, run, dataset_dir, out_dir):
            raise G5KError("g5k_ssh_key_missing", "aucune clé SSH enregistrée")

    monkeypatch.setattr("claire.lab.worker._backend_for", lambda run: RaisingSubmitBackend())
    result = execute_run(queued_run)
    assert result.status == RunStatus.FAILED
    assert result.error_code == "g5k_ssh_key_missing"


def test_execute_run_propage_le_code_metier_d_un_echec_de_rapatriement(queued_run, monkeypatch):
    """Un `fetch` qui lève (rsync tombe sur une erreur non tolérée par `allow_failure`,
    hôte devenu injoignable en cours de rapatriement) doit faire échouer le run avec le
    code métier du backend (`g5k_transfer_failed`), jamais un `fetch_failed` opaque —
    même principe que la soumission : le code affiché doit pointer vers la bonne cause."""
    _configure_g5k_credential(queued_run, monkeypatch)
    monkeypatch.setattr("claire.lab.worker.time.sleep", lambda _s: None)
    monkeypatch.setattr("claire.lab.runners.g5k.poll_interval", lambda _elapsed: 0)

    fake = FakeBackend(
        states=["stopped"], submit_job_id="oar-1",
        raise_on={"fetch": G5KError("g5k_transfer_failed", "échec du transfert (code 12)")},
    )
    monkeypatch.setattr("claire.lab.worker._backend_for", lambda run: fake)
    result = execute_run(queued_run)
    assert result.status == RunStatus.FAILED
    assert result.error_code == "g5k_transfer_failed"


def test_execute_run_detecte_une_annulation_posee_pendant_le_fetch(queued_run, monkeypatch):
    """Même fenêtre de course que dans `_wait_remote`, mais après : le rapatriement
    rsync peut prendre du temps sur un gros résultat, et une annulation demandée pendant
    ce rapatriement (par une requête HTTP dans le process web, donc une instance Django
    séparée) doit être vue au retour — même si le rapatriement a réussi, les résultats
    ne doivent jamais être ingérés après une annulation."""
    _configure_g5k_credential(queued_run, monkeypatch)
    monkeypatch.setattr("claire.lab.worker.time.sleep", lambda _s: None)
    monkeypatch.setattr("claire.lab.runners.g5k.poll_interval", lambda _elapsed: 0)

    class CancellingFetchBackend(FakeBackend):
        def fetch(self, run, out_dir):
            other = ExperimentRun.objects.get(id=run.id)
            other.cancel_requested = True
            other.save(update_fields=["cancel_requested"])
            Path(out_dir).mkdir(parents=True, exist_ok=True)
            (Path(out_dir) / "results.json").write_text(
                json.dumps({"task": "T1_primary", "metrics": {"macro_f1": 0.9}, "environment": {}})
            )
            return True  # rapatriement réussi malgré tout — ne doit pas être publié

    fake = CancellingFetchBackend(states=["stopped"], submit_job_id="oar-2")
    monkeypatch.setattr("claire.lab.worker._backend_for", lambda run: fake)
    result = execute_run(queued_run)
    assert result.status == RunStatus.CANCELLED
    assert result.metrics == {}  # jamais ingéré, même si le fetch a réussi


def test_execute_run_ne_tente_jamais_fetch_si_wait_remote_a_echoue(queued_run, monkeypatch):
    """Quand la sonde distante échoue (timeout, erreur réseau, annulation), `execute_run`
    doit s'arrêter là — un `fetch` après un `_wait_remote` en échec irait chercher des
    résultats d'un job qui n'a peut-être jamais tourné jusqu'au bout."""
    _configure_g5k_credential(queued_run, monkeypatch)
    monkeypatch.setattr("claire.lab.worker.time.sleep", lambda _s: None)

    fake = FakeBackend(submit_job_id="oar-3", raise_on={"poll": RuntimeError("g5k injoignable")})
    fetch_calls = []
    monkeypatch.setattr(FakeBackend, "fetch", lambda self, run, out_dir: fetch_calls.append(1))
    monkeypatch.setattr("claire.lab.worker._backend_for", lambda run: fake)

    result = execute_run(queued_run)
    assert fetch_calls == []
    assert result.status == RunStatus.FAILED
    assert result.error_code == "g5k_unreachable"
