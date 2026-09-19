"""Garde-fous du script de publication : pseudonymes stables, aucune fuite, idempotence."""
import importlib.util
import json
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "build_thematic_layer_release.py"
spec = importlib.util.spec_from_file_location("release", SCRIPT)
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


def test_pseudonym_map_est_stable_et_idempotent():
    m = release.pseudonym_map({"zed.user", "alpha.user", "mid.user"})
    assert m == {"alpha.user": "A1", "mid.user": "A2", "zed.user": "A3"}
    again = release.pseudonym_map(set(m.values()))
    assert again == {"A1": "A1", "A2": "A2", "A3": "A3"}
    assert release.real_identifiers(again) == set()


def test_scan_refuse_identifiant_reel_et_champ_text(tmp_path):
    ok = tmp_path / "ok.jsonl"; ok.write_text(json.dumps({"document": "x", "index": 0, "annotator": "A1"}) + "\n")
    leak = tmp_path / "leak.jsonl"; leak.write_text(json.dumps({"annotator": "real.person"}) + "\n")
    text = tmp_path / "text.jsonl"; text.write_text(json.dumps({"index": 0, "text": "some sentence"}) + "\n")
    assert release.scan_forbidden([ok], {"real.person"}) == []
    assert release.scan_forbidden([leak], {"real.person"}) == ["leak.jsonl: identifiant réel présent"]
    assert release.scan_forbidden([text], set()) == ["text.jsonl: champ `text` publié"]


def test_depot_publie_est_conforme():
    """Le dépôt tel que versionné doit passer le contrôle (aucun identifiant réel, aucun texte)."""
    assert release.build(check_only=True, demo_results=None) == 0
