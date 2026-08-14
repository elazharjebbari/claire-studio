"""`Grid5000Backend` (`runners/g5k.py`) — l'adaptateur complet submit/poll/fetch/cancel/
test_connection, jamais testé de bout en bout avant cet audit (seuls `g5k_client.py` et
`g5k_ssh.py`, les briques qu'il assemble, l'étaient individuellement)."""

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from claire.lab.g5k_client import G5KError
from claire.lab.models import Experiment, ExperimentRun, RunStatus, Task
from claire.lab.runners.g5k import Grid5000Backend, poll_interval
from claire.projects.models import MembershipRole, ProjectMembership
from tests.conftest import CorpusFactory, ProjectFactory, UserFactory

pytestmark = pytest.mark.django_db


class TestPollInterval:
    def test_dense_au_debut(self):
        assert poll_interval(0) == 5
        assert poll_interval(59) == 5

    def test_espace_apres_une_minute(self):
        assert poll_interval(61) == 15
        assert poll_interval(599) == 15

    def test_tres_espace_apres_dix_minutes(self):
        assert poll_interval(601) == 60
        assert poll_interval(3600) == 60


@pytest.fixture
def a_run(scheme_with_themes, settings, tmp_path):
    from claire.lab.models import LabDataset

    settings.LAB_DIR = str(tmp_path / "lab")
    project = ProjectFactory(corpus=CorpusFactory(), scheme=scheme_with_themes)
    lead = UserFactory(username="g5kbackend_lead", role="annotator")
    ProjectMembership.objects.create(project=project, user=lead, role=MembershipRole.LEAD)
    dataset = LabDataset.objects.create(
        project=project, created_by=lead, maturity="complete", aggregation="consensus",
        scope={}, manifest={}, splits={}, fingerprint="f" * 64, status="ready",
        n_documents=5, n_sentences=50, n_annotations=5, storage_path=str(tmp_path / "ds"),
    )
    experiment = Experiment.objects.create(
        project=project, dataset=dataset, created_by=lead, name="x", task=Task.T1,
        config={
            "version": 1, "task": "T1_primary",
            "compute": {"target": "g5k", "require_gpu": True,
                        "g5k": {"site": "nancy", "workdir": "~/pactiva"}},
        },
    )
    return ExperimentRun.objects.create(
        experiment=experiment, config=experiment.config, fingerprint="g" * 64,
        status=RunStatus.RUNNING, external_job_id="1965464",
    )


def _ok_process(returncode=0):
    proc = MagicMock()
    proc.returncode = returncode
    return proc


class TestConnection:
    def test_sans_mot_de_passe_api_ok_est_faux(self):
        backend = Grid5000Backend(login="a", password=None)
        api_ok, ssh_ok, detail = backend.test_connection()
        assert api_ok is False
        assert ssh_ok is None
        assert "aucun identifiant" in detail

    def test_api_ok_sans_cle_ssh_laisse_ssh_ok_a_none(self):
        backend = Grid5000Backend(login="a", password="p")
        with patch("claire.lab.runners.g5k.g5k_test_connection", return_value=(True, "ok")):
            api_ok, ssh_ok, detail = backend.test_connection()
        assert api_ok is True
        assert ssh_ok is None  # ⭐ pas "faux" — pas testable, distinct d'un échec

    def test_les_deux_secrets_testes_independamment(self):
        backend = Grid5000Backend(login="a", password="p", ssh_key="clé")
        with patch("claire.lab.runners.g5k.g5k_test_connection", return_value=(True, "ok")):
            with patch.object(Grid5000Backend, "_test_ssh", return_value=(False, "refusée")):
                api_ok, ssh_ok, detail = backend.test_connection()
        assert api_ok is True
        assert ssh_ok is False
        assert "refusée" in detail


class TestAccessPath:
    """Bug réel trouvé le 14 août 2026, EN SONDANT le frontal Grid'5000 avant toute
    réservation (jamais un bug hypothétique) : le `home` Grid'5000 est propre à chaque
    site, jamais partagé. Sur `access.grid5000.fr`, `~` seul pointe le disque LOCAL du
    frontal (mkdir y est refusé — vérifié empiriquement, `Permission denied`) ; chaque
    home de site y est monté sous `~/<site>/`. `workdir` bare (`~/pactiva`) utilisé tel
    quel comme cible rsync aurait donc soit fait échouer le transfert, soit poussé les
    fichiers là où AUCUN nœud de calcul ne les aurait jamais vus — un job réel aurait
    consommé une réservation pour échouer sur "fichier introuvable"."""

    def test_qualifie_un_chemin_relatif_par_le_site(self):
        assert Grid5000Backend._access_path("nantes", "~/pactiva") == "~/nantes/pactiva"

    def test_tilde_seul_sans_sous_chemin(self):
        assert Grid5000Backend._access_path("nancy", "~") == "~/nancy"

    def test_laisse_un_chemin_absolu_deja_explicite_intact(self):
        assert Grid5000Backend._access_path("nantes", "/mnt/group_storage/pactiva") == \
            "/mnt/group_storage/pactiva"


class TestSubmit:
    def test_refuse_sans_cle_ssh_avant_tout_transfert(self, a_run, tmp_path):
        backend = Grid5000Backend(login="a", password="p")  # pas de ssh_key
        with pytest.raises(G5KError) as exc:
            backend.submit(a_run, tmp_path / "data", tmp_path / "out")
        assert exc.value.code == "g5k_ssh_key_missing"

    def test_soumission_complete_pousse_puis_appelle_le_client(self, a_run, tmp_path):
        backend = Grid5000Backend(login="a", password="p", ssh_key="clé")
        out_dir = tmp_path / "out"
        with patch("claire.lab.runners.g5k.g5k_submit", return_value="42") as fake_submit:
            with patch.object(Grid5000Backend, "_rsync_push") as fake_push:
                job_id = backend.submit(a_run, tmp_path / "data", out_dir)
        assert job_id == "42"
        fake_push.assert_called_once()
        assert (out_dir / "run.sh").exists()
        assert fake_submit.call_args.kwargs["resources"] == "gpu=1,walltime=04:00"

    def test_pousse_vers_le_chemin_qualifie_par_site_mais_soumet_la_commande_bare(
        self, a_run, tmp_path,
    ):
        """LE test de non-régression du bug ci-dessus : la commande OAR (exécutée SUR le
        nœud) doit rester `~/pactiva/...` bare, tandis que la cible rsync (depuis le
        frontal `access.grid5000.fr`) doit être qualifiée par site — jamais les deux
        confondus dans un sens ou dans l'autre."""
        backend = Grid5000Backend(login="a", password="p", ssh_key="clé")
        out_dir = tmp_path / "out"
        with patch("claire.lab.runners.g5k.g5k_submit", return_value="42") as fake_submit:
            with patch.object(Grid5000Backend, "_rsync_push") as fake_push:
                backend.submit(a_run, tmp_path / "data", out_dir)

        pushed_remote = fake_push.call_args.args[2]
        assert pushed_remote == f"~/nancy/pactiva/runs/{a_run.id}"

        command = fake_submit.call_args.kwargs["command"]
        assert command == f"bash ~/pactiva/runs/{a_run.id}/run.sh"

    def test_transmet_toujours_une_queue_explicite(self, a_run, tmp_path):
        """Bug réel du 14 août 2026 (voir test_lab_g5k_client.py) : sans `queue`
        explicite, OAR échoue avec `queue 'abaca' does not exist` pour ce compte."""
        backend = Grid5000Backend(login="a", password="p", ssh_key="clé")
        with patch("claire.lab.runners.g5k.g5k_submit", return_value="42") as fake_submit:
            with patch.object(Grid5000Backend, "_rsync_push"):
                backend.submit(a_run, tmp_path / "data", tmp_path / "out")
        assert fake_submit.call_args.kwargs["queue"] == "default"

    def test_exotic_active_ajoute_le_type_exotic(self, a_run, tmp_path):
        """Bug réel du 14 août 2026 : le cluster gemini (lyon, V100 32 Go), pourtant
        déjà marqué "vérifié" dans notre catalogue, a été refusé par `oarsub` sans
        `-t exotic` explicite ("Filtering out exotic resources (..., gemini, ...)")."""
        a_run.config["compute"]["g5k"]["exotic"] = True
        a_run.save(update_fields=["config"])
        backend = Grid5000Backend(login="a", password="p", ssh_key="clé")
        with patch("claire.lab.runners.g5k.g5k_submit", return_value="42") as fake_submit:
            with patch.object(Grid5000Backend, "_rsync_push"):
                backend.submit(a_run, tmp_path / "data", tmp_path / "out")
        assert "exotic" in fake_submit.call_args.kwargs["types"]


class TestPollFetchCancel:
    def test_poll_delegue_au_client(self, a_run):
        backend = Grid5000Backend(login="a", password="p")
        with patch("claire.lab.runners.g5k.g5k_poll", return_value="running") as fake_poll:
            assert backend.poll(a_run) == "running"
        fake_poll.assert_called_once_with(backend._client, "nancy", "1965464")

    def test_fetch_tire_puis_verifie_le_sentinel(self, a_run, tmp_path):
        backend = Grid5000Backend(login="a", password="p", ssh_key="clé")
        out_dir = tmp_path / "out"
        out_dir.mkdir()
        (out_dir / "_SENTINEL").write_text("DONE")
        with patch.object(Grid5000Backend, "_rsync_pull") as fake_pull:
            complete = backend.fetch(a_run, out_dir)
        fake_pull.assert_called_once()
        assert complete is True

    def test_fetch_sans_sentinel_est_partiel(self, a_run, tmp_path):
        backend = Grid5000Backend(login="a", password="p", ssh_key="clé")
        out_dir = tmp_path / "out"
        with patch.object(Grid5000Backend, "_rsync_pull"):
            complete = backend.fetch(a_run, out_dir)
        assert complete is False  # walltime a coupé le job — pas une erreur

    def test_fetch_tire_depuis_le_chemin_qualifie_par_site(self, a_run, tmp_path):
        backend = Grid5000Backend(login="a", password="p", ssh_key="clé")
        out_dir = tmp_path / "out"
        with patch.object(Grid5000Backend, "_rsync_pull") as fake_pull:
            backend.fetch(a_run, out_dir)
        pulled_remote = fake_pull.call_args.args[0]
        assert pulled_remote == f"~/nancy/pactiva/runs/{a_run.id}/results/"

    def test_cancel_delegue_au_client(self, a_run):
        backend = Grid5000Backend(login="a", password="p")
        with patch("claire.lab.runners.g5k.g5k_cancel") as fake_cancel:
            backend.cancel(a_run)
        fake_cancel.assert_called_once_with(backend._client, "nancy", "1965464")

    def test_cancel_sans_job_id_ne_fait_rien(self, a_run):
        a_run.external_job_id = ""
        backend = Grid5000Backend(login="a", password="p")
        with patch("claire.lab.runners.g5k.g5k_cancel") as fake_cancel:
            backend.cancel(a_run)
        fake_cancel.assert_not_called()


class TestTestSsh:
    """`_test_ssh` — le VRAI appel `ssh ... true`, jamais exercé au-delà d'un mock
    entier de la méthode dans `TestConnection`."""

    def test_succes(self):
        backend = Grid5000Backend(login="alice", password="p", ssh_key="clé")
        with patch("claire.lab.runners.g5k.subprocess.run", return_value=_ok_process(0)):
            ok, detail = backend._test_ssh()
        assert ok is True
        assert "établie" in detail

    def test_cle_refusee(self):
        backend = Grid5000Backend(login="alice", password="p", ssh_key="clé")
        with patch("claire.lab.runners.g5k.subprocess.run", return_value=_ok_process(255)):
            ok, detail = backend._test_ssh()
        assert ok is False

    def test_delai_depasse(self):
        import subprocess

        backend = Grid5000Backend(login="alice", password="p", ssh_key="clé")
        with patch(
            "claire.lab.runners.g5k.subprocess.run",
            side_effect=subprocess.TimeoutExpired(cmd="ssh", timeout=20),
        ):
            ok, detail = backend._test_ssh()
        assert ok is False
        assert "délai" in detail


class TestRsync:
    def test_push_utilise_la_cle_ssh_temporaire_et_deux_appels_rsync(self, tmp_path):
        backend = Grid5000Backend(login="alice", password="p", ssh_key="clé-de-test")
        dataset_dir = tmp_path / "dataset"
        dataset_dir.mkdir()
        out_dir = tmp_path / "out"
        out_dir.mkdir()
        (out_dir / "config.json").write_text("{}")
        (out_dir / "run.sh").write_text("#!/bin/sh")

        with patch("claire.lab.runners.g5k.subprocess.run", return_value=_ok_process()) as fake_run:
            backend._rsync_push(dataset_dir, out_dir, "~/pactiva/runs/x")
        assert fake_run.call_count == 2
        first_call_args = fake_run.call_args_list[0].args[0]
        assert "rsync" in first_call_args
        assert "-e" in first_call_args  # option SSH passée, pas un rsync nu

    def test_pull_echec_est_tolere_allow_failure(self, tmp_path):
        backend = Grid5000Backend(login="alice", password="p", ssh_key="clé-de-test")
        out_dir = tmp_path / "out"
        with patch("claire.lab.runners.g5k.subprocess.run", return_value=_ok_process(returncode=23)):
            backend._rsync_pull("~/pactiva/runs/x/results/", out_dir)  # ne lève pas

    def test_push_echec_leve_g5kerror_sans_la_commande_complete(self, tmp_path):
        """⭐ Le message d'erreur ne doit jamais contenir la commande rsync complète —
        elle porte le login (donnée à faible sensibilité mais à ne pas journaliser sans
        raison, cohérent avec la politique déjà en place)."""
        backend = Grid5000Backend(login="alice", password="p", ssh_key="clé-de-test")
        dataset_dir = tmp_path / "dataset"
        dataset_dir.mkdir()
        out_dir = tmp_path / "out"
        out_dir.mkdir()
        (out_dir / "config.json").write_text("{}")
        (out_dir / "run.sh").write_text("#!/bin/sh")
        with patch("claire.lab.runners.g5k.subprocess.run", return_value=_ok_process(returncode=1)):
            with pytest.raises(G5KError) as exc:
                backend._rsync_push(dataset_dir, out_dir, "~/pactiva/runs/x")
        assert exc.value.code == "g5k_transfer_failed"
        assert "alice" not in str(exc.value)
