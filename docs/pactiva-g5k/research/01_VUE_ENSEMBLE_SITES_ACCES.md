# Grid'5000 — Vue d'ensemble, sites, hardware, accès

> Recherche documentaire effectuée le 11 août 2026, exclusivement sur la documentation
> officielle du wiki `grid5000.fr/w/`. Chaque affirmation est sourcée. Une incertitude
> ou une contradiction relevée dans la doc est signalée explicitement plutôt que résolue
> par supposition — voir la section « Synthèse des zones d'incertitude » en fin de
> document avant toute décision d'architecture.

---

## 1. Vue d'ensemble

### 1.1 Qu'est-ce que Grid'5000

Grid'5000 se définit comme **« a large-scale and flexible testbed for experiment-driven
research in all areas of computer science, with a focus on parallel and distributed
computing, including Cloud, HPC, Big Data and AI »** — un banc d'essai à grande échelle
pour la recherche expérimentale en informatique, en particulier le calcul parallèle et
distribué (Cloud, HPC, Big Data, IA). [Grid5000:Home](https://www.grid5000.fr/w/Grid5000:Home)

Caractéristiques mises en avant :
- Déploiement **bare-metal** avec pile logicielle entièrement personnalisable (Kadeploy).
- Isolation réseau des expériences.
- Monitoring avancé du réseau et de la consommation électrique.
- Support à la recherche reproductible et à la science ouverte.
[Grid5000:Home](https://www.grid5000.fr/w/Grid5000:Home)

**Gouvernance** : groupement d'intérêt scientifique hébergé par **Inria**, incluant
**CNRS**, **RENATER** et de nombreuses universités françaises ; précurseur de
**SLICES-FR**, nœud français de l'infrastructure de recherche européenne SLICES-RI.
[Grid5000:Home](https://www.grid5000.fr/w/Grid5000:Home)

⚠️ **Incohérence relevée** : la page d'accueil avance des chiffres génériques
(« 15 000 cœurs », « 800 nœuds », « 11 sites ») qui semblent être un texte de
présentation figé, différent des statistiques live agrégées de la page
[Hardware](https://www.grid5000.fr/w/Hardware) (§2.1). **Utiliser les chiffres de
Hardware pour toute architecture logicielle** — calculés dynamiquement depuis
l'inventaire réel.

### 1.2 Qui peut obtenir un compte

D'après [Grid5000:Get an account](https://www.grid5000.fr/w/Grid5000:Get_an_account) :

- **Académiques français, ou des sites des universités de Luxembourg et de Louvain** :
  demande directe après lecture/acceptation de la Usage Policy. Formulaire :
  [Special:G5KRequestAccountUMS](https://www.grid5000.fr/w/Special:G5KRequestAccountUMS).
- **Académiques hors de France et/ou non-académiques** : le programme historique
  « Open-Access » est **fermé** (« The Grid'5000 Open-Access program is closed »,
  [Grid5000:Open-Access](https://www.grid5000.fr/w/Grid5000:Open-Access)). Accès
  désormais conditionné à une **collaboration formelle avec un chercheur académique déjà
  titulaire d'un accès**, qui « parraine » la demande.
- **Relecteurs de conférences** : accès temporaire via
  [Special:G5KRequestAccountUMS?peer_review](https://www.grid5000.fr/w/Special:G5KRequestAccountUMS?peer_review),
  avec référence du « Reproducibility Initiative Chair » de la conférence.
- **Entreprises privées** : contact direct d'un membre du bureau exécutif — pas de
  formulaire self-service.
- **Enseignement/TD** : création en masse via une procédure séparée.

⚠️ Aucune durée de compte ni procédure de renouvellement explicite documentée. Seule
information connexe : un compte sans appartenance à un « Group Granting Access » (GGA)
entre en **grâce d'un mois** avant retrait.
[User Management Service documentation](https://www.grid5000.fr/w/User_Management_Service_documentation)

### 1.3 Groups Granting Access (GGA) et niveaux de privilège

- Chaque utilisateur doit appartenir à **au moins un GGA** pour soumettre des jobs ;
  l'usage (jobs OAR) est comptabilisé par GGA.
- Chaque GGA a un **niveau de privilège** : `gold`, `silver` ou `bronze` — détermine
  notamment le droit d'accès à la queue `besteffort` et les quotas de réservation
  avancée (§4).
- L'appartenance à un GGA d'un site donné n'a aucun impact sur les autres sites
  accessibles pour l'expérimentation.
[User Management Service documentation](https://www.grid5000.fr/w/User_Management_Service_documentation)

### 1.4 Charte et conditions légales

Deux documents distincts :
- [Grid5000:UsagePolicy](https://www.grid5000.fr/w/Grid5000:UsagePolicy) — règles
  opérationnelles (détail complet dans `02_OAR_KADEPLOY.md` §Politiques).
- [Grid5000:General Conditions of Use](https://www.grid5000.fr/w/Grid5000:General_Conditions_of_Use)
  — cadre légal.

Points clés des Conditions Générales :
- **RGPD** : conformité loi française du 6 janvier 1978 et RGPD (UE 2016/679).
- **Pas de sauvegarde, responsabilité utilisateur** : l'infrastructure décline toute
  responsabilité en cas de perte de données.
- **Propriété intellectuelle** : interdiction de manipuler des données/logiciels
  portant atteinte aux droits de tiers.
- **Fin d'accès** : notification par e-mail avant suppression de compte ; usage
  strictement personnel et professionnel/éducatif (commercial/politique/récréatif
  interdit sauf autorisation).
- **Journalisation** : logs conservés un an ; statistiques d'usage conservées de façon
  permanente à des fins de justification de financement.

Interdits explicites de la Usage Policy (extrait) :
- Processus lourds sur les frontales (IDE distants, agents IA, compilation lourde,
  tâches de fond).
- Modification BIOS/BMC/IPMI, flash de firmware.
- Minage de cryptomonnaie sans reversement.
- Usage Internet inhabituel sans notification au staff.

---

## 2. Sites et matériel (Hardware)

### 2.1 Statistiques globales

Citation exacte : **« 12 sites, 159 clusters, 936 nodes, 31160 CPU cores, 769 GPUs,
5228672 GPUs cores, 215.9 TiB RAM + 6.0 TiB PMEM, 978 SSDs and 746 HDDs on nodes
(total: 2.77 PB), 1939.4 TFLOPS (excluding GPUs) »**.
[Hardware](https://www.grid5000.fr/w/Hardware)

Vérification de cohérence effectuée : la somme des nœuds/clusters/GPU par site
(sections 2.2-2.3) correspond exactement à ces totaux — les chiffres sont fiables.

### 2.2 Sites réellement actifs aujourd'hui

⚠️ **Point critique pour l'architecture** : 12 sites sont *listés*, mais **Bordeaux est
en construction** — [Bordeaux:Hardware](https://www.grid5000.fr/w/Bordeaux:Hardware)
indique explicitement « The site of Bordeaux is in construction », 0 ressource. La page
[Grid5000:Home](https://www.grid5000.fr/w/Grid5000:Home) confirme **11 sites
opérationnels** : Grenoble, Lille, Luxembourg, Louvain, Lyon, Nancy, Nantes, Rennes,
Sophia-Antipolis, Strasbourg, Toulouse.

**→ Conclusion pour l'architecture : exclure Bordeaux du routage (ou le marquer
« bientôt disponible ») ; 11 sites réservables aujourd'hui.**

| Site | Statut | Clusters | Nœuds | Cœurs CPU | GPUs | RAM |
|---|---|---:|---:|---:|---:|---|
| Bordeaux | **En construction** | 0 | 0 | 0 | 0 | 0 |
| Grenoble | Actif | 27 | 110 | 3 564 | 126 | 23,25 TiB + 6,0 TiB PMEM |
| Lille | Actif | 5 | 30 | 1 088 | 52 | 10,0 TiB |
| Louvain | Actif | 1 | 8 | 384 | 0 | 2,0 TiB |
| Luxembourg | Actif | 3 | 56 | 2 120 | 36 | 11,5 TiB |
| Lyon | Actif | 10 | 68 | 1 786 | 110 | 11,71 TiB |
| Nancy | Actif | 14 | 264 | 10 470 | 129 | 57,28 TiB |
| Nantes | Actif | 3 | 74 | 1 456 | 6 | 8,0 TiB |
| Rennes | Actif | 40 | 171 | 6 340 | 80 | 52,44 TiB |
| Sophia | Actif | 51 | 114 | 3 180 | 218 | 31,78 TiB |
| Strasbourg | Actif | 3 | 19 | 356 | 0 | 5,07 TiB |
| Toulouse | Actif | 2 | 22 | 416 | 12 | 2,88 TiB |

Sources : pages `<Site>:Hardware` pour chacun des 11 sites (ex.
[Nancy:Hardware](https://www.grid5000.fr/w/Nancy:Hardware),
[Lyon:Hardware](https://www.grid5000.fr/w/Lyon:Hardware), etc.)

### 2.3 Clusters GPU — inventaire (extrait pertinent pour du fine-tuning NLP)

**Nancy** — [Nancy:Hardware](https://www.grid5000.fr/w/Nancy:Hardware)

| Cluster | Queue | Nœuds | GPU/nœud | CPU | RAM/nœud |
|---|---|---:|---|---|---|
| grouille | default | 2 | 2× Nvidia A100 (40 GB) | AMD EPYC 7452 (32c) | 128 GiB |
| graffiti | abaca | 12 | 4× RTX 2080 Ti *ou* Quadro RTX 6000 | Intel Xeon Silver 4110 (8c) | 128 GiB |
| grat | abaca | 1 | 8× Nvidia A100 (40 GB) | AMD EPYC 7513 (32c) | 512 GiB |
| gres | abaca | 7 | 2× Nvidia L40S (45 GB) | AMD EPYC 9254 (24c) | 512 GiB |
| gruss | abaca | 4 | 2× Nvidia A40 (45 GB) | AMD EPYC 7352 (24c) | 256 GiB |

**Rennes** — [Rennes:Hardware](https://www.grid5000.fr/w/Rennes:Hardware) — clusters
`abacusN` (queue abaca, généralement 1 nœud) : 2× Tesla P100 à **abacus27 : 4× Nvidia
H100 (94 GB)**.

**Lille** — [Lille:Hardware](https://www.grid5000.fr/w/Lille:Hardware)

| Cluster | Nœuds | GPU/nœud | CPU | RAM |
|---|---:|---|---|---|
| chicoree (exotic) | 1 | 4× Nvidia H200 (140 GB) | Intel Xeon 6530P (32c) | 1,0 TiB |
| chuc | 8 | 4× Nvidia A100 (40 GB) | AMD EPYC 7513 (32c) | 512 GiB |
| chifflot | 8 | 2× P100 ou V100 | Intel Xeon Gold 6126 (12c) | 192 GiB |

**Lyon** — [Lyon:Hardware](https://www.grid5000.fr/w/Lyon:Hardware)

| Cluster | Nœuds | GPU/nœud | CPU | RAM |
|---|---:|---|---|---|
| gemini | 2 | 8× Nvidia Tesla V100 (32 GB) | Intel Xeon E5-2698 v4 (40c) | 512 GiB |
| sirius | 1 | 8× Nvidia A100 (40 GB) | AMD EPYC 7742 (128c) | 1,0 TiB |
| hydra | 4 | 1× Nvidia GH200 Grace-Hopper (96 GB) | ARM Grace (288c) | 480 GiB |

**Luxembourg** — [Luxembourg:Hardware](https://www.grid5000.fr/w/Luxembourg:Hardware) —
`vianden` (exotic) : 1 nœud, **8× AMD MI300X (192 GB)**.

**Sophia** — `esterel42` : 1 nœud, 8× Nvidia H100 ; `musa` (abaca) : 6 nœuds, 12× Nvidia
H100 chacun.

**Louvain et Strasbourg : aucun GPU.**

Pour un fine-tuning Legal-BERT (modèle base, quelques centaines de Mo de poids), un
cluster à 1 GPU de 16-40 GB (Nancy `grouille`, Lille `chifflot`) suffit largement ; pas
besoin des nœuds à 8× H100/H200 — réservés pour des besoins plus lourds (LLM, multi-GPU).

### 2.4 Clusters CPU représentatifs (hors GPU)

- **Nancy `gros`** : 123 nœuds, Intel Xeon Gold 5220 (18c), 96 GiB RAM.
- **Rennes `paradoxe`** : 64 nœuds, Intel Xeon Gold 5320 (52c), 384 GiB RAM.
- **Grenoble `dahu`** : 31 nœuds, Intel Xeon Gold 6130, 192 GiB RAM.

---

## 3. Accès technique

### 3.1 SSH — passerelle et frontales

- **Point d'entrée unique** : `ssh login@access.grid5000.fr`.
  [SSH](https://www.grid5000.fr/w/SSH), [Getting Started](https://www.grid5000.fr/w/Getting_Started)
- **Authentification par clé publique SSH uniquement** — citation : *« You will get
  authenticated using the SSH public key you provided in the account creation form.
  Password authentication is disabled »*.
- Depuis `access.grid5000.fr`, rebond vers la frontale du site : `ssh <site>`. **Chaque
  site a un home directory distinct** (pas de partage inter-sites).
- Frontales réservées aux tâches légères (édition, gestion de fichiers, soumission de
  jobs) — pas de calcul intensif.
- **Astuce `.g5k`** : `~/.ssh/config` avec `ProxyJump`/`ProxyCommand` pour un accès
  direct (`ssh grenoble.g5k`, `ssh nœud.site.g5k`).

### 3.2 VPN Grid'5000

- OpenVPN, connexion directe sans rebonds SSH multiples.
- Certificat via `api.grid5000.fr` → « My account » → « VPN Certificates ».
- Passerelle `vpn.grid5000.fr`, UDP 1194 ou TCP 443, accès aux plages
  `172.16.0.0/16`/`10.0.0.0/8`/`172.20.0.0/16`.
- **Avertissement explicite : « There is no performance guarantee on the VPN
  infrastructure »** — ne pas l'utiliser pour des expériences sensibles à la
  performance réseau.
[VPN](https://www.grid5000.fr/w/VPN)

### 3.3 Doc « Getting Started » — essentiel

- `oarsub -I` : job interactif, 1 nœud entier, walltime par défaut **1 heure**.
- L'unité la plus fine réservable est le cœur CPU, mais par défaut un job réserve un
  nœud entier.
- **« Grid'5000 does NOT have a BACKUP service for users' home directories »** — pas de
  sauvegarde automatique, à charge de l'utilisateur.
[Getting Started](https://www.grid5000.fr/w/Getting_Started)

---

## 4. Politiques de réservation (résumé — détail complet dans `02_OAR_KADEPLOY.md`)

Trois files documentées : `default`, `production`/`Abaca`, `besteffort`. Une quatrième,
`testing`, existe mais est spécifique à des équipements réseau exotiques du site de
Strasbourg — pas une queue générale. **Aucune preuve d'une queue `admin` publique.**

- **`default`** : max 2h/jour en semaine 9h-19h, max 14h hors week-end ; job types `day`
  (borné 9h-19h) et `night` (19h-9h, walltime max ~14h) aident à respecter la fenêtre.
- **`production`/`Abaca`** : disponible sur **4 sites** (Nancy, Rennes, Grenoble,
  Sophia) officiellement — mais des clusters « abaca » existent aussi ailleurs (Lille,
  Luxembourg), sémantique à clarifier avec le support avant de coder une règle métier
  stricte. Walltime max par **niveau de priorité** :

  | Priorité | Walltime max |
  |---|---|
  | p1 | 168 h (1 semaine) |
  | p2 | 96 h (4 jours) |
  | p3 | 48 h (2 jours) |
  | p4 | 24 h (1 jour) |

  ⚠️ **Changement de walltime impossible en queue production à Nancy.**
- **`besteffort`** : réservée aux GGA `silver`/`gold` ; tué dès qu'un job normal a
  besoin des nœuds.

**Niveaux de privilège et réservations à l'avance** :

| Niveau | Réservations à l'avance / site | Délai max |
|---|---:|---|
| Gold | 2 | Illimité |
| Silver | 2 | 48 h |
| Bronze | 1 | 24 h |

**Réservation de disque** : maximum 14 jours.

### Bon usage — correction factuelle importante

⚠️ **Contrairement à une hypothèse répandue, la documentation officielle
n'interdit PAS de réserver un seul GPU sur un nœud qui en a plusieurs — elle
l'encourage** quand un seul GPU suffit (évite le gaspillage). Ce qui est
précisé : réserver 1 GPU sur un nœud à 2 GPU donne accès à **la moitié de la
RAM système et des cœurs CPU** (partage proportionnel automatique par OAR).
[GPUs on Grid5000](https://www.grid5000.fr/w/GPUs_on_Grid5000)

---

## Synthèse des zones d'incertitude à vérifier avant l'implémentation

1. **Chiffres « marketing » vs « live »** : préférer [Hardware](https://www.grid5000.fr/w/Hardware)
   (vérifié cohérent) à la page d'accueil.
2. **Bordeaux** : en construction, 0 ressource — exclure du routage.
3. **Périmètre exact de la queue `abaca`/`production`** : officiellement 4 sites, mais
   des clusters « abaca » existent ailleurs — à clarifier avec le support avant règle
   métier stricte.
4. **Queue `testing`** : réelle mais limitée à Strasbourg / équipements exotiques.
5. **Queue `admin`** : aucune preuve trouvée — ne pas l'implémenter.
6. **Walltimes exacts des types `night`/`weekend`** : ~14h confirmé, valeurs à la
   seconde non confirmées.
7. **Bibliothèque cliente Python officielle** : voir `03_API_REST.md` — `python-grid5000`
   existe et est référencé par la doc officielle, mais maintenu par un individu
   (Inria), pas une équipe multi-personnes formellement « core ».
