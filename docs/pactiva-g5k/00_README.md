# Intégration Grid'5000 — dossier de conception complet

> Ce dossier remplace et approfondit `docs/pactiva-lab/06_GRID5000.md` (conservé tel
> quel comme trace historique, marqué déprécié en tête). Il documente Grid'5000
> lui-même (recherche exhaustive, sourcée), analyse comment l'utiliser pour l'objectif
> de Pactiva Lab (produire le matériel scientifique de l'article JURIX 2026), conçoit
> l'architecture logicielle qui pilote réservation/exécution/monitoring/récupération de
> résultats, et exécute un premier lot d'implémentation.

## Pourquoi ce dossier existe

`claire/lab/runners/g5k.py` (créé lors de la conception initiale du module Lab)
implémente un squelette fonctionnel (`test_connection`, `submit`, `poll`, `fetch`,
`cancel`) mais reposait sur des hypothèses non vérifiées contre la documentation
officielle — certaines se sont révélées **inexactes** (voir §Correctifs). Ce dossier
part d'une recherche documentaire réelle, exhaustive et sourcée, puis en tire une
architecture robuste.

## Comment lire ce dossier

| Fichier | Contenu |
|---|---|
| `research/01_VUE_ENSEMBLE_SITES_ACCES.md` | Qu'est-ce que Grid'5000, sites/hardware, accès (SSH/VPN), politiques de réservation (queues, privilèges) |
| `research/02_OAR_KADEPLOY.md` | L'ordonnanceur OAR (`oarsub`/`oarstat`/`oardel`), cycle de vie d'un job, déploiement d'environnements (Kadeploy) |
| `research/03_API_REST.md` | **Le plus important pour l'implémentation.** API REST complète (auth, endpoints, format JSON, client officiel `python-grid5000`) |
| `research/04_STOCKAGE_RESEAU.md` | Home/Group Storage, réseau (NAT, KaVLAN), transfert de fichiers |
| `research/05_MONITORING_ML_GPU.md` | Monika/Grafana/Kwollect, pièges CUDA/PyTorch, conteneurs (Docker/Singularity) |
| `06_ANALYSE_BESOIN_PACTIVA.md` | Confrontation de la doc à notre besoin réel (14 presets, ML léger/lourd, objectif article) |
| `07_ARCHITECTURE.md` | Architecture cible : réservation, exécution, monitoring, récupération — avec diagrammes |
| `08_UX_UI.md` | Écrans, navigation, catalogue de vues (sites/clusters GPU, suivi de job, monitoring) |
| `09_PLAN_DEV.md` | Lots de développement, priorisés |
| `10_TESTS.md` | Stratégie de test (unitaire, mocké, réel-non-destructif) |
| `11_RUNBOOK_SONNET5.md` | Journal d'exécution pour agent Claude Sonnet 5 |
| `specs/*.yaml,.json,.csv` | Contrats de données structurés |
| `diagrams/*.puml` | Diagrammes de séquence, composants, état |

## Méthodologie de la recherche documentaire

Effectuée le 11 août 2026 par 5 agents de recherche en parallèle, chacun couvrant un
axe (vue d'ensemble, OAR, API REST, stockage/réseau, monitoring/ML), avec pour consigne
stricte : **sourcer chaque affirmation avec l'URL officielle exacte** et **signaler
explicitement toute incertitude ou contradiction plutôt que de la résoudre par
supposition**. Un agent a testé empiriquement l'API en direct (`curl` sans
identifiants) et a découvert un fait qui change l'architecture (voir ci-dessous).

## ⚠️ Découverte majeure de la recherche

**Toute l'API `api.grid5000.fr` exige une authentification HTTP Basic, y compris les
endpoints de référence en lecture seule** (`/sites`, `/clusters`, `/nodes`) — vérifié
empiriquement (`401 Unauthorized` sur tous les endpoints testés sans identifiants).
Il n'existe **aucun accès public** à l'API elle-même.

**Conséquence pour ce dossier** : sans compte Grid'5000, impossible d'exécuter la
moindre requête réelle contre l'API. La vérification empirique de cette session s'est
donc appuyée sur le **miroir GitHub public du reference-repository**
(`github.com/grid5000/reference-repository`), qui expose les mêmes données JSON
(sites/clusters/nodes, y compris `gpu_devices`) sans authentification — voir
`11_RUNBOOK_SONNET5.md` pour le détail de ce qui a été réellement testé.

## Correctifs factuels par rapport à `docs/pactiva-lab/06_GRID5000.md`

| Ancien contenu (06_GRID5000.md) | Réalité vérifiée dans ce dossier |
|---|---|
| « Ne pas réserver un seul GPU sur un nœud qui en compte ≥4 » | **L'inverse est documenté** : réserver 1 seul GPU quand on n'en a besoin que d'1 est *encouragé* (évite le gaspillage) ; ce qu'il faut savoir, c'est que cela donne accès à une fraction proportionnelle de la RAM/CPU du nœud. |
| Pas de mention de multi-jobs pour un sweep | La doc déconseille explicitement de soumettre de nombreux petits jobs OAR ; recommande une réservation plus large + GNU Parallel ou jobs conteneurs. Directement pertinent pour nos presets à sweep (14-25 runs). |
| Pas de mention du client officiel | `python-grid5000` (PyPI) est le client de référence recommandé par la doc officielle — retry intégré, hiérarchie d'exceptions, mode offline. À utiliser au lieu de réimplémenter des appels `requests` bruts. |
| Group Storage présenté comme un détail de config | Aucun self-service : demande manuelle par e-mail à `support-staff@lists.grid5000.fr`. Notre architecture ne peut pas l'automatiser, seulement documenter la procédure et consommer le chemin fourni. |
| Pas de mention de sélection informée de cluster | La Reference API (`gpu_devices`) expose modèle/mémoire/`compute_capability` par GPU — permet de valider la compatibilité VRAM **avant** réservation. |

## Ce qui reste hors de portée de ce dossier (et pourquoi)

**Aucune réservation réelle de ressources Grid'5000 n'a été effectuée.** Pactiva n'a pas
de compte Grid'5000 configuré, et en créer un puis réserver de vraies ressources sur une
plateforme de recherche mutualisée est une action à fort impact que je ne prends pas
sans autorisation explicite et des identifiants réels. Le plan d'exécution (§11) livre
un code entièrement testé (mocks + données publiques réelles), prêt à être branché sur
un vrai compte dès qu'il existera.
