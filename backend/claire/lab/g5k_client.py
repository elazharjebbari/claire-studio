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
           types: list[str] | None = None, name: str = "", queue: str = "default") -> str:
    """Soumet un job. Renvoie son identifiant (`uid`), jamais vide (contrairement au
    client maison précédent, une réponse sans `uid` lève ici une `Grid5000*Error`
    avant même d'atteindre notre code, donc pas besoin de re-vérifier).

    `queue` est TOUJOURS envoyé explicitement — jamais omis. Bug réel trouvé le 14 août
    2026 en soumettant deux vrais jobs (un CPU sur nantes, un GPU sur lyon) : sans ce
    champ, OAR tente de résoudre une queue par défaut pour le compte et échoue avec
    `queue 'abaca' does not exist` — reproduit indépendamment de notre client via
    `oarsub` brut, donc pas un bug de notre requête, mais une résolution de queue par
    défaut cassée pour ce compte sur au moins deux sites distincts. `-q default`
    explicite contourne le problème (confirmé empiriquement)."""
    payload = {"resources": resources, "command": command, "queue": queue}
    if types:
        payload["types"] = types
    if name:
        payload["name"] = name
    job = _wrap("soumission du job", lambda: client.sites[site].jobs.create(payload))
    return str(job.uid)


# États OAR réellement TERMINAUX (plus rien à attendre du job) — le reste (`waiting`,
# `hold`, `tolaunch`, `launching`, `suspended`, tout état futur/inconnu) doit rester
# considéré comme « pas encore fini », jamais `stopped` par défaut.
#
# Bug réel trouvé le 14 août 2026 (job Grid'5000 réel, site nancy, job 6852994) :
# l'ancien mapping ne reconnaissait explicitement que `waiting`/`running`, et traitait
# TOUT le reste — y compris `toLaunch`/`Launching`, les états transitoires entre la
# soumission et le vrai démarrage du script — comme `stopped`. `_wait_remote` déclenchait
# alors `fetch()` quelques secondes après la soumission, bien avant que le job n'ait
# seulement commencé à s'exécuter : le run échouait en `result_missing` alors que le job,
# 18 secondes plus tard, terminait réellement avec des résultats valides sur Grid'5000
# (`oarstat -f` : `state = Terminated, exit_code = 0`, `results.json` complet et
# cohérent rapatrié manuellement). Le budget de nouvelles tentatives de `fetch()`
# (`LAB_FETCH_RETRIES`, bug de la course NFS déjà corrigé) ne pouvait rien y faire : le
# job n'avait tout simplement pas encore tourné.
_TERMINAL_STATES = {"terminated", "error", "toerror", "finishing"}


def poll(client: Grid5000, site: str, job_id: str) -> str:
    """État du job — mappé vers `waiting`/`running`/`stopped` (jamais une valeur brute
    non prévue par l'UI, cohérent avec le comportement déjà en place).

    Le défaut est `waiting` (pas `stopped`) pour tout état non explicitement reconnu —
    voir `_TERMINAL_STATES` ci-dessus pour la raison."""
    job = _wrap("consultation du job", lambda: client.sites[site].jobs.get(job_id))
    if job.state == "running":
        return "running"
    if job.state in _TERMINAL_STATES:
        return "stopped"
    return "waiting"


def cancel(client: Grid5000, site: str, job_id: str) -> None:
    job = _wrap("annulation du job", lambda: client.sites[site].jobs.get(job_id))
    _wrap("annulation du job", job.delete)
