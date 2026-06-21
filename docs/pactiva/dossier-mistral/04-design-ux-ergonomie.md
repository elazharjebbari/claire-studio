# 04 — Design, UX & ergonomie

> Règles visuelles et d'interaction pour intégrer Mistral sans dégrader la lisibilité
> ni l'accessibilité. S'appuie sur les tokens existants de la Feature A
> (`docs/pactiva/dossier-annotation-avancee/02-feature-A-…/A-design-tokens.json`).
> Principe central : **l'information d'un juge n'est jamais portée par la couleur
> seule** — toujours une **lettre** (C/Cx/M) + un **libellé**.

## 1. Couleurs d'identité par modèle

Les couleurs d'**identité de juge** sont **distinctes** des couleurs de **catégorie/
thème** (qui viennent de `getThemeToken(code).color`). Elles servent uniquement
d'en-tête de piste et de liseré de frontière. La palette est déjà définie dans
`A-design-tokens.json` (`gutter.track.identity[]`) et **réutilisée** :

| Juge | `id` | Initiale | `identityColor` | Teinte | Rôle |
|------|------|----------|-----------------|--------|------|
| Claude | `claude` | **C** | `#94A3B8` | slate (gris-bleu) | en-tête piste 1 / liseré |
| Codex | `codex` | **Cx** | `#A78BFA` | violet | en-tête piste 2 / liseré |
| **Mistral** | `mistral` | **M** | `#5EEAD4` | teal (cyan-vert) | en-tête piste 3 / liseré |
| (réserve) | — | — | `#FCD34D`, `#F9A8D4` | ambre, rose | 4ᵉ/5ᵉ juge éventuels |

> Ces valeurs migrent **dans** `lib/llmJudges.ts` (elles sont aujourd'hui en dur dans
> `DocumentPanel.tsx:196-197`). Au-delà de 5 juges : repli sur **l'initiale seule**.

### 1.1 Sûreté daltonisme (critère bloquant)

La persona **Zahra** est daltonienne (deutéranomalie légère). Le trio choisi est
**discriminable** car :
- **Slate** (`#94A3B8`) et **teal** (`#5EEAD4`) diffèrent fortement en **luminance** et
  en **teinte** (gris neutre vs cyan-vert) ; le teal reste perçu même en deutéranopie.
- **Violet** (`#A78BFA`) se distingue du teal (axe bleu/cyan) et du slate (saturation).
- Le risque classique **rouge/vert** est **évité** (aucune des trois n'est rouge ni vert
  pur).
- **Garde-fou absolu** : même si deux teintes se rapprochaient pour un profil donné, la
  **lettre** (C/Cx/M) et le **libellé** au survol lèvent toute ambiguïté (redondance
  forme + texte, conforme WCAG 1.4.1 « use of color »).

### 1.2 Contraste

- En-tête de piste : lettre en `surface-text-muted` (token existant), AA garanti sur le
  fond de panneau.
- Abréviation de thème dans une cellule teintée : couleur calculée par
  `readableTextColor(themeColor)` (contraste AA dynamique) — inchangé Feature A.
- Le liseré d'identité (`identityColor`) est **décoratif** ; aucune info critique n'y
  repose seule.

## 2. Libellés & nomenclature

| Contexte | Claude | Codex | Mistral |
|----------|--------|-------|---------|
| Libellé complet | Claude | Codex | **Mistral** |
| Initiale réglette | C | Cx | **M** |
| Option prefill | « Claude » | « Codex » | « **Mistral** » |
| Option source | « Claude » | « Codex » | « **Mistral** » |
| Tooltip ligne 1 | Claude | Codex | **Mistral** |
| `aria-label` | Claude | Codex | **Mistral** |

> Tous générés par `judgeLabel(id)` / `judgeInitial(id)`. Aucune chaîne « Mistral »
> codée en dur hors `lib/llmJudges.ts`.

## 3. Réglette à 3 pistes — légende & disposition

### 3.1 Wireframe (3 pistes)

```
 lecture (phrases)                         réglette (sticky, droite)
 ┌───────────────────────────────┐        ┌──┬──┬──┐
 │ 12. Le présent contrat …      │        │C │Cx│M │   ← en-têtes (identityColor + lettre)
 │ 13. … peut être modifié …     │        │◷ │  │░ │   ← ◷ frontière ; ░ = piste M grisée
 │ 14. …                         │        │  │▒ │░ │     (Mistral absent pour CE doc)
 │ 15. En cas de résiliation …   │        │◷ │◷ │░ │   ← accord C/Cx en 15 (liseré vert opt.)
 └───────────────────────────────┘        └──┴──┴──┘

 Légende :  [x] Frontières   [ ] Catégories
            [x] C Claude   [x] Cx Codex   [~] M Mistral (aucune donnée)
                                            └─ case aria-disabled si la piste est vide
```

### 3.2 Légende — règles

- Une case **par juge** (générée depuis `JUDGES`), avec **pastille `identityColor` +
  lettre + libellé**.
- Si un juge **n'a pas de données** pour le document : case **`aria-disabled`**,
  libellé suffixé « (aucune donnée) », pastille grisée — **mais la piste reste
  affichée grisée** (on ne la retire pas : *absence ≠ masquage*).
- Toggle « Catégories » global (inchangé) : teinte les cellules par thème + abréviation.
- État persistant par poste (`localStorage`, clé existante `claire.ui` /
  `gutterModels`).

### 3.3 État « piste grisée » (Mistral absent — 28/50 docs)

| Élément | Rendu |
|---------|-------|
| En-tête « M » | grisé + **barré** |
| Cellules | `disabledOpacity` (≈ 0.35), pas de marqueur ◷ |
| Case légende | `aria-disabled`, non cliquable |
| Tooltip survol en-tête | « Mistral — aucune donnée pour ce document » |

> Objectif ergonomique : l'annotateur **comprend immédiatement** que Mistral n'a pas
> traité ce doc (≠ bug, ≠ « rien à signaler »).

### 3.4 Charge visuelle (3 pistes)

- Largeur de piste inchangée (`gutter.track.width = 24px`) ; 3 pistes tiennent dans la
  gouttière sticky sans empiéter sur `max-w-reading`.
- Densité « compacte » (store `ui.density`) déjà disponible si besoin.
- Au-delà de 5 pistes : `track.widthDense` puis orientation vers `compare` (hors lot).

## 4. Ergonomie du prefill (Mistral dans la liste)

### 4.1 Ordre et libellés

`PREFILL_OPTIONS` = `[ Aucun, Claude, Codex, Mistral ]` (Mistral en **dernier**, ordre
de la SoT). Même traitement visuel que Claude/Codex (pas de mise en avant ni de
dépréciation de Mistral).

### 4.2 Disponibilité contextuelle

- Si Mistral **n'a pas** de données pour le document : l'option « Mistral » peut être
  **présentée mais désactivée** (`aria-disabled`, tooltip « aucune donnée Mistral pour
  ce document ») — cohérent avec la piste grisée. (Comportement aligné sur la légende ;
  à confirmer en revue : désactiver vs masquer — **désactiver** recommandé pour la
  prévisibilité de l'UI.)
- Sélection « Mistral » → dialogue de confirmation : « Pré-remplir depuis **Mistral** ?
  Vos clauses actuelles seront remplacées. » (libellé via `judgeLabel`).

### 4.3 Fantôme Mistral

- Toggle dédié (légende sommaire / `TocPanel`) : « Fantôme LLM · Mistral ».
- Rendu en **filigrane** (opacité réduite), couleur d'identité Mistral pour le liseré ;
  **n'écrit rien** tant qu'on n'adopte pas.
- Multi-fantômes possibles (`ghostJudges: string[]`) : Claude **et** Mistral en même
  temps, distingués par lettre + teinte.

### 4.4 Menu par phrase

- Un **bloc juge par modèle** présent pour la phrase : Claude / Codex / Mistral, chacun
  avec puce d'identité, rationale, evidence, et bouton **« Adopter »**.
- Ordre = SoT. Résolution → voyant « ✓ **Mistral** » (libellé via `judgeLabel`).

## 5. Accessibilité (a11y) — checklist

| Critère | Règle | Réf WCAG |
|---------|-------|----------|
| Couleur non porteuse seule | lettre (C/Cx/M) + libellé partout | 1.4.1 |
| Contraste texte | AA (en-têtes muted ; abbr via `readableTextColor`) | 1.4.3 |
| Cible tactile | ≥ 24 px (`track.minHitTarget`) | 2.5.5 |
| Focus clavier | cellules/cases focusables ; tooltip ouvrable au **focus** (pas que hover) | 2.1.1 / 1.4.13 |
| État désactivé | `aria-disabled` sur piste/case/option vides | 4.1.2 |
| Mouvement | `prefers-reduced-motion` respecté (pas d'anim d'apparition tooltip) | 2.3.3 |
| Nom accessible | `aria-label` = libellé complet du juge | 4.1.2 |
| Raccourcis adopt | touches 1..N documentées (visite guidée) ; pas de piège clavier | 2.1.2 |

## 6. Cohérence avec l'identité Pactiva (Phase 5)

- **Zéro hex en dur** dans les composants : les couleurs d'identité juge vivent dans
  `lib/llmJudges.ts` (et non plus inline dans `DocumentPanel.tsx`), les neutres/géométrie
  dans `A-design-tokens.json`. Cela poursuit la « chasse aux couleurs en dur » (Phase 5).
- Les teintes de **catégorie** restent issues du schéma fermé (`getThemeToken`) — non
  mélangées avec l'identité juge.

## 7. Micro-décisions UX à valider en revue

1. Option prefill Mistral pour un doc sans données : **désactivée** (recommandé) vs
   masquée. → recommandation : **désactivée** (UI stable, prévisible).
2. Ordre des juges : **SoT** (Claude, Codex, Mistral). → garder l'ordre historique +
   Mistral en fin.
3. Liseré « accord » vert quand ≥ 2 juges coupent à la même phrase : reste **optionnel**
   et **redondant** avec l'alignement (jamais seul porteur d'info).
