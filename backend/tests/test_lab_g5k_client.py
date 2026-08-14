"""`g5k_client.py` — adaptateur sur `python-grid5000`.

Les réponses HTTP simulées reproduisent EXACTEMENT les payloads observés dans la
recherche documentaire (`docs/pactiva-g5k/research/03_API_REST.md` §3.2/§4.1/§4.2,
capturés depuis la doc officielle Grid'5000) — pas des payloads simplifiés inventés,
pour que ces tests verrouillent le format réellement documenté plutôt qu'une
approximation plausible.

⚠️ `client.sites[site]` (`BracketMixin.__getitem__`, vérifié dans le code source du
client officiel) fait lui-même un VRAI appel HTTP GET `/sites/{site}` avant tout accès
à `.jobs` — chaque test liste donc explicitement CE premier appel en plus de
l'opération visée, plutôt que de le laisser masqué par un `return_value` unique qui
répéterait le même payload pour les deux (ce qui « passerait » sans prouver le bon
nombre d'appels).
"""

import json
from unittest.mock import patch

import pytest
import requests

from claire.lab.g5k_client import G5KError, build_client, cancel, poll, submit
from claire.lab.g5k_client import test_connection as g5k_test_connection

pytestmark = pytest.mark.django_db


def _response(status_code: int, body: dict | list | None = None) -> requests.Response:
    resp = requests.Response()
    resp.status_code = status_code
    resp.url = "https://api.grid5000.fr/stable/sites"
    resp._content = json.dumps(body if body is not None else {}).encode("utf-8")
    resp.headers["Content-Type"] = "application/json"
    return resp


SITE_PAYLOAD = {"uid": "grenoble", "type": "site", "name": "Grenoble"}

# Payload EXACT de la recherche (research/03_API_REST.md §3.2, sites/rennes tronqué aux
# champs pertinents pour SiteManager.list()).
SITES_LIST_PAYLOAD = {
    "total": 1, "offset": 0,
    "items": [{"uid": "rennes", "type": "site", "name": "Rennes"}],
}

# Payload EXACT de la recherche §4.1 (réponse 201, état waiting).
JOB_CREATED_PAYLOAD = {
    "uid": 1965464, "user_uid": "auser", "walltime": 7200, "queue": "default",
    "state": "waiting", "project": "g5k-staff", "mode": "PASSIVE",
    "command": "./oarapi.subscript.IEtz0", "submitted_at": 1607006878, "started_at": 0,
    "resources_by_type": {}, "assigned_nodes": [],
}

# Payload EXACT de la recherche §4.2 (le même job, quelques secondes plus tard, running).
JOB_RUNNING_PAYLOAD = {**JOB_CREATED_PAYLOAD, "state": "running", "scheduled_at": 1607006880}


def _client():
    return build_client("auser", "s3cret")


class TestConnection:
    """`client.sites.list()` : un seul appel HTTP (`client.sites` est un manager, pas
    un item — aucun GET tant qu'on ne demande ni `.list()` ni `[clé]`)."""

    def test_reussie_avec_le_format_reel_de_reponse(self):
        with patch.object(requests.Session, "send", return_value=_response(200, SITES_LIST_PAYLOAD)):
            ok, detail = g5k_test_connection(_client())
        assert ok is True
        assert "1 sites" in detail

    def test_401_mot_de_passe_refuse(self):
        with patch.object(requests.Session, "send", return_value=_response(401, {"message": "bad credentials"})):
            ok, detail = g5k_test_connection(_client())
        assert ok is False
        assert "g5k_auth_failed" in detail

    def test_reseau_injoignable(self):
        with patch.object(requests.Session, "send", side_effect=requests.exceptions.ConnectionError("dns fail")):
            ok, detail = g5k_test_connection(_client())
        assert ok is False
        assert "g5k_unreachable" in detail


class TestSubmit:
    def test_renvoie_l_identifiant_reel_du_job(self):
        with patch.object(
            requests.Session, "send",
            side_effect=[_response(200, SITE_PAYLOAD), _response(201, JOB_CREATED_PAYLOAD)],
        ):
            job_id = submit(
                _client(), "grenoble",
                resources="nodes=2,walltime=02:00", command="sleep 3600",
            )
        assert job_id == "1965464"

    def test_401_leve_g5kerror_auth_failed(self):
        with patch.object(
            requests.Session, "send",
            side_effect=[_response(200, SITE_PAYLOAD), _response(401, {"message": "bad credentials"})],
        ):
            with pytest.raises(G5KError) as exc:
                submit(_client(), "grenoble", resources="nodes=1", command="x")
        assert exc.value.code == "g5k_auth_failed"

    def test_erreur_serveur_leve_g5kerror_unreachable(self):
        with patch.object(
            requests.Session, "send",
            side_effect=[_response(200, SITE_PAYLOAD), _response(500, {"message": "internal error"})],
        ):
            with pytest.raises(G5KError) as exc:
                submit(_client(), "grenoble", resources="nodes=1", command="x")
        assert exc.value.code == "g5k_unreachable"

    def test_transmet_types_et_name_quand_fournis(self):
        with patch.object(
            requests.Session, "send",
            side_effect=[_response(200, SITE_PAYLOAD), _response(201, JOB_CREATED_PAYLOAD)],
        ) as fake_send:
            submit(
                _client(), "grenoble", resources="nodes=1", command="x",
                types=["besteffort"], name="pactiva-test",
            )
        # Le 2e appel HTTP (POST jobs) porte le corps JSON avec types/name.
        body = fake_send.call_args_list[1].args[0].body
        assert b'"besteffort"' in body
        assert b'"pactiva-test"' in body

    def test_la_queue_est_toujours_envoyee_explicitement_meme_sans_argument(self):
        """Bug réel trouvé le 14 août 2026 sur DEUX jobs réels distincts (un CPU sur
        nantes, un GPU sur lyon) : sans ce champ, OAR tente de résoudre une queue par
        défaut pour ce compte et échoue avec `queue 'abaca' does not exist` —
        reproduit indépendamment de notre client via `oarsub` brut. `queue="default"`
        explicite contourne le problème, vérifié empiriquement sur un vrai job."""
        with patch.object(
            requests.Session, "send",
            side_effect=[_response(200, SITE_PAYLOAD), _response(201, JOB_CREATED_PAYLOAD)],
        ) as fake_send:
            submit(_client(), "grenoble", resources="nodes=1", command="x")
        body = fake_send.call_args_list[1].args[0].body
        assert b'"queue": "default"' in body

    def test_une_queue_explicite_remplace_le_defaut(self):
        with patch.object(
            requests.Session, "send",
            side_effect=[_response(200, SITE_PAYLOAD), _response(201, JOB_CREATED_PAYLOAD)],
        ) as fake_send:
            submit(_client(), "grenoble", resources="nodes=1", command="x", queue="besteffort")
        body = fake_send.call_args_list[1].args[0].body
        assert b'"queue": "besteffort"' in body


class TestPoll:
    def test_waiting(self):
        with patch.object(
            requests.Session, "send",
            side_effect=[_response(200, SITE_PAYLOAD), _response(200, JOB_CREATED_PAYLOAD)],
        ):
            assert poll(_client(), "grenoble", "1965464") == "waiting"

    def test_running(self):
        with patch.object(
            requests.Session, "send",
            side_effect=[_response(200, SITE_PAYLOAD), _response(200, JOB_RUNNING_PAYLOAD)],
        ):
            assert poll(_client(), "grenoble", "1965464") == "running"

    def test_toute_autre_valeur_devient_stopped(self):
        """⭐ Y compris un état futur non prévu par l'UI (error/terminated observés
        ailleurs dans la doc, jamais dans un exemple JSON complet) : ne jamais planter,
        toujours retomber sur `stopped` — c'est `fetch()`/`_SENTINEL` qui distingue
        ensuite complet de partiel, pas ce mapping."""
        payload = {**JOB_CREATED_PAYLOAD, "state": "terminated"}
        with patch.object(
            requests.Session, "send",
            side_effect=[_response(200, SITE_PAYLOAD), _response(200, payload)],
        ):
            assert poll(_client(), "grenoble", "1965464") == "stopped"


class TestCancel:
    def test_202_accepted_ne_leve_pas(self):
        """`DELETE` renvoie 202 (§4.4 de la recherche) — pas un code 2xx classique mais
        toujours un succès, jamais une exception. Trois appels réels : GET site, GET
        job (pour charger l'objet avant delete), DELETE job."""
        with patch.object(
            requests.Session, "send",
            side_effect=[
                _response(200, SITE_PAYLOAD),
                _response(200, JOB_RUNNING_PAYLOAD),
                _response(202, {}),
            ],
        ):
            cancel(_client(), "grenoble", "1965464")  # ne lève pas
