"""`GET /projects/<slug>/lab/g5k/clusters` — panneau « cluster recommandé » de
`ExperimentLauncher.tsx`. Accessible SANS identifiants Grid'5000 configurés (catalogue
statique, informatif) ; `configured` indique séparément si l'utilisateur peut réserver."""

import json

import pytest
from rest_framework.test import APIClient

from claire.lab.crypto import encrypt_secret
from claire.lab.models import ComputeCredential
from claire.projects.models import MembershipRole, ProjectMembership
from tests.conftest import CorpusFactory, ProjectFactory, UserFactory

pytestmark = pytest.mark.django_db
API = "/api/v1"

CATALOGUE = {
    "clusters": [
        {"site": "nancy", "cluster": "grouille", "gpu_model": "A100", "gpu_vram_gb": 40, "gpu_count": 2},
        {"site": "lille", "cluster": "chifflot", "gpu_model": "P100", "gpu_vram_gb": 16, "gpu_count": 2},
    ]
}


def _client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def project_with_lead(scheme_with_themes, settings, tmp_path):
    project = ProjectFactory(corpus=CorpusFactory(), scheme=scheme_with_themes)
    lead = UserFactory(username="g5kclusters_lead", role="annotator")
    ProjectMembership.objects.create(project=project, user=lead, role=MembershipRole.LEAD)

    path = tmp_path / "catalogue.json"
    path.write_text(json.dumps(CATALOGUE), encoding="utf-8")
    settings.LAB_G5K_GPU_CATALOGUE = str(path)
    return project, lead


def test_accessible_sans_identifiants_g5k_configures(project_with_lead):
    project, lead = project_with_lead
    resp = _client(lead).get(f"{API}/projects/{project.slug}/lab/g5k/clusters?minVramGb=8")
    assert resp.status_code == 200
    body = resp.json()
    assert body["configured"] is False
    assert {c["cluster"] for c in body["clusters"]} == {"grouille", "chifflot"}


def test_configured_vrai_quand_un_mot_de_passe_api_existe(project_with_lead, monkeypatch):
    from cryptography.fernet import Fernet

    from claire.lab import crypto

    monkeypatch.setenv(crypto.ENV_KEY, Fernet.generate_key().decode())
    project, lead = project_with_lead
    ComputeCredential.objects.create(
        user=lead, kind="g5k", login="alice", secret_encrypted=encrypt_secret("s3cret")
    )
    resp = _client(lead).get(f"{API}/projects/{project.slug}/lab/g5k/clusters")
    assert resp.json()["configured"] is True


def test_filtre_par_min_vram(project_with_lead):
    project, lead = project_with_lead
    resp = _client(lead).get(f"{API}/projects/{project.slug}/lab/g5k/clusters?minVramGb=32")
    clusters = {c["cluster"] for c in resp.json()["clusters"]}
    assert clusters == {"grouille"}  # 40 Go ≥ 32 ; chifflot (16 Go) exclu


def test_min_vram_par_defaut_est_8(project_with_lead):
    """Legal-BERT-base tient dans 8 Go — c'est le besoin réel documenté
    (docs/pactiva-g5k/06_ANALYSE_BESOIN_PACTIVA.md §1), pas une valeur arbitraire."""
    project, lead = project_with_lead
    resp = _client(lead).get(f"{API}/projects/{project.slug}/lab/g5k/clusters")
    assert {c["cluster"] for c in resp.json()["clusters"]} == {"grouille", "chifflot"}


def test_min_vram_invalide_refuse_400(project_with_lead):
    project, lead = project_with_lead
    resp = _client(lead).get(f"{API}/projects/{project.slug}/lab/g5k/clusters?minVramGb=beaucoup")
    assert resp.status_code == 400


def test_refuse_un_annotateur_simple(scheme_with_themes, settings, tmp_path):
    project = ProjectFactory(corpus=CorpusFactory(), scheme=scheme_with_themes)
    annotator = UserFactory(username="g5kclusters_ann", role="annotator")
    ProjectMembership.objects.create(project=project, user=annotator, role=MembershipRole.ANNOTATOR)
    resp = _client(annotator).get(f"{API}/projects/{project.slug}/lab/g5k/clusters")
    assert resp.status_code == 403


def test_catalogue_absent_renvoie_une_liste_vide_pas_une_erreur(project_with_lead, settings, tmp_path):
    project, lead = project_with_lead
    settings.LAB_G5K_GPU_CATALOGUE = str(tmp_path / "absent.json")
    resp = _client(lead).get(f"{API}/projects/{project.slug}/lab/g5k/clusters")
    assert resp.status_code == 200
    assert resp.json()["clusters"] == []
