# Plan d'action — Système de gestion de style Pactiva

Objectif : un **style uniforme** dans toute l'app et une **charte respectée partout**, à
partir d'une **source de vérité unique**. On capitalise sur l'existant (il est déjà bien
architecturé) plutôt que de repartir de zéro.

> Charte de référence : `docs/pactiva/charte-graphique.md`.

---

## 0. État des lieux (existant réutilisable)
- `frontend/design-tokens.json` = **source de vérité** (surfaces `light`/`dark`, 20 thèmes
  de clause, échelles injustice/certitude).
- `tailwind.config.ts` expose ces tokens en classes via **CSS variables** (`bg`, `panel`,
  `accent`, `ink`, `line`, `theme-*`…). Bascule `.dark`/`.light`.
- `globals.css` définit les variables (`:root` sombre, `html.light` clair) + `--font-*`.
- Toggle de thème déjà présent (`TopBar` + `store/ui`).

➡️ **On ne casse pas ce socle** : on l'enrichit (palette de marque + tokens sémantiques +
polices) et on **bannit les couleurs en dur** au profit des tokens.

---

## 1. Décisions à valider avant exécution
| # | Décision | Recommandation |
|---|---|---|
| **D1 — Nommage** | « CLAIRE Studio » devient-il « Pactiva » dans toute l'app ? | **Pactiva** en marque publique (header, footer, titre, login, accueil). « CLAIRE Studio » conservé seulement comme nom interne du moteur d'annotation si utile. |
| **D2 — Thème par défaut** | Quel thème à l'ouverture de l'atelier ? | **Public = clair** (institutionnel). **Atelier = toggle conservé**, défaut **sombre** (confort lecture F6), les deux thèmes habillés Pactiva. Ajustable en 1 ligne. |
| **D3 — Accent du thème clair** | Navy uni ou navy + or ? | **Navy `#0C447C`** comme accent d'action ; **or** réservé aux accents rares (jamais en bouton primaire). |

---

## 2. Phasage

### Phase 1 — Fondations (tokens + polices)
1. **Palette de marque dans `design-tokens.json`** : ajouter `brand.navy{50..900}`,
   `brand.gold{300..700}`, `neutral{0..950}`, `semantic{success,warning,danger,info}`
   (clair/sombre) — valeurs de la charte §3.
2. **Re-mapper `surface.light`** sur l'identité Pactiva (accent navy, texte navy encré) et
   **`surface.dark`** sur la palette Pactiva (accent navy éclairci AA) — charte §3.6.
3. **Polices via `next/font`** : `Outfit` (300/500/600) → `--font-display` & wordmark ;
   `Inter` (400/500/600) → `--font-sans`. Garder serif lecture + mono. Câbler dans
   `layout.tsx` et `globals.css`.
4. Étendre `tailwind.config.ts` : `fontFamily.display`, échelles radius/spacing/shadow,
   couleurs `brand-*` / `semantic-*`.

*Livrable : palette + typo de marque actives, aucun changement de structure.*

### Phase 2 — Identité visible (logo, favicon, header/footer)
1. **`components/brand/Logo.tsx`** — symbole inline (`currentColor`) + wordmark Outfit ;
   props `size`, `withWordmark`, `tone`. Source unique.  *(assets SVG déjà produits)*
2. **Favicon** : `app/icon.svg` (fait) + métadonnées dans `layout.tsx`.
3. Remplacer le texte « CLAIRE Studio » par `<Logo/>` dans : `TopBar`/`Sidebar` (atelier),
   `login`, en-têtes des pages publiques (`welcome`, `public`, `signup`…).
4. **Footer public** : symbole + « Pactiva » + « en collaboration avec des docteurs en droit ».

### Phase 3 — Routing : welcome = page d'accueil de `pactiva.legal`
1. Créer `app/page.tsx` **public** = nouvelle home Pactiva (contenu Phase 4).
2. Déplacer l'accueil applicatif `(app)/page.tsx` → `(app)/home/page.tsx` (`/home`).
3. Rediriger après login vers `/home` ; mettre à jour les liens internes (logo → `/home` si
   connecté, `/` sinon).
4. `/welcome` → **redirection** vers `/` (compat liens/e2e), ou conserver comme alias.

### Phase 4 — Contenu de la home (ambition) + retrait « Batt & Associés »
1. Refondre la home autour de **l'ambition** (post fondateur) :
   - **Hero** : « L'intelligence contractuelle, pour les ETI européennes. »
   - **Le problème** : contrats multilingues, analysés isolément → risques ratés ; le risque
     vit dans la **tension entre plusieurs documents**.
   - **La réponse Pactiva** : 2 niveaux — backend (modèles open-weight européens Mistral/
     EuroLLM, datasets de référence CUAD/LEDGAR/ContractNLI, **auditable**) + frontend
     juristes/achats (alertes lisibles, explications sourcées, recommandations actionnables).
   - **3 piliers** : multilingue natif · croisement multi-documents · déployable chez vous
     (souveraineté, zéro donnée qui sort).
   - **CTA** : Se connecter / Créer un compte / Projets publiés.
2. **Retirer toutes les mentions « Batt & Associés »** (`welcome` footer + occurrences) →
   « **en collaboration avec des docteurs en droit** ».

### Phase 5 — Uniformisation (audit conformité tokens)
1. **Primitives** (`components/ui/primitives`: Button, Panel, Field, Badge, StatusPill…)
   alignées sur la charte (états hover/focus/disabled, rayons, typo).
2. **Chasse aux couleurs en dur** : remplacer tout `#hex` / `text-red-400` / `bg-blue-*`
   par des tokens (`text-danger`, `bg-accent`, `border-line`…).
3. Harmoniser espacements/rayons/élévations sur l'échelle de la charte.

### Phase 6 — Garde-fous & validation
1. **Lint anti-régression** : règle interdisant les couleurs hex/`*-500` brutes hors
   `design-tokens.json` (eslint custom ou `stylelint`/grep en CI).
2. **Tests verts** : `tsc` 0, Vitest, e2e Playwright (adapter sélecteurs route home),
   `next build`. A11y AA (contrastes recalculés).
3. Mettre à jour la doc d'usage (ce dossier) + capture avant/après.

---

## 3. Source de vérité & flux
```
design-tokens.json  ──►  tailwind.config.ts  ──►  classes (bg/accent/ink/brand-*)
        │                                            ▲
        └──►  globals.css (CSS vars :root / .light)  │
next/font (Outfit, Inter) ──► --font-display / --font-sans ──┘
components/brand/Logo.tsx ──► header / footer / favicon (assets SVG)
```
Règle d'or : **aucune couleur, police ou rayon en dur dans les composants** — tout passe
par les tokens/classes. Un changement de marque = éditer `design-tokens.json` (+ polices).

---

## 4. Risques & maîtrise
- **Bascule clair/sombre** : valider les contrastes AA sur les deux thèmes (accent navy
  éclairci en sombre). → recalcul + test a11y.
- **Routing home** : risque sur les liens/e2e existants. → redirection `/welcome`→`/` +
  mise à jour des sélecteurs de test.
- **Régressions visuelles** : changements larges. → faire la Phase 5 par lots de petits
  diffs revus, app testée à chaque lot ; rester sur une branche dédiée.
- **Nommage (D1)** : si « Pactiva » partout, vérifier qu'aucun test ne dépend du libellé
  « CLAIRE Studio ».

## 5. Definition of Done
- [ ] Home publique = `/` sur `pactiva.legal`, contenu « ambition », logo + favicon Pactiva.
- [ ] Plus aucune mention « Batt & Associés » ; « docteurs en droit » à la place.
- [ ] Palette + typo Pactiva actives dans les deux thèmes, accent navy/or conforme charte.
- [ ] Logo unique (`<Logo/>`) en header/footer/login/atelier ; favicon en place.
- [ ] Zéro couleur en dur dans les composants ; lint garde-fou en place.
- [ ] `tsc` 0 · Vitest · e2e · `next build` verts ; contrastes AA validés.

---

## 6. Estimation (ordre de grandeur)
P1 ½ j · P2 ½ j · P3 ¼ j · P4 ½ j · P5 1 j · P6 ¼ j → ~**3 jours** de petits diffs revus.
Le chemin solo et le toggle de thème restent fonctionnels à chaque étape.
