"""Client Grid'5000 — fine couche sur `python-grid5000`, le client officiel recommandé
par la documentation (`docs/pactiva-g5k/research/03_API_REST.md` §5) : retry intégré
(5 tentatives, backoff 0.3, codes 500/502/504), hiérarchie d'exceptions testée,
gestion HATEOAS. Remplace le client HTTP maison (`urllib`, sans retry) qui existait
dans `runners/g5k.py`.

Toutes les exceptions du client officiel sont mappées vers `G5KError` (code, detail) —
le reste du Lab (worker, vues) ne connaît que ce type d'erreur, jamais les exceptions
`grid5000.*` directement.
"""

from __future__ import annotations

import requests
from grid5000 import Grid5000
from grid5000.exceptions import Grid5000AuthenticationError, Grid5000Error


class G5KError(RuntimeError):
    """Erreur côté Grid'5000, porteuse d'un code exploitable par l'UI — voir
    `docs/pactiva-g5k/specs/g5k-error-codes.csv` pour le catalogue complet."""

    def __init__(self, code: str, detail: str):
        self.code = code
        super().__init__(detail)


def build_client(login: str, password: str) -> Grid5000:
    """Construit un client authentifié par mot de passe (API HTTP Basic).

    N'authentifie PAS pour SSH/rsync — voir `g5k_ssh.py` pour le second secret.
    """
    return Grid5000(username=login, password=password)


def _wrap(action: str, fn):
    """Exécute `fn`, mappe toute exception réseau/G5K connue vers `G5KError`.

    `action` nomme l'opération en cours (submit/poll/cancel/test) uniquement pour un
    message d'erreur plus lisible ; le CODE renvoyé reste stable et générique, pour que
    l'UI puisse s'y accrocher sans connaître le détail de chaque appel.
    """
    try:
        return fn()
    except Grid5000AuthenticationError as exc:
        raise G5KError("g5k_auth_failed", f"identifiants Grid'5000 refusés ({action})") from exc
    except Grid5000Error as exc:
        raise G5KError("g5k_unreachable", f"erreur Grid'5000 lors de {action} : {exc}") from exc
    except requests.exceptions.RequestException as exc:
        raise G5KError("g5k_unreachable", f"réseau injoignable lors de {action} : {exc}") from exc


def test_connection(client: Grid5000) -> tuple[bool, str]:
    """Vérifie le mot de passe AVANT de réserver quoi que ce soit.

    Découvrir un mot de passe faux au bout d'une réservation de plusieurs heures est
    exactement ce qu'il faut éviter — `docs/pactiva-g5k/07_ARCHITECTURE.md` §7.
    """
    try:
        sites = _wrap("test de connexion", lambda: client.sites.list())
    except G5KError as exc:
        return False, f"{exc.code} : {exc}"
    return True, f"connexion établie ({len(sites)} sites)"


def submit(client: Grid5000, site: str, *, resources: str, command: str,
           types: list[str] | None = None, name: str = "") -> str:
    """Soumet un job. Renvoie son identifiant (`uid`), jamais vide (contrairement au
    client maison précédent, une réponse sans `uid` lève ici une `Grid5000*Error`
    avant même d'atteindre notre code, donc pas besoin de re-vérifier)."""
    payload = {"resources": resources, "command": command}
    if types:
        payload["types"] = types
    if name:
        payload["name"] = name
    job = _wrap("soumission du job", lambda: client.sites[site].jobs.create(payload))
    return str(job.uid)


def poll(client: Grid5000, site: str, job_id: str) -> str:
    """État du job — mappé vers `waiting`/`running`/`stopped` (jamais une valeur brute
    non prévue par l'UI, cohérent avec le comportement déjà en place)."""
    job = _wrap("consultation du job", lambda: client.sites[site].jobs.get(job_id))
    return {"waiting": "waiting", "running": "running"}.get(job.state, "stopped")


def cancel(client: Grid5000, site: str, job_id: str) -> None:
    job = _wrap("annulation du job", lambda: client.sites[site].jobs.get(job_id))
    _wrap("annulation du job", job.delete)
