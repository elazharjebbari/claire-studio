# Guide assisté de l'atelier d'annotation — audit, inventaire & plan d'action

> **But.** Le « guide assisté » (visite guidée qui explique l'interface) n'est plus à
> jour après les refontes de l'atelier (inspecteur, nature juridique, minimap, outils
> de sélection, gouttière catégories, comparaison N-way avec Mistral, undo/redo réels).
> Ce dossier : (1) audite l'existant, (2) inventorie tous les blocs à présenter,
> (3) propose le contenu et la manière, (4) cadre l'amélioration de l'outil.

## 1. Existant — deux systèmes

| Système | Fichiers | Rôle |
|---|---|---|
| **Visite guidée** (driver.js) | `src/lib/tour/workspaceTour.ts`, `src/components/workspace/WorkspaceTourButton.tsx` | Pop-overs séquentiels ancrés sur des `data-testid`/`aria-label`. Auto-démarrage 1ʳᵉ visite (`localStorage claire.tourSeen`), filtre les étapes dont la cible est absente du DOM. |
| **Centre d'aide** | `src/app/(app)/help/`, `src/components/help/HelpMarkdown.tsx`, manifeste markdown | Pages d'aide groupées (référence détaillée). Lié depuis le « ? » de la barre. |

Le présent chantier porte sur la **visite guidée** (le « guide assisté »). Le centre
d'aide est listé en §5 (recommandations) — à resynchroniser dans un second temps.

## 2. Audit — ce qui est périmé (25 étapes actuelles)

| # | Étape | Verdict |
|---|---|---|
| Contenu global | « **Claude et Codex** » partout | ❌ **Périmé** : il y a désormais **3 juges** (Claude, Codex, **Mistral**) — `LLM_JUDGES` dans `src/lib/llmJudges.ts`. Tout le vocabulaire binaire doit devenir **N-way** (« les juges LLM »). |
| Récap (étape 25) | « 1/2 adopter Claude/Codex … ⌘K palette » | ❌ **Faux** : les touches **0–3 = certitude** (pas l'adoption) ; pas de raccourci d'adoption clavier vérifié ; ⌘K non confirmé. Raccourcis réels : `j/k` `n/p` `b` `c` `e` `g` `t` `0–3` `⌘S` `⌘Z/⌘Y`. |
| Historique (étape 18) | « Socle de l'**annulation/rétablissement à venir** » | ❌ **Périmé** : `undo-btn`/`redo-btn` existent (aria « Annuler (⌘Z) » / « Rétablir (⌘Y) »). |
| Sélection multi-blocs (étape 11) | « clic-droit + glisser » sur `sentence-0` | ⚠️ **À rafraîchir** : il existe maintenant une barre d'**outils de sélection** dédiée (`selection-tools` / `selection-toolbar` : sélectionner segment, jusqu'à la frontière, tout, annoter/désannoter la sélection). À présenter comme un bloc. |
| Œil de frontière (étape 12) | `boundary-peek-*`, « Claude et Codex » | ✅ cible OK (`boundary-peek-*` existe) mais ⚠️ contenu binaire → N-way ; mentionner aussi le panneau `boundary-evidence`. |
| Cibles OK mais à enrichir | `theme-palette`, `certainty-picker`, `inspector`, `prefill-switch`, `toggle-unfairness`, `toggle-ghost-claude`, `divergence-nav`, `toggle-compare-panel` | ✅ présentes ; ghosts/compare/prefill à passer en **N-way**. |

**Blocs ABSENTS de la visite** (ajoutés par les refontes, jamais présentés) :
`document-minimap` / `minimap-viewport` (minimap & position) · `legal-nature` / `nature-badge`
(nature juridique consultable) · `selection-tools` (outils de sélection) ·
`reading-controls` (confort de lecture : `reading-zoom-in/out`, `reading-wide`) ·
`gutter-toggle-category` + `model-gutter-legend` (gouttière catégories continue) ·
`validation-meter` / `inspector-validate` (validation des clauses) ·
`boundary-evidence` (œil de frontière N-way) · `collab-bar` / `collab-invite` / `collab-status`
(présence & invitation) · `toggle-attribution` (attribution) · `undo-btn`/`redo-btn`.

## 3. Inventaire des blocs à présenter (cible de la visite)

Regroupés en **6 sections** (ordre pédagogique). ⭐ = nouveau dans la visite.

**A. Vue d'ensemble** — `annotation-workspace` (atelier 3 panneaux) · `[aria-label="Plan du document"]` (plan/clauses/progression) · ⭐ minimap & position (`document-minimap`).

**B. Lire** — `[aria-label="Document"]` (document, B = frontière) · `sentence-0` (phrase indexée, j/k) · ⭐ `reading-controls` (zoom A−/A+, pleine largeur) · `lang-switch` (VO / Bilingue / FR).

**C. Annoter** — `boundary-toggle` (frontières) · ⭐ `selection-tools` (sélection multi-blocs) · `theme-palette` (thème, T) · ⭐ `legal-nature` (nature juridique) · `certainty-picker` (certitude 0–3) · `inspector` (détail de la clause) · ⭐ validation (`inspector-validate` / `validation-meter`).

**D. Comparer aux juges LLM (N-way)** — `llm-version-select` (version v9.x) · `llm-source-switch` (humain / un juge / comparaison) · `prefill-switch` (pré-remplir depuis un juge) · œil de frontière (`boundary-peek-*` / ⭐ `boundary-evidence`, touche e) · `inspector-source-compare` (comparer la source par clause) · `toggle-compare-panel` (panneau côte à côte, g) · `divergence-nav` (n/p).

**E. Overlays** — `toggle-unfairness` (injustice CLAUDETTE) · `toggle-ghost-claude` (fantômes par juge) · ⭐ `gutter-toggle-category` (gouttière catégories).

**F. Collaborer & versionner** — `comment-thread` / `toggle-comments` (commentaires, C) · ⭐ `toggle-history` + undo/redo (historique, ⌘Z/⌘Y) · `document-switcher` (changer de document) · `snapshot-btn` (snapshot, ⌘S) · `submit-btn` (soumettre) · récap (raccourcis exacts + lien centre d'aide).

## 4. Comment présenter (contenu + manière)

- **Vocabulaire N-way** : remplacer « Claude et Codex » par « les juges LLM (Claude, Codex, Mistral…) ». Couleurs d'accord conservées (vert = accord, ambre = divergence).
- **Sections** : préfixer chaque pop-over par sa section (`Annoter · Attribuer un thème`) pour donner le fil. Champ `section` ajouté à `TourStep`.
- **Robustesse** : conserver le **filtrage des cibles absentes** (l'inspecteur, les commentaires, l'œil de frontière n'apparaissent qu'avec une clause/frontière sélectionnée). Cibler de préférence des **contrôles toujours présents** (toggles de barre) pour les étapes clés.
- **Re-présentation après mise à jour** : **versionner** la clé `localStorage` (`claire.tourSeen` → `claire.tourSeen.v2`) pour que les utilisateurs existants revoient la visite **une fois** après cette refonte.
- **Confort** : `smoothScroll`, léger `stagePadding`, progression `{{current}} / {{total}}` (déjà), boutons FR (déjà).
- **Récap exact** : `j/k` phrase · `n/p` divergence · `b` frontière · `t` thème · `c` commentaire · `e` aperçu frontière · `g` panneau comparatif · `0–3` certitude · `⌘S` snapshot · `⌘Z/⌘Y` annuler/rétablir · « ? » centre d'aide.

## 5. Amélioration de l'outil (implémentée)

1. **Refonte du contenu** des étapes (N-way, undo/redo réels, récap correct).
2. **+10 blocs** ajoutés (minimap, confort de lecture, outils de sélection, nature juridique, validation, œil de frontière N-way, gouttière catégories, undo/redo, collaboration au besoin).
3. **Champ `section`** + titres préfixés ⇒ visite structurée en 6 temps.
4. **Versionnage** de la clé « déjà vue » ⇒ re-présentation unique après refonte.
5. **Tests** mis à jour (`tests/workspaceTour.test.ts`) : cibles clés + N-way + section non vide.

## 6. Recommandations (suite, hors périmètre immédiat)
- **Resynchroniser le centre d'aide** (pages markdown) sur le N-way + les blocs récents (mêmes constats que la visite).
- Optionnel : lien « En savoir plus » par étape vers la section d'aide correspondante.
- Optionnel : amorcer un état de démo (sélection d'une clause) avant les étapes inspecteur/commentaires pour qu'elles s'affichent toujours.
