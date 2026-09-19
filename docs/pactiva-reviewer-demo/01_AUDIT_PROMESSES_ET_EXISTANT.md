# 01 — Audit : ce que le papier promet, ce qui existe, ce qui contraint

> Sources vérifiées le 16–17 septembre 2026 dans le dépôt (`jurix2026-short-paper/`, `frontend/`, `backend/`, `research/`, `data/thematic-layer/`) et sur le VPS de production.

## 1. Promesses du papier court (à tenir sur la page)

| # | Promesse | Où dans le papier | Ce qui existe | Sur la page |
|---|---|---|---|---|
| P1 | La couche thématique avec ses **votes individuels** | résumé ; `06-conclusion.tex` § Availability | `data/thematic-layer/votes.jsonl` (28 242 votes, clés `(document, index, annotator)`) | téléchargement, **après pseudonymisation** |
| P2 | La **piste d'arbitrage** et le **gold gelé** | idem | `gold.jsonl` (9 414 décisions : classe d'accord, palier de cascade, proposition, décision, tally, confiance) | téléchargement + affichage par phrase dans le visualiseur |
| P3 | Le **codebook** | idem | guide de l'atelier `frontend/content/help/` (thèmes, vocabulaire, segmentation, certitude) en français ; vocabulaire des 20 thèmes avec descriptions dans `taxonomies.json` | page « Codebook » générée en anglais depuis la spécification (définitions des 20 thèmes, règles de segmentation, multi-label), lien vers le guide complet |
| P4 | Le **protocole** | idem | `03-methodology.tex` (annotation indépendante, juges isolés, cascade 46,8 / 48,3 / 4,9 %, projections à la lecture, bootstrap par document) | section « Protocol » en anglais, reprise du papier |
| P5 | Les **prompts exacts des quatre juges** | idem | `data/thematic-layer/prompts/` (v9.2 : Fable, Mistral, claude/codex + runbooks + README de provenance) | téléchargement + lecture en ligne |
| P6 | Les **projections gelées** et l'**empreinte** | idem | `taxonomies.json` (specVersion 1, gelé le 13 sept.) ; empreinte du jeu `7116e627f528c557…` dans `manifest.json` | affichées en tête des téléchargements ; commutateur T20/T11 dans le visualiseur |
| P7 | La **plateforme d'annotation** (source + instance en ligne) | idem ; mot-clé *annotation platform* | dépôt GitHub public ; instance `pactiva.legal` (connexion requise pour l'atelier) ; `/public` liste les projets publiés | liens « Source », « Open the platform », « Public projects » |
| P8 | Les **quatre juges LLM** sur les mêmes phrases | `03-methodology.tex` | `judges.jsonl` (37 656 lignes ; `claude`, `codex`, `mistral`, `fable`) | téléchargement + colonnes du visualiseur |
| R1 | Résultats rapportés : α-MASI 0,658 → 0,725 ; plafond humain κ 0,859 ; Legal-BERT κ 0,720 (T11) ; juges 0,27–0,58 | `04-results.tex`, `tables/systems.tex` | `research/runs/legalbert_T11/results.json`, matrice des taxonomies | tableau « Key figures » généré, avec la provenance de chaque chiffre |

Point d'attention : **le fichier `votes.jsonl` versionné contient les identifiants réels des trois annotatrices**, et le dépôt est public. La pseudonymisation est le premier lot d'exécution (§ 05).

## 2. Ce qui existe côté application

- **Site public** : Next.js 14 (App Router). La page `/` est un composant serveur en thème clair (`theme-light`). Tout ce qui est sous `(app)/` est protégé par `AuthGuard`. Le client d'API n'ajoute d'en-tête d'authentification que si un jeton existe : un endpoint `AllowAny` se consomme sans compte. Un 401 déclenche une redirection globale vers la connexion : la page publique ne doit appeler que des endpoints `AllowAny`.
- **Système de style** : charte `docs/pactiva/charte-graphique.md`, jetons dans `frontend/design-tokens.json` et `globals.css`, classes Tailwind sémantiques, primitives (`Button` à machine d'états, `Panel`, `Disclosure`), garde anti-hex (`npm run check:colors`), harnais de contraste AA (`tests/contrastAA.test.ts`), e2e axe (`e2e/a11y.spec.ts`).
- **Composants purs réutilisables** : `presentTheme` / `presentationTooltip` (`lib/taxonomy/presentation.ts`), `CategoryChip`, `TaxonomyLegend`, `TaxonomySwitch`, `getThemeIcon`, `getThemeToken`. Les composants de l'atelier (`components/workspace/*`) dépendent des stores et de l'authentification.
- **API** : agrégation dans `backend/config/api_urls.py` ; endpoints publics existants (`health`, `config/flags`, `public/projects`) sur le modèle `permission_classes=[AllowAny]`, `authentication_classes=[]`. Limitation de débit : `ScopedRateThrottle` avec des scopes nommés (`login`, `burst`, `exports`, `register`, `password_reset`) ; aucun scope anonyme n'existe encore.
- **Exécution longue** : trois mécanismes en place (export en fil d'exécution, worker d'analyse, worker du Lab). Le proxy OpenLiteSpeed coupe à 60 s : toute inférence passe par un job et un sondage.
- **Environnement recherche sur le VPS** : `research/.venv` (Python 3.12) avec torch 2.13 et transformers 5.15 ; 4 vCPU, 15 Go de RAM dont 7 Go disponibles, 45 Go de disque libres. Le déploiement installe ce venv et écrit `LAB_RESEARCH_PYTHON` dans `backend/.env`.
- **Jeu de données figé** : `var/lab/datasets/0a2542a1-…/` sur le VPS et en local (empreinte `7116e627…`, 50 documents, 9 414 phrases, fichiers `sentences.jsonl` avec texte détokenisé, `votes.jsonl`, `gold.jsonl`, `judges.jsonl`, `reference.jsonl`, `splits.json`).
- **Modèle** : le package `pactiva_lab` entraînait Legal-BERT en mémoire ; la sauvegarde des poids, le rechargement et la sous-commande `predict` sont ajoutés par ce chantier (L0, fait), avec une segmentation `pysbd`.

## 3. Contraintes retenues

| Contrainte | Origine | Conséquence de conception |
|---|---|---|
| Papier court seul, pas de LLM | porteur, 17 sept. | pas de section « grey list » interactive ; une ligne de renvoi au papier long |
| Aucun nom d'annotateur | porteur ; `01_CHAINE_FINALE_ET_VALORISATION.md` | pseudonymes A1–A3 partout (fichiers, API, UI) |
| Texte CLAUDETTE : consultable, pas téléchargeable | licence tierce ; décision du porteur | texte servi par l'API pour l'affichage des 17 contrats hold-out ; zips sans texte |
| Anglais uniquement | lectorat JURIX | page, libellés de thèmes, messages d'erreur en anglais ; détection de langue légère à l'entrée |
| 60 s de proxy, 4 vCPU partagés | infrastructure | job + sondage ; 4 fils torch ; un job à la fois ; quotas |
| Charte et accessibilité | dossiers `docs/pactiva/` | jetons sémantiques, AA, clavier, `reduced-motion`, e2e axe sur `/` |
| Déploiement par la porte de tests | `deploy/deploy-claire.sh` | pytest + tsc + vitest verts avant tout envoi |
