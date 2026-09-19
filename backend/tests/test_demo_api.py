"""API publique de la démonstration (page reviewer) — contrat, pseudonymes, garde-fous, jobs.

Le jeu figé est REMPLACÉ par une fixture minimale (identifiants d'annotateurs fictifs) ; le
sous-processus `pactiva_lab predict` est remplacé par un petit script Python qui écrit un
`out.json` plausible (`DEMO_PREDICT_COMMAND`). Aucun modèle n'est chargé.
"""
import json
import sys
import textwrap
from pathlib import Path

import pytest
from django.core.cache import cache

from claire.demo import runner, services
from claire.demo.models import DemoJob

HOLDOUT_DOC = "Headspace"          # membre de la population hold-out de taxonomies.json
DESIGN_DOC = "Airbnb"              # membre de la population de conception
FAKE_ANNOTATORS = ["zoe.test", "anna.test", "mila.test"]   # ordre alphabétique → anna=A1, mila=A2, zoe=A3

SENTENCES = [
    ("Welcome to the service and thank you for reading these terms.", "PREAMBLE_SCOPE"),
    ("We may terminate your account at any time without notice.", "TERMINATION"),
    ("All fees are due within thirty days and are not refundable.", "FEES_PAYMENT"),
    ("These terms are governed by the laws of the State of Delaware.", "GOVERNING_LAW"),
]


@pytest.fixture
def demo_env(tmp_path, settings):
    dataset = tmp_path / "dataset"
    dataset.mkdir()
    sentences, votes, gold, judges, reference = [], [], [], [], []
    for doc in (HOLDOUT_DOC, DESIGN_DOC):
        for i, (text, theme) in enumerate(SENTENCES):
            sentences.append({"document": doc, "index": i, "text": text.lower(), "text_detok": text,
                              "primary": theme, "themes": [theme], "unfair": ["TER"] if theme == "TERMINATION" else []})
            for a in FAKE_ANNOTATORS:
                votes.append({"document": doc, "index": i, "annotator": a,
                              "primary": theme if a != "zoe.test" or i != 1 else "ACCEPTABLE_USE", "secondaries": []})
            gold.append({"document": doc, "index": i, "agreement_class": "majority" if i == 1 else "strict",
                         "auto_level": "auto", "decided_primary": theme, "decided_secondaries": [],
                         "tally": {theme: 3.0}, "confidence": 1.0})
            for j in ("claude", "codex", "mistral", "fable"):
                judges.append({"document": doc, "index": i, "judge": j,
                               "theme": theme if j != "codex" else "MISC_BOILERPLATE"})
            if theme == "TERMINATION":
                reference.append({"document": doc, "index": i, "category": "TER", "level": 2})
    for name, rows in (("sentences", sentences), ("votes", votes), ("gold", gold), ("judges", judges), ("reference", reference)):
        (dataset / f"{name}.jsonl").write_text("".join(json.dumps(r) + "\n" for r in rows))

    fake_predict = tmp_path / "fake_predict.py"
    fake_predict.write_text(textwrap.dedent("""
        import json, sys
        model, inp, out = sys.argv[1], sys.argv[2], sys.argv[3]
        payload = json.load(open(inp))
        sents = payload.get("sentences") or [s.strip() for s in payload.get("text", "").split(".") if s.strip()]
        themes = ["FRAMEWORK", "TERMINATION", "FEES_PAYMENT", "DISPUTES_LAW"]
        rows = [{"index": i, "text": s, "label": themes[i % 4], "confidence": 0.9, "scores": {themes[i % 4]: 0.9}}
                for i, s in enumerate(sents)]
        json.dump({"document": payload.get("document"), "n_sentences": len(rows), "classes": themes,
                   "sentences": rows, "timing_s": 0.01, "segmenter": "provided" if payload.get("sentences") else "pysbd",
                   "model": {"checkpoint": "fake"}}, open(out, "w"))
    """))
    release = tmp_path / "RELEASE.json"
    release.write_text(json.dumps({"datasetFingerprint": "abc123", "version": 1, "counts": {"documents": 50},
                                   "downloads": [], "figures": [{"key": "alpha_masi", "t20": 0.658}], "model": None}))
    settings.DEMO_DATASET_DIR = str(dataset)
    settings.DEMO_RELEASE_PATH = str(release)
    settings.DEMO_JOBS_DIR = str(tmp_path / "jobs")
    settings.DEMO_MODEL_DIR = str(tmp_path / "no-model")
    settings.DEMO_PREDICT_COMMAND = [sys.executable, str(fake_predict), "{model}", "{input}", "{out}"]
    settings.DEMO_RUN_INLINE = True
    settings.DEMO_ACCESS_CODE = ""
    settings.DEMO_MAX_CHARS = 60000
    services.reset_caches()
    cache.clear()
    yield tmp_path
    services.reset_caches()
    cache.clear()


@pytest.fixture
def anon(api_client):
    api_client.force_authenticate(user=None)
    return api_client


# --------------------------------------------------------------------------- #
# Manifeste et contrats
# --------------------------------------------------------------------------- #

@pytest.mark.django_db
def test_manifest_is_public_and_carries_release(anon, demo_env):
    r = anon.get("/api/v1/public/demo/manifest")
    assert r.status_code == 200
    body = r.json()
    assert body["datasetFingerprint"] == "abc123"
    assert body["figures"][0]["key"] == "alpha_masi"
    assert body["limits"]["maxChars"] == 60000
    assert body["accessCodeRequired"] is False
    assert HOLDOUT_DOC in body["holdoutDocuments"]
    assert "zoe.test" not in json.dumps(body)


@pytest.mark.django_db
def test_contracts_are_holdout_only(anon, demo_env):
    r = anon.get("/api/v1/public/demo/contracts")
    assert r.status_code == 200
    docs = [c["document"] for c in r.json()["contracts"]]
    assert docs == [HOLDOUT_DOC]                      # Airbnb (conception) n'apparaît pas
    assert r.json()["contracts"][0]["nSentences"] == 4
    assert anon.get(f"/api/v1/public/demo/contracts/{DESIGN_DOC}").status_code == 404


@pytest.mark.django_db
def test_contract_detail_pseudonymises_annotators(anon, demo_env):
    r = anon.get(f"/api/v1/public/demo/contracts/{HOLDOUT_DOC}")
    assert r.status_code == 200
    body = r.json()
    raw = json.dumps(body)
    for real in FAKE_ANNOTATORS:
        assert real not in raw
    s1 = body["sentences"][1]
    assert [v["annotator"] for v in s1["votes"]] == ["A1", "A2", "A3"]
    assert s1["votes"][2]["primary"] == "ACCEPTABLE_USE"        # zoe = A3 (ordre alphabétique)
    assert s1["gold"]["primary"] == "TERMINATION" and s1["gold"]["primaryT11"] == "TERMINATION"
    assert body["sentences"][3]["gold"]["primaryT11"] == "DISPUTES_LAW"   # projection T20 → T11
    assert s1["judges"]["codex"] == "MISC_BOILERPLATE"
    assert s1["unfair"] == ["TER"]
    assert s1["text"].startswith("We may terminate")


# --------------------------------------------------------------------------- #
# Garde-fous de classify
# --------------------------------------------------------------------------- #

@pytest.mark.django_db
@pytest.mark.parametrize("payload,code", [
    ({"source": "text", "text": ""}, "empty"),
    ({"source": "text", "text": "x" * 60001}, "too_long"),
    ({"source": "text", "text": "Ceci est un contrat rédigé entièrement en français, sans aucun mot anglais dedans, pour vérifier la détection."}, "not_english"),
    ({"source": "contract", "document": DESIGN_DOC}, "unknown_document"),
    ({"source": "pdf"}, "bad_source"),
])
def test_classify_rejects_bad_input(anon, demo_env, payload, code):
    r = anon.post("/api/v1/public/demo/classify", payload, format="json")
    assert r.status_code == 400
    assert r.json()["code"] == code
    assert DemoJob.objects.count() == 0


@pytest.mark.django_db
def test_classify_requires_access_code_when_configured(anon, demo_env, settings):
    settings.DEMO_ACCESS_CODE = "reviewer-2026"
    body = {"source": "contract", "document": HOLDOUT_DOC}
    assert anon.post("/api/v1/public/demo/classify", body, format="json").status_code == 403
    r = anon.post("/api/v1/public/demo/classify", body, format="json", HTTP_X_DEMO_CODE="reviewer-2026")
    assert r.status_code == 202


@pytest.mark.django_db
def test_classify_reports_queue_full(anon, demo_env, monkeypatch):
    monkeypatch.setattr(runner, "queue_full", lambda: True)
    r = anon.post("/api/v1/public/demo/classify", {"source": "contract", "document": HOLDOUT_DOC}, format="json")
    assert r.status_code == 503 and r.json()["code"] == "queue_full"


@pytest.mark.django_db
def test_classify_is_throttled_per_client(anon, demo_env, monkeypatch):
    from rest_framework.throttling import SimpleRateThrottle
    rates = {**SimpleRateThrottle.THROTTLE_RATES, "demo": "100/hour", "demo_burst": "2/min"}
    monkeypatch.setattr(SimpleRateThrottle, "THROTTLE_RATES", rates)
    body = {"source": "contract", "document": HOLDOUT_DOC}
    assert anon.post("/api/v1/public/demo/classify", body, format="json").status_code == 202
    assert anon.post("/api/v1/public/demo/classify", body, format="json").status_code == 202
    assert anon.post("/api/v1/public/demo/classify", body, format="json").status_code == 429
    # les lectures restent servies (scope `demo` distinct, 100/hour ici)
    assert anon.get("/api/v1/public/demo/contracts").status_code == 200


# --------------------------------------------------------------------------- #
# Cycle de vie du job
# --------------------------------------------------------------------------- #

@pytest.mark.django_db
def test_text_job_runs_and_never_keeps_the_text(anon, demo_env, caplog):
    text = ("We may terminate your account at any time without notice. All fees are due within thirty days. "
            "These terms are governed by the laws of the State of Delaware.")
    r = anon.post("/api/v1/public/demo/classify", {"source": "text", "text": text, "title": "My ToS"}, format="json")
    assert r.status_code == 202
    job_id = r.json()["jobId"]
    job = DemoJob.objects.get(pk=job_id)
    assert job.status == "done" and job.n_sentences == 3 and job.n_chars == len(text)
    assert not (Path(demo_env / "jobs") / job_id).exists()          # in.json supprimé
    assert "terminate your account" not in caplog.text
    r = anon.get(f"/api/v1/public/demo/jobs/{job_id}")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "done" and body["source"] == "text" and body["title"] == "My ToS"
    assert [s["label"] for s in body["result"]["sentences"]] == ["FRAMEWORK", "TERMINATION", "FEES_PAYMENT"]
    assert body["result"]["segmenter"] == "pysbd"
    assert "comparison" not in body["result"]
    assert body["timings"]["runS"] is not None


@pytest.mark.django_db
def test_contract_job_returns_comparison_with_kappa(anon, demo_env):
    r = anon.post("/api/v1/public/demo/classify", {"source": "contract", "document": HOLDOUT_DOC}, format="json")
    assert r.status_code == 202
    body = anon.get(f"/api/v1/public/demo/jobs/{r.json()['jobId']}").json()
    assert body["status"] == "done" and body["document"] == HOLDOUT_DOC
    comp = body["result"]["comparison"]
    # le faux predict recopie exactement le gold projeté en T11 → accord parfait
    assert comp["summary"]["nSentences"] == 4
    assert comp["summary"]["accuracyT11"] == 1.0 and comp["summary"]["kappaT11"] == 1.0
    # codex répond MISC_BOILERPLATE partout : en T11 cela devient FRAMEWORK, juste pour la phrase 0 seulement
    assert comp["summary"]["judgesAccuracyT11"]["codex"] == 0.25
    assert comp["summary"]["judgesAccuracyT11"]["fable"] == 1.0
    assert comp["gold"][3]["primaryT11"] == "DISPUTES_LAW"
    assert set(comp["votes"][0]) == {"index", "A1", "A2", "A3"}
    assert "zoe.test" not in json.dumps(body)


@pytest.mark.django_db
def test_failed_subprocess_gives_failed_job_without_trace(anon, demo_env, settings):
    settings.DEMO_PREDICT_COMMAND = [sys.executable, "-c", "import sys; sys.exit(3)"]
    r = anon.post("/api/v1/public/demo/classify", {"source": "contract", "document": HOLDOUT_DOC}, format="json")
    body = anon.get(f"/api/v1/public/demo/jobs/{r.json()['jobId']}").json()
    assert body["status"] == "failed"
    assert body["error"]["code"] == "internal" and body["result"] is None


@pytest.mark.django_db
def test_model_unavailable_is_reported(anon, demo_env, settings):
    settings.DEMO_PREDICT_COMMAND = None
    r = anon.post("/api/v1/public/demo/classify", {"source": "contract", "document": HOLDOUT_DOC}, format="json")
    body = anon.get(f"/api/v1/public/demo/jobs/{r.json()['jobId']}").json()
    assert body["status"] == "failed" and body["error"]["code"] == "model_unavailable"


@pytest.mark.django_db
def test_unknown_job_is_404(anon, demo_env):
    assert anon.get("/api/v1/public/demo/jobs/00000000-0000-0000-0000-000000000000").status_code == 404


@pytest.mark.django_db
def test_purge_removes_old_jobs(anon, demo_env):
    from datetime import timedelta

    from django.utils import timezone
    anon.post("/api/v1/public/demo/classify", {"source": "contract", "document": HOLDOUT_DOC}, format="json")
    DemoJob.objects.update(created_at=timezone.now() - timedelta(hours=25))
    assert runner.purge_old_jobs() == 1 and DemoJob.objects.count() == 0


def test_cohen_kappa_and_english_share():
    assert services.cohen_kappa(["a", "b", "a"], ["a", "b", "a"]) == 1.0
    assert services.cohen_kappa(["a", "a", "a"], ["a", "a", "a"]) == 1.0
    assert services.cohen_kappa([], []) is None
    assert services.english_share("the terms of the service and your account") > 0.5
    assert services.english_share("bonjour ceci est un texte") < 0.05
