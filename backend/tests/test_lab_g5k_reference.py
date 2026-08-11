"""`g5k_reference.gpu_clusters_for` — dont un test sur des données Grid'5000 RÉELLES
(pas une fixture inventée), récupérées en direct depuis le miroir public du
reference-repository pendant la recherche documentaire du 11 août 2026 (aucune
authentification requise pour ce miroir — voir `docs/pactiva-g5k/research/03_API_REST.md`
§0)."""

import json
from pathlib import Path

import pytest

from claire.lab.g5k_reference import gpu_clusters_for, load_static_catalogue

REPO_ROOT = Path(__file__).resolve().parents[2]
REAL_FIXTURE = REPO_ROOT / "docs" / "pactiva-g5k" / "specs" / "g5k-clusters-gpu-sample.json"
REAL_CATALOGUE = REPO_ROOT / "docs" / "pactiva-g5k" / "specs" / "g5k-gpu-clusters-catalogue.json"


def _synthetic_nodes():
    return {
        "big-1": {
            "site": "s1", "cluster": "big",
            "node": {"gpu_devices": {"g0": {"model": "Big40", "memory": 40 * 1024**3}}},
        },
        "small-1": {
            "site": "s2", "cluster": "small",
            "node": {"gpu_devices": {"g0": {"model": "Small8", "memory": 8 * 1024**3}}},
        },
        "cpu-only-1": {
            "site": "s3", "cluster": "cpu_only",
            "node": {"architecture": {"nb_cores": 32}},  # pas de gpu_devices
        },
    }


def test_filtre_par_vram_minimale():
    result = gpu_clusters_for(16, _synthetic_nodes())
    assert {r["cluster"] for r in result} == {"big"}


def test_exclut_les_noeuds_sans_gpu():
    result = gpu_clusters_for(0.1, _synthetic_nodes())
    assert "cpu_only" not in {r["cluster"] for r in result}


def test_trie_par_vram_croissante():
    """⭐ Le plus petit cluster qui convient en premier : ne pas monopoliser
    inutilement une ressource contendue pour un modèle qui n'en a pas besoin."""
    result = gpu_clusters_for(0.1, _synthetic_nodes())
    assert [r["cluster"] for r in result] == ["small", "big"]


def test_aucun_match_renvoie_une_liste_vide():
    assert gpu_clusters_for(1000, _synthetic_nodes()) == []


def test_catalogue_vide():
    assert gpu_clusters_for(8, {}) == []


# --------------------------------------------------------------------------- #
# Données RÉELLES — pas de mock, pas de fixture inventée
# --------------------------------------------------------------------------- #

@pytest.mark.skipif(not REAL_FIXTURE.exists(), reason="fixture réelle absente du dépôt")
def test_sur_donnees_grid5000_reelles():
    data = json.loads(REAL_FIXTURE.read_text(encoding="utf-8"))
    nodes = data["nodes"]

    # 16 Go : exclut Lille chifflot (P100 16 Go tout juste en dessous du seuil ">=",
    # en fait égal — vérifié explicitement ci-dessous) et le nœud sans GPU (Grenoble dahu).
    result = gpu_clusters_for(16, nodes)
    clusters = {r["cluster"] for r in result}
    assert "dahu" not in clusters  # Grenoble, pas de GPU — donnée réelle vérifiée
    assert "gemini" in clusters   # Lyon, 8x V100 32 Go — donnée réelle
    assert "grouille" in clusters  # Nancy, 2x A100 40 Go — donnée réelle
    assert "chifflot" in clusters  # Lille, 2x P100 16 Go — exactement au seuil

    # Le plus petit cluster suffisant est listé en premier.
    assert result[0]["cluster"] == "chifflot"
    assert result[0]["gpuVramGb"] == pytest.approx(16.0, abs=0.1)


@pytest.mark.skipif(not REAL_FIXTURE.exists(), reason="fixture réelle absente du dépôt")
def test_seuil_au_dela_de_toute_vram_reelle_exclut_tout():
    data = json.loads(REAL_FIXTURE.read_text(encoding="utf-8"))
    assert gpu_clusters_for(48, data["nodes"]) == []  # aucun de nos 4 nœuds n'a 48 Go


# --------------------------------------------------------------------------- #
# Catalogue statique — utilisé tant qu'aucun compte Grid'5000 réel n'existe
# --------------------------------------------------------------------------- #

def test_load_static_catalogue_replie_sur_liste_vide_si_fichier_absent(settings, tmp_path):
    settings.LAB_G5K_GPU_CATALOGUE = str(tmp_path / "n-existe-pas.json")
    assert load_static_catalogue() == {}


def test_load_static_catalogue_transforme_au_format_reference_api(settings, tmp_path):
    path = tmp_path / "catalogue.json"
    path.write_text(json.dumps({
        "clusters": [
            {"site": "nancy", "cluster": "grouille", "gpu_model": "A100", "gpu_vram_gb": 40, "gpu_count": 2},
        ]
    }), encoding="utf-8")
    settings.LAB_G5K_GPU_CATALOGUE = str(path)

    nodes = load_static_catalogue()
    assert set(nodes) == {"grouille"}
    assert nodes["grouille"]["site"] == "nancy"
    gpus = nodes["grouille"]["node"]["gpu_devices"]
    assert len(gpus) == 2
    assert all(g["model"] == "A100" and g["memory"] == 40 * 1024**3 for g in gpus.values())

    # Le format produit est directement consommable par gpu_clusters_for — verrouille
    # qu'un seul chemin de calcul sert les deux sources (dynamique et statique).
    assert gpu_clusters_for(40, nodes)[0]["cluster"] == "grouille"


@pytest.mark.skipif(not REAL_CATALOGUE.exists(), reason="catalogue réel absent du dépôt")
def test_catalogue_reel_du_depot_est_bien_forme(settings):
    settings.LAB_G5K_GPU_CATALOGUE = str(REAL_CATALOGUE)
    nodes = load_static_catalogue()
    assert "gemini" in nodes  # cluster vérifié empiriquement dans la recherche
    result = gpu_clusters_for(16, nodes)
    assert any(r["cluster"] == "gemini" for r in result)
