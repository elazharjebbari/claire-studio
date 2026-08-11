# Grid'5000 — Ordonnanceur OAR et déploiement d'environnements (Kadeploy)

> Recherche effectuée le 11 août 2026, sur la documentation officielle du wiki
> `grid5000.fr/w/`, de la doc OAR (`oar.imag.fr`/`oar.readthedocs.io`) et du dépôt source
> `oar-team/oar3`. Chaque affirmation est sourcée ; les points non trouvés sont listés
> explicitement en fin de document (§7).

---

## 1. `oarsub` — syntaxe et langage de sélection de ressources

### 1.1 Principe

*« A job is defined by needed resources and a script/program to run »*
[oarsub — OAR doc](https://oar.imag.fr/docs/latest/user/commands/oarsub.html). Sur
Grid'5000, une commande `oarsub` basique alloue la première ressource disponible pour
une heure. [Getting Started](https://www.grid5000.fr/w/Getting_Started)

### 1.2 Le langage `-l` (sélection de ressources)

```
{sql1}/name1=n1/name2=n2+{sql2}/name3=n3,walltime=hh:mm:ss
```
[Advanced OAR](https://www.grid5000.fr/w/Advanced_OAR) — prédicats SQL optionnels entre
accolades, **hiérarchies** séparées par `/`, **agrégation** de blocs avec `+`, `walltime`
en dernier élément.

**Hiérarchie valide (calcul)** : `cluster|switch > chassis > host > cpu > gpu > core`.
**`nodes` (pluriel) est un alias de `host` (singulier).**
[Advanced OAR](https://www.grid5000.fr/w/Advanced_OAR)

Format du `walltime` : `[heure:min:sec|heure:min|heure]`.

### 1.3 `-p` (propriétés, syntaxe SQL WHERE)

```bash
oarsub -p "ib=FDR" -l host=5,walltime=2 -I
oarsub -q production -p grappe -l host=2,walltime=2 -I
oarsub -I -p "gpu_count >= 3" -l host=1
oarsub -I -p "cluster='graphene'" -l /host=2
```
[Getting Started](https://www.grid5000.fr/w/Getting_Started), [Advanced OAR](https://www.grid5000.fr/w/Advanced_OAR)

### 1.4 Propriétés de ressources

Page [OAR Properties](https://www.grid5000.fr/w/OAR_Properties) — plus de 60
propriétés : matériel (`core_count`, `cpu_count`, `gpu_count`, `gpu_model`, `memnode`,
`disktype`...), hiérarchie (`cluster`, `host`, `core`, `gpu`, `switch`, `vlan`),
tâche (`besteffort`, `deploy`, `production`, `max_walltime`), divers (`maintenance`,
`wattmeter`, `exotic`).

### 1.5 Types de job (`-t`)

| Type | Usage |
|---|---|
| `-I` | interactif — shell sur le premier nœud du job |
| passif | script en argument, ex. `oarsub -l host=1/core=1 "python script.py"` |
| `-t deploy` | autorise Kadeploy pour un OS personnalisé |
| `-t besteffort` | tué dès qu'un job normal a besoin des nœuds |
| `-t noop` | réserve sans rien exécuter |
| `-t exotic` | requis pour clusters à architecture non-x86 (page `/w/Exotic`
  protégée par login, non consultée intégralement) |
| `-t cosystem` + `-t container` | job « conteneur » réservant un ensemble de ressources
  en un seul `oarsub`, dans lequel on lance ensuite des jobs « inner » |
| `-t day` / `-t night` | borne le job à 9h-19h / 19h-9h (walltime max ~14h pour `night`) |

[Advanced OAR](https://www.grid5000.fr/w/Advanced_OAR)

### 1.6 Autres options importantes

- `-q <queue>` : sélectionne la file.
- `-r 'YYYY-MM-DD HH:MM:SS'` : réservation à une date future (avance reservation).
- `-C <job_id>` : se connecte à un job existant.
- `--checkpoint <secondes>` : signal `SIGUSR2` envoyé N secondes avant le walltime.
- `--array <N>` / `--array-param-file` : job tableau, un sous-job par ligne du fichier.
- `--notify` : `mail:name@domain` ou `exec:/chemin/script`.
- `-O`/`-E` : fichiers stdout/stderr (motifs `%jobid%`/`%jobname%`) ; par défaut
  `OAR.<id>.stdout`/`.stderr` en mode passif.
- `--project=<nom>` : pour un compte membre de plusieurs GGA.

Variables d'environnement du job : `$OAR_NODEFILE`, `$OAR_JOB_ID`, `$OAR_JOB_NAME`,
`$OAR_PROJECT_NAME`.

### 1.7 Mode interactif

*« In interactive mode, a shell is opened on the first default resource... the job will
be terminated as soon as the job's shell is closed or will be killed earlier if the
job's walltime is reached »* [Advanced OAR](https://www.grid5000.fr/w/Advanced_OAR).

---

## 2. Cycle de vie d'un job OAR

### 2.1 États — définitions exactes

Source : [Database scheme — OAR 2.5](https://oar.readthedocs.io/en/2.5/admin/database-scheme.html)

| État | Signification |
|---|---|
| **Waiting** | en attente de décision du scheduler |
| **Hold** | mis en pause par l'utilisateur/admin (`oarhold`) |
| **toLaunch** | ressources attribuées, sur le point d'être lancé |
| **toError** | quelque chose s'est mal passé |
| **toAckReservation** | le scheduler doit répondre OUI/NON à une réservation |
| **Launching** | la commande utilisateur va s'exécuter |
| **Running** | la commande utilisateur s'exécute |
| **Suspended** | suspendu (`oarhold -r`), d'autres jobs peuvent utiliser les ressources |
| **Finishing** | la commande a terminé, OAR nettoie |
| **Terminated** | terminé normalement |
| **Error** | un problème s'est produit |

Mapping court affiché par `oarstat` (source `oar3`, `oarstat.py`) : W=Waiting, L=Launching,
R=Running, T=Terminated, E=Error, F=Finishing, S=Suspended.

Côté **API REST**, les valeurs observées de `state` sont en minuscules :
`waiting`, `running` (voir `03_API_REST.md`) — nomenclature légèrement différente de
celle de la base OAR interne ci-dessus, **à normaliser/mapper côté architecture**.

### 2.2 `oarstat` — consulter

`oarstat -u` : jobs de l'utilisateur courant. `oarstat -fj <ID>` : détail complet.

### 2.3 `oardel` — annuler

```bash
oardel 12345
oardel -c 12345          # checkpoint
oardel -s SIG 12345      # signal personnalisé
oardel -b 12345          # convertit en besteffort
oardel --sql "project = 'p1'"
```
[oardel — OAR 2.5 doc](https://oar.readthedocs.io/en/2.5/user/commands/oardel.html)

### 2.4 `oarprint`

```bash
oarprint host
oarprint core -P host,cpuset,memnode -F "NODE=%[%] MEM=%"
```
[Advanced OAR](https://www.grid5000.fr/w/Advanced_OAR)

### 2.5 `oarpeek` — NON confirmé

**Introuvable dans la doc officielle actuelle** (wiki, `oar.imag.fr/docs/2.5/user/commands.html`,
dépôt `oar-team/oar3`, man Ubuntu). Liste officielle des commandes utilisateur : `oarsub`,
`oardel`, `oarsh`/`oarcp`, `oarwalltime`, `oarstat`, `oarnodes`, `oarprint`, `oarhold`,
`oarresume`. **Ne pas s'appuyer sur `oarpeek`** sans vérification directe sur un frontend.

Pour suivre la sortie en direct : fichiers `OAR.<id>.stdout`/`.stderr` (mode passif),
consultables via SSH/`oarsh` (`tail -f`).

### 2.6 `oarsh` — connexion à un nœud du job

```bash
OAR_JOB_ID=JOBID oarsh node-2
```
[Advanced OAR](https://www.grid5000.fr/w/Advanced_OAR)

### 2.7 États des ressources (≠ états de job)

Nœuds : **Alive, Absent, Absent/standby, Suspected, Dead** (maintenance = Dead +
`maintenance=YES`).

---

## 3. Kadeploy — déploiement d'environnements systèmes

### 3.1 À quoi ça sert

Réinstalle un OS complet sur les nœuds (accès root pour la durée de la réservation).
Un environnement Kadeploy = image compressée + kernel + initrd (optionnel) + postinstall
(optionnel). [Advanced Kadeploy](https://www.grid5000.fr/w/Advanced_Kadeploy)

**Prérequis** : job de type `deploy` — `oarsub -I -t deploy -l nodes=1,walltime=3`.

### 3.2 ⚠️ Pour la majorité des usages ML, Kadeploy n'est PAS nécessaire

La page [Deep Learning Frameworks](https://www.grid5000.fr/w/Deep_Learning_Frameworks)
ne mentionne jamais Kadeploy : réservation GPU standard + **Conda** (« Conda is already
available in Grid'5000 as a module. You do not need to install Anaconda or Miniconda on
Grid'5000! »).

```bash
module load conda
conda create --name PACTIVA
conda activate PACTIVA
conda install pytorch torchvision torchaudio pytorch-cuda=11.7 -c pytorch -c nvidia
```

⚠️ **Installer sur un nœud, jamais sur le frontend** (RAM insuffisante ; échec garanti
pour `tensorflow-gpu`). Quota `$HOME/.conda` : attention au quota 25 Go.

**Kadeploy reste utile** pour : personnalisation OS/driver bas niveau, test d'une
nouvelle version de driver NVIDIA/CUDA au niveau noyau, besoin root persistant, OS non
standard. Citation : *« Grid'5000 provides the unique capability to set up your own
environment (OS, drivers, compilers...), which is especially useful for testing the
latest version of the accelerator software stack »*.

### 3.3 Environnements de référence

`debian11-min`, `debian12-base`, `debian13-nfs`, `ubuntu2404-min`, `ubuntu2404-nfs`,
`centosstream9-min`, `almalinux9-nfs`, `debiannvlegacy13-big` (NVIDIA), `ubuntugh2404-big`.

### 3.4 Commandes de déploiement

```bash
kaenv3 -l                                          # lister les environnements
kadeploy3 debian11-base                             # déployer sur les nœuds du job
kadeploy3 debian11-base -m node.site.grid5000.fr    # nœud précis
kadeploy3 debian11-min --env-version 2021092316     # version antérieure
kadeploy3 -M -f fichier_nœuds debian11-big          # multisite
```
[Advanced Kadeploy](https://www.grid5000.fr/w/Advanced_Kadeploy)

Workflow interne : **SetDeploymentMiniOS → BroadcastEnv → BootNewEnv**.

### 3.5 Créer un environnement personnalisé

**Approche `tgz-g5k`** (déployer, personnaliser à la main, sauvegarder) :
```bash
oarsub -I -t deploy -l nodes=1,walltime=3
kadeploy3 debian11-base
ssh root@node.site.grid5000.fr
apt-get install packages_desired
tgz-g5k -m hostname -f ~/environment_image.tar.zst   # depuis le frontend
```

**Approche Kameleon** (recette de build) :
```bash
kameleon repository add grid5000 https://gitlab.inria.fr/grid5000/environments-recipes.git
kameleon new my_environment grid5000/from_grid5000_environment/base
kameleon build my_environment
```
[Environment creation](https://www.grid5000.fr/w/Environment_creation)

---

## 4. Réservations avancées

### 4.1 À l'avance (`-r`)

```bash
oarsub -r "$(date +'%F %T' --date='+1 week')"
```
Quotas par niveau de privilège (voir `01_VUE_ENSEMBLE_SITES_ACCES.md` §4). Les
réservations démarrant dans moins d'une heure ne comptent pas dans le quota.

### 4.2 Multi-sites — pas de mécanisme natif

**Un job OAR ne peut pas réserver des ressources sur plusieurs sites à la fois.**
Coordination via réservations avancées séparées (même date de début, même walltime) et
l'outil **Funk** (« Find yoUr Nodes on g5K ») :
```bash
funk -m date -r lyon,nancy,rennes -w 3:00:00
funk -m max -r grid5000 -w 4:00:00 -e "2014-02-17 16:00:00" -c
```
[Funk](https://www.grid5000.fr/w/Funk)

### 4.3 ⚠️ Recommandation officielle — éviter la multiplication de petits jobs

*« It is a bad practice on Grid'5000 to submit a high number of OAR small jobs, which
typically will last less than 10 minutes »*
[HPC and HTC tutorial](https://www.grid5000.fr/w/HPC_and_HTC_tutorial). Alternatives
recommandées :
- **GNU Parallel au-dessus d'OAR** : une seule réservation (grain plus grossier),
  distribution des tâches en interne — *« needs only one reservation (minimal
  overhead) »*.
- **Jobs conteneurs** (`-t container`/`-t inner`) : réserver un ensemble de ressources
  en un `oarsub`, puis lancer plusieurs jobs « inner » dedans.

**Implication directe pour Pactiva Lab** : un sweep de plusieurs dizaines de runs (ex.
le preset `screening-preprocess`, 24 runs) ne doit **pas** soumettre 24 jobs OAR
distincts — voir `07_ARCHITECTURE.md` §Batch de sweep.

### 4.4 Prolonger un job

```bash
oarwalltime 1743185 +1:30    # ajoute 1h30
oarwalltime 1743185           # consulter
```
Via l'API REST — endpoint distinct de l'API Jobs standard, voir `03_API_REST.md` §4.5.
**Walltime change impossible en queue production à Nancy.**

---

## 5. Bonnes pratiques GPU avec OAR

```bash
oarsub -I -l "gpu=1"                                  # 1 GPU
oarsub -I -l host=1/gpu=2                              # 2 GPU du même nœud
oarsub -I -l gpu=1 -p "gpu_model = 'GPU model'"         # modèle précis
oarsub -I -p "gpu_count >= 3" -l host=1                 # nœud entier ≥3 GPU
```
[GPUs on Grid5000](https://www.grid5000.fr/w/GPUs_on_Grid5000)

⚠️ **Partage mémoire/CPU sur nœud multi-GPU** : *« On a multi-GPU node, this will give
you only part of the memory and CPU resources. For instance, on a dual-GPU node,
reserving a single GPU will give you access to half of the system memory and half of
the CPU cores »*. À anticiper dans le dimensionnement des jobs concurrents.

Vérification après réservation : `nvidia-smi` (ne montre QUE le(s) GPU réservé(s)),
`nvcc --version`.

---

## 6. Pour l'architecture Python/Django

### 6.1 Format JSON de soumission (via l'API REST — thin wrapper sur `oarsub`)

```json
{"resources": "nodes=2,walltime=02:00", "command": "sleep 3600"}
{"resources": "nodes=2", "types": ["deploy"], "command": "sleep 3600"}
```
[API tutorial](https://www.grid5000.fr/w/API_tutorial) — détail complet dans
`03_API_REST.md`.

### 6.2 Client officiel `python-grid5000` — extrait pertinent

```python
from grid5000 import Grid5000
gk = Grid5000.from_yaml(conf_file)
site = gk.sites["rennes"]
job = site.jobs.create({"name": "pyg5k", "command": "sleep 3600"})
while job.state != "running":
    job.refresh()
    time.sleep(10)
```
Détail complet (auth, retry, exceptions) dans `03_API_REST.md` §5.

---

## 7. Points non trouvés / incertains — à ne pas considérer comme acquis

- **`oarpeek`** : commande non retrouvée dans la doc actuelle.
- **Page [Exotic](https://www.grid5000.fr/w/Exotic)** : protégée par login, contenu non
  vérifié directement.
- **Schéma JSON exact du body de `PUT .../walltime-change`** : non trouvé sur le wiki ;
  seule la syntaxe `python-grid5000` (`job.walltime_change.create({"walltime": ...})`)
  a été retrouvée.
- **Endpoint REST pour stdout/stderr d'un job** : non documenté — probablement
  inexistant, accès fichier via SSH/frontend uniquement.
- **`--resubmit` de `oarsub`** : mentionné dans un résultat de recherche web, absent du
  texte intégral consulté — à vérifier via `man oarsub` sur un frontend avant usage.
- **`OAR_ARRAY_ID`** pour job arrays : non confirmé par citation directe officielle.
- **Walltime maximum par cluster** (hors `night`=14h, hors production=0/4/6/12/24/48/96/168h) :
  pas de règle générale unique — semble dépendre de la propriété `max_walltime`
  (interrogeable dynamiquement via l'API, voir `OAR Properties`), plutôt qu'à coder en
  dur.
