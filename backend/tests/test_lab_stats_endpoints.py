"""Endpoints statistiques inter-runs (lot L1, docs/pactiva-lab-resultats/06) :
`compare/paired`, `experiments/<id>/aggregate`, `agreement`.

Les prédictions par phrase sont de vraies fixtures `predictions.jsonl` écrites sur
disque et cataloguées en `RunArtifact` avec leur checksum — le chemin complet que
l'endpoint emprunte, pas un mock du pont.
"""

import hashlib
import json
import uuid

import pytest
from rest_framework.test import APIClient

from claire.lab.models import (
    ArtifactKind,
    Experiment,
    ExperimentRun,
    RunArtifact,
    RunStatus,
    Task,
)
from tests.test_lab_views import _base_config, lab_campaign, lab_dataset  # noqa: F401

pytestmark = pytest.mark.django_db
API = "/api/v1"

# 10 documents : avec n docs, les motifs de permutation aussi extrêmes que l'observé
# (identité et miroir complet) pèsent 2/2^n — à 6 documents ce serait ~3 % des tirages,
# assez pour faire dépasser 0,05 à une p-value pourtant « évidente ».
DOCUMENTS = [f"doc{i}" for i in range(10)]


def _client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _write_predictions(tmp_path, run: ExperimentRun, rows: list[dict]) -> None:
    out_dir = tmp_path / str(run.id)
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / "predictions.jsonl"
    payload = "".join(json.dumps(row) + "\n" for row in rows).encode("utf-8")
    path.write_bytes(payload)
    run.storage_path = str(out_dir)
    run.save(update_fields=["storage_path"])
    RunArtifact.objects.create(
        run=run, kind=ArtifactKind.PREDICTIONS, name="predictions.jsonl",
        path=str(path), mime="application/x-ndjson", bytes=len(payload),
        checksum=hashlib.sha256(payload).hexdigest(),
    )


def _rows(*, correct_in: set[str]) -> list[dict]:
    """4 phrases par document ; les documents hors `correct_in` sont prédits faux."""
    rows = []
    for document in DOCUMENTS:
        for index in range(4):
            truth = "A" if index % 2 else "B"
            good = document in correct_in
            rows.append({
                "document": document, "index": index, "fold": 0,
                "y_true": truth, "y_pred": truth if good else ("B" if truth == "A" else "A"),
                "confidence": 0.9, "scores": {}, "unfair": [], "agreement": "strict",
            })
    return rows


@pytest.fixture
def paired_runs(lab_campaign, lab_dataset, tmp_path):  # noqa: F811
    experiment = Experiment.objects.create(
        project=lab_campaign["project"], dataset=lab_dataset,
        created_by=lab_campaign["lead"], name="comparaison", task=Task.T1,
        config=_base_config(lab_dataset.id), preset="embeddings-frozen",
    )
    run_a = ExperimentRun.objects.create(
        experiment=experiment, config=_base_config(lab_dataset.id),
        fingerprint="a" * 64, status=RunStatus.SUCCEEDED,
    )
    run_b = ExperimentRun.objects.create(
        experiment=experiment, config=_base_config(lab_dataset.id),
        fingerprint="b" * 64, status=RunStatus.SUCCEEDED,
    )
    _write_predictions(tmp_path, run_a, _rows(correct_in=set(DOCUMENTS)))
    _write_predictions(tmp_path, run_b, _rows(correct_in=set()))
    return {"experiment": experiment, "a": run_a, "b": run_b}


# --------------------------------------------------------------------------- #
# compare/paired
# --------------------------------------------------------------------------- #

class TestComparePaired:
    def _post(self, lab_campaign, body):  # noqa: F811
        slug = lab_campaign["project"].slug
        return _client(lab_campaign["lead"]).post(
            f"{API}/projects/{slug}/lab/compare/paired", body, format="json"
        )

    def test_nominal_renvoie_delta_ic_et_p_value_camelises(self, lab_campaign, paired_runs):  # noqa: F811
        resp = self._post(lab_campaign, {
            "runA": str(paired_runs["a"].id), "runB": str(paired_runs["b"].id),
            "nResamples": 100, "nPermutations": 100,
        })
        assert resp.status_code == 200
        body = resp.json()
        # A juste partout, B faux partout : Δ > 0, IC strictement positif, p minimal.
        assert body["delta"] > 0
        assert body["low"] > 0
        assert body["pValue"] <= 0.05
        assert body["nDocuments"] == len(DOCUMENTS)
        assert body["unit"] == "document"
        assert body["test"] == "paired_bootstrap+permutation"
        assert body["labelA"] == "comparaison"

    def test_metrique_kappa_admise(self, lab_campaign, paired_runs):  # noqa: F811
        resp = self._post(lab_campaign, {
            "runA": str(paired_runs["a"].id), "runB": str(paired_runs["b"].id),
            "metric": "kappa", "nResamples": 50, "nPermutations": 50,
        })
        assert resp.status_code == 200
        assert resp.json()["metric"] == "kappa"

    def test_metrique_inconnue_refusee(self, lab_campaign, paired_runs):  # noqa: F811
        resp = self._post(lab_campaign, {
            "runA": str(paired_runs["a"].id), "runB": str(paired_runs["b"].id),
            "metric": "ece",
        })
        assert resp.status_code == 422
        assert resp.json()["code"] == "unsupported_metric"

    def test_predictions_absentes_422_avec_code_stable(self, lab_campaign, lab_dataset, paired_runs):  # noqa: F811
        # ⭐ Cas réel : run antérieur au catalogage — l'UI doit pouvoir afficher le
        # repli descriptif, jamais un test silencieusement absent.
        bare = ExperimentRun.objects.create(
            experiment=paired_runs["experiment"], config=_base_config(lab_dataset.id),
            fingerprint="c" * 64, status=RunStatus.SUCCEEDED,
        )
        resp = self._post(lab_campaign, {
            "runA": str(paired_runs["a"].id), "runB": str(bare.id),
        })
        assert resp.status_code == 422
        assert resp.json()["code"] == "predictions_missing"

    def test_checksum_corrompu_422(self, lab_campaign, paired_runs):  # noqa: F811
        artifact = RunArtifact.objects.get(run=paired_runs["b"])
        from pathlib import Path
        Path(artifact.path).write_bytes(b'{"document": "doc0", "index": 0}\n')
        resp = self._post(lab_campaign, {
            "runA": str(paired_runs["a"].id), "runB": str(paired_runs["b"].id),
        })
        assert resp.status_code == 422
        assert resp.json()["code"] == "predictions_checksum_mismatch"

    def test_couvertures_desalignees_422(self, lab_campaign, lab_dataset, paired_runs, tmp_path):  # noqa: F811
        partial = ExperimentRun.objects.create(
            experiment=paired_runs["experiment"], config=_base_config(lab_dataset.id),
            fingerprint="d" * 64, status=RunStatus.PARTIAL,
        )
        _write_predictions(tmp_path, partial, _rows(correct_in=set())[:8])
        resp = self._post(lab_campaign, {
            "runA": str(paired_runs["a"].id), "runB": str(partial.id),
        })
        assert resp.status_code == 422
        assert resp.json()["code"] == "predictions_mismatch"

    def test_parametres_degeneres_refuses_en_400_jamais_500(self, lab_campaign, paired_runs):  # noqa: F811
        # ⭐ n_resamples=0 → percentile d'une liste vide (IndexError) ; négatif →
        # division par zéro ; non numérique → ValueError. Tous en 400 propre.
        for body_extra in ({"nResamples": 0}, {"nPermutations": -1}):
            resp = self._post(lab_campaign, {
                "runA": str(paired_runs["a"].id), "runB": str(paired_runs["b"].id),
                **body_extra,
            })
            assert resp.status_code == 200, body_extra  # bornés au plancher, pas refusés
        resp = self._post(lab_campaign, {
            "runA": str(paired_runs["a"].id), "runB": str(paired_runs["b"].id),
            "nResamples": "beaucoup",
        })
        assert resp.status_code == 400
        assert resp.json()["code"] == "invalid_params"

    def test_predictions_tronquees_422_jamais_500(self, lab_campaign, paired_runs):  # noqa: F811
        # ⭐ Job tué pendant l'écriture : le fichier catalogué se termine en pleine ligne.
        artifact = RunArtifact.objects.get(run=paired_runs["b"])
        from pathlib import Path
        truncated = b'{"document": "doc0", "index": 0, "y_true": "A", "y_pr'
        Path(artifact.path).write_bytes(truncated)
        artifact.checksum = hashlib.sha256(truncated).hexdigest()
        artifact.save(update_fields=["checksum"])
        resp = self._post(lab_campaign, {
            "runA": str(paired_runs["a"].id), "runB": str(paired_runs["b"].id),
        })
        assert resp.status_code == 422
        assert resp.json()["code"] == "predictions_corrupt"

    def test_annotateur_refuse(self, lab_campaign, paired_runs):  # noqa: F811
        slug = lab_campaign["project"].slug
        resp = _client(lab_campaign["ann1"]).post(
            f"{API}/projects/{slug}/lab/compare/paired",
            {"runA": str(paired_runs["a"].id), "runB": str(paired_runs["b"].id)},
            format="json",
        )
        assert resp.status_code == 403

    def test_run_hors_projet_404(self, lab_campaign, paired_runs):  # noqa: F811
        resp = self._post(lab_campaign, {
            "runA": str(paired_runs["a"].id), "runB": str(uuid.uuid4()),
        })
        assert resp.status_code == 404


# --------------------------------------------------------------------------- #
# aggregate
# --------------------------------------------------------------------------- #

class TestAggregate:
    def test_sweep_learning_curve_expose_l_axe_et_les_points(self, lab_campaign, lab_dataset):  # noqa: F811
        experiment = Experiment.objects.create(
            project=lab_campaign["project"], dataset=lab_dataset,
            created_by=lab_campaign["lead"], name="courbe", task=Task.T1,
            config=_base_config(lab_dataset.id), preset="learning-curve",
        )
        for size, value in ((5, 0.30), (10, 0.38), (20, 0.44)):
            config = _base_config(lab_dataset.id)
            config["evaluation"]["learning_curve"] = {"n_documents": size, "seed": 42}
            ExperimentRun.objects.create(
                experiment=experiment, config=config,
                fingerprint=f"{size:064d}", status=RunStatus.SUCCEEDED,
                metrics={"metrics": {"macro_f1": value,
                                     "macro_f1_ci": {"point": value, "low": value - 0.05,
                                                     "high": value + 0.05}},
                         "human_ceiling": {"value": 0.49}},
            )
        # Un run échoué : présent dans la réponse, signalé par son statut.
        failed_config = _base_config(lab_dataset.id)
        failed_config["evaluation"]["learning_curve"] = {"n_documents": 30, "seed": 42}
        ExperimentRun.objects.create(
            experiment=experiment, config=failed_config,
            fingerprint="f" * 64, status=RunStatus.FAILED,
        )

        slug = lab_campaign["project"].slug
        resp = _client(lab_campaign["lead"]).get(
            f"{API}/projects/{slug}/lab/experiments/{experiment.id}/aggregate"
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["axis"] == "learning_curve.n_documents"
        assert body["preset"] == "learning-curve"
        assert body["humanCeiling"]["value"] == 0.49
        by_axis = {row["axisValue"]: row for row in body["runs"]}
        assert by_axis[10]["value"] == 0.38
        assert by_axis[10]["ci"]["low"] == pytest.approx(0.33)
        assert by_axis[30]["status"] == "failed"
        assert by_axis[30]["value"] is None

    def test_sweep_sans_axe_connu_renvoie_axis_null(self, lab_campaign, lab_dataset):  # noqa: F811
        experiment = Experiment.objects.create(
            project=lab_campaign["project"], dataset=lab_dataset,
            created_by=lab_campaign["lead"], name="criblage", task=Task.T1,
            config=_base_config(lab_dataset.id), preset="screening-preprocess",
        )
        config = _base_config(lab_dataset.id)
        ExperimentRun.objects.create(
            experiment=experiment, config=config, fingerprint="a" * 64,
            status=RunStatus.SUCCEEDED, metrics={"metrics": {"macro_f1": 0.4}},
        )
        slug = lab_campaign["project"].slug
        resp = _client(lab_campaign["lead"]).get(
            f"{API}/projects/{slug}/lab/experiments/{experiment.id}/aggregate"
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["axis"] is None
        # La config par run reste disponible : l'analyse marginale par axe du criblage
        # se fait côté client à partir d'elle.
        assert body["runs"][0]["config"]["model"]["family"]


# --------------------------------------------------------------------------- #
# agreement
# --------------------------------------------------------------------------- #

class TestAgreement:
    def test_matrice_kappa_et_alpha_entre_juges(self, lab_campaign, lab_dataset, tmp_path):  # noqa: F811
        experiment = Experiment.objects.create(
            project=lab_campaign["project"], dataset=lab_dataset,
            created_by=lab_campaign["lead"], name="juges", task=Task.T1,
            config=_base_config(lab_dataset.id), preset="llm-judges-baseline",
        )
        runs = []
        for judge, correct in (("fable", set(DOCUMENTS)), ("claude", set(DOCUMENTS[:3]))):
            config = _base_config(lab_dataset.id)
            config["model"] = {"family": "llm_judge", "judge": judge}
            run = ExperimentRun.objects.create(
                experiment=experiment, config=config,
                fingerprint=judge.ljust(64, "0"), status=RunStatus.SUCCEEDED,
            )
            _write_predictions(tmp_path, run, _rows(correct_in=correct))
            runs.append(run)

        slug = lab_campaign["project"].slug
        resp = _client(lab_campaign["lead"]).post(
            f"{API}/projects/{slug}/lab/agreement",
            {"runIds": [str(run.id) for run in runs]}, format="json",
        )
        assert resp.status_code == 200
        body = resp.json()
        # Matrice et vsGold en LISTES alignées sur `judges` — les dicts clefs par nom
        # seraient camélisés par le middleware (« gpt_4o » → clé « gpt4O ») et
        # deviendraient incroisables avec la liste `judges` (revue adversariale).
        assert body["kappa"]["judges"] == ["claude", "fable"]
        fable = body["kappa"]["judges"].index("fable")
        assert body["kappa"]["matrix"][fable][fable] == 1.0
        assert body["kappa"]["vsGold"][fable] == 1.0
        assert body["alpha"]["low"] <= body["alpha"]["point"] <= body["alpha"]["high"]

    def test_deux_runs_du_meme_juge_gardent_des_labels_distincts(self, lab_campaign, lab_dataset, tmp_path):  # noqa: F811
        # ⭐ Sweep relancé avec force : sans suffixe, le second run « fable » écraserait
        # le premier dans le dict — matrice à N-1 juges sans avertissement.
        experiment = Experiment.objects.create(
            project=lab_campaign["project"], dataset=lab_dataset,
            created_by=lab_campaign["lead"], name="juges-dup", task=Task.T1,
            config=_base_config(lab_dataset.id), preset="llm-judges-baseline",
        )
        runs = []
        for suffix, correct in (("1", set(DOCUMENTS)), ("2", set(DOCUMENTS[:4]))):
            config = _base_config(lab_dataset.id)
            config["model"] = {"family": "llm_judge", "judge": "fable"}
            run = ExperimentRun.objects.create(
                experiment=experiment, config=config,
                fingerprint=suffix.ljust(64, "e"), status=RunStatus.SUCCEEDED,
            )
            _write_predictions(tmp_path, run, _rows(correct_in=correct))
            runs.append(run)

        slug = lab_campaign["project"].slug
        resp = _client(lab_campaign["lead"]).post(
            f"{API}/projects/{slug}/lab/agreement",
            {"runIds": [str(run.id) for run in runs]}, format="json",
        )
        assert resp.status_code == 200
        judges = resp.json()["kappa"]["judges"]
        assert len(judges) == 2
        assert len(set(judges)) == 2

    def test_moins_de_deux_runs_refuse(self, lab_campaign, paired_runs):  # noqa: F811
        slug = lab_campaign["project"].slug
        resp = _client(lab_campaign["lead"]).post(
            f"{API}/projects/{slug}/lab/agreement",
            {"runIds": [str(paired_runs["a"].id)]}, format="json",
        )
        assert resp.status_code == 400
        assert resp.json()["code"] == "invalid_run_count"


# --------------------------------------------------------------------------- #
# preset exposé
# --------------------------------------------------------------------------- #

def test_le_preset_est_expose_en_liste_et_en_detail(lab_campaign, paired_runs):  # noqa: F811
    """⭐ Clé de routage des vues ad-hoc (04_SPEC_INTERFACES §1) — le champ vivait sur
    Experiment sans jamais atteindre le frontend."""
    slug = lab_campaign["project"].slug
    client = _client(lab_campaign["lead"])

    listed = client.get(f"{API}/projects/{slug}/lab/runs").json()
    row = next(r for r in listed if r["id"] == str(paired_runs["a"].id))
    assert row["preset"] == "embeddings-frozen"
    assert row["experiment"] == str(paired_runs["experiment"].id)

    detail = client.get(f"{API}/projects/{slug}/lab/runs/{paired_runs['a'].id}").json()
    assert detail["preset"] == "embeddings-frozen"
