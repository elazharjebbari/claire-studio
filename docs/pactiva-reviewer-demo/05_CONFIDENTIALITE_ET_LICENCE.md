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
