# Composants — catalogue & mapping

## Shell (`components/shell/`)

| Composant | Rôle (navigation.md §2) |
|---|---|
| `AppShell` | Assemble sidebar + top bar + command palette ; skip-link a11y. |
| `Sidebar` | Navigation primaire repliable (projet + section admin). |
| `TopBar` | Sélecteur de projet, bouton ⌘K, bascule thème, cloche, menu user. |
| `CommandPalette` | ⌘K : sauts rapides, export, bascule thème, comparaison. |
| `ActivityBell` | F4 — popover « qui a annoté quoi ». |

## Workspace (`components/workspace/`) — ★ cœur

| Composant | Feature | Rôle |
|---|---|---|
| `AnnotationWorkspace` | F1,F6 | Orchestrateur : branche store ↔ React Query, active les raccourcis. |
| `ResizablePanels` | F6 | 3 colonnes redimensionnables (souris + clavier, largeurs persistées). |
| `TocPanel` | F1,F2,F12 | Plan/TOC coloré, progression, toggles overlays. |
| `DocumentPanel` | F1,F6,F12,F2 | Lecture ~70ch, phrases indexées cliquables, surlignage injustice, fantômes LLM. |
| `InspectorPanel` | F1,F9,F10 | Thème (palette), nature, certitude 0–3, evidence, rationale, commentaires. |
| `WorkspaceToolbar` | F2,F3,F10 | Pré-remplir Claude/Codex, certitude globale, snapshot, soumettre. |
| `CommentThread` | F9 | Fil de commentaires ancré (post + résolution). |
| `useShortcuts` | F1 | j/k, B, T, C, 0–3, ⌘S. |
| `useUnfairness` | F12 | Indexe les ReferenceLabels par phrase, style de surlignage par niveau. |

## UI réutilisables (`components/ui/`)

| Composant | Mapping design system |
|---|---|
| `ClauseChip` | Pastille de thème colorée (token couleur + label, jamais couleur seule). |
| `ThemePalette` | Sélecteur de thème (vocab fermé, filtrable, ARIA listbox). |
| `CertaintyPicker` | Échelle 0–3 emoji + raccourci (ARIA radiogroup). |
| `primitives` | `Button`, `Badge`, `Panel`, `Field`, `StatusPill`. |

## Admin (`components/admin/`)

`AdminScaffold` — tableau générique (en-têtes + lignes + actions) réutilisé par toutes les
sous-pages `/admin/*`.

## Conventions

- Composants `PascalCase`, hooks/utils `camelCase` (CONTRACT §6).
- Couleurs **toujours** via `lib/tokens` / CSS vars, jamais en dur — alignement strict sur
  `vocabulary.yaml`.
- `data-testid` stables sur les éléments interactifs clés (ciblage Vitest + Playwright).
