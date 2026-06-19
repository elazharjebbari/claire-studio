# Vague 1 (Chantiers A + B) — réalisé & preuves

> Branche : `refonte/vague1-derigidification`. Tout est vert (voir §Runbook).
> Méthode respectée : petits diffs reviewables, test-first sur le bug, flags &
> dégradation propre, chemin solo préservé.

## 1. Ce qui a été fait (par commit)

| Commit | Type | Objet |
|---|---|---|
| `a18c56c` | docs | Cartographie + audit + plan (chantier 0) |
| `1084251` | test | Baseline vert : tests de contrat alignés (`hasTranslation`, `scope`) |
| `d8d5638` | fix | **Bug couleur (§6)** : `setBoundary` re-thématise une clause existante |
| `0d5902c` | fix | **H2** : projet courant via l'API (home, sidebar, command palette, compare) |
| `e0ada9e` | fix | a11y AA : contraste pastilles de présence + libellé frontière LLM |
| `959a733` | feat | **H1/H2** : seeders paramétrés (mot de passe, slugs) via env/CLI |
| `5be6b96` | feat | **§7** : version humaine VIDE par défaut, pré-remplissage LLM derrière flag |
| `74126e0` | feat | **H4** : couleurs/labels de thèmes depuis le schéma API + slug dynamique |

## 2. Liste exhaustive du hardcoding supprimé (preuves)

| ID | Avant (en dur) | Après | Preuve |
|---|---|---|---|
| **H1** | mot de passe `claire-demo` dans `feed_db`/`seed_demo` | `settings.SEED_PASSWORD` (env `CLAIRE_SEED_PASSWORD`) + `--password` | `feed_db.py` `--password`/`self.password` ; `test_feed_db` |
| **H2.a** | `(app)/page.tsx` → `useAssignments("claudette-gold-v1")` | `useCurrentProjectSlug()` (store → 1er projet API) | `src/lib/useCurrentProject.ts` ; e2e a11y accueil |
| **H2.b** | `Sidebar`/`CommandPalette`/`compare` slugs en dur | `useCurrentProjectSlug()` + nav générique si aucun projet | commit `0d5902c` |
| **H2.c** | `feed_db` constantes `CORPUS_SLUG`/`PROJECT_SLUG`/`TRANSLATION_FOLDER` | `settings.SEED_*` + `--corpus-slug`/`--project-slug`/`--translation-folder` | `feed_db.py` ; `seed_demo.py` |
| **H4.a** | `AnnotationWorkspace` schéma slug en dur `"claire-themes-v1"` | `useProject(projectSlug).schemeSlug` | `AnnotationWorkspace.tsx` |
| **H4.b** | couleurs/labels de thèmes depuis `design-tokens.json` statique | schéma API via `setRuntimeThemes`, statique en repli | `lib/tokens.ts` ; `tokens.test.ts` (3 tests) |

Reste à externaliser (chantiers ultérieurs, non bloquants) : utilisateurs de démo
(`alice/bob/rita`, → YAML, H3) ; chemin par défaut `vocabulary.yaml` sous `dossier/`
(H5) ; slugs des pages `/admin/*` (chantier G) ; repli corpus de `projects/[slug]/docs`.

## 3. Bug couleur (§6) — diagnostic & correctif

- **Cause** : choisir un thème pour une phrase déjà ancrée (branche « aucune clause »
  de l'inspecteur) passait par `setBoundary`, qui se contentait de **sélectionner** la
  clause sans changer son thème → le rail/badge (dérivés du thème de la clause
  couvrante) ne se mettaient jamais à jour.
- **Test-first** : 2 tests rouges reproduisant le défaut (re-thème + couleur dérivée du
  rail), puis correctif → verts. + e2e `annotate` (box-shadow du rail + badge dans le
  document, pas seulement l'inspecteur).
- **Correctif** : `setBoundary` re-thématise en place (no-op si thème identique).

## 4. §7 — version humaine vide

- `feed_db`/`seed_demo` créent des **brouillons humains vides** (`draft`, `human`, 0
  clause) : l'annotation existe (les assignations résolvent `annotationId`, le workspace
  s'ouvre) mais sans pré-écriture LLM. Le LLM reste une **suggestion** adoptée dans le
  workspace (store : `replacePrefill`/`resolveDivergence`, déjà non destructifs).
- Le pré-remplissage humain historique (seed depuis le LLM + submit + versions + IAA)
  passe derrière `SEED_HUMAN_FROM_LLM` (env) / `--seed-human` (feed_db) pour la démo/IAA.
- Test : `test_feed_db_human_version_starts_empty` (mode vide) ; les tests IAA/versions/
  shapes passent `--seed-human`.

## 5. Runbook de vérification (commandes réellement exécutées)

```bash
# Backend (SQLite in-memory, pas de Docker requis pour les tests)
cd backend
DJANGO_SECRET_KEY=dev .venv/bin/python -m pytest -q          # 69 passed

# Frontend
cd frontend
node_modules/.bin/tsc --noEmit                               # 0 erreur
node_modules/.bin/vitest run                                 # 100 passed (15 fichiers)
node_modules/.bin/playwright test annotate.spec.ts a11y.spec.ts \
  document-ux.spec.ts collaboration.spec.ts                  # 18 passed
```

Note environnement : si Vitest échoue sur `@rollup/rollup-darwin-*`, lancer
`npm install @rollup/rollup-darwin-x64 --no-save` (bug npm des deps optionnelles).

## 6. Preuve de généricité multi-corpus (mécanisme)

L'app ne dépend plus d'aucun slug/schéma figé. Pour brancher un corpus tiers :

```bash
# 1. Déclarer un schéma propre (couleurs incluses) dans un vocabulary YAML, puis :
python manage.py feed_db --corpus-slug mon-corpus --project-slug ma-campagne \
  --translation-folder mon_dossier_fr
# 2. Le front lit le schéma du projet via l'API (couleurs/labels du corpus tiers),
#    la home/nav résolvent le projet courant — aucun « claudette-* » en dur.
```

Le démarrage « à vide » puis import à la demande est assuré par les seeders
idempotents (`get_or_create`/`update_or_create`). Un jeu de données tiers minimal
servira de preuve de bout en bout (étape suivante, transverse audit point 2).

## 7. Dette constatée (pour les chantiers suivants)

- **Lint backend** : `ruff check .` remonte ~111 violations préexistantes (surtout
  tests : imports non triés/inutilisés, lignes longues). Mes diffs n'en ajoutent
  aucune. → nettoyage dédié (chantier I).
- **a11y** : home + workspace AA OK ; auditer les autres écrans (chantier H).
- **Création d'annotation à la demande** : `createAnnotation` existe (endpoints) mais
  n'est pas câblé à l'UI ; les brouillons vides sont pré-seedés en attendant un flux
  « Commencer l'annotation » (chantier F/UX).
