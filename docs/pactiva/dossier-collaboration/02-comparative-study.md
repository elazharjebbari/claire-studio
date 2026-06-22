# Étude comparative — choix de modélisation

## A. Source de la liste de documents (corriger le triple)

| Option | Description | Forces | Faiblesses | Verdict |
|---|---|---|---|---|
| **A1. Filtrer `assignments` par `me.id` côté client** | DocumentSwitcher/dashboard ne gardent que `assigneeId==me.id` | Minimal, aligné sur `/work`, 0 backend, immédiat | Sur‑télécharge 150 lignes pour en garder 50 | **RETENU (Lot1)** |
| A2. Filtre serveur `?assignee=me` | L'endpoint ne renvoie que mes assignations | Réseau optimal, contrat clair | Touche backend + contrat ; l'admin perd la vue « union » sur ce endpoint | Lot2 (optimisation) |
| A3. Dédup par `document.id` (garder la mienne) | Réduction client par doc | Robuste si l'API renvoie l'union | Logique plus subtile que A1 | Complément de A1 |

**Décision** : A1 maintenant (corrige le symptôme, cohérent avec `/work`), A2 plus tard pour la perf.
La vue « union 3 annotateurs » reste disponible pour l'admin via la **console admin**
(matrice d'assignation + avancement), pas via le sélecteur de session.

## B. Ouverture d'une session

| Option | Forces | Faiblesses | Verdict |
|---|---|---|---|
| **B1. `createAnnotation({project, document})` puis `/annotate/{id}`** (pattern `/work`) | Ouvre TOUJOURS ma session (get_or_create idempotent) ; jamais celle d'autrui | 1 POST au clic | **RETENU** |
| B2. Pousser `assignment.annotationId` | 0 requête | Peut ouvrir la session d'un autre (déroutant, lecture seule) | Abandonné |

## C. Distinguer « collaboration » vs « vraie session »

Principe retenu (déjà partiellement en place, à rendre systématique) :
- **Session solo** = `/annotate/{monId}` → bannière « Ma session — édition », éditable.
- **Lecture/Supervision** = ouverture d'une annotation d'autrui → bannière « Lecture seule »,
  store `readOnly`, autosave coupé. Accès **réservé à l'admin** depuis la console, via des
  **liens discrets (icône œil)** sur la matrice annotateurs — jamais mélangé au sélecteur perso.
- **Collaboration ambiante** = présence/CollabBar + comparaison (humain↔LLM, ou inter‑annotateurs
  en lecture) : c'est une **aide**, jamais la référence (les pré‑annotations et les annotations
  d'autrui ne comptent pas pour MA soumission).

## D. IAA pour N annotateurs

| Option | Forces | Faiblesses | Verdict |
|---|---|---|---|
| **Cohen κ pairwise, moyenné** (actuel) | Lisible, exposé par paire, robuste | `per_theme`/`boundary` double‑comptent si N≥3 (bug) | Garder + **corriger** l'agrégat (moyenner par paire) — Lot2 |
| Fleiss κ (multi‑annotateurs) | Une mesure unique N‑way | Moins lisible par paire, refonte | Optionnel plus tard |

**Décision** : conserver Cohen pairwise (déjà branché UI), corriger le double‑comptage
`per_theme`/`boundary` en moyennant les κ par paire au lieu de concaténer les observations.
