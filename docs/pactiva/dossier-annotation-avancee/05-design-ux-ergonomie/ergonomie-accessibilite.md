# Ergonomie & accessibilité — Features A & B

> Objectif : **WCAG 2.1 niveau AA** sur les deux features, **navigation clavier complète**
> de tous les gestes A & B, **daltonisme** (forme + couleur, jamais couleur seule), cibles
> tactiles conformes, **réduction du mouvement** respectée. Tout s'appuie sur l'existant :
> helper `readableTextColor` (contraste AA dynamique), focus `ring-accent` déjà en place,
> `data-*` attributes des phrases, hooks `useShortcuts`/`useLongPress`.

---

## 1. Contrastes (AA)

| Élément | Règle | Mécanisme |
|---|---|---|
| Texte de libellé (thème, métadonnées) | ≥ 4.5:1 | tokens `ink` (#E6EAF0) / `ink-muted` (#9AA6B6) sur `bg`/`panel` sombres, validés charte |
| Abréviation de catégorie sur teinte dynamique | ≥ 4.5:1 | `readableTextColor(getThemeToken(code).color)` (déjà dans `tokens.ts`) choisit quasi-noir ou blanc |
| Marqueur ◷ de frontière | ≥ 3:1 (composant non textuel) | `gutter.marker.color = rgb(var(--surface-text))` sur fond neutre de cellule |
| Anneau de focus | visible, ≥ 3:1 vs fond adjacent | `ring-accent` (navy éclairci #4E86D4 en sombre), offset 2 px (charte §9) |
| États accord/divergence (mode compare) | non porté par la couleur seule | vert/ambre **+** libellé « accord »/« divergence » + ✓/✗ (déjà en place) |

- L'or `gold` n'est **jamais** texte fin sur clair (charte) ; il n'apparaît pas dans A/B
  comme porteur d'information.
- Tout fond de cellule coloré (catégorie ON) passe par `getThemeToken().color` ; l'opacité
  (`cell.categoryOpacity = 0.28`) est calibrée pour rester sous le texte AA — l'abréviation
  reste lisible car sa couleur est recalculée par `readableTextColor`.

## 2. Focus visible & ordre de tabulation

- **Anneau de focus** systématique (`:focus-visible` → `ring-2 ring-accent` + offset 2 px),
  jamais supprimé sans remplacement. Réutilise le pattern `ring-1 ring-accent/40` déjà
  appliqué aux `SentenceRow`.
- **Ordre logique** : phrases de haut en bas (les `SentenceRow` sont des `role="button"
  tabindex=0` déjà focusables) ; la réglette est **après** la colonne de lecture dans
  l'ordre DOM (la lecture prime), pistes parcourues de gauche à droite.
- **Pas de piège clavier** : popovers (`SentenceMenu`, `BoundaryEvidence`, tooltip rail)
  fermables par `Esc` et au clic extérieur (déjà implémenté pour `SentenceMenu`), focus
  rendu au déclencheur à la fermeture.

## 3. Navigation clavier — Feature B (phrase / bloc)

La phrase focalisée (`focusedSentence`) est le **curseur** ; `j/k` la déplacent (existant).
Tous les gestes souris ont un **équivalent clavier**.

| Action | Souris | Clavier | Effet store |
|---|---|---|---|
| Déplacer le curseur | clic phrase | `j` / `k` (ou ↓ / ↑) | `moveFocus(±1)` |
| Annoter / changer le thème de la phrase | clic-droit → palette | `t` (ouvre la palette de thème sur la phrase focalisée) | `toggleBoundary(focus, theme)` |
| Désannoter la phrase | re-choisir même thème | `t` puis re-choix, ou `Backspace`/`Suppr` | `removeBoundary(focus)` |
| Démarrer/étendre une **plage** | glisser / Maj-clic | `Maj + ↓/↑` (étend `selectedSentences` depuis l'ancre) | `selectRange(ancre, focus)` |
| Annoter la **plage** sélectionnée | bouton SelectionToolbar | `t` (palette) → Entrée | `applyBlockOp("annotateRange")` |
| **Sélectionner le bloc** courant | double-clic | `b` (sélectionne `blockAt(focus).start..end`) | `selectRange(block.start, block.end)` |
| **Étendre** le bloc d'1 phrase | poignée bord ↓ | `Maj + .` (point) / `Alt + ↓` | `applyBlockOp("extend")` |
| **Réduire** le bloc d'1 phrase | poignée bord ↑ | `Maj + ,` (virgule) / `Alt + ↑` | `applyBlockOp("shrink")` |
| **Désannoter** le bloc | SelectionToolbar (mode bloc) | `Maj + Backspace` | `applyBlockOp("clearBlock")` |
| Désélectionner | clic vide / `Effacer` | `Esc` | `clearSelection` |
| **Annuler / Rétablir** | — | `Cmd/Ctrl + Z` / `Cmd/Ctrl + Maj + Z` | `undo` / `redo` (existant) |

- Les **poignées de bord** (`BlockHandlesLayer`) sont des `role="button"` focusables avec
  `aria-label` explicite (« Étendre le bloc <thème> vers le bas » / « Réduire… »), pour que
  l'extension/réduction soit possible **sans glisser** (accessibilité motrice).
- La fusion (B5) est **émergente** : aucune commande clavier dédiée (elle se produit dès que
  deux blocs de même thème deviennent contigus).
- Les raccourcis sont **enregistrés via `useShortcuts`** (déjà en place) et **désactivés**
  quand le focus est dans un champ de saisie (évite les collisions de frappe).

## 4. Navigation clavier — Feature A (réglette)

La réglette est un `role="grid"` ; chaque piste `role="row"` ; les **cellules de début de
segment** sont focusables (roving `tabindex`).

| Action | Souris | Clavier | Effet |
|---|---|---|---|
| Entrer dans la réglette | clic | `Tab` (après la lecture) | focus 1re cellule de début |
| Centrer la phrase du segment | clic cellule/marqueur | `Entrée` / `Espace` | `focusSentence(startSentence)` (= `onJump`) |
| Segment précédent / suivant (même piste) | survol | `↑` / `↓` | déplace le focus de cellule |
| Changer de piste (modèle) | — | `←` / `→` | déplace le focus de colonne |
| Ouvrir le tooltip (détail) | survol | **au focus** (pas seulement hover) | `role="tooltip"` |
| Fermer le tooltip | sortie souris | `Esc` | ferme |

- Le tooltip s'ouvre **au focus clavier**, pas uniquement au survol (sinon inaccessible au
  clavier). Contenu : modèle / catégorie (label complet) / plage de phrases.
- Toggles (case « Frontières » maître, cases par modèle, case « Catégories », lien
  « Tout / Aucun ») sont des contrôles natifs (`<input type=checkbox>` / `<button>`),
  donc nativement focusables et activables au clavier.

## 5. Daltonisme — forme + couleur (jamais couleur seule)

Garantie transverse : **toute information codée par couleur a un renfort de forme ou de
texte**.

| Information | Couleur | Renfort non-couleur |
|---|---|---|
| Frontière de modèle (rail) | (neutre par défaut) | **glyphe ◷** au seul début de segment |
| Catégorie (rail / badge) | `getThemeToken().color` | **abréviation** 2–3 lettres (`MOD`, `LTD`…) + label dans le tooltip |
| Bloc vs phrase | teinte continue | **forme** : rail continu + coins arrondis (bloc) vs ligne (phrase) ; **contour** à la sélection |
| Override interne d'un bloc | teinte différente | **rupture visible** du rail (sous-bloc) — lisible même en niveaux de gris |
| Accord / divergence (compare) | vert / ambre | **libellé** « accord »/« divergence » + ✓/✗ (déjà en place) |
| Identité de piste | palette neutre `identity[]` | **initiale** du modèle (C / Cx / M) — au-delà de 5 pistes, **initiale seule** |
| Certitude | `certaintyScale.color` | **emoji + label** (déjà en place via `CertaintyPicker`) |

- Test de validation : capture en simulation deutéranopie/protanopie → toutes les
  distinctions ci-dessus restent **identifiables sans la couleur** (forme/texte suffisent).
- Les couleurs d'identité de piste sont choisies **distinctes** des teintes de catégorie et
  entre elles en daltonisme (détaillé dans `palette-graphisme.md`).

## 6. Cibles tactiles

- **Cibles ≥ 24×24 px** pour les cellules/marqueurs de la réglette (`gutter.track.minHitTarget
  = 24`, `cell.minHeight = 22` complété par le padding de hit) ; **≥ 40 px** pour les
  contrôles principaux (boutons de toolbar, toggles) conformément à la charte §9.
- **Poignées de bloc** : zone de préhension ≥ 24 px, séparées des bords cliquables de la
  phrase pour éviter le déclenchement accidentel.
- Sur tactile/`< xl`, la réglette se replie en **déclencheur** (un bouton ≥ 40 px) ; le
  glisser de plage (B2) cohabite avec le scroll via un long-press de démarrage (réutilise
  `useLongPress`, déjà en place) pour ne pas capturer le défilement par erreur.

## 7. Lecteur d'écran (ARIA)

- **Réglette** : `role="grid"`, `aria-label="Frontières de clause par modèle"` ; chaque
  piste `role="row"` avec `aria-label="Piste Claude"` ; chaque cellule de début
  `aria-label="Claude — Modification des conditions — phrases 12 à 17"`. Une piste sans
  données est `aria-disabled="true"` (et non supprimée silencieusement) → l'utilisateur SR
  comprend « ce modèle n'a pas annoté ce document ».
- **Bloc** : la `SelectionToolbar` en mode bloc est un `role="toolbar"` (déjà le cas) avec
  `aria-label="Actions de bloc"` ; le compteur annonce « N phrases sélectionnées (bloc
  <thème>) ». Les poignées portent un `aria-label` d'action explicite.
- **Annonces dynamiques** (`role="status"`, `aria-live="polite"`) : « Bloc <thème> 12–18,
  7 phrases » à la pose ; « Annulé » / « Rétabli » sur undo/redo ; état d'enregistrement
  (réutilise le `role="status"` déjà présent sur le tooltip de sélection et le bandeau de
  score). Pas d'`aria-live="assertive"` (éviter le bavardage).
- **Cohérence des libellés** : les `aria-label` reprennent `getThemeToken(code).label`
  (français, accentué) — jamais le code brut.

## 8. Réduction du mouvement

- `prefers-reduced-motion: reduce` ⇒ pas d'animation d'apparition (tooltip, poignées,
  surfaces flottantes) ; transitions ramenées à un changement d'état instantané ou ≤ 80 ms.
- Le `scrollIntoView({behavior:"smooth"})` du centrage de phrase passe en `behavior:"auto"`
  si mouvement réduit (le centrage reste fonctionnel, sans défilement animé).
- Aucune animation **décorative** nulle part (charte « Aucune animation décorative »).

---

## 9. Check-list d'acceptation a11y (vérifiable)
- [ ] Tous les gestes B ont un équivalent clavier (table §3) et fonctionnent sans souris.
- [ ] Toute la réglette A est pilotable au clavier (grid roving, Entrée, flèches, Esc) — §4.
- [ ] Aucune information n'est portée par la **couleur seule** (forme/texte en renfort) — §5.
- [ ] Contraste texte/fond ≥ 4.5:1 partout, y compris sur teinte dynamique (`readableTextColor`).
- [ ] Tooltip rail ouvrable **au focus** clavier, pas seulement au hover.
- [ ] Cibles ≥ 24 px (réglette) / ≥ 40 px (contrôles) ; poignées préhensibles.
- [ ] `aria-label` complet par cellule de début et en-tête de piste ; pistes sans données
  `aria-disabled`.
- [ ] Annonces `aria-live="polite"` pour pose/undo/redo/enregistrement, sans bavardage.
- [ ] `prefers-reduced-motion` respecté (apparitions + scroll).
- [ ] Pas de piège clavier ; focus rendu au déclencheur à la fermeture des popovers.
