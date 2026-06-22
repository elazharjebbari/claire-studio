# Prompt — Agent Claude Max : refonte robuste & dé-rigidification de CLAIRE Studio

> À copier-coller comme consigne initiale de l'agent (mode Max, accès au repo entier).

---

Tu es un ingénieur senior full-stack + UX, en mode autonome, sur le projet
**CLAIRE Studio** (atelier d'annotation de contrats juridiques, recherche LORIA /
Université de Lorraine, partenaire Batt & Associés). Le dépôt est
`/Users/elazhar/PycharmProjects/claire-studio` : **backend Django 5 + DRF**
(`backend/`), **frontend Next.js 14 / TypeScript / Tailwind** (`frontend/`), dossier
de conception (`dossier/`), scripts d'orchestration (`scripts/`, `make dev-all`),
docker-compose. Le centre d'aide annotateur vit dans `frontend/content/help/`.

## 0. Avant tout — explore et imprègne-toi

1. Lis **tout** `dossier/` (en particulier `dossier/06_collaboration_versioning/` et
   l'audit `docs`), le `CLAUDE.md` racine, `backend/claire/*`, `frontend/src/*`,
   `scripts/`, `docker-compose.yml`, les seeders (`feed_db`, fixtures MSW).
2. Produis d'abord une **cartographie** : modules, flux de données, points
   d'entrée, dette technique, et surtout **tout ce qui est codé en dur**.
3. NE code rien avant d'avoir rendu l'audit + le plan (cf. §Méthode).

## Méthode imposée (pour CHAQUE chantier)

Audit ciblé → **2 à 4 solutions comparatives** (forces/faiblesses/pertinence) →
**choix argumenté** → **plan d'action** → implémentation par **petits diffs
reviewables** → **tests** (MSW + Vitest + Playwright côté front ; pytest côté back)
→ **runbook** de vérification → **commits conventionnels** (`feat:`, `fix:`…).
Ne jamais mélanger train/test ni masquer une fuite de données. Toujours expliquer
les choix avant le code (le code doit être défendable scientifiquement).

Principe directeur : **ne casse jamais le chemin solo existant** ; toute nouveauté
est activable par **feature flag** et **dégrade proprement**.

---

## Chantier A — Dé-rigidification : « rien en dur », multi-corpus

Objectif : l'app doit être **générique** (travailler sur d'autres bases que CLAUDETTE),
les valeurs « minimales » d'aujourd'hui devenant des **données par défaut importables
via seeders**, jamais des constantes figées dans le code.

- Recense exhaustivement le **hardcoding** : mot de passe seedé (`claire-demo` dans
  `feed_db`), utilisateurs/slug de projet en dur (`claudette-gold-v1`, alice/bob/rita),
  auto-login, fixtures MSW tenant lieu de données, vocabulaire de thèmes et catégories
  CLAUDETTE figés, `FEATURE_FLAGS` par défaut, liens de partage non persistés,
  présence = utilisateur courant, `sentence-history`/`attribution` dérivés, ports, etc.
- Externalise : **vocabulaire/schéma** (thèmes, natures, catégories CLAUDETTE, niveaux)
  en **données administrables** (modèle + seed YAML/JSON), pas en tokens figés ; le
  front lit le schéma depuis l'API.
- **Import en un clic des données par défaut** (corpus CLAUDETTE + pré-annotations
  LLM des frontières/champs) **OU** import d'un corpus tiers (upload + mapping de
  schéma). Le système doit accepter un **nouveau jeu de données** sans modifier le code.
- Fournis des **seed/seeders idempotents** pour tout faire fonctionner « à vide » puis
  charger les défauts à la demande.
- Critère : un audit prouve que toute valeur « métier » provient de la **config/DB/seed**
  et non d'une constante ; l'app démarre vide et se peuple par import.

## Chantier B — Modèle d'annotation : version humaine VIDE + validation incrémentale

- **La version humaine démarre TOUJOURS vide.** L'annotateur **valide/rejette** au fur
  et à mesure les décisions des LLM (Claude/Codex) et **choisit lui-même** son
  annotation. Le pré-remplissage massif ne doit pas pré-écrire l'annotation humaine :
  les propositions LLM restent des **suggestions** que l'humain adopte explicitement.
- **BUG à corriger** : lorsqu'on choisit l'annotation (le thème) d'une phrase, **la
  couleur n'est pas mise à jour** dans le document. Reproduis, identifie la cause
  (rail/badge/`runColor` non recalculé après `setBoundary`/`resolveDivergence`/
  `updateDraft`), corrige, et **teste** (vitest store + e2e : choisir un thème → la
  pastille/rail de la phrase change immédiatement).
- Rends le flux d'arbitrage limpide : voyant « adopté », traçabilité (qui/quoi/pourquoi),
  cohérence des couleurs entre document, plan, panneau comparatif et inspecteur.

## Chantier C — Fiabilité de l'enregistrement des annotations

- **Auto-save** robuste (debounce), **écriture optimiste** + réconciliation, **idempotence**
  (`client_op_id`), reprise après coupure réseau, indicateur d'état (enregistré / en
  cours / hors-ligne / erreur). Aucune perte d'annotation silencieuse.
- Versioning fiable (snapshots immuables), et garde-fous contre les écritures
  concurrentes. Tests de bout en bout sur la persistance.

## Chantier D — Collaboration entre annotateurs

- Finalise le **temps réel** (Django Channels + WebSocket + CRDT, cf.
  `dossier/06_.../06_realtime_collaboration.md`) : présence/curseurs réels (pas
  seulement « soi »), diffusion des changements, **gestion de conflits** non destructive.
- **Liens de partage persistés** (modèle + révocation + quotas + expiration) ; à
  l'ouverture, l'utilisateur **authentifié** rejoint le projet (jamais d'accès anonyme).
- UX collaborative : non envahissante, voyants élégants, ergonomie maximale.

## Chantier E — Comptes & onboarding

- **Écran d'accueil public** (landing) expliquant la solution (valeur, fonctionnement),
  puis **connexion** pour continuer l'annotation.
- **Création de compte** + **vérification e-mail** via **Stalwart** (serveur SMTP en
  prod, domaine dédié) : configure l'envoi d'e-mails (réinitialisation mdp, invitations,
  vérification) de façon paramétrable (pas de secrets en dur ; variables d'env / config).
- Gestion de session propre (JWT), récupération de mot de passe, profils.

## Chantier F — Projets, invitations & publication

- Un utilisateur peut **créer un projet d'annotation**, choisir/importer son corpus, et
  **inviter** d'autres personnes (rôles : owner / annotateur / relecteur).
- **Écran public** (consultable depuis le menu) où l'on **publie (ou non)** les
  résultats d'annotation d'un projet (toggle de publication, vue lecture seule,
  agrégats). Respecte la confidentialité par défaut (privé tant que non publié).

## Chantier G — Séparation Admin / Annotateur + Console d'administration

Aujourd'hui admin et annotateur sont **mêlés** : sépare-les nettement.

- **Espace annotateur** : focalisé sur l'annotation, la collaboration, ses projets.
- **Console d'administration** distincte (route + garde de rôle), avec **droits admin
  sur toute la solution** :
  - supervision : **historique de tous les annotateurs**, ce qu'ils font, leur
    **progression** d'annotation (par projet/document/annotateur) ;
  - **configuration des annotations** : vocabulaire/schéma, feature flags, quotas,
    rôles & membres, liens de partage ;
  - **import** : CLAUDETTE + versions pré-annotées (frontières & autres champs), **ou
    import des données par défaut en un clic**, ou import d'un corpus tiers ;
  - audit append-only consultable/exportable ; gouvernance.
- Exprime et implémente **tous les besoins admin** identifiés (gestion utilisateurs,
  projets, données, observabilité, sécurité).

## Chantier H — UI/UX, design & navigation (app + documents + code)

- Cohérence visuelle (icônes lucide partout, thème sombre anti-fatigue, états vides,
  feedback, accessibilité AA), navigation d'app claire (landing → login → espaces
  annotateur/admin/public).
- **Navigation dans les documents** annotés améliorée (plan, sauts, recherche,
  voyants traduction/divergence/progression), fluide et intuitive.
- **Navigabilité du code** : structure modulaire, noms explicites, barrières d'API
  nettes, suppression du code mort, doc d'architecture à jour.

## Chantier I — Qualité, sécurité, tests

- Code **robuste / fiable / évolutif / débogable / modulable / optimal / fonctionnel /
  sécurisé**. Pas de secrets en dur ; validation/permissions strictes ; RGPD.
- Couverture de tests **MSW + Vitest + Playwright** (front) et **pytest** (back) sur
  chaque brique critique (persistance, collaboration, auth, import, permissions,
  publication). `tsc --noEmit` 0 erreur ; lint propre.

---

## Audit final exigé (transverse)

Un **audit approfondi de toutes les fonctionnalités** qui **prouve** :
1. qu'aucune valeur métier n'est en dur (au mieux : défauts importés via seed/seeder) ;
2. que l'app est **suffisamment large pour fonctionner sur d'autres bases de données**
   (démontre-le en branchant un corpus tiers minimal) ;
3. que la version humaine démarre vide et se construit par validation incrémentale ;
4. que la persistance, la collaboration et les permissions sont fiables.

## Livrables

- **Dossier** mis à jour (`dossier/`) : audit, solutions comparatives par chantier,
  décisions, plans, diagrammes (md/puml/json/yaml/csv), runbook de bout en bout.
- **Code** backend + frontend (petits diffs, commits conventionnels), **migrations**,
  **seeders idempotents**, **feature flags**, configuration env (Stalwart SMTP incluse).
- **Tests** complets verts (MSW/Vitest/Playwright/pytest), **runbook** d'exécution
  (`make dev-all` + scénarios de validation), et la **liste exhaustive du hardcoding
  supprimé** avec preuves.

## Garde-fous

- Travaille par **petits diffs reviewables**, jamais une refonte massive en une passe.
- Préserve le **chemin solo** et les tests existants ; tout nouveau comportement est
  **flaggé** et **réversible**. Signale explicitement toute fuite de données ou
  régression. Demande validation avant migrations destructrices ou changements de
  contrat d'API publics.
