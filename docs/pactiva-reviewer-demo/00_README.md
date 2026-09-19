# Page reviewer Pactiva — démonstration du papier court JURIX 2026

> **19 septembre 2026 · statut : conception validée, exécution en cours (voir § Statut) · exécutant : session agentique (Claude Opus 5) sous la direction du porteur.**
> Périmètre arrêté par le porteur le 17 septembre : **le papier court uniquement** (*A Thematic Layer for CLAUDETTE*), **aucune extraction par modèle de langage**, page **en anglais**, **aucun nom d'annotateur** exposé, texte des contrats CLAUDETTE **consultable mais non téléchargeable**.

## Le problème

Les deux papiers renvoient le lecteur à `https://pactiva.legal`. Aujourd'hui cette adresse ouvre la page institutionnelle française de Pactiva : elle présente le produit, pas la recherche. Un reviewer qui vérifie la section *Availability* du papier court doit y trouver, sans compte et sans lire de code, **ce que le papier promet** : la couche thématique avec ses votes individuels, le gold gelé et sa piste d'arbitrage, les prompts des quatre juges, les projections gelées et leur empreinte, le codebook, le protocole, et la plateforme d'annotation.

## L'objectif

Faire de la page d'accueil la **page de vérification du papier** : tout ce qui est promis est visible ou téléchargeable en un clic, et le reviewer peut **exercer le classifieur Legal-BERT lui-même**, sur un texte qu'il colle, un fichier `.txt` qu'il dépose, ou l'un des **17 contrats CLAUDETTE tenus à l'écart de l'entraînement**, avec une lecture à la manière de l'atelier d'annotation (rail de couleur par thème, frontières de clauses, table des matières) et, pour les contrats CLAUDETTE, la comparaison phrase par phrase avec le gold, les trois annotateurs pseudonymisés et les quatre juges.

## Décisions clés (résumé exécutif)

| Aspect | Décision retenue | Pourquoi |
|---|---|---|
| Périmètre | Papier court seul ; le papier long est cité en une ligne, sans démonstration | Décision du porteur (17 sept.) ; l'extraction par LLM n'est pas rejouée |
| Modèle servi | Legal-BERT fine-tuné **T11**, recette E4.4 du papier (8 époques, contexte ±1, graine 42), **entraîné sur les 33 contrats de conception**, évalué et servi sur les 17 du hold-out | Les 17 contrats proposés en essai sont inconnus du modèle ; le reviewer compare modèle et gold sur du vrai hors-échantillon |
| Où tourne l'inférence | Sur le VPS, en CPU, dans `research/.venv` (torch déjà installé), via un **job + sondage** (délai proxy 60 s) | Un contrat de 200 phrases se classe en une quinzaine de secondes ; la file existante du Lab reste libre |
| Entrée du texte | Coller / déposer un `.txt` / choisir un contrat hold-out ; anglais seulement ; 60 000 caractères et 400 phrases au plus ; texte jamais conservé | Sécurité et coût maîtrisés ; le texte collé ne quitte pas le job |
| Segmentation | `pysbd` (règles, déterministe) avec frontières dures sur les paragraphes, repli ponctuation | Même granularité que CLAUDETTE (une ligne = une phrase), aucun modèle supplémentaire |
| Visualiseur | Composants **dédiés et purs** (`features/demo/`), réutilisant `presentTheme`, `CategoryChip`, `TaxonomyLegend`, `TaxonomySwitch`, `Panel`, `Button` | L'atelier est couplé aux stores et à l'authentification ; le visualiseur public doit rester lisible et sans état serveur |
| Données publiées | Le dossier `data/thematic-layer/` (empreinte `7116e627…`) **avec votes pseudonymisés A1/A2/A3**, servi en zip et fichier par fichier ; sans texte CLAUDETTE | Promesses du papier tenues ; anonymat des annotatrices ; licence tierce respectée |
| Texte CLAUDETTE | Affiché **à l'écran seulement** pour les 17 contrats hold-out, via l'API, jamais dans les téléchargements | Décision du porteur : essai en temps réel sur CLAUDETTE ; pas de redistribution |
| Sécurité | Endpoints publics `AllowAny` avec **quota par adresse** (scope `demo`, 30 requêtes/heure, 6/min), limite de taille, détection de langue légère, pas de stockage du texte, journal minimal | Aucune limitation anonyme n'existait ; on l'ajoute au niveau de DRF |
| Langue de l'interface | Anglais ; dictionnaire de libellés anglais des thèmes T20/T11 (`labels.en.ts`) | Lectorat international ; la spécification des taxonomies n'a que des libellés français |
| Page précédente | Déplacée telle quelle sur `/presentation` (français, institutionnelle) et liée depuis le pied de page | Rien n'est perdu ; les tests e2e existants sont mis à jour vers la nouvelle page |

## Principes non négociables

1. **Rien de promis n'est absent** : chaque artefact de la section *Availability* du papier a un lien ou un téléchargement sur la page.
2. **Aucun nom d'annotateur** dans l'API publique, les téléchargements, le dépôt et l'interface : pseudonymes stables A1, A2, A3.
3. **Aucun texte CLAUDETTE téléchargeable** : les jeux publiés sont clés `(document, index)` ; le texte n'est servi qu'à l'écran, pour les 17 contrats hold-out, par l'API.
4. **Le modèle servi est le modèle mesuré** : les chiffres affichés à côté du classifieur proviennent de `results.json` de l'entraînement dont les poids sont servis ; le protocole (découpe 33/17, recette E4.4) est écrit sur la page.
5. **Les chiffres du papier ne sont pas retapés** : ils sont lus depuis les artefacts figés (`data/thematic-layer/manifest.json`, `research/runs/*/results.json`) par un script de génération.
6. **Charte Pactiva** : thème clair institutionnel, jetons sémantiques uniquement (garde anti-hex), contraste AA, navigation clavier, `prefers-reduced-motion`.
7. **Le texte collé par un visiteur n'est ni conservé ni journalisé** ; seul un compteur anonyme (taille, durée, statut) est écrit.
8. **Aucun déploiement pendant un run Grid'5000** ; le déploiement passe par `deploy/deploy-claire.sh` et sa porte de tests.

## Arborescence du dossier

```
docs/pactiva-reviewer-demo/
├── 00_README.md                      ← ce fichier (index + résumé exécutif + statut)
├── 01_AUDIT_PROMESSES_ET_EXISTANT.md   ce que les papiers promettent, ce qui existe, les contraintes
├── 02_ANALYSE_COMPARATIVE.md           trois approches par bloc, forces/faiblesses, proposition finale
├── 02a_options-comparatif.csv          matrice de comparaison (tabulable)
├── 03_ARCHITECTURE.md                  architecture cible, flux, formats, sécurité
├── 03a_composants.puml                 diagramme de composants (PlantUML)
├── 03b_sequence-classification.puml    séquence coller → job → résultats
├── 03c_api-contrat.yaml                contrat de l'API publique /public/demo/*
├── 04_SPEC_UI_UX.md                    parcours, écrans, états, accessibilité
├── 04a_wireframes.txt                  maquettes ASCII
├── 04b_contenus-en.md                  textes anglais de la page (source unique)
├── 05_CONFIDENTIALITE_ET_LICENCE.md    pseudonymisation, texte CLAUDETTE, quotas, journalisation
├── 06_PLAN_ACTION.md                   lots L0–L7, dépendances, critères de sortie
├── 06a_jalons.csv                      jalons et vérifications
├── 07_RUNBOOK_AGENTIQUE.md             commandes exactes, portes, pièges, interdits
├── 08_BATTERIE_TESTS.md                stratégie de test et critères d'acceptation
└── 08a_cas-de-tests.csv                cas de tests (unitaires, API, e2e, manuels)
```

## Conventions de format

`.md` spécifications et décisions · `.csv` matrices et cas de tests · `.puml` diagrammes PlantUML · `.yaml` contrat d'API · `.txt` maquettes ASCII · `.json` artefacts de résultats (jamais édités à la main).

## Statut

| Lot | Contenu | État |
|---|---|---|
| L0 | Sauvegarde/rechargement du modèle, inférence + segmentation, sous-commande `predict`, tests | ✅ `00554ad` |
| L1 | Entraînement du modèle servi (33 → 17), poids + `results.json` | ⏳ en cours en local (CPU, lancé le 19 sept. 22 h 40) |
| L2 | Pseudonymisation des votes, zip de publication, `RELEASE.json` | ✅ `d097d34` |
| L3 | API publique `/public/demo/*`, quotas, `demo_selfcheck` | ✅ `ac0102c` (18 tests) |
| L4 | Page d'accueil anglaise + visualiseur + téléchargements ; ancienne page sur `/presentation` | ✅ `2e0682d` (22 tests vitest) |
| L5 | e2e (accueil, démonstration, a11y axe), MSW, garde couleurs, types, lint | ✅ `fa4f7a5` |
| L6 | Déploiement : page, API et données en ligne ; poids à installer à la fin de L1 | ✅ `844e00c` déployé le 20 sept. 00 h 20 (health 200, 17 contrats, zip, quota 429 au 7ᵉ appel) ; poids ⏳ |
| L7 | Parcours reviewer complet avec classification réelle, compte rendu | ⏳ après L1 |

### Constat corrigé au passage

Avant ce chantier, un visiteur anonyme de `https://pactiva.legal/` était renvoyé vers `/login?next=/` : la synchronisation des préférences par compte interrogeait `/me` sur toutes les pages et le 401 déclenchait la redirection globale. Les routes publiques sont désormais centralisées (`frontend/src/lib/publicRoutes.ts`) et exemptées de l'appel à `/me`, de la redirection sur 401 et de l'auto-connexion de développement.
