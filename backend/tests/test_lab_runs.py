"""Orchestration des runs — états, déduplication, ingestion, comparaison.

Test d'intégration réel : on construit un dataset depuis la base, on lance un run avec
le backend local (qui exécute vraiment `python -m pactiva_lab`), et on vérifie que le
résultat est ingéré. C'est le seul moyen de garantir que le contrat de fichiers entre
Django et le package tient.
"""

import json
from pathlib import Path

import pytest
from django.utils import timezone

from claire.lab.contracts import (
    ConfigValidationError,
    ResultValidationError,
    expand_sweep,
    validate_config,
    validate_results,
)
from claire.lab.models import (
    Experiment,
    ExperimentRun,
    LabDataset,
    RunStatus,
    Task,
)
from claire.lab.services import (
    DuplicateRun,
    claim_next_run,
    comparable,
    fail_run,
    ingest_results,
    queue_run,
    run_fingerprint,
)


# --------------------------------------------------------------------------- #
# Validation de configuration
# --------------------------------------------------------------------------- #

def base_config(**overrides):
    config = {
        "version": 1,
        "task": "T1_primary",
        "seed": 42,
        "preprocess": {"detokenize": "regex_rules"},
        "model": {"family": "tfidf_linear"},
        "evaluation": {"split": {"scheme": "group_kfold_document", "k": 5}},
    }
    config.update(overrides)
    return config


def test_config_valide_passe():
    assert validate_config(base_config())["task"] == "T1_primary"


def test_config_refuse_un_decoupage_par_phrase():
    """⭐ Le refus est dans le CODE, pas dans une revue : un découpage par phrase ferait
    fuir des phrases du même contrat entre entraînement et test."""
    config = base_config()
    config["evaluation"]["split"]["scheme"] = "random_sentence"
    with pytest.raises(ConfigValidationError) as exc:
        validate_config(config)
    assert "fuite" in str(exc.value)
    assert exc.value.path == "/evaluation/split/scheme"


def test_config_refuse_un_bootstrap_par_phrase():
    config = base_config()
    config["evaluation"]["bootstrap"] = {"enabled": True, "unit": "sentence"}
    with pytest.raises(ConfigValidationError) as exc:
        validate_config(config)
    assert "non-indépendance" in str(exc.value)


def test_config_signale_le_chemin_du_champ_fautif():
    """L'éditeur de configuration s'en sert pour pointer la ligne."""
    config = base_config(model={"family": "embeddings_head"})
    with pytest.raises(ConfigValidationError) as exc:
        validate_config(config)
    assert exc.value.path == "/model/encoder"


def test_config_refuse_une_famille_inconnue():
    with pytest.raises(ConfigValidationError):
        validate_config(base_config(model={"family": "magie"}))


def test_sweep_developpe_le_produit_cartesien():
    config = base_config(sweep={
        "axes": {"/preprocess/detokenize": ["none", "regex_rules"],
                 "/model/ngram_max": [1, 2]},
    })
    variants = expand_sweep(config)
    assert len(variants) == 4
    assert {v["preprocess"]["detokenize"] for v in variants} == {"none", "regex_rules"}
    # Le sweep est retiré des variantes : sinon chacune se redévelopperait à l'infini.
    assert all("sweep" not in v for v in variants)


def test_sweep_refuse_au_dela_du_plafond_avec_le_decompte():
    """⭐ Lancer 400 runs par inadvertance est un accident coûteux."""
    config = base_config(sweep={
        "axes": {"/model/ngram_max": [1, 2, 3], "/preprocess/case": ["keep", "lower"]},
        "max_runs": 4,
    })
    with pytest.raises(ConfigValidationError) as exc:
        expand_sweep(config)
    assert "6 runs" in str(exc.value)


# --------------------------------------------------------------------------- #
# Validation des résultats
# --------------------------------------------------------------------------- #

def test_results_valides():
    payload = {"task": "T1_primary", "metrics": {"macro_f1": 0.6}, "environment": {}}
    assert validate_results(payload)["task"] == "T1_primary"


def test_results_sans_metriques_refuse():
    with pytest.raises(ResultValidationError):
        validate_results({"task": "T1_primary", "metrics": {}, "environment": {}})


def test_results_avec_tache_inconnue_refuse():
    with pytest.raises(ResultValidationError):
        validate_results({"task": "T9", "metrics": {"a": 1}, "environment": {}})


# --------------------------------------------------------------------------- #
# Intégration : dataset → run → ingestion
# --------------------------------------------------------------------------- #

@pytest.fixture
def lab_project(db, django_user_model, tmp_path, settings):
    """Projet minimal avec deux annotateurs sur cinq documents."""
    from claire.annotations.models import Annotation, Clause, ClauseTheme
    from claire.corpora.models import Corpus, Document, Sentence
    from claire.projects.models import Project
    from claire.schemes.models import LabelScheme, Theme

    settings.LAB_DIR = str(tmp_path / "lab")

    scheme = LabelScheme.objects.create(slug="s", name="S", version="1")
    themes = {
        code: Theme.objects.create(scheme=scheme, code=code, label=code, order=i)
        for i, code in enumerate(["PREAMBLE_SCOPE", "TERMINATION", "FEES_PAYMENT"])
    }
    corpus = Corpus.objects.create(slug="c", name="C")
    project = Project.objects.create(
        slug="p", name="P", corpus=corpus, scheme=scheme
    )
    users = [
        django_user_model.objects.create_user(
            username=f"ann{i}", password="x", email=f"ann{i}@x.test"
        )
        for i in range(2)
    ]

    codes = list(themes)
    for d in range(5):
        document = Document.objects.create(
            corpus=corpus, external_id=f"doc{d}", title=f"Doc {d}", n_sentences=12
        )
        sentences = [
            Sentence.objects.create(document=document, index=i, raw_text=f"clause {i} text .")
            for i in range(12)
        ]
        for user in users:
            annotation = Annotation.objects.create(
                project=project, document=document, annotator=user, status="submitted"
            )
            for i, sentence in enumerate(sentences):
                theme = themes[codes[i % len(codes)]]
                clause = Clause.objects.create(
                    annotation=annotation, anchor_sentence=sentence,
                    theme=theme, order=i, validated=True,
                )
                ClauseTheme.objects.create(clause=clause, theme=theme, role="primary")
    return project, users[0]


def test_construction_puis_run_puis_ingestion(lab_project, settings):
    """⭐ Le test d'intégration qui prouve que le contrat de fichiers tient."""
    from claire.lab.services import build_dataset
    from claire.lab.worker import run_once

    project, user = lab_project
    settings.LAB_RESEARCH_DIR = str(
        Path(settings.BASE_DIR).parent / "research"
    )

    dataset = build_dataset(project=project, user=user, maturity="complete", k=5)
    assert dataset.n_documents == 5
    assert dataset.n_sentences == 60
    assert Path(dataset.storage_path, "sentences.jsonl").exists()
    assert Path(dataset.storage_path, "README.md").exists()

    experiment = Experiment.objects.create(
        project=project, dataset=dataset, created_by=user,
        name="baseline", task=Task.T1, config=base_config(),
    )
    run = queue_run(experiment=experiment)
    assert run.status == RunStatus.QUEUED

    assert run_once() is True
    run.refresh_from_db()
    assert run.status == RunStatus.SUCCEEDED, run.error_detail
    assert run.metrics["metrics"]["macro_f1"] is not None
    assert run.metrics["human_ceiling"]["value"] is not None


def test_dataset_immuable_apres_creation(lab_project):
    from django.core.exceptions import ValidationError

    from claire.lab.services import build_dataset

    project, user = lab_project
    dataset = build_dataset(project=project, user=user, maturity="complete", k=5)
    dataset.label = "modifié"
    with pytest.raises(ValidationError):
        dataset.save()


def test_meme_criteres_meme_empreinte(lab_project):
    """Deux constructions identiques doivent partager l'empreinte : c'est ce qui rend
    un `dataset_id` citable dans l'article."""
    from claire.lab.builder import build_dataset_files

    project, _ = lab_project
    a = build_dataset_files(project, maturity="complete", k=5)["manifest"]["fingerprint"]
    b = build_dataset_files(project, maturity="complete", k=5)["manifest"]["fingerprint"]
    assert a == b


def test_dataset_duplique_refuse(lab_project):
    from claire.lab.services import DuplicateDataset, build_dataset

    project, user = lab_project
    build_dataset(project=project, user=user, maturity="complete", k=5)
    with pytest.raises(DuplicateDataset):
        build_dataset(project=project, user=user, maturity="complete", k=5)


def test_dataset_trop_petit_refuse(lab_project):
    from claire.lab.services import build_dataset

    project, user = lab_project
    with pytest.raises(ValueError, match="dataset_too_small"):
        build_dataset(project=project, user=user, maturity="complete", k=10)


# --------------------------------------------------------------------------- #
# Déduplication, zombies, comparaison
# --------------------------------------------------------------------------- #

@pytest.fixture
def experiment(lab_project):
    from claire.lab.services import build_dataset

    project, user = lab_project
    dataset = build_dataset(project=project, user=user, maturity="complete", k=5)
    return Experiment.objects.create(
        project=project, dataset=dataset, created_by=user,
        name="exp", task=Task.T1, config=base_config(),
    )


def test_run_duplique_refuse(experiment):
    """⭐ Sur des heures de GPU, la déduplication n'est pas un confort."""
    queue_run(experiment=experiment)
    with pytest.raises(DuplicateRun):
        queue_run(experiment=experiment)


def test_force_outrepasse_la_deduplication(experiment):
    queue_run(experiment=experiment)
    run = queue_run(experiment=experiment, force=True)
    assert run.id is not None


def test_empreinte_change_avec_la_configuration(experiment):
    a = run_fingerprint(experiment.dataset, base_config())
    b = run_fingerprint(experiment.dataset, base_config(seed=7))
    assert a != b


def test_run_zombie_est_repris(experiment):
    """Un worker tué laisserait sinon le run bloqué pour toujours."""
    from datetime import timedelta

    run = queue_run(experiment=experiment)
    run.status = RunStatus.RUNNING
    run.heartbeat_at = timezone.now() - timedelta(hours=2)
    run.attempt = 1
    run.save()

    claimed = claim_next_run()
    assert claimed is not None
    assert claimed.id == run.id
    assert claimed.attempt == 2


def test_run_zombie_abandonne_apres_trois_tentatives(experiment):
    from datetime import timedelta

    run = queue_run(experiment=experiment)
    run.status = RunStatus.RUNNING
    run.heartbeat_at = timezone.now() - timedelta(hours=2)
    run.attempt = 3
    run.save()

    claim_next_run()
    run.refresh_from_db()
    assert run.status == RunStatus.FAILED
    assert run.error_code == "heartbeat_lost"


def test_ingestion_refuse_un_resultat_invalide(experiment, tmp_path):
    """⭐ TOUT OU RIEN : un résultat mal formé qui entrerait à moitié finirait dans un
    tableau de l'article sans que personne ne s'en aperçoive."""
    run = queue_run(experiment=experiment)
    out = tmp_path / "out"
    out.mkdir()
    (out / "results.json").write_text(json.dumps({"task": "T1_primary"}))

    ingest_results(run, out)
    run.refresh_from_db()
    assert run.status == RunStatus.FAILED
    assert run.error_code == "result_schema_invalid"
    assert run.metrics == {}


def test_ingestion_partielle_marquee_partial(experiment, tmp_path):
    """Un job tué par le walltime n'est PAS un échec : le travail fait est conservé."""
    run = queue_run(experiment=experiment)
    out = tmp_path / "out"
    out.mkdir()
    (out / "results.json").write_text(
        json.dumps({"task": "T1_primary", "metrics": {"macro_f1": 0.5}, "environment": {}})
    )

    ingest_results(run, out, partial=True)
    run.refresh_from_db()
    assert run.status == RunStatus.PARTIAL
    assert run.metrics["metrics"]["macro_f1"] == 0.5


def test_comparaison_refuse_des_plis_differents(lab_project):
    """⭐ Comparer deux modèles sur des découpages différents produit un écart qui ne
    veut rien dire."""
    from claire.lab.services import build_dataset

    project, user = lab_project
    a = build_dataset(project=project, user=user, maturity="complete", k=5, seed=1)
    b = build_dataset(project=project, user=user, maturity="complete", k=5, seed=999)

    runs = []
    for dataset in (a, b):
        exp = Experiment.objects.create(
            project=project, dataset=dataset, created_by=user,
            name=f"e{dataset.id}", task=Task.T1, config=base_config(),
        )
        runs.append(queue_run(experiment=exp))

    ok, reason = comparable(runs)
    assert ok is False
    assert "plis" in reason


def test_comparaison_refuse_des_taches_differentes(experiment, lab_project):
    project, user = lab_project
    other = Experiment.objects.create(
        project=project, dataset=experiment.dataset, created_by=user,
        name="t2", task=Task.T2, config=base_config(task="T2_multilabel"),
    )
    runs = [queue_run(experiment=experiment), queue_run(experiment=other)]
    ok, reason = comparable(runs)
    assert ok is False
    assert "tâches" in reason


def test_fail_run_persiste_le_code(experiment):
    run = queue_run(experiment=experiment)
    fail_run(run, "g5k_unreachable", "API injoignable")
    run.refresh_from_db()
    assert run.status == RunStatus.FAILED
    assert run.error_code == "g5k_unreachable"
