# Préférences par compte + auto-pré-annotation — Dossier technique

Architecture retenue : **hybride par couches** (shell=localStorage / compte=serveur),
contrat de prefs **figé dès J0** (versionné `v:1`), couches **disjointes** (aucune
réconciliation). Réf. design : `01_etude_design.md`.

---

## 1. Modèle de données

**Backend** — `User.ui_preferences = JSONField(default=dict, blank=True)` (snake_case en base ;
exposé/reçu **camelCase** `uiPreferences` via `djangorestframework-camel-case`). Migration
triviale (`default=dict`, pas de data-migration : absence ⇒ défauts front).

**Schéma `uiPrefs` (camelCase, un seul objet, versionné)** — `lib/prefs/schema.ts` :
```ts
v: 1
overlays:  { showUnfairness, displayLang("orig"|"both"|"fr"), llmSource(string libre) }
ghostJudges: Record<string, boolean>            // ids de juge LIBRES
panels:    { inspectorOpen, sidebarCollapsed, historyOpen, commentsOpen, triageOpen }
prefill:   { enabled, judge(string|null), asked }
```
Défauts = **comportement actuel** (showUnfairness:true, displayLang:"orig", llmSource:"human",
inspectorOpen:true, prefill off). Lecture = `mergeUiPrefs(DEFAULTS, serverPrefs)` ⇒ tout champ
absent/inconnu retombe sur le défaut. `prefill.judge`/`llmSource`/clés `ghostJudges` = **ids
libres** (jamais d'enum) ⇒ ajout/retrait de modèle n'invalide jamais une pref ni ne requiert de
migration. `migratePrefs(raw)` applique les transformations par version croissante avant fusion.

**Restent en localStorage** (couche shell, inchangés) : theme, density, readingZoom/Wide,
gutter*, largeurs colonnes.

---

## 2. API

Réutilise `MeView` (JWT, throttling, contrat existants), **aucune nouvelle route** :
- `GET /api/v1/me` → renvoie `uiPreferences` (lecture).
- `PATCH /api/v1/me` → accepte `uiPreferences` (**merge profond partiel** sur l'existant) en plus
  des champs profil. Validé par `UiPreferencesSerializer` à **whitelist stricte** (rejette tout
  champ inconnu — pas de JSON arbitraire), bornage `displayLang ∈ {orig,both,fr}`, `v` forcé
  serveur. `llmSource`/`prefill.judge`/clés `ghostJudges` = chaînes libres.

---

## 3. Frontend (Next.js + Zustand + React Query)

- `lib/prefs/schema.ts` — `UI_PREFS_DEFAULTS`, `UI_PREFS_SCHEMA_VERSION`, `mergeUiPrefs`, `migratePrefs` (purs, testés).
- `store/prefs.ts` — store zustand **persist namespacé `claire.prefs::<uid>`** (anti-fuite inter-comptes + purge au logout). Détient `UiPrefsV1` + setters (`setOverlays`, `setPanel`, `setGhostJudge`, `setPrefill`, `reset`, `hydrate`, `bindUser(uid)`). Chaque setter = write-through localStorage immédiat (rendu synchrone) + marque « dirty » pour la sync.
- `lib/prefs/useUiPrefsSync.ts` — monté une fois (provider authentifié) : (1) `bindUser(me.id)` + hydrate depuis `me.uiPreferences` (`migratePrefs`→`mergeUiPrefs`) ; (2) sur changement « dirty » du store, `PATCH /me {uiPreferences}` **débounced ~800 ms** (optimistic) ; (3) statut `saving|saved|idle` pour l'indicateur du popover.
- Composants : `components/ui/PrefSwitch.tsx` (role=switch), `components/workspace/AutoPrefillConsentDialog.tsx`, `components/workspace/PreferencesPopover.tsx`.

**Branchements atelier** :
- `store/workspace.ts` `init()` : **supprime** les hard-reset `displayLang/llmSource/prefilledJudge`
  → reçoit des **défauts d'overlays** (argument `overlays`) et les applique. Conserve le reset des
  données volatiles (clauses, undo/redo, sélections).
- `AnnotationWorkspace` : (a) passe à `init()` les overlays issus du store prefs ; (b) **effet
  auto-prefill** post-init, **hors** des dépendances d'`init`, gardé
  `enabled && judge && draftClauses.length===0 && availableJudges.has(judge) && !readOnly && !locked`
  (drapeau anti-ré-exécution par `annotationId`) ; (c) panneaux `historyOpen/commentsOpen/triageOpen`
  promus du `useState` local au store prefs ; (d) effet de **pont** : persiste vers prefs les
  changements d'overlays effectués dans l'atelier.
- `WorkspaceToolbar` : icône inline `Wand2` (toggle `prefill.enabled`) + déclencheur popover
  `SlidersHorizontal` ; **modale de consentement** à la 1ʳᵉ exécution (`asked===false`) ; libellés
  de modèle via **`llmJudgeLabel()`** (corrige le bug claude/codex en dur).

---

## 4. Plan de tests (MSW / vitest / playwright / pytest)

- **vitest (purs)** : `mergeUiPrefs`/`migratePrefs` (champ absent→défaut, inconnu ignoré, v0→v1) ;
  store prefs **namespacé par uid** (isolation inter-comptes) ; garde auto-prefill (toutes
  combinaisons enabled/judge/draftClauses/availableJudges/readOnly) ; `init()` lit les prefs ;
  `PrefSwitch` (role=switch, aria-checked, clavier) ; `llmJudgeLabel` Mistral.
- **MSW** : `GET/PATCH /api/v1/me` (uiPreferences) — hydratation au login ; `PATCH` débouncé
  envoyé **une** fois après rafale ; offline (PATCH échoue) → cache local autoritaire.
- **playwright** : 1ʳᵉ exécution → modale ; [Activer] → doc vierge suivant déclenche l'auto-prefill ;
  [Non merci] → icône reste, clic l'active ; popover (focus-trap/Esc/click-outside) ;
  « Réinitialiser » → défauts ; persistance cross-reload ; auto-prefill **jamais** sur doc non vierge.
- **pytest** : `UiPreferencesSerializer` accepte whitelist valide / **rejette** champ inconnu +
  `displayLang` invalide ; PATCH partiel **merge** sans écraser les clés non envoyées ; `GET /me`
  renvoie `uiPreferences` camelCase ; profil (display_name/locale) inchangé.

---

## 5. Plan d'action / exécution (phasé, contrat figé dès J0)

| Lot | Contenu | Vérif |
|---|---|---|
| **T1 — schéma pur** | `lib/prefs/schema.ts` (defaults/merge/migrate) | vitest purs |
| **T2 — backend** | `User.ui_preferences` + migration + `UiPreferencesSerializer` + `MeView` + `UserSerializer` | pytest |
| **T3 — store + sync** | `store/prefs.ts` (persist namespacé) + `useUiPrefsSync` (hydrate + PATCH débouncé) | vitest + MSW |
| **T4 — UI** | `PrefSwitch`, `PreferencesPopover`, `AutoPrefillConsentDialog` | vitest composants |
| **T5 — branchements atelier** | `init()` lit prefs, effet auto-prefill gardé, panneaux→prefs, `WorkspaceToolbar` (Wand2 + modale + popover + `llmJudgeLabel`) | vitest + e2e |
| **T6 — gate & deploy** | tsc + vitest + pytest + e2e ciblés, commit, deploy (health 200) | prod=local |

## 5bis. Statut de livraison (implémenté)
- Backend : `User.ui_preferences` (JSONField) + migration `0003` ; `merge_ui_preferences`
  (whitelist, bornage, merge partiel) ; `MeView.patch` ; `JSON_UNDERSCOREIZE.ignore_fields`
  pour garder le blob camelCase verbatim. pytest **311** verts.
- Frontend : `lib/prefs/schema.ts`, `store/prefs.ts` (cache namespacé `claire.prefs::<uid>`),
  `lib/prefs/useUiPrefsSync` (hydrate + PATCH débouncé, garde anti-ré-entrance sur `rev`),
  `PrefSwitch`, `AutoPrefillConsentDialog`, `PreferencesPopover`. `init()` sème les overlays
  depuis les prefs ; effet auto-prefill gardé (doc vierge) ; panneaux + inspecteur + sidebar
  migrés en couche compte ; `WorkspaceToolbar` (icône `Wand2`, modale de consentement, popover,
  libellés `llmJudgeLabel`). vitest **410** verts ; e2e (prefill, collab-versioning, popover) verts.
  A11y : `ProvenanceMark` passe en `role="img"`.
- **Choix de portée assumés** : `llmSource` n'est PAS ponté (mode de consultation transitoire —
  vue-juge), seulement semé (« human » par défaut). La couche shell (thème/zoom/largeurs/gutter)
  reste localStorage (« ce navigateur »).
- **Dette connue hors périmètre** (pré-existante, non régressée) : a11y de la réglette
  `model-gutter-row` (role="row" avec boutons), help-link TopBar e2e — à traiter séparément.

## 6. Risques & parades (extrait)
- **Boucle de sync** → la garde anti-ré-entrance du hook observe les CHANGEMENTS de `rev`
  (mise à jour immédiate du rev planifié) ; `setSyncStatus` ne reboucle pas.
- **Flash (FOUC)** → hydratation synchrone du cache local namespacé avant paint ; thème reste local.
- **Régression `init()` / perte de clauses** → effet auto-prefill **séparé** d'`init` et hors de ses
  dépendances ; garde `draftClauses.length===0` ; drapeau par `annotationId`.
- **Fuite inter-comptes (poste partagé)** → clé `claire.prefs::<uid>` + purge au logout.
- **Écrasement par auto-prefill** → doc **vierge** uniquement + `!readOnly` + non verrouillé + modèle dispo.
- **JSON arbitraire** → serializer whitelist stricte + bornage enums + `v` forcé serveur + merge partiel.
- **Évolution des juges** → ids **libres** ; `mergeUiPrefs` neutralise les valeurs obsolètes (auto-prefill sauté faute de `availableJudges`).
- **Désync icône/popover** → **source d'état unique** (store prefs).
- **Bug label Mistral** → tout libellé via `llmJudgeLabel()`.
