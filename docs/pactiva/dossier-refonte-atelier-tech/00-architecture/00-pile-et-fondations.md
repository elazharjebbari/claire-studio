# Architecture & fondations transverses

## Pile

Next.js 14 App Router (React 18, "use client" pour l'atelier) + Zustand pour l'état d'interaction temps réel (store workspace) et les préférences par compte (store prefs, cache localStorage namespacé + PATCH /me débouncé) + TanStack React Query v5 pour la persistance serveur (annotations, document, schéma, préfetch/invalidation). Couleur 100 % tokenisée : design-tokens.json (dérivé de vocabulary.yaml) → tailwind.config.ts expose les couleurs en `rgb(var(--token) / <alpha-value>)` ; surfaces et tokens sémantiques (--sem-success/warning/danger/info) basculent clair/sombre par variables CSS dans globals.css (sombre par défaut, classe .light). Icônes : lucide-react (bibliothèque unique). Tests : Vitest + jsdom + Testing Library (tests purs store/lib + composants UI), MSW (handlers Node en unit, navigateur en E2E via NEXT_PUBLIC_ENABLE_MOCKS), Playwright + @axe-core/playwright pour l'E2E/a11y. ~470 tests vitest + ~28 specs e2e existants. cn() (clsx) pour la composition de classes. Alias `@` → src.

## Fondations transverses

*Briques réutilisées par plusieurs lots — à construire/consolider une fois, consommées partout.*

### Machine d'états <Button> (source de vérité unique)

Remplace les 4 boutons ad hoc actuels (primitives.tsx : primary/ghost/outline/subtle, sans pending/success/error) par UN composant <Button> portant la matrice complète repos/hover/actif(aria-pressed/expanded)/désactivé/chargement(Loader2, largeur stable, anti double-clic)/succès(CheckCircle ~1,5s)/erreur(AlertCircle, role=alert, recliquable) et les variantes sémantiques primary/neutral/warning/danger/success tokenisées (success/warning/danger/info). Une prop `state` (idle|pending|success|error) ou un branchement direct sur saveState/SubmissionProgressDialog. Réutilisé par les lots 2/5/6/8/9 (toolbar, inspecteur Valider, menu express, prefill en warning). Prérequis Lot 2, consommé partout.

**Fichiers** :
- frontend/src/components/ui/primitives.tsx
- frontend/src/components/ui/Button.tsx
- frontend/src/store/autosave.ts
- frontend/src/components/workspace/SubmissionProgressDialog.tsx
- tests/components.test.tsx

### Garde anti-hex + lint token-only (Lot 0, prérequis transverse)

Verrou CI interdisant tout nouvel hex en dur dans src (hors design-tokens.json / tokens.ts qui restent la SEULE source de couleur). Implémentable via règle ESLint no-restricted-syntax (Literal regex /#[0-9a-fA-F]{3,8}/ sur className/style) + un script de scan (grep ciblé sur les fuites connues : StatusPill amber/emerald/red, levels.ts, LLM_JUDGES, useUnfairness #EC4899, InjusticeLens, AnnotationWorkspace bandeaux slate/sky/amber). Formalise aussi la frontière 'token MÉTIER (thème/triage/juge) ≠ token d'ÉTAT (success/warning/danger/info)'. Bloque la régression de tous les lots suivants.

**Fichiers** :
- frontend/.eslintrc.json
- frontend/scripts/check-no-hex.mjs
- frontend/src/lib/tokens.ts
- frontend/src/components/ui/primitives.tsx
- frontend/design-tokens.json

### Primitive de révélation progressive <Disclosure>

Brique d'accordéon/replié accessible (button aria-expanded/aria-controls, panel id, focusable clavier, respect prefers-reduced-motion via animate fade-in existant) réutilisée par : disclosure 'Affichage' au pied du plan avec badge 'N actifs' (Lot 4), inspecteur en 7 sections accordéon (Lot 6), carte d'arbitrage 'Pourquoi ?' et révélation C1→C5 à la demande (Lot 6), tiroir Affichage/Outils de la toolbar (Lot 8), œil de frontière N-way (Lot 7), menu express replié (Lot 5). Centralise l'a11y de la révélation à la demande, principe directeur n°1.

**Fichiers** :
- frontend/src/components/ui/Disclosure.tsx
- frontend/tailwind.config.ts
- tests/components.test.tsx

### Helper de contraste readableTextColor / token-aware (a11y AA)

readableTextColor(bgHex) existe déjà dans tokens.ts (luminance WCAG → #FFFFFF ou #0B0F14). À étendre pour : badges de niveau C1→C5 (fin des 5 hex TRIAGE_LEVEL_META), pastilles de juge, pastilles de thème dynamiques (schéma tiers via setRuntimeThemes), avatars de présence. Ajouter un helper de contraste sur token sémantique (texte auto sur fond translucide <alpha-value>) et la table tone→token (low/mid/high → success/warning/danger) pour la loupe d'injustice (Lot 7). Garantit l'AA prouvé en clair ET sombre, doublé par forme/glyphe (couleur jamais seule, WCAG 1.4.1).

**Fichiers** :
- frontend/src/lib/tokens.ts
- tests/tokens.test.ts
- frontend/src/lib/triage.ts

### Registre de thème→icône Lucide (getThemeToken + champ icon)

Ajout d'un champ `icon` (composant Lucide) au ThemeToken, injecté au point unique getThemeToken, mappant les 20 thèmes CLAUDETTE (FileText/Scale/Gavel/Users/Tag/ShieldCheck/ShieldOff/Copyright/CheckCircle/Upload/CreditCard/Lock/LogOut/RefreshCw/KeyRound/AlertTriangle/HandCoins/ShieldAlert/MessageSquareWarning/MoreHorizontal). Glyphe monochrome currentColor qui REMPLACE le point coloré dans la pastille (désambiguïse 3 verts/3 rouges/5 violets par la forme, zéro signal ajouté). Réutilisé par chip, plan, rail, inspecteur, menu express (Lots 3/4/5/6).

**Fichiers** :
- frontend/src/lib/tokens.ts
- frontend/src/lib/themeIcons.ts
- frontend/src/components/workspace/ClauseChip.tsx
- tests/clauseChip.test.tsx
- tests/tokens.test.ts

### Persistance de layout PAR COMPTE (extension du store prefs)

Le store prefs (UiPrefsV1, cache localStorage namespacé claire.prefs::<uid> + PATCH /me débouncé, setters idempotents anti-écho, garde anti-boucle sur rev) gère déjà panels.inspectorOpen/historyOpen/commentsOpen/triageOpen et overlays. À ÉTENDRE pour le cadre dock unifié (Lot 1) : repli bilatéral (tocCollapsed/inspectorCollapsed en rail), largeurs de panneaux, plancher de lecture ~70ch (maxWidth.reading déjà en tailwind), et migration des Commentaires/Historique/Triage en drawer overlay (état d'ouverture déjà par compte). Remonte la persistance du layout au compte au lieu de localStorage par poste (cohérence avec overlays/zoom). migratePrefs assure la compat ascendante.

**Fichiers** :
- frontend/src/lib/prefs/schema.ts
- frontend/src/store/prefs.ts
- frontend/src/lib/prefs/useUiPrefsSync.ts
- frontend/src/components/workspace/ResizablePanels.tsx
- frontend/src/store/ui.ts
- tests/prefsSchema.test.ts
- tests/prefsStore.test.ts

### Registre de raccourcis clavier unifié (Lot 9)

Source de vérité partagée pour le geste #1 valider+suivant, adoption LLM (1/2), navigation des divergences, saut prochaine non validée, prefill (Wand), fin du doublon B/T. Alimente à la fois les handlers (useShortcuts existant) et les tooltips kbd focusables + la modale d'aide '?' (fin des title= natifs invisibles au lecteur d'écran). Brique consommée par toolbar (hints), inspecteur, menu express et le mode rafale.

**Fichiers** :
- frontend/src/components/workspace/useShortcuts.ts
- frontend/src/lib/shortcuts.ts
- frontend/src/components/ui/Kbd.tsx
- tests/uiFixes.test.ts

