# 08 — Batterie de tests et critères d'acceptation

> Pyramide du dépôt : unitaires purs (pytest / vitest) → API DRF (pytest) → composants avec MSW (vitest) → e2e Playwright (a11y, parcours) → contrôle manuel en production. Les cas tabulés sont dans `08a_cas-de-tests.csv`.

## 1. Recherche (`research/tests`)

- Aller-retour `save` / `load` : mêmes probabilités à 1e-5, ordre des classes préservé (fait).
- `predict` CLI : segmentation (paragraphes durs, listes numérotées), contexte ±1 borné au document, une ligne par phrase, `model.checkpoint` renseigné (fait).
- Segmentation : texte vide → 0 phrase ; 401 phrases → tronqué à `MAX_SENTENCES` ; retours chariot Windows.

## 2. Publication (`scripts/tests` ou test du script)

- Pseudonymisation stable : même identifiant → même pseudonyme ; trois pseudonymes exactement ; aucun identifiant réel dans les fichiers générés (le test lit la liste depuis le jeu figé et l'oppose au contenu des sorties).
- Aucun champ `text` dans les fichiers publiés.
- Empreinte du jeu inchangée ; nombre d'enregistrements identique avant/après.
- `RELEASE.json` : chaque téléchargement listé existe, taille et SHA-256 exacts.

## 3. API (`backend/tests/test_demo_api.py`)

- `manifest` : 200 sans authentification ; champs requis ; aucun identifiant réel.
- `contracts` : exactement les 17 documents de la population `holdout` ; `contracts/{autre}` → 404.
- `contracts/{doc}` : votes pseudonymisés (`A1`–`A3`), gold, juges, `unfair` ; le texte est présent (affichage) ; aucun champ `annotator` réel.
- `classify` : 400 `empty`, `too_long`, `not_english`, `unknown_document` ; 403 si `DEMO_ACCESS_CODE` défini et en-tête absent ; 503 quand 3 jobs attendent ; 429 au-delà de `demo_burst`.
- Cycle de vie du job : avec `DEMO_PREDICT_COMMAND` simulé → `queued` → `running` → `done`, `result.sentences` non vide, `in.json` supprimé, `timings` renseignés ; échec du sous-processus → `failed` avec `error.code`, sans trace dans `result`.
- Comparaison : pour `source=contract`, `comparison.summary.accuracyT11` et `kappaT11` calculés sur les phrases retournées ; κ = 1 quand la prédiction simulée recopie le gold.
- Purge : jobs de plus de 24 h supprimés.
- Journal : aucun texte dans les journaux capturés (`caplog`).

## 4. Frontend (`frontend/tests/demo*.test.tsx`)

- `labels.en` couvre tous les codes T20 et T11 de `taxonomies.json`.
- `DemoPanel` : bouton désactivé si vide ; compteur ; refus > 60 000 ; message si non anglais ; onglet contrat liste 17 entrées (MSW) ; état `pending` pendant le job ; 429 → bandeau.
- `useDemoJob` : sondage 1 s puis 3 s ; arrêt sur `done` / `failed` / 3 min.
- `ResultsViewer` : segments calculés aux changements de thème ; TOC cliquable ; filtre « disagreements only » ; commutateur T11/T20 projette le gold ; export JSON/CSV sans texte pour un contrat.
- Contraste : `tests/contrastAA.test.ts` inchangé et vert (aucune nouvelle couleur).
- Garde anti-hex : nouveaux fichiers dans `GUARDED`, `npm run check:colors` vert.

## 5. e2e (`frontend/e2e`)

- `a11y.spec.ts` : `/` sans violation sérieuse ou critique.
- `welcome.spec.ts` : `/welcome` → `/` ; en-tête « A Thematic Layer for CLAUDETTE » ; liens `Sign in` et `Français` → `/presentation`.
- `demo.spec.ts` (MSW ou API réelle locale) : coller un texte → résultat affiché avec au moins un segment.

## 6. Production (manuel, checklist L7)

| # | Vérification | Attendu |
|---|---|---|
| 1 | `https://pactiva.legal/` en navigation privée | page anglaise, thème clair, aucune requête 401 dans la console |
| 2 | Coller 3 paragraphes anglais → Classify | résultat en < 20 s, segments et chips visibles |
| 3 | Déposer un `.txt` | même comportement ; fichier non envoyé tant que Classify n'est pas cliqué |
| 4 | Choisir « Headspace » | colonnes Gold / A1–A3 / Judges ; résumé avec exactitude et κ |
| 5 | Coller un texte français | refus immédiat, message anglais |
| 6 | 7 classifications en une minute | 7ᵉ refusée avec le bandeau de quota |
| 7 | Télécharger le zip, vérifier le SHA-256 affiché | identique |
| 8 | `grep -R "elazhar\|ouali\|boulaich"` sur le zip décompressé | aucun résultat |
| 9 | Tableau des chiffres clés | valeurs égales à celles du papier (0,658 ; 0,725 ; 0,859 ; 0,720 ; 0,581) |
| 10 | Lecteur d'écran / clavier | onglets, liste, lignes, TOC atteignables ; `aria-live` annonce l'état |
| 11 | `/presentation` | ancienne page française intacte |
| 12 | Console du VPS pendant un job | RSS du sous-processus < 1,6 Go, fin en < 30 s, `in.json` supprimé |
