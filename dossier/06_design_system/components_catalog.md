# Catalogue de composants — CLAIRE Studio

> Composants du design system, chacun relié à une **feature** (feature_traceability.csv), aux **entités**
> du CONTRACT §2 et aux **tokens** (`design_tokens.json`). Convention frontend : `PascalCase` (CONTRACT §6).
> Chaque composant note : rôle, props clés, états, accessibilité, tokens, feature. Les composants sont
> **agnostiques au corpus** : ils consomment le `LabelScheme` du projet, jamais des valeurs en dur.

## Principes transverses

- **Accessibilité native** (accessibility.md) : focus visible, navigable clavier, ARIA correct, info jamais
  portée par la seule couleur.
- **Thémable** : tout passe par les tokens sémantiques (`theme.light/dark`), aucune couleur en dur.
- **Optimiste** : les composants d'édition reflètent l'état localement avant confirmation serveur (409 géré).
- **Anti-fatigue** : densités confort/compact, transitions respectant `prefers-reduced-motion`.

---

## ClauseChip (F1, F11)
- **Rôle** : représente un thème de clause (pastille colorée + code + label court).
- **Props** : `themeCode`, `color` (depuis `theme_colors`/scheme), `selected`, `size`, `onClick`.
- **Entités** : `Theme`, `Clause`.
- **États** : default, selected, hover, focus, disabled (thème hors scheme — ne survient pas, vocab fermé).
- **A11y** : couleur **+ code texte** (jamais couleur seule) ; pastille à bordure ; `aria-label` = label du thème.
- **Tokens** : `radius.pill`, `theme_colors.*`, `font-family.mono`.

## SentenceRow (F1, F12)
- **Rôle** : une phrase du document, avec son index, sélectionnable, ancrable, surlignable.
- **Props** : `index`, `text`, `isAnchor`, `clauseColor?`, `unfairnessOverlay?`, `ghostLLM?`, `selected`,
  `onSelect`, `onSetBoundary`.
- **Entités** : `Sentence`, `Clause` (ancre), `ReferenceLabel` (overlay), `PreClause` (fantôme).
- **États** : normal, sélectionnée (`j/k`), ancre de clause (`B`), surlignée (overlay injustice), fantôme LLM.
- **A11y** : élément de liste, `aria-label` incluant index + thème + certitude + injustice éventuelle ;
  index en mono `fg-subtle`.
- **Tokens** : `spacing.sentence-gap`, `line-height.reading` (1.7), `measure.document` (70ch).

## ThemePalette (F1, F11)
- **Rôle** : sélecteur fermé de thème (`T`) : grille colorée + recherche typée ; **n'expose que** les thèmes
  du `LabelScheme` du projet.
- **Props** : `scheme`, `value`, `onChange`, `query`.
- **Entités** : `LabelScheme`, `Theme`.
- **États** : ouverte, en recherche, sélection, vide (aucun match).
- **A11y** : pattern listbox/combobox ARIA, `aria-activedescendant`, navigable flèches + Entrée, Échap ferme.
- **Tokens** : `theme_colors.*`, `radius.md`, `shadow.md`, `z-index.overlay`.
- **Invariant** : impossible de choisir hors scheme (ADR-0003 / INV-3) — aucun champ libre.

## CertaintyPicker (F10)
- **Rôle** : sélection de certitude 0–3 sur la clause sélectionnée ou l'annotation globale.
- **Props** : `value`, `onChange`, `scope` (`clause|annotation`), `keyboard` (0–3).
- **Entités** : `Clause.certainty`, `Annotation.global_certainty`.
- **États** : 0🤔 / 1🙂 / 2😀 / 3💯 (couleur + emoji + label), focus, non défini (null).
- **A11y** : `radiogroup` ARIA ; emoji décoratif, **label textuel** porteur de sens ; raccourcis `0–3`
  inactifs en champ de saisie.
- **Tokens** : `certainty_colors.*`, `radius.pill`.
- **Invariant** : valeur ∈ {0,1,2,3} (INV-6).

## CommentThread (F9)
- **Rôle** : fil de discussion ancré (clause/phrase/annotation) pour justifier un choix ; résolution.
- **Props** : `annotationId`, `clauseId?`, `sentenceId?`, `comments[]`, `onPost`, `onResolve`.
- **Entités** : `Comment` (`thread_root`, `resolved`, `body:md`).
- **États** : vide, fil ouvert, résolu, en cours de saisie, optimiste (post en attente).
- **A11y** : région nommée, ordre chronologique annoncé, `aria-live="polite"` à l'arrivée d'un message.
- **Tokens** : `surface`, `border`, `radius.md`. **Raccourci** : `C`.

## DiffView (F2, F3)
- **Rôle** : différence entre deux annotations / versions (humain vs LLM, ou v(n) vs v(n+1)).
- **Props** : `left`, `right`, `mode` (`versions|annotators|human-vs-llm`), `kappa?`.
- **Entités** : `AnnotationVersion` (diff), `Clause`, `PreClause`.
- **États** : accord (`=`), thème diffère (`▲`), frontière diffère (`◀▶`), seul-A, seul-B.
- **A11y** : chaque diff a un **label textuel** en plus de la couleur (« thème diffère : A=…, B=… »).
- **Tokens** : `status.*`, `font-family.mono`. **Surface** : `/compare`, `/history/[id]`, inspecteur.

## OverlayToggle (F2, F8, F12)
- **Rôle** : active/désactive les calques du document : injustice CLAUDETTE, fantôme LLM (claude/codex),
  traduction.
- **Props** : `layer` (`unfairness|llm:claude|llm:codex|translation`), `checked`, `onToggle`.
- **Entités** : `ReferenceLabel` (injustice), `PreAnnotation`/`PreClause` (LLM), `Translation`.
- **États** : on/off, indisponible (aucune donnée pour ce calque sur ce doc).
- **A11y** : `switch` ARIA, `aria-label` explicite ; état annoncé (pas seulement la couleur).
- **Tokens** : `unfairness_colors.*`, opacités `level_intensity`. **Surface** : Plan / TOC (gauche).

## CommandPalette (navigation ⌘K)
- **Rôle** : palette de commandes — sauter à un document, lancer un export, changer de thème de clause,
  ouvrir l'aide, naviguer.
- **Props** : `commands[]`, `query`, `onRun`.
- **A11y** : combobox ARIA, `aria-activedescendant`, résultats annoncés à la frappe, Échap ferme + rend focus.
- **Tokens** : `z-index.command-palette`, `shadow.lg`, `radius.lg`. **Raccourci** : `⌘K`.

---

## Composants de support (cohérents contrat)

| Composant | Rôle | Feature | Entités | Surface |
|---|---|---|---|---|
| **StatusBadge** | statut d'annotation (couleur + libellé + icône) | F3/F10 | `Annotation.status` | partout |
| **ProgressBar** | avancement projet/annotation | F4 | `Project`, `Annotation` | dashboard, plan |
| **KappaMeter** | accord inter-annotateur (κ global + par paire) | F4 | agrégat `Annotation` | dashboard, compare |
| **ActivityBell** | cloche « qui a annoté quoi » | F4 | `ActivityEvent` | top bar |
| **ResizablePanels** | 3 panneaux redimensionnables, largeurs persistées | F6 | — | workspace |
| **ThemeToggle** | bascule clair/sombre sans flash, persistée | F6 | — | top bar |
| **EvidenceSpanInput** | sélection/saisie de l'empan probant | F1 | `Clause.evidence_span` | inspecteur |
| **RationaleEditor** | éditeur markdown du raisonnement | F1 | `Clause.rationale` | inspecteur |
| **ReviewForm** | score 1–5 + décision + rubrique + corps | F10 | `Review` | `/review` |
| **VersionTimeline** | historique des snapshots + sélection diff | F3 | `AnnotationVersion` | `/history` |
| **ExportDialog** | choix format/scope + suivi job + manifest | F5 | `ExportJob` | `/admin/exports` |
| **SchemeEditor** | clone/version d'un schéma fermé (lecture des thèmes) | F11 | `LabelScheme`, `Theme`, `LegalNature` | `/admin/schemes` |
| **PreAnnotationImporter** | upload/pull + mapping v9.2/v9.4 → pivot | F2 | `PreAnnotation`, `PreClause` | `/admin/preannotations` |
| **AssignmentList** | plan de travail (mes documents) | F4 | `Assignment` | dashboard |
| **EmptyState** | états vides / onboarding non bloquant | navigation §5 | — | accueil, projet |
| **Toast** | feedback discret (auto-save, export prêt, erreur) | F6 | — | global (`aria-live`) |
| **HelpSheet (`?`)** | cheat-sheet des raccourcis | F6 | — | global |

## Cartographie composant → feature (synthèse)

| Feature | Composants principaux |
|---|---|
| F1 annotation | SentenceRow, ClauseChip, ThemePalette, EvidenceSpanInput, RationaleEditor |
| F2 pré-annotation LLM | PreAnnotationImporter, OverlayToggle (fantôme), DiffView |
| F3 versioning | VersionTimeline, DiffView, StatusBadge |
| F4 collaboration | ActivityBell, ProgressBar, KappaMeter, AssignmentList |
| F5 export | ExportDialog |
| F6 anti-fatigue | ResizablePanels, ThemeToggle, Toast, HelpSheet (tous via tokens) |
| F8 traductions | OverlayToggle (langue) |
| F9 commentaires | CommentThread |
| F10 certitude/review | CertaintyPicker, ReviewForm, StatusBadge |
| F11 multi-corpus | SchemeEditor, ThemePalette (scheme-driven) |
| F12 injustice CLAUDETTE | OverlayToggle (injustice), SentenceRow (surlignage) |
| navigation | CommandPalette, EmptyState |
