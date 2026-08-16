"""Presets d'expérience — le pont entre `docs/pactiva-lab/specs/pipeline-presets.yaml`
(conçu, jamais câblé avant cet audit UX) et l'écran « Nouvelle expérience »."""

import pytest
from rest_framework.test import APIClient

from claire.lab.presets import load_presets
from claire.projects.models import MembershipRole, ProjectMembership
from tests.conftest import CorpusFactory, ProjectFactory, UserFactory

pytestmark = pytest.mark.django_db
API = "/api/v1"

VALID_YAML = """
presets:
  - id: baseline-fast
    label: "Baselines rapides"
    why: "sans plancher, rien n'est interprétable"
    duration_hint: "~3 min CPU"
    config:
      task: T1_primary
      model: { family: tfidf_linear }
  - id: legal-bert-finetune
    label: "Legal-BERT fine-tuning"
    duration_hint: "~45 min GPU"
    config:
      task: T1_primary
      model: { family: transformer_finetune, checkpoint: nlpaueb/legal-bert-base-uncased }
recommended_order: [baseline-fast, legal-bert-finetune]
"""


def _client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


# --------------------------------------------------------------------------- #
# load_presets — pur, lecture de fichier
# --------------------------------------------------------------------------- #

def test_load_presets_lit_le_fichier_reel_du_depot():
    """Le vrai fichier `docs/pactiva-lab/specs/pipeline-presets.yaml` doit rester
    chargeable : c'est lui que l'écran servira en production, pas une fixture."""
    result = load_presets()
    ids = {p["id"] for p in result["presets"]}
    assert "baseline-fast" in ids
    assert "legal-bert-finetune" in ids
    assert len(result["presets"]) >= 10
    assert "baseline-fast" in result["recommended_order"]


def test_chaque_preset_du_depot_passe_la_validation_de_config():
    """⭐ Chaque preset du fichier réel doit produire une config VALIDE une fois
    complété comme le fait le lanceur (version + seed + dataset) — une faute dans le
    YAML doit casser ICI, pas au premier clic d'un utilisateur. Le sweep éventuel doit
    aussi se développer sous son plafond `max_runs`."""
    from claire.lab.contracts import expand_sweep, validate_config

    result = load_presets()
    assert result["presets"], "le catalogue réel ne doit jamais être vide"
    for preset in result["presets"]:
        config = {"version": 1, "seed": 42, **preset["config"]}
        if preset.get("sweep"):
            config["sweep"] = preset["sweep"]
        validate_config(config)
        variants = expand_sweep(config)
        assert variants, preset["id"]


def test_les_presets_des_papiers_sont_au_catalogue():
    """Les expériences des deux papiers (docs/pactiva-experiences-papiers/02) sont
    servies par l'API — avec leur bloc thématique."""
    result = load_presets()
    by_id = {p["id"]: p for p in result["presets"]}
    for preset_id, theme in [
        ("iaa-mesure", "mesure-accord"),
        ("gold-cascade", "mesure-accord"),
        ("cooccurrence-abusivite", "graphe-anomalies"),
        ("cooccurrence-deontique", "graphe-anomalies"),
        ("cooccurrence-bruit", "graphe-anomalies"),
    ]:
        assert preset_id in by_id, preset_id
        assert by_id[preset_id]["theme"] == theme
    theme_ids = {t["id"] for t in result.get("themes", [])}
    assert {"mesure-accord", "graphe-anomalies"} <= theme_ids


def test_load_presets_replie_sur_liste_vide_si_fichier_absent(settings, tmp_path):
    settings.LAB_PRESETS_FILE = str(tmp_path / "n-existe-pas.yaml")
    result = load_presets()
    assert result == {"presets": [], "recommended_order": []}


def test_load_presets_lit_un_fichier_configure(settings, tmp_path):
    path = tmp_path / "presets.yaml"
    path.write_text(VALID_YAML, encoding="utf-8")
    settings.LAB_PRESETS_FILE = str(path)
    result = load_presets()
    assert [p["id"] for p in result["presets"]] == ["baseline-fast", "legal-bert-finetune"]
    assert result["presets"][0]["config"]["model"]["family"] == "tfidf_linear"


# --------------------------------------------------------------------------- #
# GET /projects/<slug>/lab/presets
# --------------------------------------------------------------------------- #

@pytest.fixture
def project_with_lead(scheme_with_themes):
    project = ProjectFactory(corpus=CorpusFactory(), scheme=scheme_with_themes)
    lead = UserFactory(username="preset_lead", role="annotator")
    annotator = UserFactory(username="preset_ann", role="annotator")
    ProjectMembership.objects.create(project=project, user=lead, role=MembershipRole.LEAD)
    return project, lead, annotator


def test_endpoint_presets_renvoie_le_catalogue_camelise(project_with_lead, settings, tmp_path):
    project, lead, _ = project_with_lead
    path = tmp_path / "presets.yaml"
    path.write_text(VALID_YAML, encoding="utf-8")
    settings.LAB_PRESETS_FILE = str(path)

    resp = _client(lead).get(f"{API}/projects/{project.slug}/lab/presets")
    assert resp.status_code == 200
    body = resp.json()
    assert "recommendedOrder" in body  # camélisation de recommended_order
    assert body["presets"][1]["config"]["model"]["checkpoint"] == "nlpaueb/legal-bert-base-uncased"


def test_endpoint_presets_refuse_un_annotateur_simple(project_with_lead):
    project, _, annotator = project_with_lead
    resp = _client(annotator).get(f"{API}/projects/{project.slug}/lab/presets")
    assert resp.status_code == 403
