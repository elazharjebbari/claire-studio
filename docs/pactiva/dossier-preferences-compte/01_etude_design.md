# Préférences d'interface par compte + auto-pré-annotation — Étude de conception

> Objectif : que chaque compte retrouve **sa** configuration d'interface sans rien
> reconfigurer à chaque document, et puisse lancer la **pré-annotation automatiquement** à
> l'ouverture d'un document (sur un modèle choisi), avec une **demande de consentement** à la
> première fois et un **switch** ergonomique pour (ré)activer ensuite.

---

## 1. Audit de l'existant (vérifié dans le code)

| Élément | État actuel | Persisté ? | Problème |
|---|---|---|---|
| `useUiStore` (`claire.ui`, zustand persist) | theme, density, sidebarCollapsed, inspectorOpen, readingZoom/Wide, gutterModels, gutterShowCategory | **localStorage (par navigateur)** | pas « par compte » ; ne suit pas l'utilisateur d'un poste à l'autre |
| Store **atelier** (`workspace`) | `showUnfairness`(true), `ghostJudges`{}, `displayLang`(orig), `llmSource`(human), `prefilledJudge`(null) | **non persisté** ; `init()` **réinitialise par document** | ⇒ overlays/affichages **à reconfigurer à chaque doc** |
| Panneaux Historique / Commentaires / Triage | `useState` local (AnnotationWorkspace) | **jamais** | états perdus à chaque ouverture |
| Largeurs colonnes | `claire.workspace.layout` (localStorage) | par navigateur | OK (dépend de l'écran) |
| Pré-remplissage | `requestPrefill→setPrefill→replacePrefill` (claude/codex/mistral) | — | aucune auto-exécution ; aucun mémorisation du modèle |
| Backend | `User(AbstractUser)` **sans** champ préférences ; `MeView` GET/PATCH (profil) | — | pas de persistance serveur des prefs |
| Bug détecté | `WorkspaceToolbar` libellé `claude`/`codex` **en dur** (ignore Mistral) | — | à corriger via `llmJudgeLabel()` |

**Constat directeur** : la cause du « je reconfigure à chaque doc » est le **hard-reset dans
`init()`** + l'absence de persistance par compte des overlays/panneaux/auto-prefill.

---

## 2. Cinq aspects × 3 options (forces / faiblesses / pertinence) → recommandation

Étude complète menée en parallèle (workflow multi-agents). Synthèse par aspect ci-dessous ;
le détail intégral des 15 options est conservé dans l'annexe `02_annexe_options.md`.

### Aspect 1 — Stockage (persistance par compte)
- **A. localStorage namespacé par uid** — coût nul, zéro flash, mais **ne suit pas le compte** (multi-postes) ; risque de fuite inter-comptes sans purge.
- **B. Champ JSON serveur `/me`** — répond au « par compte / multi-appareils », source unique auditable, mais **flash + latence** (/me asynchrone) et chatter réseau.
- **C. Hybride (cache localStorage + sync serveur, write-through)** — cumule portabilité **et** zéro flash ; plus de code (réconciliation).
- **➜ Recommandé : C**, car le besoin exige *deux* choses en tension — suivre le compte (serveur) **et** s'appliquer sans flash dès l'ouverture (hydratation synchrone locale).

### Aspect 2 — Périmètre & schéma
- **A. Bloc UI unique versionné `uiPrefs` fusionné aux défauts** — un seul champ JSON, `mergeDeep(DEFAULTS, prefs)` rend tout champ absent/inconnu inoffensif ; ids de juge **libres** (pas d'enum) → robuste à l'évolution des modèles.
- **B. Deux étages (localStorage layout + petit bloc serveur)** — effort minimal mais **double source de vérité** et frontière poste/compte arbitraire.
- **C. Tables relationnelles normalisées (scope par projet)** — granularité par-campagne + analytics, mais **sur-ingénierie** vs le besoin global.
- **➜ Recommandé : A** — colle à l'infra existante (`MeView` PATCH partiel + camelCase auto), un seul champ JSON, robustesse par fusion aux défauts.

### Aspect 3 — UX auto-prefill (1ère demande + bascule)
- **A. Modale de consentement post-action + switch inline** — satisfait littéralement « demander à la 1ère exécution » ; réutilise le pattern de dialog existant ; switch là où on configure déjà le prefill.
- **B. Bandeau non bloquant + icône-switch** — zéro interruption, mais consentement esquivable et saut de layout.
- **C. Tout dans un panneau Préférences (sans 1ère demande)** — bon socle de persistance mais **supprime la demande contextuelle** demandée et découvrabilité faible.
- **➜ Recommandé : A** (socle de persistance serveur emprunté à C).

### Aspect 4 — Application & feedback de sync
- **A. localStorage-first, serveur en miroir réconcilié (updatedAt)** — zéro flash, hors-ligne OK, mais dernier-écrivain-gagne sur clés partagées.
- **B. Serveur source unique (React Query)** — pas de divergence mais **réintroduit le flash de thème**.
- **C. Hybride par COUCHES (shell=local, atelier+auto-prefill=serveur), `init()` refactoré** — chaque pref au bon endroit, **couches disjointes ⇒ aucune réconciliation**, flash circonscrit.
- **➜ Recommandé : C** — on ne touche pas l'hydratation synchrone du thème, et on ne migre côté serveur que les clés concernées par le besoin.

### Aspect 5 — Design / animation du switch & des contrôles
- **A. Switch iOS-like (`role="switch"`, track+thumb)** — affordance on/off universelle, réutilisable ; idiome absent de la toolbar (à harmoniser via tokens).
- **B. Pastille toggle homogène (`aria-pressed`, comme `toggle-inspector`)** — homogénéité maximale, coût minimal ; moins « switch ».
- **C. Hybride : Popover « Préférences » à base de `PrefSwitch` (A) + icône inline `Wand2` homogène (B)** — sépare l'affordance minuscule (toolbar) du foyer de réglages (popover) ; dégonfle une toolbar déjà dense.
- **➜ Recommandé : C** — couvre les deux volets (préférences persistées + affordance discrète), foyer naturel pour la persistance par compte.

---

## 3. Proposition finale (cohérente, argumentée)

**Architecture hybride par COUCHES, classée par NATURE de préférence** (et non par commodité) :

- **Couche SHELL / poste = localStorage** (inchangée) : `theme`, `density`, `readingZoom/Wide`,
  `gutterModels`, `gutterShowCategory`, largeurs de colonnes. *Dépend de l'écran ; hydratation
  synchrone ⇒ zéro flash (le pire cas — le thème — reste résolu gratuitement).* Libellé UI :
  **« ce navigateur »**.
- **Couche COMPTE / comportement = serveur** (`User.ui_preferences`, un seul JSON versionné,
  exposé camelCase par `/me`) : overlays atelier (`showUnfairness`, `displayLang`, `llmSource`),
  `ghostJudges`, **états de panneaux** (`inspectorOpen`, `sidebarCollapsed`, `historyOpen`,
  `commentsOpen`, `triageOpen`) et **auto-prefill** `{enabled, judge, asked}`. *Ce que
  l'utilisateur ne veut PAS reconfigurer par document.* Libellé UI : **« mon compte »**.
- **Couches disjointes** (aucune clé persistée aux deux endroits) ⇒ **aucune réconciliation /
  dernier-écrivain-gagne**. Cache localStorage namespacé `claire.prefs::<uid>` = hydratation
  instantanée (anti-flash) ; le serveur complète au login ; write-through + `PATCH /me` débounced.

**Cause racine traitée** : `init()` **cesse** de hard-réinitialiser `displayLang/llmSource/…` ;
il **lit ses défauts** depuis les prefs hydratées. L'auto-prefill devient un **effet post-init
gardé** (`draftClauses.length===0` ⇒ jamais d'écrasement).

**Flux auto-prefill** : 1ʳᵉ exécution manuelle réussie **et** `prefill.asked===false` →
**modale** « Auto-exécuter {Modèle} à chaque nouveau document vierge ? » [Activer]/[Non merci].
Dans les deux cas `asked=true` (ne se remontre jamais). Une **icône `Wand2`** reste toujours
visible dans la toolbar (OFF gris / ON accent) pour (ré)activer ; le réglage complet (switch +
sélecteur de modèle) vit dans le **Popover « Préférences d'affichage »** (`SlidersHorizontal`).
Source d'état **unique** (store de prefs) ⇒ icône et popover toujours synchronisés.

**Design** : primitive `PrefSwitch` (`role="switch"`, track+thumb, tokens accent/ink/line,
flash de confirmation borné, `motion-reduce` respecté, `focus-visible:ring-accent`) ; icône
inline `Wand2` calquée sur `toggle-inspector` ; popover sectionné (Overlays / Affichage /
Disposition / Auto-pré-annotation) avec badges de portée « mon compte » / « ce navigateur »,
indicateur « Enregistré » discret et bouton « Réinitialiser ».

**Bénéfices** : plus de reconfiguration par document ; préférences qui suivent le compte
(multi-postes) ; auto-prefill dès l'ouverture sans flash ni écrasement ; toolbar dégonflée ;
zéro hex (tokens), a11y soignée ; robuste à l'ajout/retrait de modèles (ids libres).

Le détail technique (modèle, endpoint, stores, plan de tests, plan d'action) est dans
`docs/pactiva/dossier-preferences-compte/03_dossier_technique.md`.
