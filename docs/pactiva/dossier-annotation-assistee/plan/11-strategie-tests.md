# Stratégie de tests — MSW · Vitest · Playwright · pytest

Principe : **le moteur (pur) est la cible n°1** (tests exhaustifs, rapides, sans I/O), puis
les invariants de données (pytest), puis l'UX (Vitest + Playwright), avec **MSW** pour
isoler le front du réseau. Tout entre dans le **gate de déploiement** (`deploy/deploy-claire.sh`).

## 1. Moteur de triage — Vitest (PUR, prioritaire)
Cible : `src/lib/triage/engine.ts`. Source des cas : `plan/11-cas-tests.csv` (golden set).
- **Couverture des 5 niveaux** : chaque ligne du golden set → `level`, `action`, `labelMode`,
  `labels` (primaire/secondaire), `boundary`, `override?` attendus.
- **Pré-résolutions** : override anti-refuge (impose le précis, trace override) ; cluster→multi
  (garde les deux) ; refuge jamais en secondaire (assert sur toute sortie multi).
- **Choix du primaire** : préséance (LICENSE_IP>…) ; majorité ; repli priorité.
- **Frontière** : 3/3→hard ; 2/3→soft ; trigger structurel→hard.
- **Property-based** (fast-check) : pour tout triplet de votes parmi les 20 codes,
  (1) un seul `primary`, (2) aucun refuge en `secondary`, (3) `level ∈ {C1..C5}`,
  (4) `mono` ⇒ 1 label, `open` ⇒ 0 label + candidates non vide.
- **Déterminisme** : mêmes entrées → même sortie (idempotence).
- **< 2 juges** : renvoie `null`/`level absent` (carte masquée).

## 2. Parité front/back — Vitest + pytest
- Le **golden set** (`11-cas-tests.csv` → fixture JSON partagée) est passé à `triageEngine`
  (TS) **et** `triage.py` (Python). Assert : `level` + `proposal` **identiques**.
- Garantit qu'une seule source de règles (YAML) produit le même triage des deux côtés.

## 3. Invariants de données — pytest (backend)
- `ClauseTheme` : **exactly-one-primary** (rejet si 0 ou ≥2 primary) ; **refuge≠secondary**
  (rejet `PREAMBLE_SCOPE`/`MISC_BOILERPLATE` en secondary) ; unicité (clause, theme).
- **Rétro-compat** : lecture `theme` (scalaire) == primaire ; migration legacy → 1 ClauseTheme.
- **Batch** `clauses:batch` : atomique (tout ou rien), idempotent (`client_op_id` rejoués),
  conflit INV-2 rapporté par item sans casser le lot.
- **Frontière** : `boundary` molle modifiable tant que non `validated` ; merge/split → audit.
- **Audit/provenance** : override journalisé + réversible ; votes K juges conservés.

## 4. Réseau simulé — MSW (frontend)
- Handlers : `GET preannotations` (K juges, plusieurs versions), `GET …/triage` (option),
  `POST clauses:batch`, `PATCH /clauses`, `swap-primary`, `boundary`.
- Scénarios d'erreur : 409 INV-2, 422 invariant multi-label, latence/redite (idempotence),
  < 2 juges (triage off).

## 5. Composants — Vitest (RTL)
- `SuggestionCard` : rendu **par niveau** (C1 repliée/lot, C2 override, C3 multi, C4 majorité,
  C5 candidats), explication (contexte/décision/logique) présente, CTA primaire correct.
- `MultiThemePalette` : 1 primaire + N secondaires ; impossible d'ajouter un refuge en secondaire.
- `TriageQueue` : regroupement par niveau, navigation J/K, gestes (Entrée/A/S/-/M/D/U/X),
  compteur k/N, lot C1.
- **a11y** : rôles list/listitem/region, labels ARIA (« mistral : LICENSE_IP »), focus visible.

## 6. Parcours bout-en-bout — Playwright (e2e)
- **Parcours complet** : ouvrir la file → accepter le **lot C1** → **confirmer** un C2 (puis
  **annuler** l'override) → **valider le set** d'un C3 (puis **permuter**, puis **retirer 2nd**)
  → **garder/choisir l'autre** sur un C4 → **arbitrer** un C5 (choisir, créer multi, indécidable)
  → **fusion/scission** d'une frontière molle → **soumettre**.
- **Persistance** : recharger → l'état multi-label + frontières + niveaux sont conservés.
- **Zéro perte / étanchéité** : un pair ne voit pas la session de l'autre (réutilise les
  invariants de `dossier-tests-multi-annotation/`).
- **Clavier only** : tout le parcours réalisable sans souris.

## 7. Mesure — pytest
- `iaa_multilabel` : α MASI sur multi ; **α = κ sur mono** (sanity-check) ; κ par thème ;
  Pk/WindowDiff sur frontières. Vérifier que la validation humaine **augmente** α (cible ≥ 0,67).

## 8. Performance & robustesse
- File de **200+ items** virtualisée : rendu < 16 ms/frame, navigation fluide.
- Recalcul du triage au changement de version/juges : < 50 ms sur un doc moyen.
- Batterie agressive (inspirée `dossier-tests-multi-annotation/`) : simulation randomisée
  multi-annotateurs, réconciliation au modèle de référence, property-based.

## 9. Intégration au gate
Le `deploy/deploy-claire.sh` exécute : pytest (invariants + parité + IAA) **et** vitest
(moteur + composants + store) **et** (en CI dédiée) Playwright. Build bloqué si rouge.
Cibles indicatives : moteur **100 %** des branches ; composants ≥ 90 % ; e2e parcours nominal + 5 niveaux.
