# Stratégie de fiabilité — activer les calculs réels sur Grid'5000

**Mise à jour du 15 août 2026 : les 6 Paliers sont exécutés et validés en conditions
réelles.** Paliers 1-5 (fiabilité technique) + tests intensifs ayant révélé un 8ᵉ bug
réel (états OAR transitoires mal interprétés) + **Palier 6 « le vrai test »** exécuté
à pleine échelle sur Grid'5000 (Legal-BERT fine-tuning, GPU V100, lyon/gemini) —
premier résultat scientifique réel obtenu, révélant au passage un 9ᵉ bug mineur
(cluster `grouille`/nancy classé exotic, comme `gemini` l'avait été) et une saturation
réelle de cluster (2 jours de file sur `grouille`, contournée en changeant de
site/cluster). Voir le journal en fin de document pour le détail complet.

Ce document est à l'origine un **plan d'action**, pas un journal d'exécution — sa
première version (ci-dessous) ne décrivait rien d'encore exécuté. Il reprend et englobe
la checklist tactique déjà écrite
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

## Journal d'exécution

### 14 août 2026 — Paliers 1, 2, 3

**Préparation** : deux prérequis manquants découverts en vérifiant la checklist §3
avant de rien réserver — aucun des deux n'était anticipé par la version initiale de ce
document :
1. **Aucun environnement Python n'avait jamais été provisionné sur Grid'5000.**
   `Grid5000Backend` suppose un environnement conda nommé `pactiva-lab` déjà présent sur
   le site visé — le code ne l'installe jamais lui-même. Provisionné manuellement par
   site (`module load conda && conda create -n pactiva-lab && pip install -e
   pactiva-src[sklearn]`), à répéter pour chaque nouveau site utilisé (le `home`
   Grid'5000 n'est PAS partagé entre sites, voir bug ci-dessous).
2. **Charge des sites** vérifiée via l'API `sites/<site>/status` avant de choisir
   (Nantes 88 % libre au moment du test — mais écarté ensuite, voir plus bas).

**Palier 1 — trois tentatives, deux bugs réels corrigés avant le premier succès :**

| Tentative | Site | Résultat | Cause |
|---|---|---|---|
| 1 | nantes | Échec à la soumission (500 OAR, `queue 'abaca' does not exist`) | Particularité de configuration côté Nantes, hors de notre contrôle — jamais reproduite ailleurs. Aucune ressource réservée (refusé avant allocation). |
| 2 | rennes | Job réellement alloué (job OAR `4018437`) puis échec immédiat : `cd: ~/pactiva/runs/<id>: No such file or directory` | **Bug réel n°1** : `RUN_DIR="{workdir}/runs/{id}"` avec un tilde entre guillemets doubles — bash ne l'étend jamais dans ce contexte. Corrigé (`$HOME` substitué en Python), déployé (`1a96d1d`), 2 tests de non-régression. |
| 3 | nancy | ✅ **Succès complet** (job OAR `6852543`) | — |

En creusant la tentative 1 (avant même de retenter), un second bug a été trouvé par
sondage direct du frontal `access.grid5000.fr` (lecture seule, coût nul) : **le `home`
Grid'5000 est propre à CHAQUE site, jamais partagé** — `~` bare sur le frontal pointe son
propre disque local (974 Mo, écriture refusée), pas le home d'un site. `workdir` bare
utilisé tel quel comme cible rsync aurait fait échouer le transfert ou poussé les
fichiers là où aucun nœud n'aurait pu les voir. Corrigé (`_access_path()`, deux chemins
distincts pour la perspective nœud vs frontal), déployé (`bdf0316`), 5 tests.

**Palier 1, résultat final (site nancy, job `6852543`)** :
- `queued → waiting → running → succeeded`, **31 secondes de calcul réel** (walltime
  demandé : 5 min — large marge).
- `results.json` valide : `macro_f1=0.448`, `kappa=0.481`, empreinte d'environnement
  complète (`python 3.12.13`, `scikit-learn 1.9.0`, `numpy 2.5.2`, `gpu.available:
  false` — cohérent, aucun GPU demandé).
- `externalJobId` UI (`6852543`) confirmé identique à `oarstat -f -j 6852543` côté
  Grid'5000 (`state = Terminated`, `owner = ejebbari`, `walltime = 0:5:0`).
- `oarstat -u ejebbari` vide après coup — aucun job orphelin.

**Palier 2 — annulation en vol (site nancy, job `6852549`)** : run relancé avec
`walltime=00:03`, annulation demandée 2 s après le passage en `running` (au lieu des
10-20 s prévus — le run était trop rapide pour attendre plus sans risquer de le
manquer). **Passage à `cancelled` en 2 secondes.** Vérifié côté Grid'5000 :
`oarstat -f -j 6852549` → `state = Terminated` — confirme que le job a été réellement
arrêté sur la plateforme, pas seulement marqué annulé côté Pactiva. C'est la validation
en conditions réelles du correctif du 11 août 2026 sur `_wait_remote`
(annulation cross-process, `11_RUNBOOK_SONNET5.md` Lot 1).

**Palier 3 — aucun job orphelin** : `oarstat -u ejebbari` vide après les Paliers 1 et 2,
sur le site nancy. ✅.

### 14 août 2026 — Palier 4 (GPU minimal)

**Préparation** — deux problèmes supplémentaires trouvés en sondant un vrai nœud GPU
(cluster gemini, site lyon, V100-SXM2-32GB, avant toute soumission via l'application) :

1. **`queue 'abaca' does not exist`, reproduit ici aussi** (déjà vu au Palier 1 sur
   nantes) — cette fois via `oarsub` brut sur lyon, confirmant que ce n'est PAS
   spécifique à un site : c'est une résolution de queue par défaut cassée pour ce
   compte. Contournée par `-q default` explicite. **Bug réel n°3, corrigé dans le code
   applicatif** : `g5k_client.submit()` n'envoyait jamais de `queue` dans le payload —
   ajouté, toujours envoyé désormais (déployé `97c3d02`, 4 tests).
2. **`gemini` classé "exotic"** côté Grid'5000 malgré son statut "vérifié" dans notre
   catalogue — `oarsub` a explicitement demandé `-t exotic`. Ajouté un booléen de
   config `compute.g5k.exotic` (même commit).
3. **`torch.cuda.is_available()` peut renvoyer `True` sur un GPU que le build PyTorch
   installé ne sait pas exploiter** — l'environnement initial (`torch==2.13.0+cu130`)
   détectait la V100 (compute capability 7.0) mais n'embarquait aucun noyau compilé
   pour cette CC (le build cu130 cible CC ≥7.5). Notre garde-fou GPU applicatif ne
   teste QUE `is_available()` — il ne l'aurait donc PAS attrapé. Corrigé manuellement
   pour ce lot en réinstallant `torch==2.13.0+cu126` (confirmé par un vrai produit
   matriciel exécuté sur la V100, pas seulement `is_available()`) ; **non corrigé dans
   le code applicatif** — noté en risque résiduel ci-dessous.
4. **`GLIBCXX_3.4.29' not found`** — le libstdc++ SYSTÈME du nœud est plus ancien que
   celui qu'attendent numpy/torch de l'environnement conda, même quand l'environnement
   embarque bien une version compatible. Sans correctif, ce n'est pas seulement le run
   qui échoue : c'est le GARDE-FOU GPU LUI-MÊME qui plante (il importe torch pour se
   vérifier), avec une trace Python cryptique au lieu d'un code d'erreur propre.
   **Bug réel n°4, corrigé dans le code applicatif** : `LD_LIBRARY_PATH` explicite
   ajouté à `build_run_script()`, avant le garde-fou (déployé `3d25272`, 1 test).

**Palier 4, résultat final (site lyon, cluster gemini, job `2058813`)** — lancé via
l'application réelle (`queue_run`), preset `legal-bert-finetune` réduit pour la
validation (1 époque au lieu de 8, `k=2` au lieu de 5, `walltime=00:15` au lieu de
`03:00`) :
- `queued → waiting → running → succeeded`, **593 secondes (9,9 min) de calcul réel**
  sur les 15 min de walltime demandées.
- `results.json` valide : `macro_f1=0.429`, `kappa=0.531`, `ece=0.163`. Empreinte
  d'environnement confirmant l'usage RÉEL du GPU (pas un repli silencieux CPU, le
  risque documenté §5 de l'audit d'origine, `05_MONITORING_ML_GPU.md` §4.3) :
  `gpu.available: true, device: "Tesla V100-SXM2-32GB"`, `torch: "2.13.0+cu126"`.
- `externalJobId` confirmé identique côté `oarstat -f -j 2058813`
  (`state = Terminated`), et surtout : `initial_request` montre
  `--queue=default ... --type=exotic` — la preuve que les DEUX correctifs (n°3 et n°4)
  fonctionnent bien via le code applicatif réel, pas seulement en test manuel.
- `oarstat -u ejebbari` vide après coup — aucun job orphelin.

**Risque résiduel non corrigé** : le garde-fou GPU applicatif (`nvidia-smi` +
`torch.cuda.is_available()`) ne détecte PAS un désaccord de compute capability
(bug n°3 ci-dessus) — seulement l'absence totale de GPU. Un futur run sur un cluster
plus récent que le build PyTorch installé échouerait au moment du calcul réel (erreur
CUDA "no kernel image"), pas au garde-fou. Non traité dans ce lot : nécessiterait de
vérifier `torch.cuda.get_device_capability()` contre les CC supportées par le build
installé, une vérification plus fine que ce que le garde-fou fait aujourd'hui.

### 14 août 2026 — Palier 5 (garde-fou de sweep) — le bug le plus sérieux de la série

**Refus sans force** : sweep de 4 variantes (`/model/ngram_max: [1,2,3,4]`, CPU,
`tfidf_linear`, cible G5K délibérément choisie légère — la mécanique du garde-fou de
sweep est indépendante du type de calcul, pas besoin de 4 fine-tunings GPU pour la
valider) → `400 g5k_sweep_too_large` immédiat, **0 run créé**, `oarstat` confirmé vide.
Exactement le comportement attendu.

**Avec force=true** : **incident de méthode** (pas un bug applicatif) — le premier
appel `curl` a réussi côté serveur (4 runs créés) mais sa réponse ne s'est pas affichée
localement ; en relançant pour comprendre pourquoi, un second appel a créé 4 runs
supplémentaires (`force=true` contourne délibérément la déduplication par empreinte,
donc rien n'a bloqué le doublon). Au final 8 runs réels au lieu de 4 — sans
conséquence sur la validation du garde-fou lui-même (chaque appel a bien créé
exactement les 4 runs demandés, indépendamment suivis, `ngram_max` correctement
distribué 1/2/3/4 dans chaque lot).

**Ce que ces 8 runs réels ont révélé, en revanche, est le bug le plus sérieux trouvé
dans toute cette série** : 5 runs sur 8 ont échoué avec `result_missing` — alors que
`results.json` ET `_SENTINEL` existaient bel et bien côté Grid'5000 pour l'un d'eux
(vérifié à la main : le job avait même imprimé ses métriques finales dans son propre
stdout OAR). **Un résultat réellement calculé, silencieusement porté disparu** —
exactement le risque que `§4 Garantie de récupération des résultats` de ce document
existe pour prévenir, désormais confirmé en conditions réelles plutôt qu'hypothétique.

Cause : `_wait_remote` déclenche le rapatriement dès que l'état OAR passe à "stopped",
sans délai de grâce — alors que le job tourne sur un NŒUD DE CALCUL et que le rsync
part du FRONTAL `access.grid5000.fr`, deux montages NFS distincts dont la cohérence
"close-to-open" n'est pas instantanée. **Bug réel n°5, corrigé** : nouvelle tentative
bornée (3 essais, `LAB_FETCH_RETRIES`) du rapatriement complet tant que `results.json`
n'apparaît pas localement — déployé (`9853f44`), 3 tests (dont un qui verrouille
l'absence de coût dans le cas normal : un seul appel quand le résultat est déjà là).

Après correctif : `oarstat -u ejebbari` vide sur nancy ET lyon — aucun job orphelin
malgré le doublon de méthode et les 5 échecs.

**Non exécuté** : Palier 6 (le vrai test, à pleine échelle) — nécessite un accord
explicite séparé, pas encore demandé à ce stade.

### 14 août 2026 — Tests intensifs post-Palier 6 : bug n°8, le plus profond de la série

Après les six paliers ci-dessus (tous verts, y compris le Palier 6 redéfini par la
revue scientifique et exécuté en local plutôt que sur Grid'5000 — voir la revue
`wsi2cfn5w`), l'utilisateur a explicitement demandé une validation plus poussée :
« enchaine sur des testes intensifs sur Grid5000 pour bien tout valider ». Objectif :
épuiser volontairement le walltime d'un run réel pour vérifier bout en bout le
mécanisme d'ingestion partielle (bug n°7, §Palier 5 ci-dessus).

**v1/v2 (`embeddings_head`, e5-large-v2)** : échecs, mais dus à mon propre
provisioning incomplet de l'environnement conda `nancy` (`sentence_transformers`
jamais installé) — pas un bug applicatif, diagnostiqué via `MissingDependency` dans le
stderr OAR.

**v3/v4 (`tfidf_linear`, `walltime=00:00:12`)** : le job **6852994** (run
`63f251ac`) a échoué en `result_missing` **13 secondes** après sa soumission. Vérification
directe sur Grid'5000 (`oarstat -f -j 6852994`, stdout/stderr OAR, répertoire distant
`results/`) : le job a réellement tourné et terminé **normalement** —
`state=Terminated, exit_code=0`, 31 secondes réelles, `results.json` COMPLET et
valide déjà présent (`macro_f1=0.44027, micro_f1=0.508674`, IC 95%
`[0.411169, 0.470997]`), `_SENTINEL` présent. **Un résultat entièrement calculé et
valide, déclaré manquant par notre propre système** — le même symptôme que le bug n°5
(Palier 5), mais le budget de nouvelles tentatives déjà en place (`LAB_FETCH_RETRIES`,
3×3s) n'a rien pu faire : l'écart de log (`journalctl` ne montrait AUCUNE entrée sur la
fenêtre où j'avais d'abord cherché, à cause d'un décalage de fuseau horaire entre mes
propres recherches en heure locale CEST et les journaux systemd en UTC — pas une
anomalie du worker) a orienté l'investigation vers le VRAI journal (`20:50:55` →
`20:51:11` UTC, soit 16 secondes de vie totale côté worker) : notre système avait
déclaré le job « stopped » et déclenché le rapatriement **avant même que le job
n'ait commencé à s'exécuter réellement** sur le nœud (le job OAR, lui, n'a démarré
son script qu'après un délai de lancement, puis a tourné 31 secondes réelles).

**Cause, bug réel n°8 — le plus profond de toute la série** : `g5k_client.py::poll()`
ne reconnaissait explicitement que les états OAR `waiting` et `running`, et mappait
TOUT le reste vers `stopped` par défaut — y compris `toLaunch`/`Launching`, les états
transitoires OAR entre la soumission et le démarrage réel du script utilisateur
(catalogués dans `docs/pactiva-g5k/research/02_OAR_KADEPLOY.md` §États). Sur un job à
walltime très court, la fenêtre de sondage adaptatif (`POLL_SCHEDULE`, dense les
premières secondes) avait de bonnes chances de tomber pile dans cette fenêtre
transitoire, la confondant avec une fin de job — expliquant pourquoi ce bug était
resté invisible sur les runs GPU à walltime de plusieurs heures (Palier 4) : la
fenêtre transitoire y est négligeable face au sondage, mais devient dominante sur un
job de quelques secondes. **C'est un bug DISTINCT du bug n°5** (course NFS
close-to-open) : celui-ci déclenchait un rapatriement prématuré alors que le job avait
déjà tourné et terminé côté nœud ; celui-ci déclenche un rapatriement avant même que
le job ait commencé — aucun budget de nouvelles tentatives de `fetch()` ne peut
compenser un job qui n'a simplement pas encore eu le temps de produire quoi que ce
soit.

**Fix** : inversion du défaut — `poll()` ne renvoie `stopped` que pour les états
OAR réellement terminaux (`terminated`, `error`, `toerror`, `finishing`) ; tout état
non reconnu (y compris un état futur non catalogué) reste `waiting`, jamais `stopped`
par optimisme. 5 nouveaux tests paramétrés (états terminaux vs transitoires/inconnus),
71 tests du module G5K + 769 tests backend passés, déployé (`6f447fe`, healthchecks
API+frontend 200).

**Confirmation en conditions réelles** : ré-exécution du MÊME run exact (job 6853020,
run `62f40a50`, même config `tfidf_linear`/`walltime=00:00:12`/nancy) après déploiement
du correctif. Journal worker : `lab_run_started` → `g5k_submitted job=6853020` →
`lab_run_ingested status=partial`, **44 secondes** de vie totale (contre 16 secondes
avant le fix). Détail de l'API : `phase` passe correctement par `running` (jamais
observé avant le fix), le walltime a bien coupé le job après 3 folds sur 5, et le
mécanisme d'ingestion partielle (bug n°7) a récupéré des métriques réelles et valides
(`macroF1=0.422346, kappa=0.452863`, 3 `perFold`) au lieu d'un `result_missing`. Les
bugs n°7 et n°8 se corrigent mutuellement dans ce scénario précis : n°8 empêchait
d'atteindre honnêtement la fin du walltime, n°7 empêchait de garder ce qui avait été
calculé une fois qu'on l'atteignait.

### 15 août 2026 — Palier 6 « le vrai test » : Legal-BERT fine-tuning (confirmatoire)

Avant de lancer un fine-tuning GPU à pleine échelle (walltime `03:00`, le premier
résultat scientifique visé pour l'article JURIX), relecture de `docs/pactiva-lab/` +
inspection des résultats déjà obtenus par la batterie locale « Palier 6 » (criblage,
embeddings gelés, courbe d'apprentissage, juges LLM — tous exécutés et verts avant
compaction de contexte). **Constat inattendu** : le meilleur run *embeddings gelés*
(e5-large-v2 + SVM linéaire, aucun fine-tuning, coût CPU local) atteint
`macroF1=0.495306`, quasi identique au plafond humain approximatif calculé par le
pipeline lui-même (`humanCeiling.value=0.494978`, taux d'accord strict). Signal fort
qu'un fine-tuning GPU pourrait ne rien gagner.

Décision (validée avec l'utilisateur) : lancer `legal-bert-finetune` quand même, mais
recadré comme test **confirmatoire** plutôt qu'exploratoire — soit il confirme
l'absence de gain (résultat négatif publiable, justifie l'usage d'embeddings gelés
dans l'article pour son rapport coût/bénéfice), soit il révèle un gain que
l'approximation du plafond humain sous-estimait (le plafond exact demanderait un
dataset `aggregation='soft'`, pas encore construit).

**Préconditions vérifiées avant soumission** : worker `active`, file `queued`/
`waiting`/`running` vide (0/0/0), `oarstat -u ejebbari` vide sur nancy et lyon.
**Aucun déploiement ne sera effectué pendant la fenêtre du run** — le worker redémarre
inconditionnellement sur chaque `deploy-claire.sh`, ce qui tuerait un job GPU de 3h en
vol sans annulation côté G5K (point bloquant remonté par la revue de fiabilité
pré-Palier 6, `wsi2cfn5w`).

**Bug réel n°9 (mineur, même famille que le n°4)** : premier essai de soumission avec
le cluster A100 explicitement épinglé (`{cluster='grouille'}/gpu=1,walltime=03:00`,
préféré à un choix GPU non déterministe sur nancy — le catalogue exclut délibérément
`graffiti`, dont le modèle GPU est ambigu) → échec immédiat `g5k_unreachable`,
`400 Bad query : "Filtering out exotic resources (grouille)"`. Comme `gemini`/lyon
(bug n°4), `grouille`/nancy est ÉGALEMENT classé exotic côté Grid'5000 en ce moment —
non documenté par le catalogue statique (`g5k-gpu-clusters-catalogue.json`, marqué
« vérifié » mais sans le champ `exotic`), confirmant la mise en garde du fichier
lui-même : cette classification change côté Grid'5000 et n'est pas une propriété fixe
par cluster. Corrigé en ajoutant `compute.g5k.exotic: true` — job resoumis avec
succès (`externalJobId=6853275`, statut `waiting` confirmé immédiatement après
soumission).

**Run `1baf9943` (nancy/grouille, corrigé) resté bloqué en file` réel — pas un bug** :
`oarstat -f -j 6853275` : `state = Waiting`, `message = FIFO scheduling OK`, mais
`scheduled_start = 2026-08-17 08:31:01` — plus de 2 jours après la soumission.
`grouille` n'a que 2 GPU A100 au total (catalogue), manifestement tous réservés par
d'autres équipes pour la fenêtre visée. Conforme au playbook §6 de ce document
(« ne jamais laisser courir indéfiniment ») : run annulé via l'API
(`POST .../cancel`) plutôt que laissé en attente. Le worker a bien vu
`cancel_requested`, annulé le job côté OAR (`oarstat -u ejebbari` vide sur nancy après
coup — aucun orphelin) et libéré le process pour le run suivant — **seule
observation mineure** : `_wait_remote` n'écrit aucune ligne de log en cas d'annulation
réussie (seulement en cas d'échec de l'annulation), rendant ce chemin silencieux à
tort dans `journalctl` ; pas un bug fonctionnel, juste une lacune d'observabilité, non
corrigée dans ce lot.

**Resoumission sur `lyon`/`gemini`** (déjà validé de bout en bout au Palier 4 : V100
32 Go × 8, `exotic` requis, `LD_LIBRARY_PATH`/GLIBCXX déjà corrigés) plutôt que de
retenter nancy à l'aveugle — cluster explicitement épinglé
(`{cluster='gemini'}/gpu=1,walltime=03:00`) pour éviter les deux autres clusters GPU
de lyon, non vérifiés (`sirius` A100, `hydra` GH200). Vérification immédiate avant de
laisser tourner : `oarstat -f -j 2058963` → `state = Running`,
`start_time = submission_time` (démarrage immédiat, aucune contention), nœud
`gemini-1.lyon.grid5000.fr`. Run `8ae3bcb9-82ac-43d5-85cb-f1eaa29fc7fd`, transition
`waiting`→`running` confirmée par notre propre système immédiatement après soumission
(bug n°8 tient bon sur un job réel, pas seulement sur le job-jouet de 12 secondes qui
l'avait révélé).

**Résultat — succeeded, ~44 min de bout en bout (30 min de calcul GPU réel sur les
3h de walltime allouées)** :

| | macroF1 | κ | IC 95% macroF1 |
|---|---|---|---|
| Embeddings gelés (e5-large-v2 + SVM, CPU, sans fine-tuning) | 0.4953 | 0.563 | [0.460, 0.540] |
| **Legal-BERT fine-tuné (GPU, ce run)** | **0.5155** | **0.601** | **[0.482, 0.558]** |
| Plafond humain (approximation, taux d'accord strict) | 0.4950 | — | — |

**Interprétation scientifique** : le fine-tuning apporte un gain de +0.020 macroF1,
mais les deux intervalles de confiance à 95% se chevauchent largement — la
différence n'est PAS statistiquement significative à cette taille d'échantillon
(39 documents). Les deux approches dépassent légèrement le plafond humain
approximatif. C'est un résultat confirmatoire honnête, exactement celui anticipé par
l'analyse pré-run : ni un gain spectaculaire qui justifierait le fine-tuning à lui
seul, ni un résultat nul pur — un signal faible et statistiquement incertain qui
penche en faveur des embeddings gelés pour le rapport coût/bénéfice (CPU local,
quelques minutes contre GPU dédié, 30 min). Empreinte d'environnement confirmant
l'usage RÉEL du GPU (pas de repli CPU silencieux, le risque documenté §5) :
`gpu.available: true, device: "Tesla V100-SXM2-32GB", torch: "2.13.0+cu126"` — le
même build CUDA déjà validé au Palier 4, aucun problème de compatibilité de compute
capability rencontré sur ce run malgré le risque résiduel documenté à l'époque.

`oarstat -u ejebbari` vide sur lyon ET nancy après coup — aucun job orphelin, malgré
le double changement de site/cluster de cette session de Palier 6.

**Palier 6 clos.** Premier résultat scientifique réel obtenu sur Grid'5000,
directement exploitable pour l'article JURIX : les embeddings gelés suffisent à
approcher le plafond humain sur ce jeu de données, le fine-tuning Legal-BERT
n'apporte pas de gain statistiquement démontrable à cette échelle d'annotation.
