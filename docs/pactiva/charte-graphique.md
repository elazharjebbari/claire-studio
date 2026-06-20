# Charte graphique — Pactiva

> Plateforme européenne d'intelligence contractuelle.
> Document de référence pour toute production visuelle (produit, site, social, print).

---

## 1. Essence de marque

**Ce que Pactiva est.** Une intelligence contractuelle souveraine, pensée pour les ETI
européennes — pas seulement pour les grands groupes et cabinets d'élite. Multilingue
nativement, capable de croiser plusieurs documents, déployable sur l'infrastructure du
client (zéro donnée qui sort).

**Ce que la marque doit inspirer**

| Valeur | Traduction visuelle |
|---|---|
| **Rigueur institutionnelle** | Géométrie nette, alignements stricts, zéro décoration superflue. |
| **Souveraineté & confiance** | Navy profond, sobriété, aucune fioriture « tech hype ». |
| **Intelligence / convergence** | Le symbole : deux trajectoires qui convergent en un point de décision. |
| **Accessibilité (ETI)** | Lisibilité avant tout, langage clair, pas de jargon gratuit. |
| **Précision juridique** | Un seul accent (l'or), placé au point exact qui compte. |

**Références esthétiques.** Minimalisme corporate européen — Wolff Olins, Pentagram,
Landor. Précision institutionnelle, intention maximale, décoration nulle.

**À proscrire.** Glassmorphism, néomorphisme, 3D, dégradés décoratifs, ombres portées
lourdes, glow, textures, emojis dans l'UI produit, couleurs vives hors palette.

---

## 2. Logo

### 2.1 Construction
La marque combine un **symbole de convergence** et le **wordmark** « Pactiva ».

- **Symbole** — deux traits diagonaux (navy) convergeant à droite vers un **rhombus doré**
  posé au point de convergence. Il se lit comme une **convergence** (deux sources qui se
  rejoignent) *et* comme un **vecteur** orienté vers l'avant (intention, décision).
  Le rhombus doré est le centre de gravité : il doit être géométriquement parfait et
  toujours lisible, même à petite taille.
- **Wordmark** — « Pactiva » en **Outfit Light (300)**, navy, interlettrage aéré (+tracking),
  optiquement centré sur le symbole. Le wordmark est secondaire au symbole.

### 2.2 Fichiers fournis (`frontend/public/brand/` & `frontend/src/app/`)
| Fichier | Usage |
|---|---|
| `pactiva-symbol.svg` | Symbole seul, traits navy — fonds clairs (favicon print, avatar). |
| `pactiva-symbol-light.svg` | Symbole seul, traits clairs — fonds sombres. |
| `pactiva-logo.svg` | Lockup horizontal complet (symbole + wordmark). |
| `app/icon.svg` | Favicon adaptatif (navy en clair, clair en sombre via `prefers-color-scheme`). |
| `components/brand/Logo.tsx` | Composant React (symbole inline `currentColor` + wordmark Outfit), source unique côté app. |

### 2.3 Règles d'usage
- **Zone de protection** : marge ≥ hauteur du symbole sur les quatre côtés.
- **Taille minimale** : symbole seul ≥ 16 px ; lockup complet ≥ 96 px de large.
- **Couleurs autorisées** : navy + or sur blanc/clair ; traits clairs + or sur fond sombre.
  Monochrome navy ou blanc toléré quand l'or est impossible (gravure, fax).
- **Interdits** : déformer les proportions, changer l'angle de convergence, recolorer le
  rhombus, ajouter ombre/contour/dégradé, enfermer la marque dans un badge, ajouter un
  tagline collé, poser le logo sur un fond peu contrasté.

---

## 3. Couleurs

### 3.1 Couleurs de marque (immuables)
| Rôle | Hex | Usage |
|---|---|---|
| **Navy Pactiva** | `#0C447C` | Couleur primaire : traits du logo, wordmark, titres, éléments structurants, accent du thème clair. |
| **Or Pactiva** | `#BA7517` | Accent unique et rare : rhombus du logo, soulignement d'un élément clé. **Jamais** en aplat large. |
| **Blanc** | `#FFFFFF` | Fond institutionnel de référence. |

### 3.2 Échelle navy (dérivée, pour surfaces & états)
`50 #EAF1F8` · `100 #D4E2F0` · `200 #A9C2DE` · `300 #6E93BE` · `400 #3C6B9C` ·
`500 #0C447C` *(marque)* · `600 #0A3A6A` · `700 #082F56` · `800 #062443` · `900 #04182E`

### 3.3 Échelle or (dérivée, accent uniquement)
`300 #E0A85A` · `400 #CE8E34` · `500 #BA7517` *(marque)* · `600 #99600F` · `700 #784B0B`

### 3.4 Neutres
`0 #FFFFFF` · `50 #F7F9FC` · `100 #EEF2F8` · `200 #D8E0EC` · `300 #B7C2D4` ·
`400 #8A97AB` · `500 #5A6678` · `600 #3D4859` · `700 #28303D` · `800 #1A2230` ·
`900 #0E141C` · `950 #0B0F14`

### 3.5 Couleurs sémantiques (états)
| État | Clair | Sombre |
|---|---|---|
| Succès | `#1E7A4D` | `#34C77B` |
| Attention | `#9A6700` | `#E0A100` |
| Erreur/risque | `#B4232A` | `#F2585F` |
| Information | `#0C447C` | `#5B9DFF` |

> **Contraste** : tout texte respecte **WCAG AA** (≥ 4.5:1 corps, ≥ 3:1 grands titres).
> L'or `#BA7517` n'est jamais utilisé comme texte fin sur blanc (réservé aux aplats/accents).

### 3.6 Mapping surfaces → thèmes (tokens)
| Token surface | Clair (institutionnel) | Sombre (atelier anti-fatigue) |
|---|---|---|
| `bg` | `#F7F9FC` | `#0B0F14` |
| `bgElevated` / `panel` | `#FFFFFF` | `#111722` / `#141B26` |
| `panelMuted` | `#EEF2F8` | `#1A2230` |
| `border` | `#D8E0EC` | `#26303F` |
| `text` | `#0E2238` *(navy encré)* | `#E6EAF0` |
| `textMuted` | `#5A6678` | `#9AA6B6` |
| `accent` | `#0C447C` *(navy)* | `#3E7BD0` *(navy éclairci, AA sur sombre)* |
| `onAccent` | `#FFFFFF` | `#0B0F14` |

Le **clair** porte l'identité institutionnelle (pages publiques). Le **sombre** conserve
le confort de lecture longue de l'atelier (exigence F6), **mais habillé de la palette
Pactiva** — la charte est donc respectée dans les deux thèmes.

---

## 4. Typographie

| Rôle | Police | Poids | Usage |
|---|---|---|---|
| **Display / titres / wordmark** | **Outfit** | 300 / 500 / 600 | Hero, titres de section, logo. Géométrique humaniste, institutionnelle. |
| **UI / corps** | **Inter** | 400 / 500 / 600 | Texte d'interface, libellés, paragraphes courants. Excellente lisibilité à petite taille. |
| **Lecture document** | Serif (Iowan/Georgia) | 400 | Texte contractuel long, colonne ~70ch, interligne 1.7 (anti-fatigue). |
| **Monospace** | ui-monospace | 400 | Identifiants techniques, raccourcis, code. |

**Échelle typographique** (rem) : `xs .75 · sm .875 · base 1 · lg 1.125 · xl 1.25 ·
2xl 1.5 · 3xl 1.875 · 4xl 2.5 · 5xl 3.25`. Titres en Outfit, interlettrage légèrement
négatif sur les grands titres ; le wordmark seul garde un tracking positif.

---

## 5. Iconographie
- Jeu unique : **lucide** (trait fin, 1.5–2 px, cohérent). Taille UI 15–18 px.
- Pas de pictos pleins ni multicolores. Couleur = `currentColor` (hérite du texte).
- L'or n'est jamais utilisé pour des icônes courantes (réservé marque/accent).

---

## 6. Mise en page & système spatial
- **Grille** : largeur de contenu max 1200 px (marketing) ; colonne de lecture 70ch (atelier).
- **Espacements** : échelle 4 px (`4 8 12 16 24 32 48 64 96`).
- **Rayons** : `sm 4 · md 6 · lg 10 · xl 16 · full`. Défaut UI : 6–8 px (ni dur, ni « bubble »).
- **Élévation** : minimaliste. Préférer **bordures `1px`** + fonds `panel` aux ombres.
  Ombre douce unique tolérée pour les surfaces flottantes (menus, modales) :
  `0 8px 24px rgb(12 68 124 / .12)`.
- **Mouvement** : sobre et rapide (120–180 ms, `ease-out`). Aucune animation décorative.

---

## 7. Ton & voix
Issu du positionnement (post fondateur). La marque parle aux **juristes et directions
achats**, pas aux ingénieurs.

- **Direct et concret** : on nomme le problème réel (« le risque vit dans la tension entre
  plusieurs documents »), pas des généralités.
- **Confiant, sans superlatifs creux** : démontrer, pas survendre.
- **Pédagogue** : expliquer, sourcer, rendre actionnable — « sans prérequis technique ».
- **Européen et souverain** : multilingue, auditable, données chez le client.
- **Inclusif des ETI** : accessible, pas réservé à l'élite.
- **Lexique** : « intelligence contractuelle », « croisement multi-documents »,
  « multilingue natif », « souveraineté des données », « auditable », « actionnable ».
- **À éviter** : hype IA, jargon technique inutile, anglicismes gratuits, ton condescendant.

---

## 8. Applications
- **Web — header** : lockup à gauche, navigation à droite ; fond clair institutionnel.
- **Web — footer** : symbole + « Pactiva », mentions, « en collaboration avec des docteurs
  en droit ». Jamais de mention d'un partenaire nominatif retiré.
- **Favicon / onglet** : symbole seul, adaptatif clair/sombre.
- **Avatar social / OG** : symbole seul centré sur navy `#0C447C` ou blanc.
- **E-mail transactionnel** : lockup navy sur blanc, en-tête sobre.

---

## 9. Accessibilité (non négociable)
- Contraste **WCAG AA** partout ; focus visible (anneau `accent` 2 px, offset 2 px).
- Cibles tactiles ≥ 40 px ; navigation clavier complète ; `prefers-reduced-motion` respecté.
- Le sens ne repose jamais sur la couleur seule (icône/texte en renfort).

---

*Source d'inspiration logo : `docs/pactiva/inspiration-logo.md`. Implémentation du système
de tokens : voir `docs/pactiva/plan-style-systeme.md`.*
