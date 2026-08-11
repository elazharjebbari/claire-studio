# Grid'5000 — Stockage et Réseau : rapport documentaire

Rapport basé exclusivement sur la documentation officielle du wiki Grid'5000 (`grid5000.fr/w/`), consultée en août 2026. Chaque affirmation est sourcée. Là où la documentation est silencieuse ou ambiguë, cela est signalé explicitement plutôt que comblé par une supposition.

---

## 1. Stockage `home`

### 1.1 Nature et portée (par site, NON partagé entre sites)

Le stockage principal de chaque utilisateur est le répertoire `home`, exposé via NFS :

- « The principal storage space in Grid'5000 is `site:/home/userid`, which is based on a file system exposed by NFS. All reserved nodes share the same home directory, and it is also shared with the site frontend. » — [Storage](https://www.grid5000.fr/w/Storage)
- Le `home` est **propre à chaque site**, pas partagé entre sites : « You have a different home directory on each Grid'5000 site, so you will usually use Rsync or `scp` to move data around. » — [Getting Started](https://www.grid5000.fr/w/Getting_Started)
- Techniquement : « On each node, the home directory is a network filesystem (NFS): data in your home directory is not actually stored on the node itself, it is stored on a storage server managed by the Grid'5000 team. » — [Getting Started](https://www.grid5000.fr/w/Getting_Started)
- Accès direct par NFS depuis les machines d'accès : « On access machines, you have direct access to each of those home directories through NFS mounts. » — [Storage](https://www.grid5000.fr/w/Storage)

**Conséquence architecturale** : un job réservé sur le site A ne voit PAS le `home` du site B. Toute synchronisation multi-site doit passer par un transfert explicite (rsync/scp) ou par un Group Storage partagé (voir §2).

### 1.2 Quotas

Citations verbatim de la page [Storage](https://www.grid5000.fr/w/Storage) :

- Quota par défaut, par site : « Each user has a default quota of 25GB of storage on each site (soft limit), with a reserve of 100GB (hard limit). »
- Le soft limit est la limite jugée raisonnable pour un usage permanent ; le hard limit est un tampon de dépannage temporaire, pas un objectif d'usage courant.
- Plafonds pour les extensions de quota demandées : « We have a limitation of 200GB per home dir and a limitation of 400GB per home dir if your request is limited in time (no more than one year). »
- Quota d'inodes : « Each user has a default inodes hard quota of 10 million. » — au-delà, impossible de créer de nouveaux fichiers tant que des fichiers ne sont pas supprimés.

### 1.3 Vérifier et étendre son quota

- Vérification : commande `quota` exécutée sur le frontend du site — [Storage](https://www.grid5000.fr/w/Storage).
- Extension : « If your usage of Grid'5000 requires more disk space, it is possible to request quota extensions in the account management interface » via [https://api.grid5000.fr/ui/account](https://api.grid5000.fr/ui/account) (onglet « homedir quotas ») — [Storage](https://www.grid5000.fr/w/Storage), [Getting Started](https://www.grid5000.fr/w/Getting_Started).

### 1.4 Pas de sauvegarde — responsabilité utilisateur

Point critique répété sur plusieurs pages : « Grid'5000 does NOT have a BACKUP service for storage it provides: it is your responsibility to save important data outside Grid'5000. » — [Storage](https://www.grid5000.fr/w/Storage), [Getting Started](https://www.grid5000.fr/w/Getting_Started).

### 1.5 Partage public de contenu du `home`

- Interne à Grid'5000 : `http://public.SITE.grid5000.fr/~USERNAME/`
- Externe (authentifié) : `https://api.grid5000.fr/sid/sites/SITE/public/USERNAME/`
— [Storage](https://www.grid5000.fr/w/Storage)

### 1.6 Exemple de transfert vers le `home`

« Typically, to copy a file to your home directory on the Nancy site, you can use: `scp myfile.c login@access.grid5000.fr:nancy/targetdirectory/mytargetfile.c` » — [Getting Started](https://www.grid5000.fr/w/Getting_Started).

---

## 2. Group Storage

### 2.1 Objet

Le Group Storage est un espace NFS destiné au partage de données à plus grande échelle qu'un `home`, entre plusieurs utilisateurs/membres d'une même équipe :

- « Group storages are used to control the access to different storage spaces located on NFS servers. Group Storage gives you the possibility to share a storage between multiple users. » — [Group Storage](https://www.grid5000.fr/w/Group_Storage)
- Recommandation de seuil : pour un besoin de moins de 200GB, une extension de quota `home` est préférable — « For smaller storage space (under 200GB), asking for a quota extension for your home may be a better solution », et l'extension de `home` de 200-400GB est possible « if your request is limited in time » — [Group Storage](https://www.grid5000.fr/w/Group_Storage). Le Group Storage vise donc explicitement les volumes plus importants et/ou durables, au-delà de ce que l'extension de `home` permet.

### 2.2 Comment l'obtenir (demande par e-mail, pas de self-service)

Il n'existe pas de commande de réservation automatique (type OAR) pour créer un Group Storage : il faut passer par une demande manuelle au support :

- Adresse : `support-staff@lists.grid5000.fr`, objet : **« Group storage creation »** — [Group Storage](https://www.grid5000.fr/w/Group_Storage)
- Informations requises dans la demande :
  - « What is your Grid'5000 login ? »
  - Nom souhaité pour l'espace (lettres minuscules/chiffres uniquement)
  - « On which site do you want the storage space? »
  - Groupe existant à utiliser, OU nom d'un nouveau groupe (doit commencer par `sto-`)
  - « What size do you require for the storage space? » (en GB/TB)
  - « What is the intended usage, in a few lines ? »
  - « What is the expiration date? »
  — [Group Storage](https://www.grid5000.fr/w/Group_Storage)
- Extension d'un Group Storage existant : même canal, objet « Group storage extension », en précisant le nom, l'extension demandée et la justification — [Group Storage](https://www.grid5000.fr/w/Group_Storage).

### 2.3 Gestion des membres (accès par groupe)

- Il faut être membre du groupe associé pour accéder à l'espace : « You must be a member of the group associated to storage space to access it » — [Group Storage](https://www.grid5000.fr/w/Group_Storage).
- Rejoindre un groupe existant se fait via l'onglet **Groups** de l'interface de gestion de compte.
- Rôles : owners/delegates gèrent l'appartenance ; un owner/delegate n'est PAS automatiquement ajouté comme membre (« An owner/delegate is NOT automatically added as a member »).
- Délai de propagation : « You may have to wait up to 15 minutes after your mail is answered by the Grid'5000 team for the changes to take effect. »
— [Group Storage](https://www.grid5000.fr/w/Group_Storage)

### 2.4 Syntaxe d'accès (chemins)

Le point de montage suit le format :

```
/srv/storage/<storage_name>@<server_hostname_fqdn>
```
avec une variante de compatibilité utilisant `___` à la place de `@` :
```
/srv/storage/<storage_name>___<server_hostname_fqdn>
```
Exemple : `/srv/storage/my_storage@storage1.lille.grid5000.fr`

Il est recommandé de créer un lien symbolique pour un usage confortable :
```
ln -s /srv/storage/my_storage@storage1.lille.grid5000.fr ~/my_storage
```
— [Group Storage](https://www.grid5000.fr/w/Group_Storage)

### 2.5 Montage automatique (autofs) — et ses limites

- « Autofs is used to remotely mount storage. So they are automatically mounted when accessed. » — [Group Storage](https://www.grid5000.fr/w/Group_Storage)
- Ce montage automatique fonctionne sur les frontends et sur les environnements « standard », « nfs » et « big ». Pour d'autres environnements déployés (Kadeploy) ou des VMs persistantes, l'autofs n'est pas disponible : il faut alors passer par l'API **Storage Manager** pour créer explicitement un « access » NFS. — [Group Storage](https://www.grid5000.fr/w/Group_Storage), [Storage Manager](https://www.grid5000.fr/w/Storage_Manager)

### 2.6 Emplacement des serveurs de stockage et capacités

D'après la page [Group Storage](https://www.grid5000.fr/w/Group_Storage) : des serveurs de stockage existent sur 10 sites Grid'5000, avec des capacités allant d'environ 1 To (Strasbourg) à 360 To (Grenoble, serveur `storage3`), et des débits de lien variant de 10 Gbps à 200 Gbps selon le site. **Note de prudence** : ces chiffres précis (capacités par site, débits) proviennent d'une extraction automatisée de la page et n'ont pas pu être re-vérifiés mot à mot ; ils donnent un ordre de grandeur mais devraient être revérifiés directement sur [Group Storage](https://www.grid5000.fr/w/Group_Storage) avant de les citer comme définitifs dans une archi de prod.

### 2.7 Permissions par défaut

- Bit `s` (setgid) : les nouveaux fichiers héritent du groupe du répertoire parent.
- Sticky bit : empêche la suppression de fichiers appartenant à d'autres utilisateurs du groupe.
- ACL par défaut `g::rwx:` sur les sous-répertoires : héritage des droits lecture/écriture/exécution pour le groupe.
— [Group Storage](https://www.grid5000.fr/w/Group_Storage)

### 2.8 Utilisation depuis un job

La documentation de Group Storage elle-même ne mentionne pas de type de job OAR spécifique ni de variable d'environnement dédiée pour « réserver » l'accès au storage — l'accès est une question d'appartenance au groupe Unix, pas de réservation de ressource OAR. Concrètement :
- Dans un job non-déployé (environnement de référence), le chemin `/srv/storage/<name>@<server>` est simplement accessible si l'utilisateur est membre du groupe, via autofs.
- Dans un environnement déployé (Kadeploy) ou une VM persistante, il faut créer explicitement un accès NFS via l'API Storage Manager (voir §2.9) car autofs n'y est pas actif.

### 2.9 API Storage Manager (accès explicite hors autofs)

Le **Storage Manager** « manages access to NFS shares on Grid'5000. It is used for user's home and Group Storage. » Il fonctionne via des objets « access » définis par une liste d'adresses IP autorisées et une condition de terminaison. — [Storage Manager](https://www.grid5000.fr/w/Storage_Manager)

Cas d'usage typiques nécessitant le Storage Manager plutôt que l'autofs :
- Autoriser des adresses supplémentaires à accéder au `home` (par ex. nœuds dans un KaVLAN)
- Accès cross-site à un stockage
- Accès depuis un environnement déployé sans autofs

Endpoints REST :
```
https://api.grid5000.fr/stable/sites/{site}/storage/home/{username}/access
https://api.grid5000.fr/stable/sites/{site}/storage/{server}/{storage}/access
```

Créer un accès avec expiration fixe :
```bash
curl -X POST 'https://api.grid5000.fr/stable/sites/nancy/storage/storage1/delta/access' \
  -H "Content-Type: application/json" \
  -d '{"hosts": ["dahu-1.grenoble.grid5000.fr", "dahu-2.grenoble.grid5000.fr"],
       "termination" : {"until":"2018-12-25 19:38"}}'
```

Créer un accès lié à la durée de vie d'un job OAR :
```bash
curl -X POST 'https://api.grid5000.fr/stable/sites/nancy/storage/storage1/delta/access' \
  -H "Content-Type: application/json" \
  -d '{"hosts": ["dahu-1.grenoble.grid5000.fr", "dahu-2.grenoble.grid5000.fr"],
       "termination" : {"job": 4548, "site": "grenoble"}}'
```
(en omettant `hosts`, l'API remplit automatiquement la liste avec les nœuds du job)

Lister :
```bash
curl https://api.grid5000.fr/stable/sites/nancy/storage/storage1/delta/access
```

Supprimer :
```bash
curl -X DELETE https://api.grid5000.fr/stable/sites/nancy/storage/storage1/delta/access/{access_id}
```

Contraintes : « Only the home owner or a group member can interact with his or her accesses » ; « Access is created immediately and is valid until the termination of the job, even if the job has not started yet. »
— [Storage Manager](https://www.grid5000.fr/w/Storage_Manager)

### 2.10 Stockage local sur disque (alternative pour données volumineuses locales à un nœud)

Ce n'est pas du Group Storage, mais une option de stockage connexe mentionnée sur la page [Storage](https://www.grid5000.fr/w/Storage) et détaillée sur [Disk reservation](https://www.grid5000.fr/w/Disk_reservation) :

- « Disk reservation consists in reserving on nodes additional hard disks, which are otherwise not usable. » Ce sont des disques nus nécessitant root pour partitionner/formater/monter.
- Différence clé avec Group Storage : ce stockage est **local au nœud**, pas partagé sur le réseau ; il **persiste entre jobs** (contrairement à `/tmp`) mais **n'est pas nettoyé automatiquement** — « Reserved disks are not cleaned-up at the end of reservation. As a result: Data let on the disks can be accessed by user in later reservations. » L'utilisateur doit effacer lui-même ses données sensibles. Aucune sauvegarde n'est faite.
- Réservation via OAR, exemples :
```
oarsub -I -l "{host+disk & grimoire}"/host=1
oarsub -I -l "{host+disk & host in (grimoire-1, grimoire-2)}"/host=2
```
- Réservation de disques seuls, longue durée, sans réserver de puissance de calcul (job type `noop`) :
```
oarsub -r "2018-01-01 00:00:00" -t noop -l "{disk&grimoire-1}"/host=1/disk=2,walltime=168
```
- Découverte et montage dans le job :
```
lsblk
ls -l /dev/disk[0-9]*
cfdisk /dev/disk2
mkfs.ext4 -m 0 /dev/disk2p1
mkdir -p /mnt/mylocaldisk
mount /dev/disk2p1 /mnt/mylocaldisk
```
- Accès root requis : `sudo-g5k` en job non-déployé, ou SSH root en environnement déployé.
— [Disk reservation](https://www.grid5000.fr/w/Disk_reservation)

### 2.11 storage5k (obsolète)

Une recherche indique que l'ancien outil `storage5k` (réservation de blocs de stockage de 10GB pour données persistantes entre expériences) est en cours de remplacement par le service Group Storage actuel. **Avertissement de prudence** : cette information provient d'un résumé de recherche web (pas d'une citation directe extraite d'une page wiki officielle que j'ai pu re-vérifier verbatim) ; à confirmer directement sur le wiki avant de s'appuyer dessus dans une conception d'architecture — ne pas concevoir de dépendance sur `storage5k`, utiliser Group Storage qui est la solution actuelle documentée.

---

## 3. Stockage de datasets publics pré-hébergés (recherche ML/IA)

**Constat après recherche approfondie : aucune preuve trouvée que Grid'5000 propose un service officiel de datasets publics pré-hébergés pour la recherche ML/IA** (type « dataset hub » avec ImageNet, corpus NLP, etc. déjà présents sur la plateforme).

Éléments vérifiés :
- La page [HPC and HTC tutorial](https://www.grid5000.fr/w/HPC_and_HTC_tutorial) ne mentionne aucun dataset public ni dépôt de données maintenu par Grid'5000 ; elle ne traite que des quotas et de la gestion disque par l'utilisateur lui-même.
- Aucune page wiki dédiée « Datasets » n'a été trouvée sous `grid5000.fr/w/`.
- Grid'5000 se positionne comme infrastructure de calcul et de stockage généraliste (via `home`, Group Storage, disques locaux), pas comme fournisseur de corpus/données de recherche pré-chargées.
- Les seules données que Grid'5000 « distribue » de façon documentée sont des **traces d'usage de la plateforme elle-même** (traces de jobs HPC/Grid'5000, utilisées comme jeu de données de recherche sur l'ordonnancement — hors du périmètre ML/IA visé ici), mentionnées dans des publications académiques externes, pas dans la documentation d'infrastructure.

**Conclusion pour l'architecture** : il ne faut PAS supposer l'existence d'un cache de datasets publics pré-hébergé par Grid'5000. Toute donnée d'entraînement/modèle (ex. poids de modèles ML) doit être explicitement transférée par l'architecture cible (Group Storage + transfert rsync/scp, voir §6), potentiellement mutualisée entre expériences en la plaçant sur un Group Storage partagé afin d'éviter de la re-télécharger à chaque job.

---

## 4. Réseau

### 4.1 Réseau interne haute performance et RENATER

- Le réseau qui relie les sites Grid'5000 est fourni par RENATER : « Renater provides Grid'5000 a dedicated 10Gbit/s switching network (using dedicated lambdas on Renater network infrastructure) » et fonctionne comme « a single layer-2 Ethernet network » avec du routage IP à travers ce backbone. — [Grid5000:Network](https://www.grid5000.fr/w/Grid5000:Network)
- Adressage : réseaux de production en IPv4 privé (blocs `172.16.0.0/20` par site) et en IPv6 global (`2001:0660:4406::/hex` par site) ; interconnexions haute performance (InfiniBand/Omni-Path) sur des blocs séparés `172.18.0.0/20` par site. — [Grid5000:Network](https://www.grid5000.fr/w/Grid5000:Network)
- MTU jumbo supporté : « A MTU (Maximum Transmission Unit) of up to 9000 is guaranteed to work on Grid'5000: within a site, between sites, and in a Kavlan. » (MTU par défaut = 1500, configurable). — [Grid5000:Network](https://www.grid5000.fr/w/Grid5000:Network)

### 4.2 Accès Internet depuis les nœuds

- Accès sortant autorisé : « Full Internet access is allowed from Grid'5000 network to the Internet. » — [FAQ](https://www.grid5000.fr/w/FAQ)
- Confirmé côté Getting Started : « You can access websites outside Grid'5000 : for example, to fetch the Linux kernel sources. » — [Getting Started](https://www.grid5000.fr/w/Getting_Started)
- **IPv4** : tout le trafic sortant est NATé derrière une IP publique unique par site de sortie. Adresses publiques de sortie mentionnées : `194.254.60.35` (nr-lil-536.grid5000.fr) et `194.254.60.13` (nr-sop-535.grid5000.fr). — [FAQ](https://www.grid5000.fr/w/FAQ)
- **IPv6** : « with IPv6 each node uses its own public IPv6 address » — pas de NAT, adressage public routable directement (`2001:0660:4406::/48`, réparti sur tous les sites Grid'5000). — [FAQ](https://www.grid5000.fr/w/FAQ), [IPv6](https://www.grid5000.fr/w/IPv6)
- **Journalisation/surveillance** : « for legal reasons, your Internet activity from Grid'5000 is logged and monitored » (Getting Started) / « for security reasons, all connections are logged » (FAQ) — [Getting Started](https://www.grid5000.fr/w/Getting_Started), [FAQ](https://www.grid5000.fr/w/FAQ)
- **Aucune limite de bande passante ni de restriction de ports sortants n'est documentée** dans les pages consultées (Getting Started, FAQ, Grid5000:Network). À noter explicitement : cette absence de mention n'est pas une garantie qu'il n'existe aucune limite technique — c'est simplement l'absence de documentation officielle trouvée sur ce point précis.

### 4.3 Accès entrant depuis Internet (par défaut bloqué)

- Par défaut aucune connexion entrante n'est autorisée vers un nœud : « By default and as in most platforms, inbound communication from the Internet to a node is not allowed, the Grid'5000 network is protected by a firewall. » — [FAQ](https://www.grid5000.fr/w/FAQ) (via résumé de recherche, cohérent avec la doc sur le pare-feu ci-dessous)
- Pour entrer dans le réseau Grid'5000 depuis l'extérieur en interactif : passer par la machine d'accès `access.grid5000.fr` — [FAQ](https://www.grid5000.fr/w/FAQ), [SSH](https://www.grid5000.fr/w/SSH)

### 4.4 Reconfigurable Firewall (« g5kfw ») — ouverture ciblée de ports entrants en IPv6

Ce service permet d'ouvrir des ports entrants spécifiques vers un nœud IPv6, lié à la durée de vie d'un job — utile pour exposer un service (ex. serveur d'inférence, API) sans passer par le proxy HTTP.

- Contexte : « In IPv4, all communications from inside Grid'5000 to the outside Internet are NATed to the single public IP address », ce qui empêche les connexions entrantes. Les nœuds ayant une adresse IPv6 publique globale peuvent en revanche recevoir des connexions entrantes ciblées via ce service. — [Reconfigurable Firewall](https://www.grid5000.fr/w/Reconfigurable_Firewall)
- Fonctionnement : API REST associant des ouvertures de pare-feu à un job OAR précis ; nécessite d'avoir réservé le nœud en exclusif (host complet, tous les cœurs) ; les ouvertures sont automatiquement supprimées à la fin du job ; supporte TCP/UDP/« all » ; peut restreindre à une adresse source précise ; ICMPv6 est autorisé automatiquement pour toute destination ouverte. — [Reconfigurable Firewall](https://www.grid5000.fr/w/Reconfigurable_Firewall)
- Exemple — ouvrir le port 22 :
```bash
curl -i https://api.grid5000.fr/stable/sites/SITE/firewall/OAR_JOB_ID \
  -d '[{"addr": "IPV6NODE", "port": 22}]'
```
- Restreindre à une source :
```bash
curl -i https://api.grid5000.fr/stable/sites/SITE/firewall/OAR_JOB_ID \
  -d '[{"addr": "IPV6NODE", "src_addr": "2001:db8:1842:1234::/64", "port": 22}]'
```
- Tous les protocoles :
```bash
curl -i https://api.grid5000.fr/stable/sites/SITE/firewall/OAR_JOB_ID \
  -d '[{"addr": "IPV6NODE", "proto": "all"}]'
```
- Limite connue : « When firewall openings are removed...existing established connections will not be closed. »
— [Reconfigurable Firewall](https://www.grid5000.fr/w/Reconfigurable_Firewall)

### 4.5 IPv6 — activation et limites

- Les nœuds n'ont pas d'adresse IPv6 par défaut : il faut l'activer explicitement, ex. `sudo-g5k dhclient -6 br0` depuis l'environnement standard, déclenchant le DHCPv6 interne. — [IPv6](https://www.grid5000.fr/w/IPv6)
- « Frontends currently don't have IPv6 addresses. » — [IPv6](https://www.grid5000.fr/w/IPv6)
- Le trafic entrant reste filtré par défaut même en IPv6 : il faut activer le Reconfigurable Firewall par job (voir §4.4). — [IPv6](https://www.grid5000.fr/w/IPv6)
- Dans un KaVLAN local, il n'y a pas de service DHCPv6 : configuration statique nécessaire. — [IPv6](https://www.grid5000.fr/w/IPv6)

### 4.6 KaVLAN — isolation réseau par VLAN

**Objet** : « KaVLAN provides network isolation capabilities for Grid'5000 users' experimentations, via a high-level, user-driven interface to VLANs (802.1Q). » Il reconfigure dynamiquement les switches réseau pour placer les interfaces des nœuds réservés dans un VLAN dédié, offrant une isolation complète de niveau 2. — [KaVLAN](https://www.grid5000.fr/w/KaVLAN)

**Quand l'utiliser** : quand une expérimentation a besoin d'un réseau isolé (pas d'interférence avec d'autres utilisateurs Grid'5000 sur le même segment L2), par exemple pour des tests réseau bas niveau, des protocoles nécessitant une topologie contrôlée, un cluster multi-nœuds nécessitant son propre plan d'adressage/DHCP, ou pour simuler un environnement réseau isolé de production.

**Trois types de VLAN** :

| Type | Nom OAR | Plage d'ID | Isolation | Accès |
|---|---|---|---|---|
| Local | `kavlan-local` | 1-3 | Complètement isolé (« No IP routing is configured in any router ») | Via une passerelle SSH dédiée `kavlan-<vlanid>` |
| Routé (routed) | `kavlan` | 4-9 | Routé au niveau 3, joignable depuis le reste de Grid'5000 | Direct, pas de passerelle nécessaire |
| Global | `kavlan-global` | 10-21+ | S'étend sur tous les sites Grid'5000 (encapsulation 802.1ad), « exactly 1 and only 1 global VLAN provided by site » | Même réseau L2 à travers les sites, pas de routage nécessaire entre nœuds |

— [KaVLAN](https://www.grid5000.fr/w/KaVLAN)

**Réservation via OAR** (nécessite un job de type `deploy`, car KaVLAN implique de reconfigurer la pile réseau de l'OS) :
```
oarsub -t deploy -l {"type='kavlan-local'"}/vlan=1+/nodes=3 -I
```
Exemple VLAN routé avec un cluster ciblé :
```
oarsub -t deploy -l {"type='kavlan'"}/vlan=1,{"cluster='suno'"}/nodes=3 -I
```
Exemple VLAN global :
```
oarsub -t deploy -l "{type='kavlan-global'}/vlan=1+nodes=1,walltime=0:30" -I
```
— [KaVLAN](https://www.grid5000.fr/w/KaVLAN), [Advanced KaVLAN](https://www.grid5000.fr/w/Advanced_KaVLAN)

**Récupérer l'ID du VLAN attribué** :
```
kavlan -V              # depuis le job
kavlan -V -j JOBID      # depuis l'extérieur du job
```

**Déploiement avec assignation automatique au VLAN** :
```
kadeploy3 -f $OAR_NODEFILE -k -e debian11-big --vlan `kavlan -V`
```

**Résolution DNS dans le VLAN** : les nœuds prennent un nom d'hôte du type `<nom>-<numero>-kavlan-<id>.<site>.grid5000.fr` (ex. `suno-30-kavlan-4.sophia.grid5000.fr`) ; les noms d'hôte par défaut ne sont plus joignables une fois le nœud basculé dans le VLAN.

**Contrôle DHCP** : `kavlan -e` (activer le serveur DHCP intégré), `kavlan -d` (désactiver).

**Limitations à connaître pour un VLAN local** : montage NFS de `/home` susceptible d'échouer, les environnements avec flags `-nfs`, `-big`, `-std` peuvent ne pas démarrer correctement — cohérent avec l'isolation complète de niveau 3 (pas de routage vers les serveurs NFS du site).
— [KaVLAN](https://www.grid5000.fr/w/KaVLAN)

---

## 5. Accès HTTP/HTTPS aux services tournant sur un nœud (proxy inverse)

### 5.1 Principe et format d'URL

Grid'5000 fournit un proxy inverse pour accéder depuis l'extérieur (navigateur, client HTTP) à un service web tournant sur un nœud, sans configuration réseau côté nœud :

> « Whenever you need to connect to a web interface or web API served by a Grid'5000 node using HTTP or HTTPS, you can use Grid'5000 reverse proxy. »
— [HTTP/HTTPs access](https://www.grid5000.fr/w/HTTP/HTTPs_access)

Formats d'URL documentés :
- HTTP (port 80 sur le nœud) : `https://<node>.<site>.http.proxy.grid5000.fr/`
- HTTPS (port 443 sur le nœud) : `https://<node>.<site>.https.proxy.grid5000.fr/`
- HTTP sur port 8080 : `https://<node>.<site>.http8080.proxy.grid5000.fr/`
- HTTPS sur port 8443 : `https://<node>.<site>.https8443.proxy.grid5000.fr/`

Exemple donné : `https://paravance-81.rennes.http.proxy.grid5000.fr`

— [HTTP/HTTPs access](https://www.grid5000.fr/w/HTTP/HTTPs_access)

**Remarque importante pour l'architecture** : la connexion au proxy elle-même se fait toujours en HTTPS (`https://...`), quel que soit le protocole utilisé côté nœud (même pour un service qui écoute en HTTP simple sur le nœud, l'URL commence par `https://` et inclut `.http.` dans le nom d'hôte). Le nom du sous-domaine encode le protocole/port cible, pas le schéma de l'URL du proxy lui-même.

### 5.2 Authentification

« Please note that the reverse proxy needs authentication using your Grid'5000 credentials. » — [HTTP/HTTPs access](https://www.grid5000.fr/w/HTTP/HTTPs_access)

La documentation consultée précise que l'authentification utilise les identifiants Grid'5000, mais **le mécanisme exact (HTTP Basic Auth, formulaire, certificat client) n'a pas pu être confirmé verbatim** dans les extraits obtenus — à vérifier directement sur la page avant implémentation d'un client automatisé (ex. script Python effectuant des requêtes HTTP vers ce proxy devra probablement gérer une authentification HTTP Basic avec login/mot de passe Grid'5000, mais cela reste à confirmer empiriquement ou en relisant la page en détail).

### 5.3 Limitation connue (certificat TLS)

Le certificat TLS ne couvre pas nécessairement `*.proxy.grid5000.fr` de façon générique selon la doc extraite (mention d'un possible avertissement de certificat dans le navigateur) — point à vérifier empiriquement, car les extractions automatisées sur ce point n'ont pas produit de citation exacte fiable. Pas de mention trouvée sur un support WebSocket.

### 5.4 Méthode alternative : tunneling SSH

Pour un contrôle plus fin (WebSocket, ports non-standards, pas de dépendance à une authentification web tierce), Grid'5000 documente l'usage du tunneling SSH classique :

> « Another way to access a web service running inside Grid'5000 (on a node), is to use the OpenSSH forwarding feature, either with the embedded SOCKS proxy (-D option) or with local (-L) or remote (-R) port forwarding. »
— [HTTP/HTTPs access](https://www.grid5000.fr/w/HTTP/HTTPs_access), détails pratiques sur [SSH](https://www.grid5000.fr/w/SSH)

**Proxy SOCKS5** (utile si accès à plusieurs services/ports sans connaître à l'avance les ports) :
```bash
ssh login@access.grid5000.fr -D 7777
```
puis configurer le navigateur/client pour utiliser `localhost:7777` comme proxy SOCKS5.

**Redirection de port locale** (`-L`) — exposer un service du nœud sur `localhost` :
```bash
ssh ssh_gateway -L 1111:remote_server:2222
```
Exemple d'usage cité : accéder à un notebook Jupyter tournant sur un nœud Grid'5000 via un navigateur local sur le port 1111.

**Redirection de port distante** (`-R`) — exposer un service local vers Grid'5000 :
```bash
ssh ssh_gateway -R 1111:local_server:2222
```
— [SSH](https://www.grid5000.fr/w/SSH)

### 5.5 Accès SSH de base et configuration recommandée

- Passerelle : `access.grid5000.fr`, authentification par clé SSH. — [SSH](https://www.grid5000.fr/w/SSH)
- Rebond vers un site via `ProxyJump` (OpenSSH ≥ 7.3) :
```bash
ssh -J g5k_login@access.grid5000.fr g5k_login@nancy
```
ou dans `~/.ssh/config` :
```
Host fnancy
  User g5k_login
  ProxyJump access.grid5000.fr
```
- Configuration `ProxyCommand` plus flexible (motif générique `*.g5k`) :
```
Host g5k
  User g5k_login
  Hostname access.grid5000.fr
  ForwardAgent no

Host *.g5k
  User g5k_login
  ProxyCommand ssh g5k -W "$(basename %h .g5k):%p"
  ForwardAgent no
```
permettant ensuite `ssh nancy.g5k` ou `scp myfile nancy.g5k:`.
— [SSH](https://www.grid5000.fr/w/SSH)

---

## 6. Transfert de fichiers (envoi vers Grid'5000 / rapatriement des résultats)

### 6.1 rsync recommandé plutôt que scp

Recommandation explicite pour la performance, en particulier pertinente pour synchroniser des jeux de données ou rapatrier des résultats de calcul :

> « Use rsync instead of scp for better performance with multiple files. » — [Getting Started](https://www.grid5000.fr/w/Getting_Started)

Justification technique (page dédiée [Rsync](https://www.grid5000.fr/w/Rsync)) :
- « its protocol is more efficient. scp considers one file after the other, which doesn't perform very well on network links with high bandwidth but medium latency » — pertinent typiquement pour le lien inter-site Grid'5000 ou le lien labo↔nœud.
- « [scp] performs poorly (compared to rsync) when transfering many small files (your typical source tree). »
- Transfert incrémental : « when a remote copy is already present, rsync only transfers the differences between your local copy and the remote copy. This is very useful during development, because you often have to transfer only small changes. » — particulièrement utile pour re-synchroniser un dataset partiellement modifié ou re-tenter un transfert interrompu.

Exemple de commande donné :
```bash
rsync -avzP source remotelogin@remotehost:/tmp
```
— [Rsync](https://www.grid5000.fr/w/Rsync)

**Piège de syntaxe à connaître** (différence rsync/scp sur le slash final) :
- Avec `scp`, `scp source rlogin@rhost:/tmp` et `scp source/ rlogin@rhost:/tmp` sont équivalents.
- Avec `rsync`, ce n'est PAS le cas : `source` (sans slash) crée un répertoire `source` dans la destination contenant les fichiers ; `source/` (avec slash) copie le contenu directement dans le répertoire de destination, sans créer de sous-répertoire.
— [Rsync](https://www.grid5000.fr/w/Rsync)

### 6.2 Exemple scp basique (petits transferts ponctuels)

```bash
scp myfile.c login@access.grid5000.fr:nancy/targetdirectory/mytargetfile.c
```
— [Getting Started](https://www.grid5000.fr/w/Getting_Started)

### 6.3 Bonnes pratiques pour de gros volumes (ex. poids de modèles ML)

En combinant les éléments documentés ci-dessus, pour une architecture qui synchronise des datasets/poids de modèles vers Grid'5000 et rapatrie des résultats :

1. **Utiliser rsync**, pas scp, pour tout transfert de dataset ou de checkpoint de modèle volumineux — meilleure tolérance à la latence, reprise incrémentale en cas d'échec/interruption, évite de re-transférer un gros fichier de poids déjà présent si seule une partie a changé. — [Rsync](https://www.grid5000.fr/w/Rsync), [Getting Started](https://www.grid5000.fr/w/Getting_Started)
2. **Passer par `access.grid5000.fr`** comme point d'entrée SSH/rsync (`rsync -avzP mydata/ login@access.grid5000.fr:site/targetdir/`), le `home` étant propre à chaque site (§1.1) — bien cibler le site de destination dans le chemin distant.
3. **Pour des données destinées à plusieurs jobs/expériences ou plusieurs sites** : les placer sur un **Group Storage** (§2) plutôt que sur un `home`, pour éviter de re-transférer le même dataset/modèle à chaque nouveau job et pour dépasser les quotas `home` (25GB soft / 200-400GB max). C'est le mécanisme documenté conçu pour des volumes de plusieurs To partagés entre utilisateurs/jobs.
4. **Pour un besoin de stockage local très rapide, propre à un nœud, entre plusieurs jobs successifs sur le même nœud** (ex. cache local de dataset pour I/O rapide pendant l'entraînement) : envisager le **Disk reservation** (§2.10) — mais attention, ces disques ne sont pas nettoyés automatiquement et ne sont pas partagés entre nœuds.
5. **Aucune limite de bande passante n'est documentée** pour le trafic Internet sortant/entrant des sites (§4.2) au-delà du fait que tout le trafic IPv4 est NATé et journalisé ; le lien inter-site Grid'5000 (RENATER, §4.1) est nettement plus rapide (dédié 10Gbit/s a minima) que la plupart des liens Internet classiques — privilégier le stockage Group Storage local à un site pour des transferts répétés entre nœuds d'un même site plutôt que de retélécharger depuis l'extérieur à chaque job.
6. **Pour rapatrier des résultats de calcul automatiquement** (ex. depuis un script d'orchestration externe) : deux approches documentées existent —
   - rsync/scp classique via `access.grid5000.fr` comme gateway SSH (nécessite des clés SSH configurées, §5.5) ;
   - si le job expose un service HTTP de collecte (ex. un petit serveur de fichiers temporaire sur le nœud), le proxy inverse HTTPS (§5.1) permet d'y accéder depuis l'extérieur sans tunnel SSH, mais nécessite de gérer l'authentification par identifiants Grid'5000 (mécanisme exact non confirmé, §5.2) — le tunnel SSH (`-L`) reste l'option la mieux documentée et la plus prévisible pour une architecture automatisée.

---

## 7. Points explicitement non confirmés / à vérifier avant mise en production

Cette section liste, par transparence, ce qui n'a **pas** pu être établi avec certitude à partir de la documentation consultée, pour éviter tout risque de fabrication :

- **Mécanisme exact d'authentification du proxy HTTP/HTTPS** (§5.2) : confirmé que des « identifiants Grid'5000 » sont requis, mais le protocole précis (Basic Auth HTTP, formulaire web, cookie de session) n'a pas pu être cité verbatim depuis la page source. À vérifier directement sur [HTTP/HTTPs access](https://www.grid5000.fr/w/HTTP/HTTPs_access) (idéalement en se connectant réellement) avant de coder un client HTTP automatisé.
- **Support WebSocket par le proxy inverse** : aucune mention trouvée, ni pour ni contre.
- **Statut exact et date de dépréciation de `storage5k`** (§2.11) : signalé comme remplacé par Group Storage via une source secondaire (résumé de recherche), pas une citation directe vérifiée. Ne pas s'appuyer sur `storage5k` dans une nouvelle architecture ; utiliser Group Storage.
- **Chiffres précis de capacité/débit par site de Group Storage** (§2.6) : donnés à titre indicatif, extraits via un outil de résumé automatisé, non recopiés caractère par caractère depuis la source. À revérifier avant de dimensionner une architecture de stockage.
- **Existence d'un job type OAR dédié pour « réserver » explicitement du Group Storage** (au sens capacité/bande passante garantie) : non trouvée dans la documentation — l'accès semble être une question d'appartenance à un groupe Unix/NFS, pas une ressource réservable via OAR comme le sont les nœuds, VLANs ou disques locaux.
- **Limite de bande passante ou de connexions sortantes par nœud** : aucune mention trouvée (documentation muette sur ce point, ce qui ne garantit pas l'absence de limite technique réelle).

---

## Sources consultées (liste complète)

- [Storage](https://www.grid5000.fr/w/Storage)
- [Group Storage](https://www.grid5000.fr/w/Group_Storage)
- [Storage Manager](https://www.grid5000.fr/w/Storage_Manager)
- [Disk reservation](https://www.grid5000.fr/w/Disk_reservation)
- [Getting Started](https://www.grid5000.fr/w/Getting_Started)
- [FAQ](https://www.grid5000.fr/w/FAQ)
- [Grid5000:Network](https://www.grid5000.fr/w/Grid5000:Network)
- [IPv6](https://www.grid5000.fr/w/IPv6)
- [Reconfigurable Firewall](https://www.grid5000.fr/w/Reconfigurable_Firewall)
- [KaVLAN](https://www.grid5000.fr/w/KaVLAN)
- [Advanced KaVLAN](https://www.grid5000.fr/w/Advanced_KaVLAN)
- [HTTP/HTTPs access](https://www.grid5000.fr/w/HTTP/HTTPs_access)
- [SSH](https://www.grid5000.fr/w/SSH)
- [Rsync](https://www.grid5000.fr/w/Rsync)
- [HPC and HTC tutorial](https://www.grid5000.fr/w/HPC_and_HTC_tutorial)
