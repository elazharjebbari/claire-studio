# Audit de refonte & dé-rigidification — Cartographie + plan

> Livrable du §0 du prompt de refonte (`dossier/agents/prompt_claude_max_refonte.md`).
> **Aucune ligne de code n'a été modifiée avant ce document.** Daté : 2026-06-19.
> Statut : audit factuel (cartographie + hardcoding + état par chantier) + plan proposé.
> Le séquençage final reste à valider avec le porteur du projet.

---

## 1. Résumé exécutif — le constat qui change tout

Le dépôt est **beaucoup plus mûr que le prompt ne le suppose**. Le prompt décrit une app
« rigide, codée en dur, à refondre ». La réalité :

- Le **vocabulaire/schéma est déjà externalisé** : `vocabulary.yaml` → modèles
  `LabelScheme/Theme/LegalNature` (couleurs incluses), chargé par seeder idempotent.
- Les **settings sont env-driven** (`django-environ`), **aucun secret en dur** côté backend ;
  JWT avec rotation + blacklist, throttling anti-brute-force, scrubber PII sur les logs,
  en-têtes de sécurité, docs RGPD/threat model présentes.
- **Feature flags** déjà en place (`FEATURE_FLAGS` + `GET /config/flags`).
- 11 apps Django bien découpées par domaine + 13 fichiers de tests pytest + une suite
  Vitest/Playwright/MSW.

Conséquence : **ce n'est pas une refonte from-scratch, c'est un audit + comblement de
trous ciblé.** Plusieurs « bugs à corriger » et « features à construire » du prompt sont
déjà (partiellement) faits. Les **vrais manques** sont concentrés sur 4 axes :

| Axe | Manque réel |
|---|---|
| **D — temps réel/collab** | Aucun backend Channels/WebSocket, pas de modèle `ShareLink` persisté, présence = soi seul |
| **E — comptes/onboarding** | Pas de signup, pas de vérification e-mail, pas de SMTP/Stalwart, pas de reset mot de passe, pas de landing publique |
| **F — projets/publication** | Pas de champ de publication ni d'écran public lecture-seule |
| **G — séparation admin** | `/admin/*` n'est **pas** une route gardée par rôle côté front (backend protégé, front non) |

Et un axe transverse **A — dé-rigidification** : le hardcoding résiduel est réel mais
**localisé** (seeders + fixtures MSW + 1 slug dans la home), pas systémique.

---

## 2. Méthode & périmètre

Conforme au prompt : pour chaque chantier → audit ciblé → 2–4 solutions comparatives →
choix argumenté → plan en **petits diffs reviewables** → tests → runbook → commits
conventionnels. **Le chemin solo existant ne doit jamais casser** ; toute nouveauté est
**feature-flaggée** et **dégrade proprement**. Pas de migration destructrice ni de
changement de contrat d'API public sans validation.

Périmètre exploré : `dossier/` (intégral), `backend/claire/*` (11 apps), `backend/config/*`,
seeders (`feed_db`, `seed_demo`), `frontend/src/*` (App Router, store Zustand, lib, mocks
MSW), `scripts/`, `docker-compose.yml`, `requirements.txt`, `package.json`.

---

## 3. Cartographie

### 3.1 Backend — Django 5 + DRF (`backend/claire/`)

| App | Rôle | Modèles clés |
|---|---|---|
| `accounts` | Utilisateur custom + rôles | `User(role: annotator/reviewer/admin/owner)` |
| `corpora` | Corpus & documents source | `Corpus, Document, Sentence, ReferenceLabel` + loaders CLAUDETTE |
| `schemes` | Vocabulaire fermé versionné | `LabelScheme, Theme, LegalNature` (← `vocabulary.yaml`) |
| `projects` | Campagnes, membres, assignations, IAA | `Project, ProjectMembership, Assignment` + `iaa.py` |
| `annotations` | Cœur métier | `Annotation, Clause, AnnotationVersion` + `services.py` (transitions) + `signals.py` |
| `collaboration` | Commentaires & revues | `Comment, Review` — **pas** de ShareLink/présence |
| `imports` | Pré-annotations LLM | `PreAnnotation, PreClause` + `theme_mapping.py` + loaders v9.2/v9.4 |
| `exports` | Exports multi-format | `ExportJob` + services |
| `translations` | Traductions file-based | `TranslationSet, Translation` + sync |
| `audit` | Journal d'activité append-only | `ActivityEvent` |
| `common` | Transverse | permissions, throttling, pagination, middleware sécurité, exceptions, PII scrubber |

Points d'entrée API : `backend/config/api_urls.py` (router DRF `/api/v1/` + `auth/login`,
`auth/refresh`, `me`, `config/flags`, `health`). ASGI = **Django nu** (`config/asgi.py`),
**sans Channels**.

Settings : `base.py` (commun, env-driven) → `dev.py` / `prod.py` / `test.py`.

### 3.2 Frontend — Next.js 14 App Router (`frontend/src/`)

- **Routes** : `app/(app)/*` (chrome complet, derrière `AuthGuard`) + `app/login` + group
  `(app)/admin/*` (8 pages admin, **même group, pas de garde de rôle**).
- **Workspace** (`components/workspace/`) : `AnnotationWorkspace`, `DocumentPanel`,
  `InspectorPanel`, `ComparePanel`, `SentenceMenu`, `CollabBar`, `ShareLinkDialog`, etc.
- **État** : `store/workspace.ts` (Zustand — édition locale : drafts, undo/redo, prefill,
  divergences, action log) ; persistance serveur via React Query (`lib/api/hooks.ts`).
- **Couleurs/tokens** : `lib/tokens.ts` lit **`design-tokens.json` statique** (≠ API).
- **Mode d'exécution** : `lib/env.ts` → `MOCKS_ENABLED` (MSW, E2E) vs `REAL_MODE` (JWT).
  Auto-login dev optionnel (`lib/auth.ts`), off par défaut, env-gated.
- **Mocks** : `mocks/handlers.ts` + `mocks/fixtures.ts` (MSW) — tiennent lieu de backend
  en mode démo/E2E.

### 3.3 Flux de données

```
Mode MOCK  : UI → React Query → MSW (handlers + fixtures.ts)  [aucun backend, aucun JWT]
Mode REAL  : UI → React Query → axios(client.ts, JWT) → DRF /api/v1 → SQLite/Postgres
Seeding    : vocabulary.yaml ─┐
             data/claudette_tos ─┼→ feed_db (idempotent) → DB
             data/preannotations ┘
```

### 3.4 Orchestration

`scripts/dev_all.sh` (full), `run_real.sh` (backend réel + front), `seed_all.sh`,
`e2e.sh`, `test_all.sh`, `ports.env`. `Makefile` racine + `make dev-all`. `docker-compose.yml`.

---

## 4. État réel par chantier (avant tout code)

| Chantier | État | Détail |
|---|---|---|
| **A** Dé-rigidification | 🟡 Partiel | Vocab déjà externalisé ; hardcoding résiduel = seeders + fixtures + 1 slug home + front lit `design-tokens.json` |
| **B** Version humaine vide + bug couleur | 🟡 Partiel | Store traite le LLM comme suggestion ; **mais feed_db seed des annotations humaines pré-remplies** (contradiction). Bug couleur **non reproductible statiquement** (voir §6) |
| **C** Fiabilité enregistrement | 🟡 Partiel | React Query + versioning snapshots présents ; **pas** d'idempotence `client_op_id`, ni auto-save debounce explicite, ni indicateur d'état réseau |
| **D** Collaboration temps réel | 🔴 Manquant | Pas de Channels/WS backend, pas de `ShareLink` persisté, présence = soi |
| **E** Comptes & onboarding | 🔴 Manquant | Login seul ; pas de signup/vérif-email/SMTP/reset/landing |
| **F** Projets & publication | 🟡 Partiel | Création projet (admin) existe ; **pas** de publication ni écran public |
| **G** Séparation admin | 🟡 Partiel | Backend `IsAdminRole` OK ; **front : admin non gardé par rôle, mêlé au group (app)** |
| **H** UI/UX & navigation | 🟢 Avancé | Workspace riche, lucide, thème sombre, tour guidé, plan/recherche docs |
| **I** Qualité/sécurité/tests | 🟢 Avancé | Sécurité backend solide ; combler tests sur les nouvelles briques |

---

## 5. Inventaire exhaustif du hardcoding (chantier A)

> Critère du prompt : toute valeur métier doit venir de config/DB/seed, jamais d'une
> constante figée. Voici l'inventaire **exhaustif** avec l'externalisation proposée.

| # | Valeur en dur | Emplacement(s) | Gravité | Externalisation proposée |
|---|---|---|---|---|
| H1 | Mot de passe `claire-demo` | `feed_db.py:206`, `seed_demo.py:138`, `login/page.tsx:14`, `lib/env.ts:22`, `.env.local(.example):14`, `run_real.sh:49,59` | ⚠️ Moyenne (démo only, mais visible) | `--password` au seeder + `DJANGO_SEED_PASSWORD` (défaut aléatoire imprimé) ; retirer le défaut du champ login |
| H2 | Slugs `claudette-tos` / `claudette-gold-v1` | `feed_db.py:72-73` (constantes), `import_claudette.py:54`, `import_annotations_archive.py:40`, **`(app)/page.tsx:11`** (home `useAssignments("claudette-gold-v1")`) | 🔴 Forte (la home casse multi-corpus) | Args seeder + corpus/projet « courant » résolu via `/me`/API, pas en dur dans la home |
| H3 | Users `admin/alice/bob/rita` | `feed_db.py:107-110`, `seed_demo.py`, MSW `fixtures.ts`, `admin/users/page.tsx`, `login/page.tsx` | ⚠️ Moyenne | Seed depuis un YAML `seed_users.yaml` (idempotent), liste configurable |
| H4 | Front lit `design-tokens.json` statique | `lib/tokens.ts:5`, `tokens.ts:34-37` | 🔴 Forte (multi-corpus : un schéma tiers ⇒ tout gris fallback) | Le front lit le **schéma du projet via l'API** (`GET /schemes/{slug}`), tokens statiques = repli |
| H5 | Chemin défaut `vocabulary.yaml` dans `dossier/` | `base.py:50-55` | 🟡 Faible | Déplacer la source de seed sous `data/schemes/` (doc reste un miroir) |
| H6 | Catégories/niveaux d'injustice CLAUDETTE | `vocabulary.yaml` (OK, data) + `design-tokens.json` (statique) | 🟡 Faible | Même traitement que H4 (via API) |
| H7 | Mapping de thèmes LLM | `imports/theme_mapping.py` | 🟡 À vérifier | Externaliser en table/JSON administrable si codé en dur |
| H8 | `FEATURE_FLAGS` défauts | `base.py:231-239` | 🟢 Acceptable | Déjà env-driven ; exposer édition admin (chantier G) |
| H9 | Auto-login user/pass défaut | `lib/env.ts:20-22` | 🟢 Acceptable | Déjà env-gated, off par défaut ; documenter |
| H10 | Slugs en dur dans tests/MSW | `fixtures.ts`, `*.spec.ts`, pytest | 🟢 Acceptable | Normal pour des fixtures de test ; garder mais isoler |

**Verdict A** : le hardcoding « métier » est **localisé**, pas systémique. Les deux points
réellement bloquants pour le multi-corpus sont **H2 (slug home)** et **H4 (front lit les
tokens statiques au lieu du schéma API)**. Le reste est de la donnée de seed/démo/test
légitime, à rendre paramétrable.

---

## 6. Bug couleur (chantier B) — analyse tracée

**Reproduction par lecture de code (chemin complet) :**

1. `SentenceMenu.handleSetTheme` (`SentenceMenu.tsx:108-114`) : si une clause couvre la
   phrase → `updateDraft(localId, {theme})` ; sinon → `setBoundary(index, theme)`. ✅ correct.
2. `updateDraft` (`store/workspace.ts:363-386`) remplace `draftClauses` par un **nouveau
   tableau** avec le thème changé. ✅
3. `DocumentPanel` : `humanRuns = useMemo(… computeRuns(drafts…), [drafts, n])` → recalculé
   car `drafts` change d'identité. ✅
4. Rendu : `runColor = getThemeToken(run.theme).color` (`DocumentPanel.tsx:390`) ; `SentenceRow`
   **n'est pas mémoïsé** → re-rendu. ✅
5. `design-tokens.json` == `vocabulary.yaml` (20 thèmes, mêmes codes/couleurs) → pas de
   fallback gris parasite. ✅

**Conclusion :** dans le code **actuel**, le chemin « choisir un thème → couleur du rail/
badge » est **correct**. Le bug décrit (« la couleur ne change pas ») est soit **déjà
corrigé** par les commits récents (`bb12c88 fix(workspace): … switch source inspecteur,
divergences sticky/nav`), soit survit dans un **chemin étroit** non couvert par la lecture
statique. Cas résiduels à tester explicitement :
- `setBoundary` sur une **ancre déjà existante** ignore le nouveau thème (`store:273-276`) —
  si un appelant (raccourci `B`, toolbar) re-thématise via `setBoundary`, la couleur ne
  bouge pas. **C'est le seul vrai piège latent.**
- Re-thème via `InspectorPanel` quand `focusedSentence` ≠ ancre couvrante.

**Action (avant tout fix) :** écrire un test Vitest store (`setBoundary` sur ancre
existante doit-il re-thématiser ? décision produit) + un test composant DocumentPanel
(« choisir un thème → `runColor` change ») + 1 E2E. **On ne déclare le fix qu'après un
test rouge reproduisant le bug**, sinon on corrige un fantôme.

---

## 7. Tension de conception majeure (chantier B)

Le prompt exige : **« la version humaine démarre TOUJOURS vide »** ; le LLM = suggestions à
adopter explicitement. **Or `feed_db._seed_one`** crée des `Annotation` humaines **déjà
remplies** depuis les pré-annotations (`seed_annotation_from_preannotation`), soumises, avec
versions/commentaires/review. C'est une **contradiction frontale** avec l'exigence.

C'est une **décision produit**, pas juste technique :
- **Option 1 (fidèle au prompt)** : l'annotation humaine naît vide ; le pré-remplissage est
  un overlay de suggestions (déjà supporté par le store : `replacePrefill`/`ghostClauses`).
  Le seed crée des annotations **vides** (ou seulement des `PreAnnotation`), l'IAA/insights
  se calculent autrement au départ.
- **Option 2 (statu quo)** : garder des annotations seedées pour la démo/IAA, mais derrière
  un flag `SEED_HUMAN_FROM_LLM=false` par défaut.

→ **À trancher avec le porteur** (voir question en fin de chat) car cela impacte seeders,
contrat, tests IAA et la démo.

---

## 8. Solutions comparatives + recommandation par chantier (synthèse)

> Détail complet à éclater en sous-docs `dossier/16_audit_refonte/0X_*.md` au démarrage de
> chaque chantier. Ici : l'arbitrage de tête.

- **A — Dé-rigidification.** Options : (a) tout en YAML de seed ; (b) tables admin éditables ;
  (c) hybride. → **Reco (c)** : schéma/vocab déjà en DB (garder), ajouter seeders
  paramétrés (H1–H3), faire lire le **schéma via API** au front (H4), import corpus tiers
  via mapping. Petits diffs indépendants.
- **B — Humaine vide + bug couleur.** → **Reco** : trancher §7 (Option 1 derrière flag),
  puis test-first sur le bug couleur (§6). Aucun risque de contrat.
- **C — Fiabilité.** Options : (a) auto-save debounce + `client_op_id` idempotent côté API ;
  (b) écriture optimiste + réconciliation ; (c) les deux. → **Reco (c)**, additif (nouveau
  champ `client_op_id` nullable, pas de breaking change), indicateur d'état réseau dans la
  TopBar.
- **D — Temps réel.** Options : (a) Django Channels + Redis + CRDT (Yjs) ; (b) polling/SSE ;
  (c) Channels présence d'abord, CRDT ensuite. → **Reco (c)** : `ShareLink` persisté +
  présence via Channels d'abord (flag `realtime_collaboration` déjà off par défaut), CRDT
  en 2e temps. **Migrations + ASGI infra → validation requise.**
- **E — Comptes.** Options : (a) JWT maison + Stalwart SMTP ; (b) lib (django-allauth) ;
  (c) JWT actuel + endpoints register/verify/reset + EmailBackend SMTP paramétrable. →
  **Reco (c)** : reste cohérent avec l'existant (SimpleJWT), zéro secret en dur (env),
  landing publique + page signup. **Migrations (token de vérif) → validation.**
- **F — Publication.** → **Reco** : champ `Project.visibility` (private/public) + endpoint
  lecture-seule `/public/projects/{slug}` + écran agrégats. Privé par défaut (RGPD).
- **G — Admin.** Options : (a) garde de rôle sur `(app)/admin` ; (b) route group dédié
  `(admin)` + layout/guard + sidebar séparée. → **Reco (b)** : séparation nette annotateur
  vs admin, guard `IsAdminRole` front + redirections.
- **H — UI/UX.** Déjà avancé → améliorations ciblées (états vides, a11y AA, nav docs).
- **I — Qualité/tests.** Couvrir chaque brique nouvelle (MSW/Vitest/Playwright/pytest),
  `tsc --noEmit` 0 erreur, lint propre, à chaque diff.

---

## 9. Plan d'action proposé (petits diffs, séquencé)

**Vague 0 — socle de l'audit (ce doc) + filets.** ✅ ce document. Puis : exécuter la suite
de tests existante pour établir la **ligne de base verte** avant tout changement.

**Vague 1 — A + B (sans migration, faible risque, fort signal) :**
1. `feat(seed): paramétrer mot de passe + slugs (H1, H2)` — args + env, défauts conservés.
2. `fix(home): retirer le slug en dur, résoudre le projet courant via l'API (H2)`.
3. `feat(front): lire le schéma du projet via l'API, design-tokens en repli (H4)`.
4. `test+fix(workspace): reproduire puis corriger le bug couleur si présent (§6)`.

**Vague 2 — C (fiabilité, additif) :** `client_op_id` idempotent + auto-save debounce +
indicateur d'état. Migration **additive non destructrice**.

**Vague 3 — G (séparation admin) :** route group `(admin)` + guard de rôle. Front only.

**Vague 4 — E (comptes) :** signup + vérif e-mail (Stalwart SMTP env) + reset + landing.
**Migrations → validation.**

**Vague 5 — F (publication) :** `visibility` + écran public. **Migration → validation.**

**Vague 6 — D (temps réel) :** `ShareLink` persisté + présence Channels (flag off),
CRDT ensuite. **Infra ASGI + migrations → validation.**

Chaque diff : tests verts + runbook + commit conventionnel. H/I traités en continu.

---

## 10. Risques & garde-fous

- **Ne jamais casser le chemin solo** : tout nouveau comportement est derrière un flag et
  dégrade proprement (les flags existent déjà).
- **Migrations destructrices & contrat d'API public** : validation explicite avant (D, E, F).
- **Pas de fuite train/test** ni de secrets : SMTP/Stalwart 100 % via env.
- **Tests d'abord** sur le bug couleur (éviter de « corriger » un fantôme).
- **Idempotence** des seeders préservée (`update_or_create`).
```
