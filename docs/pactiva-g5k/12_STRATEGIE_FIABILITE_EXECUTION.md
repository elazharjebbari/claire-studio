# Stratégie de fiabilité — activer les calculs réels sur Grid'5000

Ce document est un **plan d'action**, pas un journal d'exécution : rien ci-dessous n'a
été exécuté. Il reprend et englobe la checklist tactique déjà écrite
(`11_RUNBOOK_SONNET5.md` §Étape 10, étapes 10.5 à 10.12, restées non exécutées) dans
une stratégie de fiabilité complète — observabilité, garanties de récupération des
résultats, points d'arrêt explicites — plutôt que de la dupliquer.

**Rappel du principe qui gouverne tout ce document** : Grid'5000 est une plateforme de
recherche **partagée**. Chaque réservation, même de 5 minutes, retire une ressource à
d'autres équipes. « Très très fiable » ne veut donc pas seulement dire « qui aboutit »
— cela veut dire : **jamais de job orphelin**, jamais de réservation dont on ignore
l'issue, jamais un résultat déclaré « récupéré » sans preuve.

**Aucune étape de ce document ne sera exécutée sans confirmation explicite de
l'utilisateur, à chaque palier.** Un aller simple pour dire « vas-y » ne vaut pas pour
tous les paliers suivants — chacun consomme une ressource réelle différente (CPU 5 min
≠ GPU 3 h), et l'utilisateur doit pouvoir arrêter la progression à tout palier sans
que le suivant soit présumé acquis.

---

## 1. Ce qui rend un run « fiable », concrètement

Quatre garanties, dans cet ordre — chacune est un prérequis de la suivante, pas une
liste d'options :

1. **On sait toujours ce qui tourne réellement où.** Livré ce jour même
   (`docs/pactiva-lab-ui/04_CIBLE_CALCUL.md`) : badge Local/Grid'5000 partout,
   identifiant de job OAR affiché. Sans ça, un run bloqué est indistinguable d'un run
   qui progresse normalement.
2. **On sait quand s'arrêter d'attendre.** Chaque palier ci-dessous a un `walltime`
   **délibérément court** — jamais le walltime de production dès le premier essai. Un
   run de validation qui prend plus de 2× son walltime déclaré est un échec de
   fiabilité, pas une lenteur à tolérer.
3. **On sait que le résultat récupéré EST le bon résultat.** Une réponse HTTP 200 ou un
   statut `succeeded` ne suffit pas — voir §4, vérification post-récupération.
4. **On ne laisse jamais une ressource réservée sans supervision active.** Chaque
   palier qui réserve une ressource se termine par une vérification explicite côté
   Grid'5000 (`oarstat`) que plus rien ne tourne pour ce compte — pas seulement que
   l'UI Pactiva affiche un statut terminal.

## 2. Paliers — du moins coûteux au plus coûteux

Chaque palier a un **coût** (ce qu'il consomme réellement sur la plateforme), un
**critère de réussite** vérifiable (pas « ça a eu l'air de marcher »), et un
**arrêt obligatoire** avant le suivant tant que l'utilisateur n'a pas donné un accord
explicite pour CE palier précisément.

### Palier 0 — déjà fait, rappel pour mémoire
Identifiants API + SSH enregistrés et testés (lecture seule, aucune réservation).
✅ Fait, voir `11_RUNBOOK_SONNET5.md` Lot 2.

### Palier 1 — un run CPU minimal, walltime 5 minutes
Reprend 10.5-10.7. Dataset minimal (1-2 documents), preset `baseline-fast` MAIS avec
`compute.target` forcé à `g5k` (le preset par défaut cible `local` — c'est la
config qui compte, pas le nom du preset), `compute.g5k.resources: "walltime=00:05"`,
site choisi **après vérification de charge** (Monika ou `https://intranet.grid5000.fr`
— jamais le premier site venu).

- **Coût réel** : un nœud CPU réservé ≤5 minutes.
- **Réussite** : le run passe `queued → waiting → running → succeeded` sans
  intervention manuelle, ET l'`externalJobId` affiché dans l'UI correspond exactement à
  l'identifiant vu côté `oarstat -u <login>` pendant l'exécution.
- **Échec informatif, pas un blocage** : si le run passe à `failed`, le `error_code`
  affiché (`g5k_auth_failed`, `g5k_transfer_failed`, `g5k_unreachable`, `g5k_timeout`)
  doit pointer sans ambiguïté vers la cause — sinon c'est un défaut d'observabilité à
  corriger AVANT de retenter, pas à contourner.

### Palier 2 — annulation en vol
Reprend 10.8. Un second run CPU similaire, walltime ≥2 min, annulé depuis l'UI 10-20 s
après le passage en `running`.

- **Coût réel** : un nœud réservé puis libéré avant terme.
- **Réussite** : passage à `cancelled` en moins de 2× l'intervalle de sondage du worker
  — **c'est le test qui vérifie en conditions réelles le correctif du 11 août 2026 sur
  `_wait_remote`** (annulation demandée depuis un process différent de celui du worker,
  cf. Lot 1). Sans lui, un job de plusieurs heures cliqué « Annuler » ne s'arrêterait
  jamais avant son walltime naturel — le pire scénario de fiabilité possible.

### Palier 3 — vérification d'absence de job orphelin
Reprend 10.9. Après les paliers 1 et 2 : `oarstat -u <login>` doit renvoyer une file
**vide** pour ce compte.

- **Coût réel** : aucun (vérification).
- **Réussite** : file vide. **Bloquant absolu** — si un job traîne encore, il doit être
  annulé manuellement (`oardel`) et la cause du non-nettoyage automatique diagnostiquée
  avant de considérer les paliers 1-2 comme acquis, quel qu'ait été leur statut Pactiva.

### Palier 4 — un run GPU minimal
Reprend 10.10. `legal-bert-finetune` (le preset GPU le plus léger), sur le plus petit
dataset possible, cluster suggéré par le panneau « Cluster recommandé »
(`ExperimentLauncher.tsx`, § `docs/pactiva-lab-ui/04_CIBLE_CALCUL.md`), **`walltime`
réduit délibérément** (ex. `00:15`, pas les `03:00` du preset par défaut — un préset
sert de point de départ, sa config reste éditable en mode expert avant de créer
l'expérience).

- **Coût réel** : un GPU réservé, la ressource la plus contendue de la plateforme.
  **C'est le palier qui justifie à lui seul de ne rien précipiter avant lui.**
- **Réussite** : le garde-fou GPU embarqué dans le script d'exécution
  (`nvidia-smi` puis `torch.cuda.is_available()`, codes de sortie 64/65,
  `runners/g5k.py`) ne se déclenche PAS en faux positif — et surtout, s'il devait se
  déclencher (mauvaise version CUDA sur le nœud alloué), le run doit finir en `failed`
  avec un message explicite, jamais tourner silencieusement sur CPU pendant tout le
  walltime sans que personne ne le sache (c'est exactement le risque que ce garde-fou
  a été écrit pour éliminer).

### Palier 5 — garde-fou de sweep
Reprend 10.11-10.12. `encoders-comparison` (4 variantes) sans `force`, puis avec
« Continuer quand même ».

- **Coût réel** : le refus initial, aucun ; l'acceptation forcée, jusqu'à 4 GPU.
- **Réussite** : 400 `g5k_sweep_too_large` sans qu'AUCUN job ne soit créé côté G5K
  (vérifié par `oarstat`, pas seulement par l'absence d'erreur réseau) ; puis, avec
  force, exactement 4 runs créés et suivis indépendamment.

### Palier 6 — « le vrai test »
Seulement après les 5 paliers précédents au vert **et** un nouvel accord explicite,
spécifique à ce palier. Une expérience à walltime de production réel (les `03:00`/
`06:00` déclarés dans les presets), sur un dataset représentatif — le premier résultat
scientifique réellement exploitable pour l'article JURIX.

- Avant ce palier : relire `docs/pactiva-lab/` (les plans scientifiques déjà écrits,
  Q1-Q5, protocole en deux étages criblage→confirmation) pour choisir l'expérience qui
  a le plus de valeur à être la première — ne pas la choisir par défaut de liste.

---

## 3. Ce qui doit être vrai AVANT de proposer le Palier 1 à l'utilisateur

Cette section est une checklist de préparation, pas un palier en soi — c'est ce que je
vérifierai moi-même avant de demander l'autorisation du Palier 1, pour ne pas faire
perdre de temps à l'utilisateur sur un blocage évitable :

- [ ] Le worker (`claire-studio-lab-worker`) est `active` en prod (vérifié en direct
      avant chaque palier, pas supposé stable depuis le dernier déploiement).
- [ ] Aucun run `queued`/`waiting`/`running` préexistant n'encombre la file (un run
      oublié d'une session précédente fausserait l'interprétation d'un nouveau statut).
- [ ] Le site Grid'5000 visé a une charge raisonnable au moment du test (Monika) — ne
      pas réserver sur un site déjà saturé, ce qui allongerait `waiting` sans rapport
      avec la fiabilité du pipeline lui-même.
- [ ] Le dataset minimal utilisé pour les paliers 1-2 existe déjà ou est trivial à
      construire (1-2 documents, `maturity=any` pour ne pas dépendre de l'état
      d'annotation de la vraie campagne).

## 4. Garantie de récupération des résultats

Un `status=succeeded` ne suffit pas à garantir qu'un résultat est exploitable. Avant de
considérer un run comme réellement terminé avec succès :

1. **`results.json` existe et respecte le schéma attendu** — pas seulement présent,
   mais parseable et contenant au minimum `task`, `metrics`, `environment`. Le code
   d'erreur `result_missing` (déjà rencontré et corrigé cette session pour les runs
   locaux) existe précisément pour le cas où ce n'est pas vrai — le même contrôle
   s'applique à un run G5K rapatrié par SSH.
2. **`environment` contient une empreinte cohérente** (version CUDA, modèle GPU,
   hash du dataset) — un résultat sans cette traçabilité n'est pas reproductible, donc
   pas publiable.
3. **Le rapatriement SSH est vérifié, pas supposé** — `Grid5000Backend.fetch()`
   (`runners/g5k.py`) doit confirmer la présence du fichier sentinelle après rsync,
   pas seulement l'absence d'erreur de la commande `rsync` elle-même (une commande qui
   réussit sur un répertoire vide est un succès silencieux trompeur).
4. **Pour un run `partial`** (walltime atteint avant la fin) : les plis déjà calculés
   doivent être présents et exploitables individuellement — un `partial` qui ne
   contient en réalité aucun pli complet est un `failed` mal étiqueté, à corriger
   avant de faire confiance à ce statut pour le palier 6.

## 5. Observabilité pendant un run réel

Pendant les paliers 1-6, surveiller en parallèle (pas seulement l'UI Pactiva) :
- `oarstat -u <login>` côté Grid'5000 — état réel de la réservation.
- `journalctl -u claire-studio-lab-worker -f` côté VPS — le worker traite bien le run
  attendu, aucune exception non gérée.
- L'`externalJobId` affiché dans l'UI (livré ce jour) doit correspondre à l'identifiant
  vu par `oarstat` — la première vérification de cohérence, avant même de regarder les
  métriques scientifiques.

## 6. Playbook d'échec

| Symptôme | Diagnostic | Action |
|---|---|---|
| Run bloqué en `waiting` très au-delà du raisonnable | file d'attente Grid'5000 longue sur le site choisi | vérifier Monika ; annuler et retenter sur un site moins chargé — ne jamais laisser courir indéfiniment « au cas où » |
| `failed` avec `g5k_transfer_failed` | rapatriement SSH interrompu | vérifier la connectivité SSH (`ssh access.grid5000.fr`) ; ne PAS relancer aveuglément — un échec de transfert répété peut indiquer une clé expirée côté G5K |
| `failed` avec le garde-fou GPU (code 65) | le nœud alloué n'a pas le CUDA attendu | changer de cluster (voir catalogue GPU) ; documenter le cluster fautif pour l'écarter des recommandations futures |
| `partial` avec zéro pli exploitable | walltime trop court pour même un seul pli | ne pas compter ce run comme un signal de fiabilité positif ; ré-estimer le walltime nécessaire avant de retenter |
| Job visible dans `oarstat` mais absent de l'UI Pactiva | désynchronisation worker/G5K | ne jamais `oardel` sans d'abord comprendre pourquoi le worker ne le voit pas — pourrait indiquer un bug de reprise après redémarrage du worker |

## 7. Ce que ce plan ne couvre pas (délibérément)

- **Optimisation de coût/performance** (choix du cluster le plus rapide plutôt que le
  moins chargé) — une fois la fiabilité acquise, pas avant.
- **Automatisation complète du choix de site/walltime** — chaque palier reste une
  décision explicite pendant cette phase de validation ; l'automatiser viendrait après,
  une fois un historique de runs réels réussis accumulé.
- **Nettoyage de la `ForeignKey` `Experiment.compute_target` inutilisée** (notée dans
  `docs/pactiva-lab-ui/04_CIBLE_CALCUL.md`) — une migration de données, à traiter
  séparément, sans rapport avec la fiabilité d'exécution elle-même.
