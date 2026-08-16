"""Programmes d'expériences (docs/pactiva-lab/05_BLOCS_ET_PROGRAMMES.md) : programmes
déclarés en YAML + avancement PAR PRESET dérivé des runs réels — jamais un état stocké.
"""

import pytest
from rest_framework.test import APIClient

from claire.lab.models import Experiment, ExperimentRun, RunStatus, Task
from tests.test_lab_views import _base_config, lab_campaign, lab_dataset  # noqa: F401

pytestmark = pytest.mark.django_db
API = "/api/v1"


def _client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _make_run(campaign, dataset, preset, status, fingerprint):
    experiment = Experiment.objects.create(
        project=campaign["project"], dataset=dataset, created_by=campaign["lead"],
        name=f"exp {preset}", task=Task.T1, config=_base_config(dataset.id),
        preset=preset,
    )
    ExperimentRun.objects.create(
        experiment=experiment, config=_base_config(dataset.id),
        fingerprint=fingerprint, status=status,
    )
    return experiment


def test_programmes_declares_et_statuts_derives(lab_campaign, lab_dataset):  # noqa: F811
    exp_ok = _make_run(lab_campaign, lab_dataset, "baseline-fast", RunStatus.SUCCEEDED, "a" * 64)
    _make_run(lab_campaign, lab_dataset, "legal-bert-finetune", RunStatus.FAILED, "b" * 64)
    _make_run(lab_campaign, lab_dataset, "learning-curve", RunStatus.RUNNING, "c" * 64)

    slug = lab_campaign["project"].slug
    resp = _client(lab_campaign["lead"]).get(f"{API}/projects/{slug}/lab/programs")
    assert resp.status_code == 200
    body = resp.json()

    # Les programmes du YAML réel sont servis (papier long + papier court), items ordonnés.
    ids = [p["id"] for p in body["programs"]]
    assert "papier-long" in ids and "papier-court" in ids
    long = next(p for p in body["programs"] if p["id"] == "papier-long")
    assert long["items"][0]["preset"] == "baseline-fast"
    assert long["paper"] == "long"
    assert all("role" in item for item in long["items"])

    # ⭐ Les statuts viennent des RUNS, jamais d'un état séparé.
    status = body["presetStatus"]
    assert status["baseline-fast"]["validated"] is True
    assert status["baseline-fast"]["experimentId"] == str(exp_ok.id)
    assert status["legal-bert-finetune"]["validated"] is False
    assert status["legal-bert-finetune"]["byStatus"] == {"failed": 1}
    assert status["learning-curve"]["byStatus"] == {"running": 1}
    # Preset jamais lancé → absent de la map (le front l'interprète « jamais lancé »).
    assert "position-only" not in status


def test_filtre_dataset_ne_compte_que_la_campagne_visee(lab_campaign, lab_dataset):  # noqa: F811
    """⭐ Un statut toutes-données-confondues mentirait sur l'avancement d'une campagne
    liée à UN dataset."""
    from claire.lab.services import build_dataset

    other = build_dataset(
        project=lab_campaign["project"], user=lab_campaign["lead"],
        maturity="any", aggregation="consensus", k=5,
    )
    _make_run(lab_campaign, lab_dataset, "baseline-fast", RunStatus.SUCCEEDED, "a" * 64)
    _make_run(lab_campaign, other, "baseline-fast", RunStatus.FAILED, "d" * 64)

    slug = lab_campaign["project"].slug
    client = _client(lab_campaign["lead"])

    scoped = client.get(
        f"{API}/projects/{slug}/lab/programs?dataset={lab_dataset.id}"
    ).json()
    assert scoped["presetStatus"]["baseline-fast"]["validated"] is True
    assert scoped["presetStatus"]["baseline-fast"]["nRuns"] == 1

    other_scoped = client.get(
        f"{API}/projects/{slug}/lab/programs?dataset={other.id}"
    ).json()
    assert other_scoped["presetStatus"]["baseline-fast"]["validated"] is False


def test_acces_reserve_aux_roles_lab(lab_campaign):  # noqa: F811
    slug = lab_campaign["project"].slug
    assert _client(lab_campaign["ann1"]).get(
        f"{API}/projects/{slug}/lab/programs"
    ).status_code == 403
    assert _client(lab_campaign["reviewer"]).get(
        f"{API}/projects/{slug}/lab/programs"
    ).status_code == 200


def test_fichier_absent_donne_une_liste_vide_jamais_500(lab_campaign, settings, tmp_path):  # noqa: F811
    from claire.lab import programs

    settings.LAB_PROGRAMS_FILE = str(tmp_path / "absent.yaml")
    programs._load_cached.cache_clear()
    try:
        slug = lab_campaign["project"].slug
        resp = _client(lab_campaign["lead"]).get(f"{API}/projects/{slug}/lab/programs")
        assert resp.status_code == 200
        assert resp.json()["programs"] == []
    finally:
        programs._load_cached.cache_clear()


def test_le_catalogue_expose_themes_et_metadonnees(lab_campaign):  # noqa: F811
    """Le YAML enrichi (themes + theme/papers/stage par preset) traverse l'API tel
    quel — la classification du lanceur par blocs en dépend."""
    slug = lab_campaign["project"].slug
    body = _client(lab_campaign["lead"]).get(f"{API}/projects/{slug}/lab/presets").json()
    assert [t["id"] for t in body["themes"]][:2] == ["planchers", "references-llm"]
    baseline = next(p for p in body["presets"] if p["id"] == "baseline-fast")
    assert baseline["theme"] == "planchers"
    assert baseline["stage"] == "reference"
    assert baseline["papers"] == ["long"]
    # Tous les presets sont classés — un preset sans thème casserait le regroupement.
    assert all(p.get("theme") and p.get("stage") for p in body["presets"])
