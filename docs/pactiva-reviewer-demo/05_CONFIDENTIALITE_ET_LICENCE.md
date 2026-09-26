# 05 — Confidentialité, anonymat, licence

## 1. Anonymat des annotatrices

**Règle** : aucun identifiant réel (nom d'utilisateur, e-mail, nom) n'apparaît dans les fichiers publiés, les réponses de l'API publique, l'interface, ni les dépôts.

**Mécanisme** : pseudonymes stables `A1`, `A2`, `A3`, attribués par ordre alphabétique des identifiants du jeu figé (fonction `pseudonymise()` partagée par le script de publication et par `claire/demo/services.py`). Le même identifiant reçoit toujours le même pseudonyme sur toute la ressource.

**Application** :
- `data/thematic-layer/votes.jsonl` est **réécrit** avec les pseudonymes (le fichier versionné change ; son README le dit).
- `manifest.json` : le champ `criteria.scope.annotators` reste vide ; aucune liste nominative n'est ajoutée.
- `frontend/public/downloads/` est généré depuis les fichiers pseudonymisés ; le script refuse d'écrire si un identifiant réel subsiste.
- L'API `contracts/{document}` pseudonymise à la lecture (le jeu figé sur le VPS garde les identifiants ; il n'est pas public).
- Le papier parle de « three trained annotators » : cohérent.

**Point réservé au porteur** : l'historique git du dépôt public contient des versions antérieures de `votes.jsonl` avec les identifiants. Deux options, à décider par le porteur : laisser en l'état (les identifiants sont ceux des co-autrices, déjà nommées comme autrices) ou réécrire l'historique de ce seul fichier. Rien n'est fait sans décision explicite.

## 2. Texte des contrats CLAUDETTE

- Licence tierce : **pas de redistribution**. Les fichiers publiés sont clés `(document, index)` ; le script de publication refuse tout champ `text`.
- Consultation à l'écran : l'API sert le texte des **17 contrats hold-out** pour le visualiseur (décision du porteur : essai en temps réel). Les exports côté navigateur d'un résultat sur un contrat CLAUDETTE omettent le texte et l'indiquent.
- `data/annotations/pilot_100/clauses.jsonl` (legal-kg) contient du texte CLAUDETTE et est versionné : signalé au porteur, hors périmètre de cette page.

## 3. Texte collé par les visiteurs

- Jamais en base, jamais dans les journaux applicatifs ; écrit dans un fichier temporaire du job (permissions 600), supprimé à la fin du job (succès ou échec) ; purge horaire de sécurité.
- Le résultat (phrases et thèmes) est conservé 24 h pour permettre le sondage et le rechargement de la page, puis purgé.
- `client_hash` : HMAC (clé serveur) de l'adresse IP tronquée (/24 IPv4, /48 IPv6) ; sert au quota et au diagnostic, sans permettre de retrouver l'adresse.

## 4. Quotas et bon usage

| Garde-fou | Valeur | Où |
|---|---|---|
| Quota horaire par adresse | 30 requêtes (`demo`) | `DEFAULT_THROTTLE_RATES` |
| Rafale | 6 par minute (`demo_burst`) sur `classify` | idem |
| Taille du texte | 60 000 caractères ; 400 phrases classées | client + API |
| Fichier | `.txt` ≤ 200 ko, lu dans le navigateur | client |
| Langue | ≥ 5 % de mots-outils anglais sur les 2 000 premiers caractères | client + API |
| File | 3 jobs en attente au plus, 1 en cours | runner |
| Délai | 120 s par job | runner |
| Code d'accès | `DEMO_ACCESS_CODE` (vide = ouvert) | API |

## 5. Journalisation

Un enregistrement par job : identifiant, source, document (si contrat), nombre de phrases, durées, statut, `client_hash`. Pas de texte, pas d'adresse.

## 6. Licence des artefacts publiés

La page reprend la formulation du dossier du papier court : *released under an open licence upon publication*. Le choix de la licence (CC BY 4.0 pour les données, MIT pour le code, par exemple) et le dépôt d'un DOI restent des décisions du porteur, consignées dans `docs/pactiva-jurix-short-paper/01_STRUCTURE_RECOMMANDEE.md`.

## 7. Accès reviewer à la plateforme (20 sept.)

Commande `manage.py reviewer_access` (backend), rejouable :

| Élément | Réglage | Protection de nos annotations |
|---|---|---|
| Compte partagé `jurix-reviewer` | rôle utilisateur `reviewer`, e-mail de service, mot de passe passé en argument, jamais stocké | pas de droit d'export (admins seulement) ; ne peut modifier le contenu d'aucune session d'autrui (`IsAnnotationOwner`) |
| Campagne `campagne-pactiva` | **verrouillée** (`locked`), le compte y est membre `reviewer` sans assignation | lecture des 150 sessions, comparaison humain ↔ juges, concordance ; **aucune nouvelle session** dans un projet verrouillé ni pour un membre `reviewer` (garde ajoutée dans `annotations/views.py`, 423 / 403) ; gold finalisé immuable |
| Bac à sable `jurix2026-sandbox` | même corpus et schéma, privé, non verrouillé ; le compte y est `annotator` avec les 50 documents assignés | les sessions des reviewers restent dans ce projet et n'entrent jamais dans la couche publiée |
| Noms à l'écran | les trois comptes ayant annoté reçoivent le nom d'affichage `Annotator A1/A2/A3` (ordre alphabétique des identifiants, même règle que les données) | réversible : `reviewer_access --restore-display-names` |

Vérifié en production le 20 sept. : connexion OK ; 150 sessions listées ; création de session dans la campagne → 423 ; dans le bac à sable → 201 ; export → 403 ; membres affichés `Annotator A1/A2/A3`.

Résidu connu : l'API des membres d'un projet expose aussi l'identifiant de connexion des co-auteurs (`elazhar.jebbari`, …) à côté du nom d'affichage ; l'interface montre le nom d'affichage en premier. Les co-auteurs sont nommés dans le papier (relecture en simple aveugle) ; si le porteur veut masquer aussi les identifiants, une option de l'endpoint des membres pour les comptes au rôle `reviewer` suffit.

Transmission des identifiants : par le canal des chairs (commentaire EasyChair) ou sur demande par e-mail ; la page publique annonce l'existence de l'accès sans le publier.

## 8. Compte invité et accès en un clic (20 sept., après-midi)

- `User.is_guest` (migration `accounts/0004`) + `GuestAccessMiddleware` : pour un invité, lecture des annotations, du gold et des juges ; écriture seulement sur ses propres sessions (`/annotations`, sauf commentaires, revues, partage) ; refus 403 explicite pour Lab, analyse, exports, audit, utilisateurs, imports, configuration de projet, membres, décisions gold. La barre latérale masque Analyse, Lab et Résultats de l'article (`isGuest`).
- Identifiants publiés sur la page (bouton « Sign in as reviewer ») : servis par le manifeste seulement si `DEMO_REVIEWER_PUBLIC=true` et `DEMO_REVIEWER_PASSWORD` définis sur le serveur. Décision du porteur du 20 sept. (« que le compte soit accessible »). Rotation : changer `DEMO_REVIEWER_PASSWORD` dans `.env`, relancer `reviewer_access --password …`, redémarrer `claire-studio`.
- Quotas : réglables sans redéploiement (`THROTTLE_DEMO_RATE`, `THROTTLE_DEMO_BURST_RATE`) ; levés le 20 sept. à la demande du porteur (100 000/h) ; trois classifications en parallèle (`DEMO_MAX_PARALLEL=3`, `DEMO_THREADS=2`), file de six.
- Vérifié en production : connexion en un clic → `/projects/campagne-pactiva/docs` ; barre latérale réduite ; cockpit gold lisible (composition strict / majorité / divergence, paliers) ; trois contrats classés en parallèle (32–48 s chacun) ; aucun 429.

## 9. Entrée directe dans les annotations (26 sept.)

Le compte reviewer n'a aucune assignation sur la campagne : la liste des documents lui présentait 50 lignes sans porte d'entrée. Corrigé :

- `/projects/<campagne>/docs` affiche, pour un lecteur sur un projet **gelé**, les **sessions existantes** (`A1`, `A2`, `A3`) ouvertes en un clic en lecture, plus un lien « Comparer » par document et un renvoi vers le bac à sable. Le mode est décidé par le **verrou du projet**, pas par le rôle : sur son bac à sable, le même compte retrouve « Annoter → » et ses 50 documents attribués.
- L'API `/projects/<slug>/documents` expose la matrice des sessions au rôle `reviewer` (déjà la règle de `/annotations`), restreinte aux membres **ayant annoté**.
- Identités : le nom d'affichage passe avant l'identifiant partout (`common/identity.display_name`), et l'identifiant de connexion n'est plus servi qu'à la supervision et à soi-même (matrice des sessions et liste des membres) — le résidu signalé au § 7 est levé.
- Confort : pour un invité, la visite guidée ne s'ouvre plus d'elle-même et le partage collaboratif est masqué.

Vérifié en production le 26 sept. : connexion en un clic → 150 liens de lecture et 50 liens de comparaison sur la campagne ; ouverture d'une session en lecture seule ; bac à sable → 50 boutons « Annoter », session éditable (« Ma session — édition »).
