# Frontend — Architecture, routing, état

> Code : `annotation-studio/frontend/`. Source de vérité fonctionnelle :
> `dossier/00_overview/{CONTRACT.md, vocabulary.yaml, navigation.md, feature_traceability.csv}`.

## 1. Stack

- **Next.js 14** (App Router, RSC + Client Components), **TypeScript strict**
  (`noUncheckedIndexedAccess`, etc.).
- **Tailwind CSS** piloté par CSS variables (bascule clair/sombre sans rerender),
  couleurs importées depuis `design-tokens.json` (dérivé de `vocabulary.yaml`).
- **@tanstack/react-query** pour le cache serveur ; **Zustand** pour l’état UI et l’état
  d’édition local du workspace.
- **MSW** pour mocker `/api/v1/*` (front MVP autonome) ; **Vitest** (unit) + **Playwright** (E2E),
  audit d’accessibilité via **`@axe-core/playwright`**.

## 2. Arborescence

```
frontend/
├─ design-tokens.json            # couleurs thèmes/injustice/certitude + surfaces
├─ tailwind.config.ts            # importe les tokens
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx              # <html class="dark"> + Providers
│  │  ├─ providers.tsx          # React Query + thème + démarrage MSW
│  │  ├─ globals.css            # CSS vars sombre/clair, focus AA, overlay injustice
│  │  ├─ login/page.tsx
│  │  └─ (app)/                 # groupe avec chrome (sidebar+topbar+⌘K)
│  │     ├─ layout.tsx          # AppShell
│  │     ├─ page.tsx            # Accueil
│  │     ├─ projects/…          # liste, [slug], [slug]/docs
│  │     ├─ annotate/[annotationId]/page.tsx   # ★ workspace
│  │     ├─ review/[id]/page.tsx
│  │     ├─ compare/page.tsx
│  │     ├─ history/[id]/page.tsx               # timeline + DiffView (F3, implémenté)
│  │     ├─ projects/[slug]/page.tsx            # dashboard + IaaDashboard (F10, implémenté)
│  │     ├─ settings/page.tsx
│  │     └─ admin/…             # corpora, schemes, projects, preannotations,
│  │                             # translations (F8, implémenté), exports, users, audit
│  ├─ components/{shell,workspace,ui,admin,history,projects}/
│  ├─ lib/{api,pivot,tokens,cn}
│  ├─ store/{ui,workspace}
│  ├─ mocks/{handlers,fixtures,browser,server}
│  └─ types/contract.ts
├─ tests/                        # Vitest (unit) + setup MSW
└─ e2e/                          # Playwright
```

## 3. Routing (navigation.md §1) — couverture

Toutes les routes de `navigation.md` sont présentes. `/login` est hors chrome ; tout le reste
vit dans le groupe `(app)` qui applique `AppShell` (sidebar repliable + top bar + command palette).
Le workspace `/annotate/[annotationId]` occupe la pleine hauteur sous la top bar.

## 4. Couche données

`src/lib/api/client.ts` : `apiFetch<T>()` ajoute `Authorization: Bearer`, tente un refresh
transparent sur 401, lève `ApiError`. `endpoints.ts` mappe 1:1 le CONTRACT §3. `hooks.ts` expose
les hooks React Query avec clés stables (`qk`) et invalidations ciblées après mutation.

Le **format pivot** (CONTRACT §4) est isolé dans `lib/pivot.ts` : `normalizeToPivotClauses`
absorbe v9.2 (`document_plan.segments[].start_id`) et v9.4 (`plan.clauses[].anchor_id`/`open_span`)
vers le pivot natif, trie de façon monotone et déduplique les ancres (1 start par phrase).

Le **diff de versions** (CONTRACT §3, F3) est isolé dans `lib/versionDiff.ts` : `diffSnapshots`
compare deux snapshots pivot clause par clause (par `anchor_index`) et qualifie chaque clause
(`added` / `removed` / `modified` / `unchanged`) avec la liste des champs modifiés ; `buildVersionDiff`
agrège le résumé. C’est une brique pure, testée (`tests/versionDiff.test.ts`) et réutilisée côté MSW.

## 4 bis. Surfaces complètes (passées de squelette à implémenté)

- **`/history/[id]`** (F3) : timeline des `AnnotationVersion` + `DiffView` (clauses ajoutées /
  supprimées / modifiées par ancre et thème, champs avant→après, résumé). Sélection de la version
  base et cible. MSW : `GET .../versions`, `GET .../versions/{n}/diff?against=`, `POST .../versions`.
- **`/admin/translations`** (F8) : déclaration d’un `TranslationSet` (dossier source, langue,
  stratégie de mapping), lancement de la sync, affichage du mapping document↔fichier (associés /
  non résolus). MSW : `GET/POST /translations/sets`, `POST /translations/sets/{id}/sync`.
- **`/projects/[slug]`** (F10) : `IaaDashboard` — κ de Cohen global, accord sur les frontières,
  κ par thème (barres SVG/CSS maison, couleurs des tokens), depuis `iaaDetail` de
  `/projects/{slug}/progress`.

## 4 ter. Centre d'aide & visite guidée (onboarding)

Deux dispositifs d'aide complètent le shell (navigation.md §2 « ouvrir l'aide », §5
« tour guidé léger, jamais bloquant »).

### Centre d'aide in-app (Markdown)

- **Route** : `/help` (groupe `(app)`), accessible via le lien « ? »
  (`data-testid="help-link"`) dans la `TopBar`. Mise en page 2 colonnes : barre
  latérale (groupes + sections du manifeste, lien actif, recherche par titre) +
  contenu rendu avec **react-markdown + remark-gfm** (`components/help/HelpMarkdown.tsx`,
  composants stylés sur les tokens sombres : titres, listes, code, tables, citations,
  liens internes via `next/link`).
- **Contenu piloté par fichiers** : `content/help/*.md` (un fichier par section,
  éditables à la main, source de vérité). `content/help/manifest.ts` exporte
  l'ordre et les titres `[{ slug, title, group }]` + les helpers `helpGroups()`,
  `helpSection()`. `content/help/index.ts` réexporte chaque `.md` en chaîne brute
  via le suffixe `?raw` (support natif Vite/Vitest ; règle webpack `asset/source`
  ajoutée dans `next.config.mjs` ; type `*.md?raw` déclaré dans `src/types/raw-md.d.ts`).
- **Ajouter une section** : (1) créer `content/help/<slug>.md` ; (2) l'importer et
  l'enregistrer dans `HELP_CONTENT` (`content/help/index.ts`) ; (3) ajouter
  `{ slug, title, group }` dans `HELP_MANIFEST`. Aucune autre modification.
- Sections livrées : introduction, démarrage, workspace, thèmes & vocabulaire,
  pré-annotations LLM, injustice CLAUDETTE, certitude, commentaires, versions &
  historique, revue, export, traductions, raccourcis, FAQ.

### Visite guidée du workspace (driver.js)

- **Module** : `src/lib/tour/workspaceTour.ts` configure **driver.js** (MIT, CSS
  importé dans le module). Les étapes (`WORKSPACE_TOUR_STEPS`) ciblent des sélecteurs
  RÉELS (`data-testid` + rôles ARIA) : workspace, plan, document, phrase, inspecteur,
  palette de thèmes, certitude, pré-remplissage Claude, overlays injustice/fantômes,
  commentaires, snapshot, soumission, rappel des raccourcis + lien vers `/help`.
  `startWorkspaceTour()` **filtre dynamiquement** les étapes dont l'élément est absent
  du DOM (ex. le fil de commentaires n'existe qu'avec une clause sélectionnée).
- **Déclenchement** : bouton « Visite guidée » (`data-testid="start-tour"`) dans
  `WorkspaceToolbar` (`components/workspace/WorkspaceTourButton.tsx`, import dynamique
  pour ne charger driver.js qu'à la demande). Auto-démarrage à la **première visite**
  (localStorage `claire.tourSeen`), non bloquant, et **JAMAIS en mode mock**
  (`NEXT_PUBLIC_ENABLE_MOCKS === "true"`) afin de préserver les E2E Playwright ; le
  bouton fonctionne toujours. Pilotable au clavier (driver.js).
- **Tests** : Vitest `tests/helpManifest.test.ts` (slugs uniques, contenu non vide)
  et `tests/workspaceTour.test.ts` (chaque étape a un sélecteur + popover titre/desc).
  Playwright `e2e/help.spec.ts` et `e2e/tour.spec.ts`.

## 5. Thème & accessibilité (F6)

- Sombre par défaut, contraste AA, colonne de lecture ~70ch, `line-height 1.7`.
- Bascule clair/sombre persistée (`store/ui`, localStorage), appliquée par classe sur `<html>`.
- `:focus-visible` global, skip-link, ARIA (listbox/radiogroup/dialog/separator), navigation
  clavier complète dans le workspace et la command palette.

Détails état : `state_management.md`. Composants : `components.md`. Tests : `testing_frontend.md`.
