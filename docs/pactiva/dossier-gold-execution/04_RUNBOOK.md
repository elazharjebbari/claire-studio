# 04 — Runbook agentique d'exécution

> Mode conservateur : inspecter avant de modifier · réutiliser l'existant · zéro
> refactoring gratuit · **aucune destruction de données** · un test avant chaque
> correctif · chaque lot vérifié avant de passer au suivant.
>
> Commandes de référence :
> ```
> backend  : cd backend && DJANGO_SECRET_KEY=x .venv/bin/python -m pytest tests/ -q
> frontend : cd frontend && npx vitest run && npx tsc --noEmit && npx next lint
> ```

## Vue d'ensemble

| Lot | Objectif | Bloquant pour l'arbitrage ? | État |
|---|---|---|---|
| **L1** | Débloquer : participants déclarés + diagnostic nommé + source unique | **OUI — sans lui, rien n'est possible** | ✅ backend fait |
| **L2** | Rendre le blocage visible et réparable depuis l'UI | oui (sinon rediagnostic à l'aveugle) | ⏳ |
| **L3** | Garde-fous de qualité du gold (auto-résolution, égalités) | **OUI — sinon le gold produit est faux** | ⏳ |
| **L4** | Inspecteur d'arbitrage complet (thème libre, secondaires, commentaire) | **OUI — sinon décisions impossibles/incomplètes** | ⏳ |
| **L5** | Vitesse : navigation « cas manuels » + raccourcis clavier + compteurs | non, mais ×3 sur le débit | ⏳ |
| **L6** | Robustesse : erreurs visibles, verrou sur finalize, confirmation, annulation | non, mais évite des gold faux | ⏳ |
| **L7** | Vérification en réel + procédure d'arbitrage | — | ⏳ |

---

## L1 — Déblocage : participants attendus déclarés ✅

**Objectif** : permettre de déclarer qui participe réellement, sans lever le garde-fou
de complétude ; nommer les manquants ; une seule implémentation cockpit/atelier.

| | |
|---|---|
| **Fichiers** | `backend/claire/gold/config.py`, `backend/claire/gold/services.py`, `backend/claire/projects/views.py`, `backend/tests/test_gold_participants.py` (nouveau), `backend/tests/test_gold_lifecycle.py` (assertions) |
| **Modifications** | `expected_annotators` dans la config (validé comme `arbiters`) ; `expected_annotator_ids()` → (ids, source) ; `readiness_payload()` pur ; `readiness_by_document()` (batch, cockpit) ; le cockpit cesse de recalculer en SQL |
| **Tests** | `pytest tests/test_gold_participants.py` (7 cas : blocage reproduit, noms exposés, déblocage, garde-fou maintenu, liste vide = historique, non-membre refusé, cockpit ≡ atelier) |
| **Succès** | 7/7 verts **et** suite complète sans régression |
| **Dépendances** | aucune |
| **Risques** | affaiblir le garde-fou → écarté : la complétude reste exigée sur la liste déclarée (test dédié) |
| **Rollback** | `git revert` ; la config vide restaure exactement le comportement antérieur |

**Résultat mesuré** : 7/7 + 812 tests backend verts (2 assertions d'égalité stricte
adaptées — comportement inchangé, 3 champs additifs).

---

## L2 — Rendre le blocage visible (frontend)

**Objectif** : qu'un arbitre bloqué comprenne **en une phrase** pourquoi, et qu'un
lead puisse corriger sans passer par la base.

| | |
|---|---|
| **Fichiers** | `frontend/src/lib/gold/types.ts`, `GoldWorkspace.tsx` (bandeau), `GoldCockpit.tsx`, `GoldConfigStudio.tsx` (+ section Participants, réutilise `ArbiterPicker`), tests `goldWorkspace/goldConfig` |
| **Modifications** | `GoldReadiness` gagne `expectedUsernames`/`missingUsernames`/`source` ; le bandeau nomme les manquants + lien config pour lead/admin ; studio : sélecteur « Participants attendus » |
| **Tests** | bandeau nommant le manquant ; studio enregistrant la liste ; cockpit affichant la source |
| **Succès** | vitest vert ; `tsc` et `lint` propres |
| **Risques** | camélisation DRF → les 3 champs sont des **listes de chaînes** et un scalaire (jamais un dict à clés libres) |
| **Rollback** | revert du commit ; le backend reste compatible (champs additifs ignorés) |

---

## L3 — Garde-fous de qualité du gold

**Objectif** : empêcher le module de produire un gold **faux mais plausible**.

Trois failles vérifiées :

1. **Couverture solitaire** : une phrase annotée par un seul annotateur est classée
   « accord strict », auto-résolue en 1 clic, confiance 1,0 (vérifié :
   `score_sentence([Vote('a','META'), Vote('b',None), Vote('c',None)])`).
2. **Égalité alphabétique** : sur un 1-1-1, la proposition est le **vainqueur
   alphabétique** (vérifié : renommer un thème change la proposition) — et le rail
   « ✓ valider » l'adopte en un clic.
3. **Rail de validation sur cas manuel** : rien ne distingue visuellement une
   validation de consensus d'une adoption arbitraire.

| | |
|---|---|
| **Fichiers** | `backend/claire/gold/services.py` (garde d'auto-résolution), `backend/claire/projects/gold_scoring.py` (**champ additif** `n_covering` + `tie`), miroir `frontend/src/lib/goldScoring.ts`, `GoldReadingPanel.tsx`, tests de parité + golden |
| **Modifications** | (a) l'auto-résolution exige **≥ 2 annotateurs couvrants** — garde posée dans *services*, pas dans le moteur pur ; (b) le moteur expose `n_covering` et `tie` (booléen d'égalité en tête) **sans changer aucune décision** ; (c) le rail « ✓ » disparaît sur `autoLevel === 'manual'` ou `tie` — l'arbitre doit choisir explicitement |
| **Tests** | couverture solitaire non auto-résolue ; `tie` vrai sur 1-1-1 ; parité TS↔PY sur les nouveaux champs ; **golden cases inchangés** (aucune décision modifiée) |
| **Succès** | `test_gold_scoring` + `test_gold_parity` + `goldParity` verts, golden intacts |
| **Risques** | toucher au moteur pur → strictement additif, aucune valeur de décision modifiée (test de non-régression sur les golden) |
| **Rollback** | revert ; les champs additifs sont ignorés par l'UI antérieure |

---

## L4 — Inspecteur d'arbitrage complet

**Objectif** : rendre une décision d'arbitrage **possible et complète** (primaire +
secondaires + justification), y compris hors des votes.

| | |
|---|---|
| **Fichiers** | `GoldInspectorPanel.tsx`, `GoldWorkspace.tsx` (passe le commentaire), `frontend/src/lib/gold/types.ts`, tests `goldInspector` (nouveau) |
| **Modifications** | (a) candidats **numérotés et ordonnés de façon stable** (ordre du schéma, pas l'ordre des votes) ; (b) sélecteur « Autre thème… » sur tout le schéma ; (c) bloc **Secondaires** éditable (candidats + schéma complet, refuges désactivés, primaire exclu) ; (d) champ **commentaire** repliable envoyé dans `payload.comment` ; (e) affichage libellé + couleur de thème, plus seulement le code |
| **Tests** | décider un thème hors candidats ; ajouter/retirer un secondaire ; refuge refusé ; commentaire transmis ; une phrase `empty` reste décidable |
| **Succès** | vitest vert + un test d'API backend confirmant le stockage du commentaire et des secondaires |
| **Dépendances** | L2 (types) |
| **Risques** | surcharge visuelle → secondaires et commentaire **repliés par défaut** |
| **Rollback** | revert du composant (le backend acceptait déjà ces champs) |

---

## L5 — Vitesse d'arbitrage

**Objectif** : passer de ~6 actions souris par cas à 1–2 frappes.

| | |
|---|---|
| **Fichiers** | `frontend/src/lib/gold/blocks.ts`, `store/goldStore.ts`, `GoldWorkspace.tsx`, `GoldOutlinePanel.tsx`, `GoldCockpit.tsx`, `backend/claire/projects/views.py` (compteur `manual`), tests `goldBlocks`, `goldKeyboard` (nouveau) |
| **Modifications** | `nextManual()`/`prevManual()` + `manual` dans `outlineStats` ; filtre `"manual"` (défaut à l'ouverture) ; raccourcis `n/p`, `1..9`, `Entrée`, `u`, `?` **conformes à la spec d'origine** ; compteur « N cas manuels restants » (`aria-live`) ; colonne `manual` au cockpit |
| **Tests** | navigation saute bien aux `manual` ; raccourcis inertes sans verrou ; raccourcis inertes dans un champ de saisie ; compteur juste |
| **Succès** | vitest vert ; un parcours simulé de 3 cas au clavier |
| **Dépendances** | L4 (les numéros de candidats) |
| **Risques** | capture clavier parasite → garde `input/textarea/contenteditable` testée |
| **Rollback** | revert (fonctions pures additives) |

---

## L6 — Robustesse et sécurité de l'acte

| | |
|---|---|
| **Fichiers** | `backend/claire/gold/services.py` (verrou sur `finalize`/`reopen`, idempotence), `backend/claire/projects/views.py` (route `decide/undo`), `GoldWorkspace.tsx`, `useArbitrationLock.ts`, tests backend + frontend |
| **Modifications** | (a) `finalize_resolution`/`reopen_resolution` sous `select_for_update` + `_assert_holder` + idempotence ; (b) **erreurs affichées** (409/423/400) au lieu d'un saut silencieux ; (c) **confirmation avant finalisation** avec récapitulatif ; (d) **annulation** (`u`) tracée par un verbe `UNDO` (migration `AlterField` sur les `choices`, sans effet de schéma) ; (e) heartbeat tolérant à un échec réseau isolé |
| **Tests** | finalize sans verrou refusé ; double finalize idempotent ; undo restaure l'état moteur et trace l'événement ; message d'erreur rendu à l'écran |
| **Succès** | suites backend et frontend vertes |
| **Risques** | migration → `AlterField` sur `choices` uniquement (précédent identique : `gold/0002`) |
| **Rollback** | revert code ; la migration inverse est générée automatiquement |

---

## L7 — Mise en service et arbitrage réel

| Étape | Action | Vérification |
|---|---|---|
| 7.1 | Déployer (`DJANGO_SECRET_KEY=x ./deploy/deploy-claire.sh --allow-migrations`) | ligne « ✓ Déploiement OK @ sha » **et** `git rev-parse HEAD` serveur identique |
| 7.2 | Déclarer les participants réels dans le studio : `zahra.boulaich`, `fatima.ouali`, `elazhar.jebbari` | le cockpit passe de 50 `awaiting` à 50 `ready` |
| 7.3 | Recompute + auto-résolution sur un **document témoin** (`9gag`) | 132 phrases auto-résolues, **7 cas manuels** restants |
| 7.4 | Arbitrer les 7 cas au clavier, finaliser | `ArbitrationEvent` = 7 `decide` + 1 `finalize` ; gold figé |
| 7.5 | Étendre aux 49 autres documents | 462 cas manuels au total |
| 7.6 | Export gold + relance des mesures E5 | export deux couches complet, `gold-cascade` sur données réelles |

**Garde-fou de mise en service** : aucune écriture en production avant que 7.1 et 7.2
ne soient vérifiées, et le document témoin (7.3–7.4) sert de test de bout en bout
**avant** de toucher aux 49 autres.

---

## Critères d'acceptation du module

Le module est déclaré **prêt pour l'arbitrage réel** quand :

1. ✅ Un document réel passe à `ready` et le cockpit l'affiche.
2. ✅ Le bandeau nomme les participants manquants quand il en manque.
3. ✅ L'arbitre peut décider **n'importe quel thème du schéma**, primaire **et**
   secondaires, avec un commentaire optionnel.
4. ✅ Aucune phrase n'est indécidable (y compris une phrase non couverte).
5. ✅ Aucune validation en un clic n'est proposée sur une égalité ou un cas manuel.
6. ✅ L'auto-résolution exige au moins deux annotateurs couvrants.
7. ✅ `n` amène au cas manuel suivant ; `1..9` adopte un candidat ; `u` annule.
8. ✅ Toute erreur serveur produit un message lisible à l'écran.
9. ✅ La finalisation demande confirmation et exige le verrou.
10. ✅ Un parcours complet (ouvrir → arbitrer → finaliser → exporter) est couvert par
    un test automatisé de bout en bout.
11. ✅ Suites complètes vertes : backend et frontend, sans test désactivé.

## Migration des données existantes

**Aucune migration de données n'est nécessaire.** Les 425 `GoldSentence` des trois
résolutions ouvertes ne portent **aucune décision humaine** (`decided = 0`,
`ArbitrationEvent = 0`) : elles seront simplement rafraîchies par le premier recompute.
La règle « la décision humaine est sacrée » protège tout travail ultérieur, et aucune
ligne n'est supprimée (sauf phrases hors-bornes d'un document rétréci, cas absent ici).
