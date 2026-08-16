# 05 — Blocs thématiques & programmes d'expériences

**Date** : 16 août 2026 · **Statut** : décidé, en cours d'implémentation.
Fait suite à la campagne de validation des 15-16 août (14/14 presets verts en réel,
CPU + GPU Grid'5000) : le MOTEUR est validé, ce dossier organise son PILOTAGE.

## 1. Audit — le fonctionnement actuel et ses limites

### Ce qui existe (et marche)
- 14 presets dans `specs/pipeline-presets.yaml` (config + sweep + why + duration_hint),
  servis tels quels par l'API ; un `recommended_order` encode le protocole deux étages.
- Lanceur à deux modes (guidé = liste de presets ; expert = JSON libre), estimation
  avant lancement, garde-fous (sweep G5K, dédup par empreinte).
- Pages de résultats ad-hoc par famille (dossier `pactiva-lab-resultats/`), intros
  pédagogiques par preset, vues agrégées de sweep.
- La cartographie preset → question de recherche → papier → preuve attendue existe —
  mais dans la DOC (`pactiva-lab-resultats/02_ROLES_PUBLICATION.md`), pas dans le
  produit.

### Les limites constatées
1. **Liste plate.** Le mode guidé affiche 14 presets en vrac (à peine triés par
   `recommended_order`) : aucune structure par thème, aucun regroupement par objectif,
   aucune vue « où en suis-je dans le protocole ».
2. **Aucun lien produit ↔ publication.** Rien dans l'UI ne dit quels presets servent
   le papier long, lesquels servent le papier court, ni ce qui reste à exécuter pour
   chacun.
3. **Aucun statut d'accomplissement.** Le lanceur ne sait pas dire « déjà validé sur
   ce dataset le 15 août » vs « jamais lancé » — l'utilisateur doit fouiller la liste
   des runs.
4. **Bug réel : le mode guidé perd le `sweep`.** `baseConfig()` ne copie que
   `preset.config` — un preset à sweep (criblage 48 runs, courbe 25, juges 4…) lancé
   depuis l'UI crée UNE expérience mono-run. La campagne de validation est passée par
   l'API ; un utilisateur ne peut pas.
5. **Métadonnées de classement absentes.** Les presets n'ont ni thème, ni papier, ni
   étage (criblage/confirmation/ablation) — la classification demandée n'a pas de
   support de données.

## 2. Trois solutions, forces / faiblesses / pertinence

### Option A — Catalogue à facettes (métadonnées seules)
Enrichir le YAML (`theme`, `papers`, `stage`), regrouper le lanceur par thème, ajouter
des filtres. Les statuts sont dérivés des runs existants.
- **Forces** : minimal (zéro migration), vérité unique (les runs), rapide à livrer,
  n'introduit aucun état à maintenir.
- **Faiblesses** : les campagnes « papier » restent implicites — pas d'objet qui dit
  « voici le programme du papier long et son avancement » ; la navigation reste
  centrée sur le catalogue, pas sur l'objectif.
- **Pertinence** : nécessaire mais insuffisant seul — il structure le catalogue, pas
  le pilotage par publication.

### Option B — Programmes persistés (entité backend `ExperimentProgram`)
Nouvelle table programme (+ items ordonnés), instanciée sur un dataset, avec états
propres, endpoints CRUD, tableau de bord kanban.
- **Forces** : explicite, auditable, snapshots de campagne par papier, extensible
  (portes, dépendances entre items, quotas GPU).
- **Faiblesses** : duplication de vérité (l'état d'un item DOIT suivre les runs — deux
  sources qui divergent = mensonge silencieux, le défaut que ce produit combat
  partout) ; migrations + CRUD + synchronisation = coût et risque sans besoin avéré :
  les programmes visés sont CONNUS et stables (deux papiers), pas créés à la volée.
- **Pertinence** : sur-ingénierie au stade actuel ; se justifierait si les programmes
  devenaient dynamiques/utilisateur.

### Option C — Parcours guidé unique (wizard pas-à-pas)
Un stepper linéaire qui suit `recommended_order` avec verrous de progression.
- **Forces** : excellent pour un premier passage, impose le protocole.
- **Faiblesses** : rigide — incompatible avec les « expériences isolées par
  thématique » demandées ; deux papiers = deux parcours entrelacés qu'un stepper
  linéaire représente mal ; frustrant dès qu'on veut relancer un point isolé.
- **Pertinence** : bonne idée d'onboarding, mauvais modèle d'organisation.

### Décision — hybride A + « programmes dérivés » (le cœur de B sans sa dette)
1. **Blocs thématiques** (option A) : métadonnées `theme`/`papers`/`stage` dans le
   YAML + un registre `themes:` ordonné ; le mode guidé du lanceur devient une liste
   de BLOCS avec, par preset, son rang dans le protocole, son étage, ses papiers et
   son statut réel sur le dataset choisi.
2. **Programmes ciblés** (l'intention de B, en LECTURE SEULE dérivée) : un fichier
   `specs/experiment-programs.yaml` déclare les programmes (papier long, papier
   court) comme listes ordonnées de presets avec leur rôle (« fig. F5 », « écho R2 ») ;
   un endpoint calcule l'avancement de chaque item À PARTIR DES RUNS (aucune table,
   aucun état à synchroniser — la vérité reste les runs) ; un onglet « Programmes »
   affiche chaque programme avec sa progression et des actions directes (lancer /
   voir les résultats).
3. **Corrections embarquées** : le bug du sweep perdu (n°4 de l'audit) est corrigé
   dans le même lot — sans lui, ni les blocs ni les programmes ne peuvent lancer
   correctement la moitié du catalogue.

Principes UI/UX appliqués : navigation par OBJECTIF (l'onglet Programmes répond à
« que faut-il pour le papier ? ») ET par EXPLORATION (les blocs répondent à « que
puis-je tester sur ce thème ? ») ; statut visible sans clic ; jamais deux sources de
vérité ; révélation progressive (blocs repliables, détail au clic) ; cohérence avec
les patrons existants (chips de statut, Disclosure, tokens sémantiques).

## 3. Plan technique

### Backend (aucune migration)
- `pipeline-presets.yaml` : + `themes:` (id, label, description, ordre) et, par
  preset, `theme`, `papers` ([long|court]), `stage`
  (reference|criblage|confirmation|ablation). Le loader sert tel quel.
- `specs/experiment-programs.yaml` : `programs:` [{id, label, paper, goal,
  items: [{preset, role}]}].
- `claire/lab/programs.py` (miroir de `presets.py`, lecture seule, cache par chemin,
  absence de fichier ⇒ liste vide journalisée).
- `GET /projects/<slug>/lab/programs?dataset=<uuid>` → `{programs, presetStatus}` où
  `presetStatus[presetId]` = {nRuns, byStatus, lastRunAt, experimentId (le plus
  récent pour ce preset×dataset), validated (≥1 succeeded)} — calculé sur les runs
  réels du projet, filtré par dataset si fourni.
- Tests : statuts dérivés corrects (preset jamais lancé / validé / en échec /
  sweep partiel), filtre dataset, permissions lead/reviewer, fichier absent ⇒ vide.

### Frontend
- Fix sweep : `baseConfig()` fusionne `preset.sweep` dans la config (+ test qui
  verrouille : un preset à sweep produit une config avec `sweep`, l'estimation
  annonce nRuns > 1).
- Lanceur guidé par blocs : regroupement par `theme` (registre ordonné), chaque ligne
  = libellé + cible + durée + rang protocole + étage + badges papier + chip de statut
  (jamais lancé / validé / en cours / échec) via `presetStatus`.
- Onglet « Programmes » (`ProgramsPanel`) : une carte par programme — badge papier,
  objectif, barre de progression (validés/total), liste d'items : rôle, statut, action
  « Lancer » (ouvre le lanceur pré-sélectionné sur le preset + dataset) ou
  « Résultats » (lien vue d'expérience agrégée).
- Plomberie : `ExperimentLauncher` accepte `initialPresetId` ; `LabWorkspace` route
  l'action « Lancer » du programme vers l'onglet Expériences avec le preset armé.
- Tests vitest : fusion du sweep, regroupement par blocs + chips, ProgramsPanel
  (progression, actions, états), non-régression lanceur/liste.

### Portes de validation
pytest backend complet ; vitest complet + tsc + lint + anti-hex + build ; revue
rapide du diff ; déploiement vérifié (ligne « Déploiement OK » + sha).

## 4. Hors périmètre (assumé)
- Création/édition de programmes depuis l'UI (l'option B complète) — les programmes
  changent au rythme des papiers, par le YAML, sous revue git.
- Orchestration automatique (« lancer tout le programme ») — à décider en phase
  scientifique : un programme lance des heures de GPU, le geste doit rester conscient.
- Portes bloquantes entre items (« l'étage 2 exige l'étage 1 ») — affichées comme
  information (rang, étage), pas imposées.
