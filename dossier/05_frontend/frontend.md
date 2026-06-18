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
- **MSW** pour mocker `/api/v1/*` (front MVP autonome) ; **Vitest** (unit) + **Playwright** (E2E).

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
│  │     ├─ history/[id]/page.tsx
│  │     ├─ settings/page.tsx
│  │     └─ admin/…             # corpora, schemes, projects, preannotations,
│  │                             # translations, exports, users, audit
│  ├─ components/{shell,workspace,ui,admin}/
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

## 5. Thème & accessibilité (F6)

- Sombre par défaut, contraste AA, colonne de lecture ~70ch, `line-height 1.7`.
- Bascule clair/sombre persistée (`store/ui`, localStorage), appliquée par classe sur `<html>`.
- `:focus-visible` global, skip-link, ARIA (listbox/radiogroup/dialog/separator), navigation
  clavier complète dans le workspace et la command palette.

Détails état : `state_management.md`. Composants : `components.md`. Tests : `testing_frontend.md`.
