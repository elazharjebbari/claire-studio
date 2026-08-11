"""Point d'entrée `python -m pactiva_lab run` — jamais testé automatiquement avant cet
audit (0 % de couverture), alors que c'est exactement la commande que
`claire/lab/runners/local.py` invoque en sous-processus depuis Django. Un test qui
appelle `run_experiment` directement ne prouve pas que l'argument parsing, l'écriture du
fichier de config, ou le code de sortie fonctionnent — seul un appel à `main(argv)` le
prouve.
"""

import json

import pytest

from pactiva_lab.cli import main


def _write_config(path, config):
    path.write_text(json.dumps(config), encoding="utf-8")
    return path


def test_main_reussit_et_ecrit_les_resultats(toy_dataset, base_config, tmp_path, capsys):
    config_path = _write_config(tmp_path / "config.json", base_config)
    out = tmp_path / "out"

    code = main([
        "run", "--config", str(config_path), "--data", str(toy_dataset), "--out", str(out),
    ])

    assert code == 0
    assert (out / "results.json").exists()
    captured = capsys.readouterr()
    assert "macro-F1" in captured.out


def test_main_renvoie_1_sur_configuration_invalide(toy_dataset, tmp_path, capsys):
    """Une famille de modèle inconnue doit produire un échec propre (code 1, message sur
    stderr), pas une trace Python brute — c'est ce que lit `run.log` côté Django."""
    bad_config = {
        "version": 1, "task": "T1_primary", "seed": 42,
        "model": {"family": "modele_qui_n_existe_pas"},
        "evaluation": {"split": {"scheme": "group_kfold_document", "k": 5}},
    }
    config_path = _write_config(tmp_path / "config.json", bad_config)
    out = tmp_path / "out"

    code = main([
        "run", "--config", str(config_path), "--data", str(toy_dataset), "--out", str(out),
    ])

    assert code == 1
    assert "ÉCHEC" in capsys.readouterr().err


def test_main_renvoie_130_sur_annulation(toy_dataset, base_config, tmp_path):
    """Le code 130 (SIGINT conventionnel) est ce que `LocalBackend` distingue d'un échec
    réel via `self.last_returncode` — vérifié ici au niveau du point d'entrée exact."""
    config_path = _write_config(tmp_path / "config.json", base_config)
    out = tmp_path / "out"
    cancel_file = tmp_path / "CANCEL"
    cancel_file.write_text("1", encoding="utf-8")

    code = main([
        "run", "--config", str(config_path), "--data", str(toy_dataset), "--out", str(out),
        "--cancel-file", str(cancel_file),
    ])

    assert code == 130


def test_main_commande_inconnue_leve_une_erreur_argparse():
    with pytest.raises(SystemExit):
        main(["envole-toi"])
