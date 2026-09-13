# 01 — Diagnostic AS-IS du module de résolution GOLD

> Audit du 13 septembre 2026, sur le code de `main` et les **données réelles de
> production** (consultation en lecture seule). Chaque constat est appuyé par une
> référence `fichier:ligne` ou une requête reproductible.

## 0. Le résumé exécutable

Le module GOLD est **architecturalement sain et bien testé** (114 tests backend +
61 frontend, tous verts), mais il est **totalement inopérant en production** pour une
raison unique et non documentée : **aucun des 50 documents n'est « prêt »**
(`readiness.ready = false` partout), ce qui désactive en cascade l'auto-résolution,
la prise de verrou, la décision (409) et la finalisation.

Deuxième constat majeur : **le chiffre de « 123 cas manuels » est un artefact**. Il
provient de l'état stocké le jour où les résolutions ont été créées, alors que les
annotations n'étaient pas terminées. Recalculé sur les données d'aujourd'hui, le
volume réel d'arbitrage est de **462 cas manuels sur les 50 documents**
(13 seulement sur les 3 documents déjà ouverts).

## 1. Le blocage fonctionnel (cause racine)

### 1.1 Le mécanisme

`backend/claire/gold/services.py:45` — `document_annotators()` définit les annotateurs
**attendus** pour un document comme : les membres de rôle `ANNOTATOR` qui ont une
**assignation** sur ce document (et, à défaut d'assignation, ceux qui ont réellement
une annotation).

`services.py:69` — `resolution_readiness()` compare ces attendus aux **soumis**.
`ready = (expected > 0 et submitted >= expected)`.

### 1.2 Les données de production

| Utilisateur | Rôle projet | Assigné | A réellement annoté |
|---|---|---|---|
| `zahra.boulaich` | annotator | 50 docs | **50** |
| `fatima.ouali` | annotator | 50 docs | **50** |
| `elazhar.jebbari` | **lead** | 50 docs | **50** |
| `jc.lamirel` | annotator | **50 docs** | **0** |

Conséquence mécanique : l'ensemble « attendu » = {zahra, fatima, **jc.lamirel**}
(les leads ne sont pas comptés comme annotateurs, cf. le commentaire de `services.py:48`),
l'ensemble « soumis » = {zahra, fatima}. Donc **2/3 → `ready = false`, sur les 50
documents**, définitivement : `jc.lamirel` ne soumettra jamais.

Vérifié en production : `documents_ready_total = 0`.

### 1.3 Les effets en cascade

| Couche | Effet observé | Référence |
|---|---|---|
| Auto-résolution | désactivée : `allow_auto` forcé à `{False, False}` | `services.py:224` |
| Décision | refusée — 409 « Résolution indisponible : 1 annotateur(s) sur 3 n'ont pas soumis » | `services.py:439` via `assert_resolution_ready` |
| Finalisation | impossible (`can_finalize` exige `readiness.ready`) | `services.py:355` |
| Verrou | **jamais acquis** : le hook est monté avec `enabled: ready` | `GoldWorkspace.tsx:54` |
| Inspecteur | affiche « Lecture seule (verrou non détenu) » | `GoldInspectorPanel.tsx:143` |
| Diagnostic | **invisible** : le bandeau affiche « 2/3 annotateurs ont soumis » **sans nommer qui manque** | `GoldWorkspace.tsx:176` |

C'est ce dernier point qui explique que le blocage n'ait jamais été diagnostiqué :
l'interface dit qu'il manque quelqu'un, jamais **qui**.

### 1.4 Pourquoi ce n'est pas un bug de code

La règle « on ne résout qu'une fois que tout le monde a fini » est **volontaire et
correcte**. Ce qui manque, c'est une **échappatoire déclarative** : la campagne a
changé (un annotateur assigné n'a jamais participé, un lead a annoté à sa place),
et le module n'offre aucun moyen de le dire. Le correctif doit donc être une
**option de configuration explicite et tracée**, pas un contournement du garde-fou.

## 2. Le vrai volume de travail

Simulation à blanc du moteur (`score_sentence`) sur les 50 documents avec les
annotations actuelles — aucune écriture :

| Niveau | Phrases | Part | Signification |
|---|---|---|---|
| `auto_1click` | 4 406 | 46,8 % | accord strict des 3 annotateurs (primaire **et** secondaires) |
| `auto` | 4 546 | 48,3 % | majorité ≥ 2/3 sur le primaire |
| **`manual`** | **462** | **4,9 %** | **divergence réelle → arbitrage humain** |
| Total | 9 414 | 100 % | |

49 documents sur 50 comportent au moins un cas manuel. Les plus chargés :
Airbnb 55, Endomondo 48, Microsoft 44, WorldOfWarcraft 23, Skype 22.

### 2.1 Ce que deviennent les 3 résolutions existantes

| Document | Stocké aujourd'hui | Après recalcul (simulé) |
|---|---|---|
| `Google` | **93 `empty`** (aucun annotateur vu) → 93 `manual` | 38 strict · 50 majorité · **5 manuels** |
| `Academia` | 127 strict · 43 majorité · **23 manuels** | 109 strict · 83 majorité · **1 manuel** |
| `9gag` | 47 strict · 85 majorité · **7 manuels** | inchangé : **7 manuels** |
| **Total** | **123 manuels** | **13 manuels** |

Les 425 `GoldSentence` existantes ne portent **aucune décision humaine**
(`decided = 0`, `ArbitrationEvent = 0`) : un recalcul est donc **sans risque de
perte** — il n'y a rien à préserver, et la règle « la décision humaine est sacrée »
(`services.py:262`) protégera de toute façon le travail à venir.

## 3. Ce qui est solide (à ne pas refaire)

L'audit confirme que le socle mérite d'être conservé tel quel :

- **Moteur de scoring pur** (`backend/claire/projects/gold_scoring.py`) : sans
  dépendance Django, déterministe (départage lexicographique), testé par golden cases
  et **parité TS↔PY vérifiée** ; la règle « les LLM ne sont jamais parties au conflit »
  y est appliquée sans exception.
- **Recompute idempotent** : n'écrit que les lignes réellement modifiées, sous
  `select_for_update`, et **ne touche jamais une décision humaine** (`services.py:262`).
- **Verrou exclusif à bail** (90 s, heartbeat 20 s, `steal` tracé) : contrôle
  d'exclusivité **sous le verrou de ligne, dans la transaction d'écriture** — la
  fenêtre TOCTOU est fermée (`services.py:_assert_holder`).
- **Garantie « gold figé »** : `assert_not_finalized` sur `decide`/`auto-resolve`,
  `finalize` borné à `index < n`, `reopen` réaligne le statut stocké.
- **Traçabilité** : `ArbitrationEvent` append-only (decide / override / auto / steal /
  finalize / reopen).
- **Export en deux couches** (`gold/export.py`) : décision *hard* + `tally` et votes
  bruts *soft* — le désaccord n'est jamais effacé, ce qui est la condition pour citer
  le dataset dans un article.

## 4. Les manques ergonomiques pour un arbitrage de volume

Le module a été conçu pour arbitrer, pas pour **enchaîner 462 décisions**. Écart
mesuré entre la spécification (`docs/pactiva/dossier-gold/`) et l'implémentation :

| Fonction spécifiée | Référence spec | État réel |
|---|---|---|
| Raccourcis `n`/`p` (conflit suivant/précédent) | `02-navigation/02-raccourcis.csv` | **absent** |
| Raccourcis `1..9` (adopter le k-ième vote) | idem | **absent** |
| `Espace`/`Entrée` (adopter le majoritaire) | idem | **absent** |
| `u` (annuler la dernière décision) | idem | **absent** |
| Décision multi-label : primaire **et** secondaires séparément | `03-ecrans/atelier…` | **absent** — l'UI renvoie toujours `proposedSecondaries` |
| Commentaire d'arbitrage par décision | idem | **absent** de l'UI (l'API et le modèle le supportent) |
| Badge « signal fort » humain ≠ LLM | idem | absent (champ déprécié côté moteur) |

Vérification : le seul `keydown` du module GOLD concerne l'autocomplétion des arbitres
et la fermeture de la modale d'aide — **aucun raccourci d'arbitrage n'existe**.

Trois manques supplémentaires, non spécifiés mais structurants :

1. **Impossible de choisir un thème hors candidats.** `GoldInspectorPanel.tsx:26`
   construit les candidats à partir des seuls votes d'annotateurs. Si les trois se
   trompent, l'arbitre **ne peut pas** trancher correctement.
2. **La navigation vise les « conflits », pas les cas manuels.** `needsAttention()`
   (`lib/gold/blocks.ts:14`) = `agreementClass !== "strict"`, ce qui inclut les
   4 546 cas déjà auto-résolus. Naviguer de conflit en conflit fait donc traverser
   ~5 000 phrases pour en trouver 462.
3. **Le cockpit ne compte pas les cas manuels.** Les compteurs exposés sont
   `decided / auto / strict / majority / divergence / highRisk` — l'arbitre ne peut
   pas savoir où est le travail restant.

## 5. Risques de qualité scientifique

- **Perte systématique des étiquettes secondaires sur les cas manuels** : l'UI envoie
  `proposedSecondaries`, calculé avec `secondary_min_annotators = 2` ; sur un cas
  divergent, ce jeu est presque toujours vide. Le gold arbitré serait donc
  **mono-label sur les cas les plus difficiles**, alors que le corpus est
  multi-étiquettes à 16,4 %.
- **Politique `advisory` en production** : les secondaires ne sont jamais promus
  automatiquement ; ils doivent donc l'être **par l'arbitre** — ce que l'UI ne permet
  pas. Les deux constats se combinent en une perte garantie d'information.

## 6. Points de vigilance mineurs (confirmés)

- **Duplication de la logique de complétude** : `projects/views.py:722-747` recalcule
  `expected/submitted/ready` en SQL pour le cockpit, en parallèle de
  `services.resolution_readiness()`. Deux implémentations = risque de divergence.
  (Le statut, lui, est déjà partagé via `compute_status()` — à imiter.)
- **`human_dissent`** est déclaré déprécié dans le moteur (toujours `False`) mais reste
  stocké, exposé dans le payload et utilisé comme clé de bloc côté frontend
  (`blocks.ts:20`) — code mort à signaler, pas à supprimer dans l'urgence.
