# Système de couleurs — CLAIRE Studio

> La couleur sert trois fonctions : **lisibilité durable** (anti-fatigue, feature 6), **encodage
> sémantique** (thèmes de clause, injustice, certitude) et **conformité** (WCAG AA). Valeurs exactes :
> `design_tokens.json`. Toutes les palettes sémantiques (thèmes, injustice, certitude) sont **reprises
> à l'identique de `vocabulary.yaml`** — `vocabulary.yaml` fait foi, ce document explique les choix.

## Principes

1. **Anti-éblouissement** : en thème sombre, fond **gris très sombre (`#0F1115`), jamais noir pur** ;
   texte **gris clair (`#E6E8EC`), jamais blanc pur**. Le couple noir/blanc purs provoque halation et
   fatigue ; on vise un contraste **élevé mais doux**. Le panneau document a son propre fond légèrement
   distinct (`bg-document`) pour reposer l'œil sur la zone de lecture longue.
2. **La couleur n'est jamais seule** : tout encodage couleur est **doublé** d'un texte/code/icône
   (accessibility.md §3). La couleur accélère le scan, le texte porte le sens.
3. **Conformité AA** : texte normal ≥ 4.5:1, texte large / éléments d'UI ≥ 3:1, sur les **deux** thèmes.
4. **Daltonisme** : palettes distinguables en protanopie/deutéranopie grâce au redoublement texte + bordures.

## 1. Neutres & thèmes (tokens `theme.light` / `theme.dark`)

| Alias sémantique | Light | Dark | Rôle |
|---|---|---|---|
| `bg` | `#F8FAFC` | `#0F1115` | fond global |
| `bg-document` | `#FCFCFD` | `#13161B` | zone de lecture (off-white / sombre doux) |
| `surface` | `#F1F5F9` | `#1E232B` | cartes, panneaux élevés |
| `border` | `#E2E8F0` | `#2A313B` | séparateurs |
| `fg` | `#0F172A` | `#E6E8EC` | texte primaire |
| `fg-muted` | `#475569` | `#A4ACB8` | texte secondaire (≥ 4.5:1) |
| `accent-fg` | `#0369A1` | `#38BDF8` | liens / action |
| `focus-ring` | `#0284C7` | `#38BDF8` | anneau de focus (≥ 3:1) |

Bascule clair/sombre : un clic (top bar), persistée (`/settings` + `prefers-color-scheme`), **sans flash**
(thème appliqué avant le premier paint).

## 2. Couleurs de thèmes de clause (20 thèmes — `vocabulary.yaml`)

Reprises **exactement** de `vocabulary.yaml` (« couleurs pensées pour un thème sombre, contraste AA,
fatigue oculaire minimale »). Exemples : `PRIVACY_DATA #0EA5E9`, `LICENSE_IP #EAB308`,
`LIMITATION_LIABILITY #DC2626`, `MISC_BOILERPLATE #94A3B8`.

- **Rendu** : pastille colorée (`ClauseChip`) **+ code de thème en texte** (`● PRIVACY_DATA`). Jamais la
  couleur seule.
- **Bordure systématique** sur les pastilles pour rester visibles sur fond clair **et** sombre.
- **Surlignage de clause** dans le document : fond teinté **faible opacité** (≈ 12–18 %) + barre latérale
  de la couleur du thème → repérable sans « brûler » la rétine.
- La progression du spectre (gris → violet → bleu → vert → jaune → orange → rouge → rose → magenta) suit
  l'ordre des thèmes (`order`) et regroupe visuellement les familles (données, contenu, responsabilité…).

## 3. Surimpression injustice CLAUDETTE (feature 12 — `vocabulary.yaml`)

Catégories `A/CH/CR/J/LAW/LTD/TER/USE` avec couleurs reprises de `vocabulary.yaml`, et **niveaux 1/2/3**
encodés par l'**intensité/opacité** (`level_intensity` : 0.25 / 0.55 / 0.90).

- **Overlay togglable** (Plan / TOC, navigation.md §3) : calque de faible opacité + **chiffre de niveau**
  visible + info-bulle `catégorie + niveau` (ex. « LTD niv. 3 — clairement injuste »).
- N'**impose aucun choix** : c'est une aide au repérage des zones sensibles, en lecture seule.
- Couleur + chiffre + libellé → triple encodage (accessibilité).

## 4. Échelle de certitude (feature 10 — `vocabulary.yaml`)

| Valeur | Couleur | Emoji | Label (aria) | Raccourci |
|---|---|---|---|---|
| 0 | `#94A3B8` | 🤔 | Incertain | `0` |
| 1 | `#38BDF8` | 🙂 | Plutôt | `1` |
| 2 | `#34D399` | 😀 | Confiant | `2` |
| 3 | `#22C55E` | 💯 | Certain | `3` |

- `CertaintyPicker` : couleur + emoji **+ label textuel** (l'emoji est décoratif, le label porte le sens).
- Progression chromatique gris → bleu → vert : intuitive (incertain « froid/neutre » → certain « validé »).

## 5. Couleurs de statut & d'action (tokens `color.status`)

| Sens | Couleur | Usage |
|---|---|---|
| success | `#22C55E` | `approved`, certitude haute |
| warning | `#F59E0B` | `request_changes`, attention |
| danger | `#EF4444` | `rejected`, action destructive |
| info | `#0EA5E9` | `in_review`, informatif / accent |

Les **statuts d'annotation** (state machine) sont rendus **couleur + libellé + icône** (ex. `submitted ◑`).

## 6. Gestion des collisions de couleurs

Certaines couleurs se recoupent entre familles (ex. `ARBITRATION_DISPUTES #EC4899` thème et `A #EC4899`
injustice ; `LIMITATION_LIABILITY #DC2626` et `LTD #DC2626`). C'est **assumé et cohérent** : les codes
CLAUDETTE et les thèmes apparentés partagent la teinte volontairement. La désambiguïsation vient :
- du **contexte** (overlay injustice vs chip de thème, zones distinctes de l'UI),
- du **texte** systématiquement associé (code thème vs code+niveau d'injustice),
- de la **forme** (pastille de thème vs calque de surimpression).

## 7. Vérification AA (testable, F6)

- `a11y axe` : 0 violation de contraste sur les écrans clés (workspace, review, compare, admin), thèmes
  clair **et** sombre.
- Contrôle manuel des couples critiques : `fg/bg`, `fg-muted/bg`, `accent-fg/bg`, chips de thème sur
  `bg-document` (texte du code ≥ 4.5:1, pastille ≥ 3:1 via bordure).
- Simulation daltonisme (protanopie/deutéranopie) : aucune perte d'information (redoublement texte).
- `prefers-color-scheme` et bascule manuelle testés sans FOUC.
