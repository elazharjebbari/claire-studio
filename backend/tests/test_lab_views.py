"""API HTTP du Lab (`claire/lab/views.py`) — jamais exercée avant cet audit : toute la
suite précédente appelait les fonctions pures (`build_dataset`, `run_once`…) directement,
jamais via le client DRF. Ce fichier couvre ce que seul un vrai passage HTTP révèle :
permissions par rôle, codes de statut, et la camélisation automatique des réponses (y
compris à l'intérieur d'un JSONField générique comme `metrics` — la source du bug réel
trouvé en pilotant un vrai navigateur contre `RunResults.tsx`, voir test_lab_runs.py).
"""

import uuid

import pytest
from cryptography.fernet import Fernet
from rest_framework.test import APIClient

from claire.lab.models import (
    ComputeCredential,
    Experiment,
    ExperimentRun,
    LabDataset,
    RunStatus,
    Task,
)
from claire.projects.models import MembershipRole, ProjectMembership
from tests.conftest import CorpusFactory, DocumentFactory, ProjectFactory, UserFactory

pytestmark = pytest.mark.django_db
API = "/api/v1"


def _client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def lab_campaign(scheme_with_themes, settings, tmp_path):
    """Projet avec deux annotateurs complets sur cinq documents, et les trois rôles
    d'accès (lead/reviewer/annotateur non membre) nécessaires pour tester la permission
    du Lab, qui est réservée à lead/reviewer (`access_for().may_create_project_artifact`).
    """
    from claire.annotations.models import Annotation, Clause, ClauseTheme
    from claire.corpora.models import Sentence

    settings.LAB_DIR = str(tmp_path / "lab")
    corpus = CorpusFactory()
    project = ProjectFactory(corpus=corpus, scheme=scheme_with_themes)

    ann1 = UserFactory(username="lab_view_ann1", role="annotator")
    ann2 = UserFactory(username="lab_view_ann2", role="annotator")
    lead = UserFactory(username="lab_view_lead", role="annotator")
    reviewer = UserFactory(username="lab_view_reviewer", role="reviewer")
    outsider = UserFactory(username="lab_view_outsider", role="annotator")
    for user, role in [
        (ann1, MembershipRole.ANNOTATOR), (ann2, MembershipRole.ANNOTATOR),
        (lead, MembershipRole.LEAD), (reviewer, MembershipRole.REVIEWER),
    ]:
        ProjectMembership.objects.create(project=project, user=user, role=role)

    themes = list(scheme_with_themes.themes_map.values())
    for d in range(5):
        document = DocumentFactory(corpus=corpus, n_sentences=10)
        sentences = [
            Sentence.objects.create(document=document, index=i, raw_text=f"clause {i} .")
            for i in range(10)
        ]
        for user in (ann1, ann2):
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

    return {
        "project": project, "lead": lead, "reviewer": reviewer,
        "ann1": ann1, "ann2": ann2, "outsider": outsider,
    }


def _base_config(dataset_id):
    return {
        "version": 1, "task": "T1_primary", "seed": 42, "dataset_id": str(dataset_id),
        "preprocess": {"detokenize": "regex_rules"},
        "model": {"family": "tfidf_linear"},
        "evaluation": {"split": {"scheme": "group_kfold_document", "k": 5}},
    }


# --------------------------------------------------------------------------- #
# Permissions — appliquées par _project_for() sur TOUS les endpoints projet-scopés
# --------------------------------------------------------------------------- #

def test_un_annotateur_simple_recoit_403_sur_le_preflight(lab_campaign):
    slug = lab_campaign["project"].slug
    resp = _client(lab_campaign["ann1"]).post(f"{API}/projects/{slug}/lab/datasets/preflight", {})
    assert resp.status_code == 403
    assert resp.json()["code"] == "forbidden"


def test_un_utilisateur_hors_projet_recoit_403(lab_campaign):
    slug = lab_campaign["project"].slug
    resp = _client(lab_campaign["outsider"]).get(f"{API}/projects/{slug}/lab/runs")
    assert resp.status_code == 403


@pytest.mark.parametrize("role_key", ["lead", "reviewer"])
def test_lead_et_reviewer_peuvent_lister_les_runs(lab_campaign, role_key):
    slug = lab_campaign["project"].slug
    resp = _client(lab_campaign[role_key]).get(f"{API}/projects/{slug}/lab/runs")
    assert resp.status_code == 200


# --------------------------------------------------------------------------- #
# Datasets
# --------------------------------------------------------------------------- #

def test_preflight_rapporte_les_documents_retenus_sans_rien_creer(lab_campaign):
    slug = lab_campaign["project"].slug
    resp = _client(lab_campaign["lead"]).post(
        f"{API}/projects/{slug}/lab/datasets/preflight",
        {"maturity": "complete", "k": 5}, format="json",
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["nDocuments"] == 5
    assert LabDataset.objects.count() == 0  # rien créé


def test_construction_puis_doublon_refuse_409(lab_campaign):
    slug = lab_campaign["project"].slug
    client = _client(lab_campaign["lead"])
    payload = {"maturity": "complete", "aggregation": "consensus", "k": 5}

    first = client.post(f"{API}/projects/{slug}/lab/datasets", payload, format="json")
    assert first.status_code == 201
    dataset_id = first.json()["id"]

    duplicate = client.post(f"{API}/projects/{slug}/lab/datasets", payload, format="json")
    assert duplicate.status_code == 409
    assert duplicate.json()["dataset"]["id"] == dataset_id


def test_dataset_detail_404_pour_un_autre_projet(lab_campaign):
    other_project = ProjectFactory(corpus=CorpusFactory(), scheme=lab_campaign["project"].scheme)
    ProjectMembership.objects.create(
        project=other_project, user=lab_campaign["lead"], role=MembershipRole.LEAD
    )
    slug = other_project.slug
    resp = _client(lab_campaign["lead"]).get(
        f"{API}/projects/{slug}/lab/datasets/{uuid.uuid4()}"
    )
    assert resp.status_code == 404


def test_datasets_get_filtre_par_maturite(lab_campaign):
    slug = lab_campaign["project"].slug
    client = _client(lab_campaign["lead"])
    client.post(
        f"{API}/projects/{slug}/lab/datasets",
        {"maturity": "complete", "k": 5}, format="json",
    )
    resp = client.get(f"{API}/projects/{slug}/lab/datasets", {"maturity": "submitted"})
    assert resp.status_code == 200
    assert resp.json() == []  # aucun dataset "submitted", seulement "complete"


# --------------------------------------------------------------------------- #
# Expériences et runs
# --------------------------------------------------------------------------- #

@pytest.fixture
def lab_dataset(lab_campaign):
    from claire.lab.services import build_dataset

    return build_dataset(
        project=lab_campaign["project"], user=lab_campaign["lead"],
        maturity="complete", aggregation="consensus", k=5,
    )


def test_experiments_post_refuse_une_config_invalide(lab_campaign, lab_dataset):
    slug = lab_campaign["project"].slug
    config = _base_config(lab_dataset.id)
    config["evaluation"]["split"]["scheme"] = "random_sentence"
    resp = _client(lab_campaign["lead"]).post(
        f"{API}/projects/{slug}/lab/experiments",
        {"name": "x", "task": Task.T1, "dataset": str(lab_dataset.id), "config": config},
        format="json",
    )
    assert resp.status_code == 400
    assert resp.json()["code"] == "config_invalid"


def test_cycle_complet_experience_run_annulation(lab_campaign, lab_dataset):
    slug = lab_campaign["project"].slug
    client = _client(lab_campaign["lead"])
    config = _base_config(lab_dataset.id)

    created = client.post(
        f"{API}/projects/{slug}/lab/experiments",
        {"name": "baseline", "task": Task.T1, "dataset": str(lab_dataset.id), "config": config},
        format="json",
    )
    assert created.status_code == 201
    experiment_id = created.json()["id"]

    estimate = client.post(
        f"{API}/projects/{slug}/lab/experiments/{experiment_id}/estimate"
    )
    assert estimate.status_code == 200
    assert estimate.json()["nRuns"] == 1
    assert estimate.json()["requiresGpu"] is False

    launched = client.post(f"{API}/projects/{slug}/lab/experiments/{experiment_id}/run")
    assert launched.status_code == 202
    run_ids = launched.json()["runIds"]
    assert len(run_ids) == 1
    run_id = run_ids[0]

    relaunched = client.post(f"{API}/projects/{slug}/lab/experiments/{experiment_id}/run")
    assert relaunched.status_code == 409
    assert relaunched.json()["code"] == "run_duplicate"

    detail = client.get(f"{API}/projects/{slug}/lab/runs/{run_id}")
    assert detail.status_code == 200
    assert detail.json()["status"] == "queued"

    cancelled = client.post(f"{API}/projects/{slug}/lab/runs/{run_id}/cancel")
    assert cancelled.status_code == 202

    run = ExperimentRun.objects.get(id=run_id)
    run.status = RunStatus.SUCCEEDED
    run.save(update_fields=["status"])
    finished_cancel = client.post(f"{API}/projects/{slug}/lab/runs/{run_id}/cancel")
    assert finished_cancel.status_code == 409
    assert finished_cancel.json()["code"] == "run_finished"


def test_run_detail_404_pour_un_run_d_un_autre_projet(lab_campaign, lab_dataset):
    experiment = Experiment.objects.create(
        project=lab_campaign["project"], dataset=lab_dataset, created_by=lab_campaign["lead"],
        name="x", task=Task.T1, config=_base_config(lab_dataset.id),
    )
    run = ExperimentRun.objects.create(
        experiment=experiment, config=experiment.config, fingerprint="f",
        status=RunStatus.QUEUED,
    )
    other_project = ProjectFactory(corpus=CorpusFactory(), scheme=lab_campaign["project"].scheme)
    ProjectMembership.objects.create(
        project=other_project, user=lab_campaign["lead"], role=MembershipRole.LEAD
    )
    resp = _client(lab_campaign["lead"]).get(
        f"{API}/projects/{other_project.slug}/lab/runs/{run.id}"
    )
    assert resp.status_code == 404


def test_compare_runs_camelise_les_cles_construites_a_la_main(lab_campaign, lab_dataset):
    """⭐ `compare_runs` construit son payload en snake_case Python (`run_id`,
    `human_ceiling`, `incomparable_reason`) — le contraire du bug trouvé dans
    `RunResults.tsx` (qui lisait du snake_case sur un payload déjà camélisé). Ici on
    verrouille l'autre sens : le middleware camélise bien CE dict construit à la main,
    pas seulement les ModelSerializer classiques — le front peut donc s'y fier partout."""
    experiment = Experiment.objects.create(
        project=lab_campaign["project"], dataset=lab_dataset, created_by=lab_campaign["lead"],
        name="baseline", task=Task.T1, config=_base_config(lab_dataset.id),
    )
    run = ExperimentRun.objects.create(
        experiment=experiment, config=experiment.config, fingerprint="f",
        status=RunStatus.SUCCEEDED,
        metrics={"metrics": {"macro_f1": 0.5}, "human_ceiling": {"value": 0.8}},
    )
    slug = lab_campaign["project"].slug
    resp = _client(lab_campaign["lead"]).post(
        f"{API}/projects/{slug}/lab/compare",
        {"run_ids": [str(run.id)]}, format="json",
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "incomparableReason" in body  # pas "incomparable_reason"
    row = body["rows"][0]
    assert row["runId"] == str(run.id)  # pas "run_id"
    assert row["humanCeiling"] == 0.8  # pas "human_ceiling"


# --------------------------------------------------------------------------- #
# Identifiants de calcul — jamais le secret, 503 sans clé Fernet
# --------------------------------------------------------------------------- #

def test_compute_credentials_get_ne_contient_jamais_le_secret(lab_campaign, monkeypatch):
    from claire.lab import crypto

    monkeypatch.setenv(crypto.ENV_KEY, Fernet.generate_key().decode())
    user = lab_campaign["lead"]
    ComputeCredential.objects.create(
        user=user, kind="g5k", login="alice",
        secret_encrypted=crypto.encrypt_secret("s3cret"),
    )
    resp = _client(user).get(f"{API}/me/compute-credentials")
    assert resp.status_code == 200
    assert "s3cret" not in resp.content.decode()
    assert resp.json()["credentials"][0]["hasPassword"] is True


def test_compute_credentials_put_refuse_503_sans_cle_fernet(lab_campaign, monkeypatch):
    from claire.lab import crypto

    monkeypatch.delenv(crypto.ENV_KEY, raising=False)
    resp = _client(lab_campaign["lead"]).put(
        f"{API}/me/compute-credentials",
        {"kind": "g5k", "login": "alice", "password": "s3cret"}, format="json",
    )
    assert resp.status_code == 503
    assert resp.json()["code"] == "credentials_key_missing"
    assert ComputeCredential.objects.count() == 0  # refus d'écrire, jamais en clair


def test_compute_credentials_put_puis_delete(lab_campaign, monkeypatch):
    from claire.lab import crypto

    monkeypatch.setenv(crypto.ENV_KEY, Fernet.generate_key().decode())
    client = _client(lab_campaign["lead"])
    created = client.put(
        f"{API}/me/compute-credentials",
        {"kind": "g5k", "login": "alice", "password": "s3cret"}, format="json",
    )
    assert created.status_code == 200
    credential_id = created.json()["id"]

    deleted = client.delete(f"{API}/me/compute-credentials/{credential_id}")
    assert deleted.status_code == 204
    assert ComputeCredential.objects.count() == 0


def test_compute_credentials_test_appelle_le_backend_et_persiste_le_resultat(
    lab_campaign, monkeypatch
):
    """Le test de connexion évite de découvrir un mot de passe faux après une réservation
    de plusieurs heures — jamais exercé avant cet audit. Le backend Grid'5000 réel est
    mocké : ce test vérifie le CÂBLAGE (vue → backend → persistance), pas le réseau."""
    from claire.lab import crypto

    monkeypatch.setenv(crypto.ENV_KEY, Fernet.generate_key().decode())
    user = lab_campaign["lead"]
    credential = ComputeCredential.objects.create(
        user=user, kind="g5k", login="alice",
        secret_encrypted=crypto.encrypt_secret("s3cret"),
    )
    monkeypatch.setattr(
        "claire.lab.runners.g5k.Grid5000Backend.test_connection",
        lambda self: (True, "connexion établie (12 sites)"),
    )
    resp = _client(user).post(f"{API}/me/compute-credentials/{credential.id}/test")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert "12 sites" in body["detail"]
    credential.refresh_from_db()
    assert credential.last_test_ok is True
    assert credential.last_tested_at is not None


def test_compute_credential_delete_scope_a_l_utilisateur(lab_campaign, monkeypatch):
    """Un identifiant appartient à SON utilisateur — un autre lead ne peut ni le voir
    ni le supprimer (les identifiants Grid'5000 ne sont pas partagés au projet)."""
    from claire.lab import crypto

    monkeypatch.setenv(crypto.ENV_KEY, Fernet.generate_key().decode())
    credential = ComputeCredential.objects.create(
        user=lab_campaign["lead"], kind="g5k", login="alice",
        secret_encrypted=crypto.encrypt_secret("s3cret"),
    )
    resp = _client(lab_campaign["reviewer"]).delete(
        f"{API}/me/compute-credentials/{credential.id}"
    )
    assert resp.status_code == 404
    assert ComputeCredential.objects.filter(id=credential.id).exists()
