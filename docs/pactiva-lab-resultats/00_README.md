# Dossier — Résultats d'expérimentations : interfaces ad-hoc, tests statistiques, pédagogie

**Date** : 15 août 2026 · **Statut** : conception, prêt à exécuter · **Exécutant visé** : agents Claude Opus 5 (voir `07_RUNBOOK_OPUS5.md`)

## Le problème

L'interface de résultats du Pactiva Lab est **générique** : la même page (`RunResults.tsx`)
affiche les mêmes 4 KPIs et les mêmes 4 figures pour les 14 presets d'expérimentation,
quel que soit leur objectif. Trois conséquences, constatées par audit (voir `01_AUDIT.md`) :

1. **Le résultat affiché ne répond pas à la question posée.** Une courbe d'apprentissage
   (« combien de documents annoter ? ») s'affiche comme 25 runs indépendants dans une
   liste ; un criblage de prétraitements (« quels axes survivent ? ») comme 24 lignes
   sans analyse par axe ; une comparaison fine-tuning vs embeddings gelés sans test
   apparié — alors que le plan scientifique exige ces preuves pour l'article.
2. **Aucun test statistique** n'est intégré, alors que le plan scientifique déclare
   « un résultat sans IC ne va pas dans l'article » — et que l'IC bootstrap est déjà
   **calculé** par le runner puis jeté par l'UI (bug : `RunList.tsx` ne transmet pas
   `ci` à `RunComparisonFigure`, qui sait pourtant le tracer).
3. **Aucune pédagogie** : pas de section introductive (que teste cette expérience,
   pourquoi, quel est son rôle dans la publication), pas de guide d'interprétation
   (que veut dire macro-F1 vs micro-F1, κ, ECE, dispersion inter-plis, plafond
   humain approximé). Le savoir interprétatif existe — mais dans les *commentaires de
   code* de `charts.tsx`, invisibles à l'utilisateur.

## L'objectif

Des interfaces de résultats **par expérience** qui rendent chaque expérimentation :

- **utile** — la vue répond à la question décisionnelle de l'expérience (choisir,
  trancher, estimer), pas à une question générique ;
- **utilisable** — la décision à prendre est lisible en un coup d'œil (verdict,
  classement, courbe), le détail en dessous ;
- **compréhensible** — chaque vue s'ouvre sur une introduction (but, rôle dans la
  publication, comment lire) et chaque métrique porte sa définition ;
- **scientifique** — chaque comparaison porte le test statistique adapté à son
  objectif, avec ses conditions de validité affichées, jamais une p-value décorative.

## Les cinq documents de fond

| Fichier | Contenu | Sert à |
|---|---|---|
| `01_AUDIT.md` | État des lieux consolidé : données produites vs affichées, capacités des figures, lacunes | Justifier le périmètre, ancrer chaque lot dans un constat vérifié |
| `02_ROLES_PUBLICATION.md` | Les 14 presets → question de recherche → papier (long/court) → objectif décisionnel → preuve attendue | Décider CE QUE chaque vue doit montrer |
| `03_CADRE_STATISTIQUE.md` | Le test adapté par famille d'objectifs (comparaison appariée, criblage, courbe, plafond, juges, planchers), classé [FRONT]/[RUNNER]/[BACKEND] | Décider COMMENT chaque preuve se calcule, honnêtement |
| `04_SPEC_INTERFACES.md` | Les 8 familles de vues ad-hoc : dispatch, composition, maquettes textuelles, états | Décider À QUOI ressemble chaque vue |
| `05_CONTENUS_PEDAGOGIQUES.md` | Les textes finaux : introductions par expérience, glossaire des métriques, guides d'interprétation | Le contenu éditorial, prêt à intégrer |

## Les trois documents d'exécution

| Fichier | Contenu |
|---|---|
| `06_PLAN_ACTION.md` | Plan en 7 lots (L0–L6) : conceptuel → statistique (Python) → backend → frontend socle → vues ad-hoc → pédagogie → finitions ; dépendances et périmètre de chaque lot |
| `07_RUNBOOK_OPUS5.md` | Runbook pas-à-pas exécutable par agents : conventions du dépôt, commandes de test, portes de validation, pièges connus, interdits |
| `08_BATTERIE_TESTS.md` | Batterie de validation : tests unitaires Python (stats), parité TS↔Python, tests d'endpoints, tests de vues (vitest), fixtures dorées issues de runs réels, critères d'acceptation par lot |

## Principes non négociables (repris du plan scientifique et de la charte)

1. **L'unité statistique est le document**, jamais la phrase (les ~195 phrases d'un
   document ne sont pas indépendantes) — bootstrap et permutation par document.
2. **Comparer exige les mêmes plis** — le refus explicite existe déjà côté serveur
   (`comparable()`), les nouvelles vues le conservent et l'expliquent.
3. **Le plafond humain est un proxy** (taux d'accord strict, sous-ensemble
   multi-annoté) — bande de référence, jamais barre comparable ; rhétorique « X % d'un
   plafond approximé », jamais « dépasse l'humain ».
4. **L'exploratoire s'assume comme tel** — le criblage n'affiche pas une forêt de
   p-values : classement + IC + règle de survie explicite ; le confirmatoire (étage 2)
   porte le test apparié.
5. **Ton éditorial de la maison** (charte §7) : français soutenu, vouvoiement, phrases
   courtes, pédagogue, jamais condescendant, zéro hype.
6. **Système de design existant** : tokens sémantiques uniquement (pas de hex, pas de
   palette Tailwind brute), composants `Figure`/`Panel`/`Disclosure`/`GoldHelpModal`
   comme patrons, thème sombre du Lab.
