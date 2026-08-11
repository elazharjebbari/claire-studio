# Plan de tests

> Trois niveaux, cohérents avec la méthode déjà en place dans le projet : unitaire pur,
> HTTP mocké (comportement conforme à la recherche documentaire, pas à des suppositions),
> et **réel non-destructif** contre une source publique quand c'est possible.

---

## Niveau 1 — unitaire pur (aucun réseau, aucune dépendance)

| Cible | Cas couverts |
|---|---|
| `g5k_reference.gpu_clusters_for` | filtre par VRAM min, tri croissant, catalogue vide, aucun match, égalité de VRAM |
| `g5k_ssh` (gestion de fichier temporaire) | permissions 0600, suppression garantie même si l'appelant lève une exception (`try/finally`), ne persiste jamais au-delà de l'appel |
| `services.py` garde-fou sweep | sous le seuil → OK, au-dessus sans `force` → refusé avec message citant la bonne pratique, au-dessus avec `force=True` → OK |
| `build_run_script` (script généré) | présence du garde-fou GPU, activation Conda, `HF_HOME`, `_SENTINEL` — déjà testé, à réexécuter tel quel après migration client |

## Niveau 2 — HTTP mocké (comportement conforme à la recherche)

Le point important : les mocks doivent reproduire **exactement** ce que la recherche a
observé (formats de réponse réels documentés dans `research/03_API_REST.md`), pas une
approximation plausible — sinon un test vert masquerait un vrai bug d'intégration.

| Cible | Cas couverts, avec la source qui justifie le mock |
|---|---|
| `g5k_client.test_connection` | 200 avec la structure `{"items": [...]}` réelle (§3.2) → `apiOk=True` ; 401 → message `g5k_auth_failed` (client officiel : `Grid5000AuthenticationError`) ; timeout/connexion refusée → `g5k_unreachable` |
| `g5k_client.submit` | 201 avec le JSON réel de réponse (§4.1, champs `uid`/`state`/`assigned_nodes`) ; réponse sans `uid` → erreur explicite |
| `g5k_client.poll` | `state: "waiting"` → `waiting` ; `state: "running"` → `running` ; toute autre valeur (y compris `error`/`terminated` non confirmés par la doc) → `stopped`, jamais un crash |
| `g5k_client.cancel` | `202 Accepted` avec le header `X-Oar-Info` réel (§4.4) — pas d'exception levée sur ce code |
| Retry réseau | simuler un 502 puis un 200 — vérifier que le comportement de retry du client officiel (5 tentatives, backoff 0.3) est bien exercé, pas contourné par notre couche |

## Niveau 3 — réel, non-destructif (SANS compte Grid'5000)

**Le seul niveau qui touche un vrai service Grid'5000** — mais sans authentification ni
réservation, donc sans aucun impact sur la plateforme partagée.

| Test | Ce qu'il prouve |
|---|---|
| `test_reference_repository_mirror_est_accessible` | `GET https://raw.githubusercontent.com/grid5000/reference-repository/master/data/grid5000/sites/lyon/clusters/gemini/nodes/gemini-1.json` répond 200 avec un JSON contenant bien `gpu_devices` — le format sur lequel `g5k_reference.py` est construit correspond à la réalité, pas à une supposition |
| `test_gpu_clusters_for_sur_donnees_reelles` | `gpu_clusters_for(16, [vrai JSON gemini-1 + vrai JSON d'un cluster CPU sans GPU])` retourne bien `gemini` et exclut le cluster sans GPU — preuve que le parsing fonctionne sur de vraies données Grid'5000, pas une fixture inventée |
| `test_api_exige_authentification` | `GET https://api.grid5000.fr/stable/sites` (sans credentials) répond bien `401` — verrouille la découverte critique n°1 du dossier (§`00_README.md`) ; si Grid'5000 change un jour cette politique, ce test casse et nous alerte plutôt que de laisser une hypothèse fausse silencieusement obsolète |

**Explicitement HORS de portée sans compte réel** (documenté, pas simulé comme « fait ») :
soumission d'un vrai job, transfert rsync réel, test de connexion avec de vrais
identifiants, vérification de la clé SSH contre un vrai `access.grid5000.fr`. Le code
est écrit et testé (niveaux 1-2) pour être prêt le jour où un compte existera —
voir `11_RUNBOOK_SONNET5.md` pour la procédure de vérification manuelle à suivre à ce
moment-là.

## Couverture cible

Même standard que le reste du module Lab (`claire.lab` à 89% après l'audit du 11 août
2026) : chaque fonction publique de `g5k_client.py`/`g5k_reference.py`/`g5k_ssh.py`
testée, chaque branche d'erreur (`G5KError` avec chacun de ses codes) exercée au moins
une fois.
