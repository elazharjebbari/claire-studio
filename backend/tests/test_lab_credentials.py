"""Sécurité des identifiants de calcul.

Un secret qui fuit ne se rattrape pas : ces tests sont adversariaux et balaient
RÉCURSIVEMENT les réponses sérialisées. Un champ ajouté par inadvertance à un
sérialiseur imbriqué serait sinon invisible jusqu'à l'audit.
"""

import logging
import os
from unittest import mock

import pytest
from cryptography.fernet import Fernet

from claire.lab.crypto import (
    CredentialsKeyMissing,
    decrypt_secret,
    encrypt_secret,
    is_configured,
    mask,
)
from claire.lab.models import ComputeCredential
from claire.lab.serializers import ComputeCredentialSerializer

SECRET = "mot-de-passe-grid5000-tres-secret"
SSH_KEY = "-----BEGIN OPENSSH PRIVATE KEY-----\nclé-privée-de-test\n-----END OPENSSH PRIVATE KEY-----"


@pytest.fixture
def with_key():
    key = Fernet.generate_key().decode()
    with mock.patch.dict(os.environ, {"LAB_CREDENTIALS_KEY": key}):
        yield key


@pytest.fixture
def without_key():
    with mock.patch.dict(os.environ, {"LAB_CREDENTIALS_KEY": ""}):
        yield


# --------------------------------------------------------------------------- #
# Chiffrement
# --------------------------------------------------------------------------- #

def test_aller_retour(with_key):
    token = encrypt_secret(SECRET)
    assert token != SECRET
    assert decrypt_secret(token) == SECRET


def test_le_chiffre_ne_contient_pas_le_clair(with_key):
    assert SECRET not in encrypt_secret(SECRET)


def test_refus_d_ecrire_sans_cle(without_key):
    """⭐ Jamais de stockage en clair « en attendant » : un secret écrit en clair une
    fois le reste indéfiniment."""
    with pytest.raises(CredentialsKeyMissing) as exc:
        encrypt_secret(SECRET)
    # Le message doit dire COMMENT générer la clé, pas seulement qu'elle manque.
    assert "Fernet.generate_key" in str(exc.value)


def test_cle_invalide_refusee():
    with mock.patch.dict(os.environ, {"LAB_CREDENTIALS_KEY": "pas-une-cle-fernet"}):
        with pytest.raises(CredentialsKeyMissing):
            encrypt_secret(SECRET)


def test_is_configured_reflete_l_etat(with_key, ):
    assert is_configured() is True


def test_is_configured_faux_sans_cle(without_key):
    """L'UI s'en sert pour DÉSACTIVER la cible distante avec un motif, plutôt que de la
    faire disparaître sans explication."""
    assert is_configured() is False


def test_deux_chiffrements_different(with_key):
    """Fernet inclut un sel : deux chiffrés du même secret diffèrent, ce qui empêche de
    détecter par comparaison que deux comptes partagent un mot de passe."""
    assert encrypt_secret(SECRET) != encrypt_secret(SECRET)


def test_mask_ne_revele_presque_rien():
    assert mask(SECRET).startswith("mo")
    assert SECRET[2:-2] not in mask(SECRET)
    assert mask("abc") == "•••"
    assert mask("") == ""


# --------------------------------------------------------------------------- #
# Sérialisation — le balayage récursif
# --------------------------------------------------------------------------- #

def _walk(node):
    """Rend toutes les valeurs scalaires d'une structure imbriquée."""
    if isinstance(node, dict):
        for key, value in node.items():
            yield str(key)
            yield from _walk(value)
    elif isinstance(node, (list, tuple)):
        for item in node:
            yield from _walk(item)
    else:
        yield str(node)


@pytest.mark.django_db
def test_le_secret_est_absent_de_toute_la_serialisation(with_key, django_user_model):
    """⭐ Balayage RÉCURSIF : un champ ajouté à un sérialiseur imbriqué serait invisible
    à un test qui ne regarde que le premier niveau."""
    user = django_user_model.objects.create_user(username="chercheur", password="x", email="c1@x.test")
    credential = ComputeCredential.objects.create(
        user=user, kind="g5k", login="ajebbari",
        secret_encrypted=encrypt_secret(SECRET),
        ssh_key_encrypted=encrypt_secret(SSH_KEY),
    )
    data = ComputeCredentialSerializer(credential).data

    values = list(_walk(data))
    assert SECRET not in values
    assert credential.secret_encrypted not in values
    assert SSH_KEY not in values  # ⭐ le second secret (clé SSH) ne fuit pas non plus
    assert credential.ssh_key_encrypted not in values
    assert "password" not in values
    assert "secret_encrypted" not in values
    assert "ssh_key" not in values
    assert "ssh_key_encrypted" not in values
    # Ce que l'UI a le droit de savoir : que les deux secrets existent, indépendamment.
    assert data["has_password"] is True
    assert data["has_ssh_key"] is True
    assert data["login"] == "ajebbari"


@pytest.mark.django_db
def test_le_repr_du_modele_ne_fuit_pas(with_key, django_user_model):
    """Même en débogage : un `print(credential)` ne doit rien révéler."""
    user = django_user_model.objects.create_user(username="chercheur2", password="x", email="c2@x.test")
    credential = ComputeCredential.objects.create(
        user=user, kind="g5k", login="ajebbari",
        secret_encrypted=encrypt_secret(SECRET),
        ssh_key_encrypted=encrypt_secret(SSH_KEY),
    )
    assert SECRET not in repr(credential)
    assert SSH_KEY not in repr(credential)
    assert credential.secret_encrypted not in repr(credential)
    assert credential.ssh_key_encrypted not in repr(credential)


@pytest.mark.django_db
def test_un_identifiant_appartient_a_un_seul_utilisateur(with_key, django_user_model):
    # L'e-mail est unique dans ce projet : le renseigner explicitement.
    a = django_user_model.objects.create_user(username="a", password="x", email="a@x.test")
    b = django_user_model.objects.create_user(username="b", password="x", email="b@x.test")
    ComputeCredential.objects.create(
        user=a, kind="g5k", login="a-login", secret_encrypted=encrypt_secret(SECRET)
    )
    assert ComputeCredential.objects.filter(user=b).count() == 0


@pytest.mark.django_db
def test_l_identifiant_disparait_avec_le_compte(with_key, django_user_model):
    user = django_user_model.objects.create_user(username="ephemere", password="x", email="e@x.test")
    ComputeCredential.objects.create(
        user=user, kind="g5k", login="x", secret_encrypted=encrypt_secret(SECRET)
    )
    user.delete()
    assert ComputeCredential.objects.count() == 0


# --------------------------------------------------------------------------- #
# Journaux
# --------------------------------------------------------------------------- #

def test_le_secret_n_apparait_dans_aucun_journal(with_key, caplog):
    """⭐ Le worker journalise beaucoup ; le secret ne doit jamais s'y retrouver."""
    from claire.lab.runners.g5k import Grid5000Backend

    with caplog.at_level(logging.DEBUG):
        backend = Grid5000Backend(login="ajebbari", password=SECRET)
        # Un échec de transfert doit produire un message SANS la commande complète
        # (qui contiendrait le login), et a fortiori sans le mot de passe.
        try:
            backend._run_rsync(["--version-inexistante"])
        except Exception as exc:
            assert SECRET not in str(exc)

    assert SECRET not in caplog.text


def test_l_erreur_de_transfert_ne_contient_pas_la_commande(with_key):
    from claire.lab.runners.g5k import G5KError, Grid5000Backend

    backend = Grid5000Backend(login="ajebbari", password=SECRET)
    with pytest.raises(G5KError) as exc:
        backend._run_rsync(["--option-qui-nexiste-pas"])
    assert "ajebbari" not in str(exc.value)
    assert SECRET not in str(exc.value)
