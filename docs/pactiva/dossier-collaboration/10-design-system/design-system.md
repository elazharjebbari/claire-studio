# Design system & accessibilité — Pactiva

> Lot **10-design-system** du dossier collaboration. Documente le système de style
> effectivement en place (tokens, primitives, identité utilisateur, hiérarchie des
> écrans) et la **liste des écarts** relevés par l'audit (`area=design-a11y`), avec un
> plan priorisé P1/P2/P3. **Ce document ne corrige pas le code** : il en décrit l'état et
> le plan.
>
> Sources de vérité : `frontend/design-tokens.json` (couleurs), `docs/pactiva/charte-graphique.md`
> (charte), `frontend/src/lib/tokens.ts` (accès typé), `frontend/tailwind.config.ts`
> (exposition Tailwind), `frontend/src/app/globals.css` (CSS vars + a11y de base),
> `backend/claire/common/identity.py` (couleur d'identité). Findings :
> `../00-audit/findings.csv` (`area=design-a11y`).

---

## 1. Architecture du système de style

La couleur n'a **qu'une source de vérité** : `frontend/design-tokens.json` (dérivé de
`dossier/00_overview/vocabulary.yaml`). La chaîne est :

```
vocabulary.yaml  →  design-tokens.json  →  tailwind.config.ts (colors)          →  classes utilitaires (bg-accent, text-ink…)
                                        →  globals.css (CSS vars --surface-*, --sem-*)  →  bascule clair/sombre
                                        →  src/lib/tokens.ts (THEMES, CERTAINTY…)       →  composants (puces, jauges)
```

Deux familles de couleurs cohabitent :

1. **Surfaces & états sémantiques** — pilotés par **CSS variables** (`--surface-*`,
   `--sem-*`, `--brand-gold`) définies dans `globals.css:10-36` (sombre, défaut) et
   `globals.css:38-58` (clair, classe `.light`/`.theme-light`). Tailwind les expose en
   canaux RGB avec `<alpha-value>` (`tailwind.config.ts:25-40`), ce qui permet des
   opacités (`bg-accent/50`) tout en suivant le thème. **Ce sont ces tokens qu'il faut
   utiliser dans l'UI**, jamais une couleur Tailwind palette en dur.
2. **Couleurs de domaine** — thèmes de clause, échelle de certitude, catégories/niveaux
   d'injustice CLAUDETTE. Fixes (identiques aux deux thèmes), lues via `src/lib/tokens.ts`
   (`THEMES`, `CERTAINTY_SCALE`, `UNFAIRNESS_CATEGORIES`, `UNFAIRNESS_LEVELS`) et
   exposées en `text-theme-META`, etc. (`tailwind.config.ts:44`). Le schéma du projet
   (API) peut hydrater ces couleurs au runtime (`setRuntimeThemes`, `tokens.ts:67-85`)
   pour rendre l'app générique (corpus tiers).

Deux thèmes :

- **Sombre** (défaut) — atelier anti-fatigue (exigence F6), habillé de la palette Pactiva.
- **Clair** (classe `.light` sur `<html>`, ou `.theme-light` local pour les pages
  publiques) — identité institutionnelle navy sur blanc.

---

## 2. Tokens sémantiques de surface

Table des tokens **surface** (mappage défini dans `globals.css` et exposé dans
`tailwind.config.ts:25-34`). Les valeurs sont confirmées identiques entre
`design-tokens.json > surface` et la charte (§3.6).

| Classe Tailwind | CSS var | Sombre (`#`) | Clair (`#`) | Rôle |
|---|---|---|---|---|
| `bg-bg` | `--surface-bg` | `0B0F14` | `F7F9FC` | Fond global de l'application |
| `bg-elevated` | `--surface-bg-elevated` | `111722` | `FFFFFF` | Surface surélevée (header, popovers) |
| `bg-panel` | `--surface-panel` | `141B26` | `FFFFFF` | Panneau / carte |
| `bg-panel-muted` | `--surface-panel-muted` | `1A2230` | `EEF2F8` | Panneau secondaire, hover, fond de badge |
| `border-line` | `--surface-border` | `26303F` | `D8E0EC` | Bordure 1px (élévation par bordure, pas ombre) |
| `text-ink` | `--surface-text` | `E6EAF0` | `0E2238` | Texte primaire |
| `text-ink-muted` | `--surface-text-muted` | `9AA6B6` | `5A6678` | Texte secondaire / libellés |
| `bg-accent` / `text-accent` | `--surface-accent` | `4E86D4` | `0C447C` | Accent d'action (navy éclairci AA en sombre) |
| `text-accent-fg` | `--surface-on-accent` | `0B0F14` | `FFFFFF` | Texte **sur** l'accent |
| `bg-reading` | `--surface-reading` | `0E141C` | `FCFDFF` | Fond de la colonne de lecture (~70ch) |

Table des tokens **sémantiques d'état** (`globals.css:24-27` / `:54-57`, exposés
`tailwind.config.ts:36-40`) :

| Classe | CSS var | Sombre | Clair | Rôle |
|---|---|---|---|---|
| `*-success` | `--sem-success` | `34C77B` | `1E7A4D` | Succès / validé |
| `*-warning` | `--sem-warning` | `E0A100` | `9A6700` | Attention / lecture seule |
| `*-danger` | `--sem-danger` | `F2585F` | `B4232A` | Erreur / risque / rejet |
| `*-info` | `--sem-info` | `5B9DFF` | `0C447C` | Information |
| `*-gold` | `--brand-gold` | `BA7517` | `BA7517` | Accent de marque **rare** (jamais aplat large) |

> **Note de gouvernance** : ces 4 tokens sémantiques existent et basculent correctement
> entre thèmes, mais une grande partie de l'UI **ne les utilise pas** (voir §6, finding
> `hardcoded-tailwind-state-colors`). C'est l'écart de design le plus structurant.

Typographies (`tailwind.config.ts:46-51`, `globals.css:32-35`) : `font-sans` (Inter, UI),
`font-display` (Outfit, titres/wordmark), `font-reading` (serif Iowan/Georgia, colonne
~70ch, `line-height: 1.7`), `font-mono` (identifiants/raccourcis). `max-w-reading = 70ch`.

---

## 3. Couleur d'identité par utilisateur

Définie **côté backend** dans `backend/claire/common/identity.py`. Elle sert l'overlay
d'attribution (point 3), la présence collaborative (4b/7) et les avatars, **sans stocker
de couleur** : elle est dérivée de façon déterministe et stable de l'`id` utilisateur.

```python
# identity.py:8-24
PALETTE = ["#06B6D4", "#F59E0B", "#A78BFA", "#34D399", "#F472B6", "#60A5FA"]
def user_color(user_id) -> str:
    n = int(user_id) ...            # repli: somme des ord(c) si non entier
    return PALETTE[n % len(PALETTE)]
```

- **Palette de 6 teintes** (cyan, amber, violet, emerald, pink, blue), choisies pour le
  contraste. Stable : la couleur d'un annotateur ne change pas d'une session à l'autre.
- **Collision possible** au-delà de 6 utilisateurs simultanés (`% 6`) — acceptable pour la
  taille d'équipe actuelle (3 comptes), mais à documenter comme limite si l'équipe grandit.
- **Lisibilité du texte par-dessus** : côté frontend, `readableTextColor(bgHex)`
  (`src/lib/tokens.ts:139-150`) calcule le quasi-noir/blanc maximisant le contraste WCAG
  sur n'importe quelle teinte de fond dynamique → les pastilles de présence et puces de
  thème restent AA quelle que soit la couleur. `hexToRgbChannels` (`tokens.ts:119-125`)
  convertit un hex en canaux pour les CSS vars.
- `display_name(user)` (`identity.py:27-32`) fournit le libellé lisible associé
  (`get_full_name` → `username` → `user#id`).

---

## 4. Primitives & StatusPill

`frontend/src/components/ui/primitives.tsx` — petites primitives qui **consomment
correctement les tokens** (bon exemple à généraliser) :

| Primitive | Lignes | Tokens utilisés |
|---|---|---|
| `Button` (`primary`/`outline`/`ghost`/`subtle`) | `9-27` | `bg-accent`/`text-accent-fg`, `border-line`/`bg-panel`/`text-ink`, `bg-panel-muted`, `text-ink-muted` |
| `Badge` | `29-42` | `border-line`, `bg-panel-muted`, `text-ink-muted` |
| `Panel` | `44-54` | `border-line`, `bg-panel` |
| `Field` (label + slot) | `56-73` | `text-ink-muted` |
| `StatusPill` | `75-94` | **mixte** (voir ci-dessous) |

**`StatusPill`** mappe un statut de session vers un ton :

```tsx
// primitives.tsx:76-83
draft:     "border-ink-muted/40 text-ink-muted"     // OK (token)
submitted: "border-accent/50 text-accent"           // OK (token)
in_review: "border-amber-500/50 text-amber-400"     // ✗ couleur en dur
approved:  "border-emerald-500/50 text-emerald-400" // ✗ couleur en dur
rejected:  "border-red-500/50 text-red-400"         // ✗ couleur en dur
archived:  "border-ink-muted/30 text-ink-muted"     // OK (token)
```

→ `StatusPill` est **le premier candidat à la centralisation** : `in_review` devrait
utiliser `warning`, `approved` → `success`, `rejected` → `danger`. C'est l'illustration
canonique du finding `hardcoded-tailwind-state-colors` (§6).

---

## 5. Hiérarchie visuelle des écrans

Principe directeur de la refonte (ADR-001, §4 « Séparation UI systématique D ») : trois
zones **visuellement distinctes**, jamais confondues, conformes au glossaire
(`../01-besoins/glossaire.md`).

| Zone | Sémantique (glossaire) | Code couleur attendu | Éditable ? |
|---|---|---|---|
| **Ma session** | Travail réel et isolé de l'utilisateur (`Annotation.annotator == me`) | `accent` (navy) | Oui — owner-only (INV-ISO) |
| **Lecture seule / Supervision** | Session d'un autre, vue par admin/lead | `warning` (ambre) | Non — bandeau explicite attendu |
| **Collaboration** | Commentaires, présence, comparaison N-way, fantômes LLM | neutre + identité utilisateur | **Jamais une référence** (INV-COLLAB) |

Hiérarchie typographique (charte §4) : titres en **Outfit** (`font-display`), corps UI en
**Inter** (`font-sans`), document contractuel en **serif** sur fond `reading` colonne
~70ch interligne 1.7 (anti-fatigue F6). Élévation **minimaliste** : bordures `1px` +
fonds `panel` plutôt qu'ombres (charte §6). Mouvement sobre 120-180 ms `ease-out`
(`tailwind.config.ts:59-67`, `animation: fade-in 120ms ease-out`).

A11y de base **déjà en place** dans `globals.css` : focus visible accessible
(`:focus-visible` anneau `accent` 2px offset 2px, `:73-77`), skip-link clavier
(`.skip-link`, `:85-98`), scrollbars discrètes (`:80-83`), `color-scheme` correct par
thème. C'est une fondation saine ; les écarts ci-dessous sont des compléments, pas une
remise à plat.

---

## 6. Écarts relevés par l'audit (`area=design-a11y`) & plan priorisé

Six findings consolidés dans `../00-audit/findings.csv`. Tous **majeurs**. Priorisation :
**P1** = visible/régression a11y bloquante pour lecteur d'écran ou rendu, **P2** = dette
de cohérence à fort effet de levier, **P3** = robustesse/raffinement.

### Tableau de synthèse

| # | Finding (id) | Sévérité | Emplacement(s) vérifié(s) | Priorité |
|---|---|---|---|---|
| 1 | `save-indicator-no-live-region` | major | `WorkspaceToolbar.tsx:379-412` (`SaveIndicator`) | **P1** |
| 2 | `surface-line-css-var-typo` | major | `DocumentPanel.tsx:662`, `ModelBoundaryRail.tsx:108` | **P1** |
| 3 | `theme-fouc-no-blocking-script` | major | `layout.tsx:32`, `providers.tsx:41-49`, `store/ui.ts:69-73` | **P1** |
| 4 | `no-prefers-reduced-motion` | major | `globals.css` (absent), `tailwind.config.ts:59-67` | **P2** |
| 5 | `hardcoded-tailwind-state-colors` | major | `primitives.tsx:79-82`, `WorkspaceToolbar.tsx:383-392` (~86, mesuré ≈138 occurrences `src/`) | **P2** |
| 6 | (identité utilisateur — limite `% 6`) | note | `common/identity.py:8-15` | **P3** |

### Détail & recommandations

**1 — `SaveIndicator` sans région live (P1).** `WorkspaceToolbar.tsx:379` :
`SaveIndicator` rend l'état d'autosave (`saving`/`saved`/`offline`/`retrying`/`error`/
`unauthorized`/`idle`) dans un `<span data-testid="save-indicator">` **sans**
`role="status"` ni `aria-live`. Un lecteur d'écran n'annonce donc jamais un échec
d'enregistrement silencieux — risque de perte de travail non perçue. Aggravé par le fait
que l'indicateur repose sur des glyphes + couleur (`✗`, `text-red-400`) : le sens passe
partiellement par la couleur seule (contraire charte §9).
**Reco :** ajouter `role="status" aria-live="polite" aria-atomic="true"` sur le conteneur ;
annoncer aussi les actions pose/undo/redo ; conserver un libellé textuel non ambigu (déjà
le cas) pour ne pas dépendre de la couleur.

**2 — Variable CSS inexistante `--surface-line` (P1).** Deux usages écrivent
`"rgb(var(--surface-line))"` (`DocumentPanel.tsx:662`, `ModelBoundaryRail.tsx:108`) alors
que `globals.css` ne définit **que** `--surface-border`. La var est donc *undefined* →
`rgb()` invalide → bordure non rendue (ou repli navigateur) dans les deux thèmes, là où
une frontière de modèle/clause devrait être visible.
**Reco :** remplacer par `rgb(var(--surface-border))` ou, mieux, par la classe Tailwind
`border-line` qui pointe déjà sur ce token. Ajouter un test/lint interdisant les
`var(--surface-*)` hors liste connue.

**3 — FOUC du thème (P1).** `layout.tsx:32` fige `className="dark"` en SSR ; le thème réel
(préférence persistée par `store/ui.ts`) n'est appliqué qu'après hydratation via
`useApplyTheme` (`providers.tsx:41-49`, un `useEffect`). Conséquence : un utilisateur en
clair voit un **flash de thème sombre** au premier paint à chaque chargement. Régression
de confort et d'accessibilité (transition brutale de luminance).
**Reco :** injecter un **script inline bloquant** dans `<head>` (avant le premier paint)
qui lit la préférence (localStorage) et pose `light`/`dark` + `color-scheme` sur
`<html>`. Garder `suppressHydrationWarning` (déjà présent). `useApplyTheme` reste pour les
changements ultérieurs.

**4 — `prefers-reduced-motion` ignoré (P2).** `globals.css` ne contient aucun bloc
`@media (prefers-reduced-motion: reduce)` ; l'animation `fade-in` (120 ms) et tout
`scroll-behavior: smooth` s'appliquent quelle que soit la préférence système. Contraire à
la charte §9 (« `prefers-reduced-motion` respecté ») et aux WCAG 2.3.3.
**Reco :** ajouter dans `globals.css` :
`@media (prefers-reduced-motion: reduce) { *, ::before, ::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; scroll-behavior: auto !important; } }`.
Possibilité de neutraliser aussi le keyframe `fade-in` côté Tailwind pour les variantes
`motion-reduce:`.

**5 — Couleurs Tailwind palette en dur (P2).** Le finding cite **~86** occurrences qui
court-circuitent les tokens sémantiques (`amber-400`, `emerald-400`, `red-400`, `sky-*`…).
Un comptage élargi sur tout `src/` (toutes classes `text/bg/border/ring/from/to/via-*-NNN`)
remonte **≈138** occurrences — l'écart vient du périmètre (le finding cible surtout les
**états** ; le comptage large inclut aussi pages publiques/auth). Exemples vérifiés :
`StatusPill` (`primitives.tsx:79-82`), `SaveIndicator` (`WorkspaceToolbar.tsx:383-392`).
Problème : ces couleurs **ne basculent pas** clair/sombre et **dérivent** de la charte
(p.ex. `red-400` ≠ `--sem-danger`), ce qui fragmente le langage visuel et casse le contrat
AA en thème clair.
**Reco (effet de levier max) :** centraliser via les tokens — `success`/`warning`/`danger`/
`info` — en commençant par les composants d'état partagés (`StatusPill`, `SaveIndicator`,
`WorkspaceToolbar`), puis les pages. Ajouter une règle ESLint/regex en CI interdisant les
classes de couleur palette dans `src/components/**` (autoriser une *allowlist* documentée
pour les couleurs de domaine non tokenisables). Mesurer la dette par un compteur en CI.

**6 — Limite de la palette d'identité (P3, note hors findings).** `user_color`
(`identity.py:8-15`) fait `% 6` : au-delà de 6 utilisateurs simultanés, deux annotateurs
peuvent partager une teinte. Sans impact pour l'équipe actuelle (3 comptes), mais à
surveiller. **Reco :** documenter la limite ; si l'équipe grandit, élargir la palette
(en conservant le contraste AA) ou hacher sur plus de bits ; ne jamais faire reposer
l'attribution sur la **seule** couleur (toujours doubler d'un nom/initiales — déjà servi
par `display_name`).

---

## 7. Synthèse du plan

| Priorité | Action | Fichiers cibles | Critère de « fait » |
|---|---|---|---|
| **P1** | Région live sur l'autosave | `WorkspaceToolbar.tsx` | `role=status`/`aria-live=polite`/`aria-atomic`; test SR/axe |
| **P1** | Corriger `--surface-line` → `--surface-border` | `DocumentPanel.tsx`, `ModelBoundaryRail.tsx` | bordures rendues clair+sombre; lint var |
| **P1** | Script inline bloquant de thème | `layout.tsx` (`<head>`) | zéro FOUC au reload en clair |
| **P2** | `@media prefers-reduced-motion` | `globals.css` | animations/scroll neutralisés si reduce |
| **P2** | Centraliser les états sur les tokens | `primitives.tsx`, `WorkspaceToolbar.tsx`, pages | StatusPill/SaveIndicator sans couleur en dur; lint anti-palette en CI |
| **P3** | Documenter limite palette identité | `identity.py` (doc) | limite `% 6` notée; attribution jamais couleur-seule |

> Tous les écarts sont des **compléments** à une fondation a11y déjà correcte
> (focus visible, skip-link, `readableTextColor`, AA des tokens). Aucun ne nécessite de
> refonte du système de tokens : la cible est de **faire utiliser** des tokens qui
> existent déjà et de combler trois trous d'accessibilité (live region, FOUC,
> reduced-motion).
