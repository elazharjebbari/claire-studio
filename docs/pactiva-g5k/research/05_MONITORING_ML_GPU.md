# Grid'5000 — Monitoring et usages Machine Learning / GPU

> Recherche effectuée le 11 août 2026, sur la documentation officielle du wiki
> `grid5000.fr/w/`. Chaque affirmation est sourcée. Une page protégée par login
> (Notebooks) n'a pu être consultée qu'indirectement — signalé explicitement.

---

## 1. Monika — visualisation temps réel de l'occupation des ressources

[Status](https://www.grid5000.fr/w/Status) recense, par site, un lien vers **Monika**
(*« current placement and queued jobs status »*).

- **URL** : `https://intranet.grid5000.fr/oar/[NomDuSite]/monika.cgi` — sous-domaine
  `intranet.grid5000.fr`, donc accessible uniquement depuis l'intérieur du réseau
  Grid'5000 (VPN ou machine d'accès).
- Interface web standard d'OAR : état des nœuds (propriétés) + jobs en cours/à venir.
  Certains sites (Grenoble, Nancy, Rennes, Sophia) ont une instance séparée pour la
  file de production.
- **Drawgantt** (même page) : planification passée/présente/future des jobs OAR, sous
  forme de Gantt — utile pour anticiper la libération d'un cluster.

**Pour un usage scripté**, l'équivalent est l'**API de statut** :
```bash
curl https://api.grid5000.fr/stable/sites/grenoble/clusters/yeti/status?pretty
curl https://api.grid5000.fr/stable/sites/grenoble/clusters/status?pretty   # agrégé site
```
Renvoie l'état des nœuds (`"hard": "standby"`, `"soft": "free"`) et des compteurs
(`free_slots`, `busy_slots`, `freeable_slots`). *« Credentials are not needed from
within Grid'5000, but are required from outside »* — donc authentifié depuis
l'extérieur, comme le reste de l'API (confirmé empiriquement : 401 sans compte).
[API tutorial](https://www.grid5000.fr/w/API_tutorial)

---

## 2. Grafana

Grid'5000 propose des dashboards **Grafana adossés à Kwollect** (pas un produit
autonome) : `https://api.grid5000.fr/stable/sites/<site>/metrics/dashboard`, un
dashboard par site (Grenoble, Lille, Luxembourg, Lyon, Nancy, Nantes, Rennes, Sophia,
Strasbourg, Toulouse).
[Monitoring Using Kwollect](https://www.grid5000.fr/w/Monitoring_Using_Kwollect)

Filtrable par job ou par période ; pour des plages > 30 min, valeurs résumées/moyennées
sur des fenêtres de 5 min ; métriques `_total` affichées comme taux/seconde.

**Aucune mention trouvée d'un Grafana public indépendant de Kwollect** (pas de Grafana
dédié à l'occupation OAR — ce rôle est couvert par Monika/Drawgantt, §1). Absence
signalée, pas affirmée comme certaine.

---

## 3. Kwollect — monitoring énergie/température/réseau/GPU

Page de référence : [Monitoring Using Kwollect](https://www.grid5000.fr/w/Monitoring_Using_Kwollect),
[Energy consumption monitoring tutorial](https://www.grid5000.fr/w/Energy_consumption_monitoring_tutorial),
[Traceable performance evaluation](https://www.grid5000.fr/w/Traceable_performance_evaluation).

### 3.1 Catégories de métriques

1. **Énergie** : wattmètres dédiés (Lyon, Grenoble, Nancy).
2. **BMC** : température, consommation PSU, ventilateurs. ⚠️ *« Metrics from BMC are
   quite unreliable. They may be inaccurate, highly averaged, or unavailable on some
   nodes »*.
3. **Réseau** : trafic depuis les équipements réseau.
4. **PDU** : énergie au niveau des unités de distribution électrique.
5. **Métriques nœud** : node-exporter Prometheus, et **exporteur NVIDIA DCGM pour les
   nœuds GPU** — directement pertinent pour du monitoring GPU pendant un entraînement.

### 3.2 API — interroger par job ou nœud

```bash
curl 'https://api.grid5000.fr/stable/sites/lyon/metrics?job_id=1304978'
curl 'https://api.grid5000.fr/stable/sites/lille/metrics?nodes=chifflot-5,chifflot-6&start_time=2021-06-08T15:00&end_time=2021-06-08T17:00'
curl "https://api.grid5000.fr/stable/sites/lyon/metrics?nodes=taurus-10&metrics=wattmetre_power_watt&start_time=$(date -d '15 min ago' +%s)"
```
**Limite de taille** : *« request size is limited. When too much metrics values are
requested, you may hit that limit and receive an error message »*.

### 3.3 Métriques haute fréquence « à la demande »

Certaines métriques (wattmètre haute fréquence) doivent être activées **à la
réservation** :
```bash
oarsub -I -t monitor=bmc_cpu_temp_celsius
oarsub -I -t monitor='.*temp.*'      # regex supportées
oarsub -I -t monitor='wattmetre_power_watt'
```
`wattmetre_power_watt` : échantillonnage par défaut 1 s ; `bmc_node_power_watt` : 5 s.

### 3.4 Rétention

**« metrics stored in Kwollect are kept indefinitely »** — pas de purge automatique.

### 3.5 Bonnes pratiques de reproductibilité (mesures fiables)

[Traceable performance evaluation](https://www.grid5000.fr/w/Traceable_performance_evaluation)
recommande : désactiver `prometheus-node-exporter.service` et l'exporteur DCGM pendant
la mesure elle-même (source de pics de consommation parasites), utiliser un
environnement kadeploy minimaliste, consigner `/etc/grid5000/release` et
`/etc/grid5000/postinstall`, figer un snapshot de la Reference API (voir
`03_API_REST.md` §3.4, versioning Git).

---

## 4. Environnements Deep Learning / GPU

### 4.1 Frameworks documentés

[Deep Learning Frameworks](https://www.grid5000.fr/w/Deep_Learning_Frameworks) couvre
PyTorch, TensorFlow (+Keras), scikit-learn, MXNet (ppc64).

### 4.2 Installation recommandée : Conda

```bash
module load conda
conda create --name PACTIVA
conda activate PACTIVA
conda install pytorch torchvision torchaudio pytorch-cuda=11.7 -c pytorch -c nvidia
```
⚠️ *« Installing Conda packages can be time and resources consuming. You should
preferably use a node (instead of a frontend) »* — et pour TensorFlow : installation
sur frontend échoue systématiquement (mémoire), utiliser un nœud GPU.

### 4.3 ⚠️ Le piège CUDA/pytorch-cuda — documenté explicitement

Citation exacte : **« You must adapt the version number of pytorch-cuda according to
your version of cuda installed on your system. GPU will not be detected by PyTorch if
the version of cuda mismatches with the one installed on your system. »**

Vérification après connexion au nœud (pas avant réservation, voir §4.4) :
```bash
nvcc --version      # version du toolkit CUDA
nvidia-smi           # version driver + CUDA max supportée
```
```python
import torch
print(torch.cuda.is_available(), torch.cuda.get_device_name(0))
```

### 4.4 ⚠️ Comment découvrir la version CUDA/driver AVANT réservation — limite constatée

**La documentation ne fournit pas de mécanisme fiable pour connaître, avant
réservation, la version exacte de CUDA/driver d'un cluster** — cette information dépend
de l'**environnement système déployé** (image Debian standard du site à un instant
donné), pas d'un attribut figé du nœud dans la Reference API.

Historique connu (page [News](https://www.grid5000.fr/w/News)) : Debian 11 « Bullseye »
(oct. 2021) → CUDA 11.2.2 / driver 460.91.03 ; Debian 12 « Bookworm » (janv. 2024) →
driver 535.129.03 / CUDA 12.2.2. Modules CUDA disponibles en parallèle via
`module load cuda/11.7.1_gcc-10.4.0` (lister : `module av`).

**Conclusion pratique** : la stratégie fiable n'est pas de deviner la version CUDA à
l'avance, mais (a) fixer une version CUDA/PyTorch précise via `conda install
pytorch-cuda=X.Y` OU une image Singularity figée (§6), et (b) vérifier systématiquement
avec `nvcc --version`/`nvidia-smi` juste après connexion, **avant** de lancer
l'entraînement — c'est exactement le garde-fou déjà implémenté dans le script généré par
Pactiva Lab (voir `06_GRID5000.md` historique, §6, repris dans `07_ARCHITECTURE.md`).

### 4.5 Cas particuliers matériels

- **AMD (ROCm)** : PyTorch via wheels ROCm spécifiques ; TensorFlow uniquement via
  Docker sur AMD.
- **ppc64** : configuration nettement plus complexe (Python 3.7 requis pour IBM
  PowerAI).

---

## 5. Jupyter sur Grid'5000

**Page dédiée protégée par login** — contenu non consulté intégralement. Ce qui est
établi via des pages publiques qui la référencent :

- [Getting Started](https://www.grid5000.fr/w/Getting_Started) : *« Grid'5000 supports
  Jupyter notebooks and Jupyter lab servers. Jupyter lab servers provide you with a
  simple web interface to submit jobs on Grid'5000 »*.
- URL du service (retrouvée via extraits indexés, **moins fiable, non vérifiée par
  fetch direct**) : `https://intranet.grid5000.fr/notebooks/`. Flux indiqué : « Start My
  Server » → « Launch Server » → configuration ressources (`gpu=1`) + walltime → OAR
  lance `jupyter-labhub` sur un nœud réservé.

**Recommandation** : valider en direct (compte + VPN/accès) le contenu exact avant de
bâtir dessus.

---

## 6. Conteneurs — Docker et Singularity/Apptainer

### 6.1 Docker

- Installation : réserver un nœud, `g5k-setup-docker -t` (utilise `/tmp/` pour plus
  d'espace). Fonctionne sur `debian11-nfs`/`-big`, `debian10-nfs`/`-big`.
- **Support GPU** : `g5k-setup-nvidia-docker`. Vérification :
  `docker run --gpus all ubuntu:22.04 nvidia-smi`.
- **Miroir de registre** `docker-cache.grid5000.fr` (contourne le rate-limiting
  DockerHub), configuré automatiquement par `g5k-setup-docker`.
- ⚠️ **Piège réseau** : réseau Docker par défaut `172.16.0.1/16` en conflit avec le
  réseau interne Grid'5000 — reconfiguration nécessaire via `/etc/default/docker`.
[Docker](https://www.grid5000.fr/w/Docker)

### 6.2 Singularity / Apptainer

- `module load singularity` (ou `apptainer`).
- Exécution directe d'une image Docker : `singularity run docker://debian`.
- Build (root) : `module load singularity && sudo-g5k $(which singularity) build mpi.sif mpi.def`.
- **Support GPU** : `singularity run --nv docker://tensorflow/tensorflow:latest-gpu`
  après `oarsub -I -l gpu=1`.
- **C'est le mécanisme documenté et recommandé pour porter un environnement logiciel
  figé (donc une version CUDA/PyTorch précise) entre Grid'5000 et d'autres
  infrastructures HPC** — cas d'usage explicite décrit : portage Grid'5000 ↔
  supercalculateur Jean Zay (IDRIS) via conversion Docker→Singularity.
[Singularity](https://www.grid5000.fr/w/Singularity)

---

## 7. Tutoriels officiels de pipeline ML reproductible

**Constat honnête : aucun tutoriel officiel dédié au fine-tuning de modèles de langage
(type Legal-BERT) ou à l'entraînement distribué n'a été trouvé.** Ce qui s'en approche :

- [Deep Learning Frameworks](https://www.grid5000.fr/w/Deep_Learning_Frameworks) —
  installation/vérification des frameworks, pas un pipeline complet.
- [HPC and HTC tutorial](https://www.grid5000.fr/w/HPC_and_HTC_tutorial) — réservation
  via API/propriétés OAR, GNU Parallel/besteffort/job containers.
- [Traceable performance evaluation](https://www.grid5000.fr/w/Traceable_performance_evaluation) —
  méthodologie de reproductibilité/traçabilité (§3.5).
- [Grid5000:Software](https://www.grid5000.fr/w/Grid5000:Software) — outils
  communautaires (Execo, `grd`, Ruby-Cute, `g5k-campaign`).

**Conclusion pour le pipeline Legal-BERT de Pactiva Lab** — voie documentée à assembler
soi-même :
1. Réserver un GPU (`oarsub -l gpu=1`) après vérification de disponibilité via l'API
   status ou Monika.
2. Figer l'environnement logiciel (CUDA/PyTorch/transformers) dans une image
   Singularity/Apptainer construite une fois — évite le piège pytorch-cuda puisque la
   version CUDA est celle empaquetée dans l'image.
3. Instrumenter le job avec Kwollect (`-t monitor=…`) pour tracer énergie/GPU pendant
   l'entraînement.
4. Consigner `/etc/grid5000/release` et un snapshot Reference API pour la traçabilité.

---

## Points d'incertitude explicitement signalés

1. Contenu intégral de `https://www.grid5000.fr/w/Notebooks` (page protégée par login).
2. Existence ou non d'un Grafana public *indépendant* de Kwollect.
3. Nombre total exact de GPU sur la plateforme (deux pages donnent des chiffres
   différents — probablement des snapshots à des dates différentes ; toujours
   revérifier en direct via `Hardware`).

## Sources consultées

[Status](https://www.grid5000.fr/w/Status) ·
[Monitoring Using Kwollect](https://www.grid5000.fr/w/Monitoring_Using_Kwollect) ·
[Energy consumption monitoring tutorial](https://www.grid5000.fr/w/Energy_consumption_monitoring_tutorial) ·
[Traceable performance evaluation](https://www.grid5000.fr/w/Traceable_performance_evaluation) ·
[Deep Learning Frameworks](https://www.grid5000.fr/w/Deep_Learning_Frameworks) ·
[GPUs on Grid5000](https://www.grid5000.fr/w/GPUs_on_Grid5000) ·
[Modules](https://www.grid5000.fr/w/Modules) ·
[News](https://www.grid5000.fr/w/News) ·
[Docker](https://www.grid5000.fr/w/Docker) ·
[Singularity](https://www.grid5000.fr/w/Singularity) ·
[HPC and HTC tutorial](https://www.grid5000.fr/w/HPC_and_HTC_tutorial) ·
[Getting Started](https://www.grid5000.fr/w/Getting_Started) ·
[Grid5000:Software](https://www.grid5000.fr/w/Grid5000:Software)
