"""Tâches des papiers (M1/M2/G2) côté plateforme — export du dataset, contrats, vues,
et intégration réelle par le worker (le sous-processus `python -m pactiva_lab` tourne
vraiment : c'est le seul moyen de garantir que le contrat de fichiers tient).

Réf. : docs/pactiva-experiences-papiers/03_PLAN_TECHNIQUE.md (L1, L6, L9).
"""

import json
from pathlib import Path

import pytest
from rest_framework.test import APIClient

from claire.lab.contracts import ConfigValidationError, validate_config
from claire.lab.models import Experiment, RunStatus, Task
from claire.lab.services import build_dataset, queue_run

API = "/api/v1"


def _client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def measure_project(db, django_user_model, tmp_path, settings):
    """Deux annotateurs sur cinq documents, avec un désaccord DÉTERMINISTE (ann1 dévie
    une phrase sur 4), des labels CLAUDETTE sur les phrases TERMINATION (matière de
    G2), un juge de pré-annotation (matière de la matrice M1) et une résolution gold
    partielle (matière de M2)."""
    from claire.annotations.models import Annotation, Clause, ClauseTheme
    from claire.corpora.models import Corpus, Document, ReferenceLabel, Sentence
    from claire.gold.models import GoldResolution, GoldSentence
    from claire.imports.models import PreAnnotation, PreClause
    from claire.projects.models import Project
    from claire.schemes.models import LabelScheme, Theme

    settings.LAB_DIR = str(tmp_path / "lab")

    scheme = LabelScheme.objects.create(slug="sm", name="SM", version="1")
    codes = ["PREAMBLE_SCOPE", "TERMINATION", "FEES_PAYMENT", "LICENSE_IP"]
    themes = {
        code: Theme.objects.create(scheme=scheme, code=code, label=code, order=i)
        for i, code in enumerate(codes)
    }
    corpus = Corpus.objects.create(slug="cm", name="CM")
    project = Project.objects.create(slug="pm", name="PM", corpus=corpus, scheme=scheme)
    users = [
        django_user_model.objects.create_user(
            username=f"mann{i}", password="x", email=f"mann{i}@x.test"
        )
        for i in range(2)
    ]

    documents = []
    for d in range(5):
        document = Document.objects.create(
            corpus=corpus, external_id=f"mdoc{d}", title=f"MDoc {d}", n_sentences=12
        )
        documents.append(document)
        sentences = [
            Sentence.objects.create(
                document=document, index=i,
                raw_text=f"the provider may terminate clause {i} .",
            )
            for i in range(12)
        ]
        for i, sentence in enumerate(sentences):
            if codes[i % len(codes)] == "TERMINATION":
                ReferenceLabel.objects.create(sentence=sentence, category="TER", level=1)
        for u, user in enumerate(users):
            annotation = Annotation.objects.create(
                project=project, document=document, annotator=user, status="submitted"
            )
            for i, sentence in enumerate(sentences):
                code = codes[i % len(codes)]
                if u == 1 and i % 4 == 0:
                    code = "PREAMBLE_SCOPE"
                theme = themes[code]
                clause = Clause.objects.create(
                    annotation=annotation, anchor_sentence=sentence,
                    theme=theme, order=i, validated=True,
                )
                ClauseTheme.objects.create(clause=clause, theme=theme, role="primary")
                if i % 5 == 0 and code != "LICENSE_IP":
                    ClauseTheme.objects.create(
                        clause=clause, theme=themes["LICENSE_IP"], role="secondary"
                    )
        pre = PreAnnotation.objects.create(
            project=project, document=document, judge="claude",
            schema_version="v9.2", raw={},
        )
        for i, sentence in enumerate(sentences):
            PreClause.objects.create(
                preannotation=pre, anchor_index=i,
                theme_code=codes[i % len(codes)], order=i,
            )

    resolution = GoldResolution.objects.create(
        project=project, document=documents[0], status="in_progress", pct_resolved=0.5
    )
    for index, (tier, decided) in enumerate(
        [("auto_1click", True), ("auto", True), ("manual", True), ("manual", False)]
    ):
        # La décision manuelle (idx 2) tranche LICENSE_IP alors que la pluralité des
        # votes y est FEES_PAYMENT (codes[2 % 4]) — c'est le cas « l'arbitre a
        # contredit la pluralité » que M2 doit compter.
        decided_theme = themes["LICENSE_IP" if tier == "manual" else "FEES_PAYMENT"]
        GoldSentence.objects.create(
            resolution=resolution, index=index,
            agreement_class={"auto_1click": "strict", "auto": "majority",
                             "manual": "divergence"}[tier],
            risk_band="low", auto_level=tier, confidence=0.8,
            proposed_primary="TERMINATION", decided=decided,
            auto_resolved=tier != "manual",
            primary_theme=decided_theme if decided else None,
            secondaries=[],
        )
    return project, users[0]


# --------------------------------------------------------------------------- #
# L1 — export votes + gold
# --------------------------------------------------------------------------- #

def test_le_dataset_exporte_votes_et_gold(measure_project, tmp_path):
    from claire.lab.builder import build_dataset_files

    project, _ = measure_project
    out = tmp_path / "ds"
    result = build_dataset_files(project, maturity="submitted", k=5, out_dir=out)
    manifest = result["manifest"]

    votes = [json.loads(l) for l in (out / "votes.jsonl").read_text().splitlines()]
    # 2 annotateurs × 5 documents × 12 phrases.
    assert len(votes) == 120
    assert manifest["nVotes"] == 120
    assert {v["annotator"] for v in votes} == {"mann0", "mann1"}
    with_secondary = [v for v in votes if v["secondaries"]]
    assert with_secondary, "les secondaires doivent traverser l'export"

    gold = [json.loads(l) for l in (out / "gold.jsonl").read_text().splitlines()]
    assert len(gold) == 4
    assert manifest["nGoldSentences"] == 4
    assert manifest["nGoldFinalizedDocuments"] == 0
    assert {g["auto_level"] for g in gold} == {"auto_1click", "auto", "manual"}
    decided = [g for g in gold if g["decided"]]
    assert {g["decided_primary"] for g in decided} == {"FEES_PAYMENT", "LICENSE_IP"}


def test_une_decision_gold_change_l_empreinte(measure_project):
    """⭐ L'état gold FAIT PARTIE de l'identité du dataset : une décision d'arbitrage
    prise entre deux constructions doit produire une empreinte différente — sinon la
    déduplication rendrait M2 irrejouable sur l'état réellement mesuré."""
    from claire.gold.models import GoldSentence
    from claire.lab.builder import build_dataset_files
    from claire.schemes.models import Theme

    project, _ = measure_project
    before = build_dataset_files(project, maturity="submitted", k=5)["manifest"][
        "fingerprint"
    ]
    sentence = GoldSentence.objects.get(resolution__project=project, index=3)
    sentence.decided = True
    sentence.primary_theme = Theme.objects.get(scheme=project.scheme, code="TERMINATION")
    sentence.save()
    after = build_dataset_files(project, maturity="submitted", k=5)["manifest"][
        "fingerprint"
    ]
    assert before != after


# --------------------------------------------------------------------------- #
# L6 — contrats
# --------------------------------------------------------------------------- #

def _config(task, family, **model_extra):
    return {
        "version": 1, "task": task, "seed": 42,
        "preprocess": {"detokenize": "none"},
        "model": {"family": family, **model_extra},
        "evaluation": {"split": {"scheme": "group_kfold_document", "k": 5}},
    }


@pytest.mark.parametrize("task,family", [
    ("M1_agreement", "measurement"),
    ("M2_gold_cascade", "measurement"),
    ("G2_cooccurrence", "cooccurrence_anomaly"),
])
def test_les_taches_de_mesure_passent_avec_leur_famille(task, family):
    assert validate_config(_config(task, family))["task"] == task


def test_une_tache_de_mesure_refuse_une_autre_famille():
    """⭐ Le verrou tâche↔famille : une faute coûte une seconde, pas un run."""
    with pytest.raises(ConfigValidationError, match="exige la famille measurement"):
        validate_config(_config("M1_agreement", "tfidf_linear"))


def test_une_famille_de_mesure_est_reservee_a_ses_taches():
    with pytest.raises(ConfigValidationError, match="réservée aux tâches"):
        validate_config(_config("T1_primary", "measurement"))


def test_g2_valide_ses_options():
    with pytest.raises(ConfigValidationError) as exc:
        validate_config(_config("G2_cooccurrence", "cooccurrence_anomaly",
                                unit="paragraph"))
    assert exc.value.path == "/model/unit"
    with pytest.raises(ConfigValidationError) as exc:
        validate_config(_config("G2_cooccurrence", "cooccurrence_anomaly",
                                deontic="llm"))
    assert exc.value.path == "/model/deontic"


# --------------------------------------------------------------------------- #
# L6 — garde à la création d'expérience (vue)
# --------------------------------------------------------------------------- #

def test_m1_refuse_a_la_creation_sur_un_dataset_sans_votes(measure_project):
    """Un dataset construit AVANT l'export des votes (legacy) doit être refusé à la
    création de l'expérience — pas dans le worker deux minutes plus tard."""
    from claire.projects.models import MembershipRole, ProjectMembership

    project, user = measure_project
    ProjectMembership.objects.create(
        project=project, user=user, role=MembershipRole.LEAD
    )
    dataset = build_dataset(project=project, user=user, maturity="submitted", k=5)
    dataset.manifest = {**dataset.manifest, "nVotes": 0}
    dataset.save(update_fields=["manifest"])

    resp = _client(user).post(
        f"{API}/projects/{project.slug}/lab/experiments",
        {
            "name": "m1", "task": "M1_agreement", "dataset": str(dataset.id),
            "config": _config("M1_agreement", "measurement"),
        },
        format="json",
    )
    assert resp.status_code == 400
    assert resp.json()["code"] == "dataset_incompatible"


def test_m1_accepte_sur_un_dataset_avec_votes(measure_project):
    from claire.projects.models import MembershipRole, ProjectMembership

    project, user = measure_project
    ProjectMembership.objects.create(
        project=project, user=user, role=MembershipRole.LEAD
    )
    dataset = build_dataset(project=project, user=user, maturity="submitted", k=5)
    resp = _client(user).post(
        f"{API}/projects/{project.slug}/lab/experiments",
        {
            "name": "m1", "task": "M1_agreement", "dataset": str(dataset.id),
            "config": _config("M1_agreement", "measurement"),
        },
        format="json",
    )
    assert resp.status_code == 201, resp.content


# --------------------------------------------------------------------------- #
# L9 — intégration réelle par le worker (sous-processus)
# --------------------------------------------------------------------------- #

@pytest.fixture
def research_dir(settings):
    settings.LAB_RESEARCH_DIR = str(Path(settings.BASE_DIR).parent / "research")
    return settings.LAB_RESEARCH_DIR


def _run_task(project, user, task, config):
    from claire.lab.worker import run_once

    dataset = build_dataset(project=project, user=user, maturity="submitted", k=5)
    experiment = Experiment.objects.create(
        project=project, dataset=dataset, created_by=user,
        name=f"integration-{task}", task=task, config=config,
    )
    run = queue_run(experiment=experiment)
    assert run_once() is True
    run.refresh_from_db()
    return run


def test_m1_de_bout_en_bout_par_le_worker(measure_project, research_dir):
    """⭐ Le contrat de fichiers M1 tient à travers le sous-processus réel."""
    project, user = measure_project
    config = _config("M1_agreement", "measurement")
    config["evaluation"]["bootstrap"] = {"enabled": True, "n_resamples": 50}
    run = _run_task(project, user, Task.M1, config)
    assert run.status == RunStatus.SUCCEEDED, run.error_detail

    metrics = run.metrics["metrics"]
    assert metrics["alpha_masi"] is not None
    assert 0.0 < metrics["alpha_masi"] <= 1.0
    agreement = run.metrics["agreement"]
    # ann1 dévie une phrase sur 4 → l'accord n'est pas parfait, et la matrice couvre
    # les 2 annotateurs + le juge claude.
    assert agreement["matrix"]["raters"] == ["mann0", "mann1", "claude"]
    assert agreement["matrix"]["kinds"] == ["annotator", "annotator", "judge"]


def test_g2_de_bout_en_bout_par_le_worker(measure_project, research_dir):
    project, user = measure_project
    config = _config("G2_cooccurrence", "cooccurrence_anomaly",
                     unit="segment", deontic="none")
    config["evaluation"]["bootstrap"] = {"enabled": True, "n_resamples": 50}
    run = _run_task(project, user, Task.G2, config)
    assert run.status == RunStatus.SUCCEEDED, run.error_detail

    metrics = run.metrics["metrics"]
    assert metrics["auc_pr_rarity"] is not None
    assert metrics["base_rate"] > 0
    # L'artefact hypergraphe (livrable d'article) est recensé.
    assert run.artifacts.filter(name="hypergraph.json").exists()
    assert run.artifacts.filter(name="segments.jsonl").exists()


def test_m2_de_bout_en_bout_par_le_worker(measure_project, research_dir):
    project, user = measure_project
    config = _config("M2_gold_cascade", "measurement")
    run = _run_task(project, user, Task.M2, config)
    assert run.status == RunStatus.SUCCEEDED, run.error_detail
    metrics = run.metrics["metrics"]
    assert metrics["n_gold_sentences"] == 4
    assert metrics["n_finalized_documents"] == 0
    # L'arbitre (idx 2) a décidé FEES_PAYMENT contre la pluralité TERMINATION.
    assert metrics["manual_changed_by_arbitration"] == 1
