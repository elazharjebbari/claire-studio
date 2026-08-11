"""`g5k_ssh.temporary_ssh_key` — la clé privée ne doit JAMAIS survivre sur disque au-delà
du transfert qui l'utilise, y compris si ce transfert échoue."""

import stat

import pytest

from claire.lab.g5k_ssh import ssh_command, temporary_ssh_key


def test_ecrit_la_cle_avec_les_permissions_0600():
    with temporary_ssh_key("clé-de-test\n") as path:
        assert path.read_text(encoding="utf-8") == "clé-de-test\n"
        mode = stat.S_IMODE(path.stat().st_mode)
        assert mode == 0o600


def test_ajoute_un_saut_de_ligne_final_si_absent():
    with temporary_ssh_key("clé-sans-fin") as path:
        assert path.read_text(encoding="utf-8") == "clé-sans-fin\n"


def test_supprime_le_fichier_a_la_sortie_normale():
    captured_path = None
    with temporary_ssh_key("x") as path:
        captured_path = path
        assert path.exists()
    assert not captured_path.exists()


def test_supprime_le_fichier_meme_si_le_bloc_leve():
    """⭐ Le point de sécurité central : un transfert qui plante ne doit pas laisser la
    clé privée sur disque."""
    captured_path = None
    with pytest.raises(RuntimeError):
        with temporary_ssh_key("x") as path:
            captured_path = path
            raise RuntimeError("rsync a échoué")
    assert not captured_path.exists()


def test_refuse_une_cle_vide():
    with pytest.raises(ValueError):
        with temporary_ssh_key(""):
            pass


def test_ssh_command_reference_le_chemin_et_desactive_les_invites():
    with temporary_ssh_key("x") as path:
        command = ssh_command(path)
    assert str(path) in command
    assert "BatchMode=yes" in command  # jamais d'invite interactive dans un worker
