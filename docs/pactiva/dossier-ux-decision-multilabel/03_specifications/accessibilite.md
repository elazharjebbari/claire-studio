# Spécification — Accessibilité (WCAG 2.1 AA)

> Décline le principe socle §5 : **information jamais portée par la couleur seule**
> (forme + glyphe + texte), contraste AA, navigation clavier complète, focus visible. Inclut une
> check-list de validation (axe / Lighthouse).

## 1. Couleur jamais seule (WCAG 1.4.1 — Use of Color)

| Information | Vecteur primaire (sans couleur) | Couleur = renfort |
|---|---|---|
| Niveau C1–C5 | glyphe `●◐⧉◑⚖` + libellé (Or/Haute/Multi-label/Majorité/Arbitrage) | teinte du badge |
| Provenance | **forme** `★`/`⚡`/`✎` + tooltip texte | accent d'origine |
| État validé / à valider | forme pleine (validé) vs `◷` (à valider) + texte | vert / ambre |
| Conflit C4/C5 | glyphe `❗` + libellé « Arbitrage / Majorité » | rose / ambre vif |
| Primaire vs secondaire | chip plein + `✓` vs contour pointillé + `+` + graisse | teinte de thème |
| Multi-label ON/OFF | libellé **Mono / Multi** + position du switch | bleu `#64B5F6` |

Test de référence : l'écran reste **entièrement compréhensible en niveaux de gris** et sous
simulation de daltonisme (deutéranopie / protanopie / tritanopie).

## 2. Contrastes (WCAG 1.4.3 / 1.4.11)

| Cible | Seuil | Application Pactiva |
|---|---|---|
| Texte normal | ≥ **4.5:1** | encre claire (`ink`) sur chip à 18 % d'opacité — vérifié AA |
| Texte large (≥ 18.66 px gras / 24 px) | ≥ 3:1 | libellés de badge |
| Éléments non textuels (glyphes, bordures, switch, focus) | ≥ **3:1** | `★/⚡/✎/◷/❗` ≥ 12 px, liserés, anneau de focus |

Le thème clair (`hex_light`) sert de repli WCAG quand le fond sombre ne permet pas le seuil
(ex. ambre `#FBBF24` → `#B45309`, vert `#34D399` → `#2E7D32` sur fond clair).

## 3. Navigation clavier (WCAG 2.1.1 / 2.4.3)

- **Tout** est atteignable au clavier : chips, toggle, boutons valider, bouton de décision C4/C5,
  actions de la `SuggestionCard`.
- Ordre de tabulation **logique** : dans une vue de revue, priorité aux clauses C5 puis C4
  (cf. saillance socle), sinon ordre de lecture du document.
- Raccourcis cohérents : **Espace / Entrée** activent toggle et boutons ; **Échap** ferme
  popover / menu et **annule** le geste en cours (réversibilité) ; flèches pour naviguer entre
  chips d'une même clause.
- Pas de piège clavier (WCAG 2.1.2) : on peut toujours sortir d'un popover au clavier.

## 4. Focus visible (WCAG 2.4.7)

- Anneau de focus `selection_ring` **2 px, offset 2 px**, contraste ≥ 3:1, **jamais supprimé**.
- Le focus reste prioritaire sur le hover (un survol concurrent ne le masque pas).
- Sur les éléments à hit-zone étendue, l'anneau épouse la hit-zone, pas seulement le glyphe.

## 5. ARIA et sémantique

| Composant | Rôle / attributs |
|---|---|
| Toggle `🏷` | `role=switch`, `aria-checked`, `aria-label` « Multi-label — actuellement {Mono\|Multi} » |
| Chip primaire | `aria-label` « Thème principal : {nom} » |
| Chip secondaire | `aria-label` « Thème secondaire : {nom} », actions exposées au menu |
| Marque provenance | `aria-label` / `title` : « Validé via le triage — règle C2 », « Pré-annotation LLM confirmée », « Validé manuellement », « À valider » |
| Badge `+N` (plan) | `aria-label` « {N} thème(s) secondaire(s) — multi-label » |
| Conflit C4/C5 | `aria-label` « Conflit C5 — arbitrage requis » / « Majorité C4 — à vérifier » ; bouton « Décider (manuel) » correctement libellé |
| Bouton désactivé | `aria-disabled=true` + tooltip de raison (pas seulement `disabled` muet) |

- Changements d'état dynamiques annoncés via région **`aria-live=polite`** : « Multi-label
  activé », « {nom} est désormais le thème principal », « Clause validée ».
- Les glyphes décoratifs purement redondants sont `aria-hidden` ; ceux porteurs de sens ont un
  équivalent texte.

## 6. Mouvement (WCAG 2.3.3)

- `prefers-reduced-motion` respecté : suppression des translations / morphings, conservation du
  seul changement d'état final. Aucun clignotement (pas de contenu clignotant > 3 Hz — WCAG 2.3.1).

## 7. Cibles (WCAG 2.5.5 / 2.5.8)

- Cibles ≥ **24 px** (AA — Target Size minimum) ; ≥ **32 px** recommandé dans l'inspecteur.
- Espacement suffisant pour ne pas activer une cible voisine par erreur ; hit-zone étendue par
  padding invisible quand le visuel est plus petit.

## 8. Check-list de validation

### Automatique
- [ ] **axe-core** : 0 violation critique / sérieuse sur chaque écran (document, plan,
      inspecteur, SuggestionCard).
- [ ] **Lighthouse Accessibility** : score ≥ 95 ; revue manuelle des items « manual checks ».
- [ ] Contraste vérifié sur tous les couples texte/fond et glyphe/fond (outil de contraste).

### Manuelle
- [ ] Parcours **100 % clavier** : valider une clause, activer/désactiver le toggle, permuter
      primaire↔secondaire, arbitrer une C5 — sans souris.
- [ ] **Échap** annule le geste en cours et ferme les popovers, sans piège clavier.
- [ ] **Focus visible** à chaque étape ; jamais masqué par un hover.
- [ ] Test **niveaux de gris** : primaire/secondaire, provenance, conflit restent distinguables.
- [ ] Simulation **daltonisme** (deutéran/protan/tritan) : aucune information perdue.
- [ ] **Lecteur d'écran** (VoiceOver / NVDA) : provenance, niveau, rang de thème et état du
      toggle correctement annoncés ; `aria-live` déclenché sur validation et bascule.
- [ ] `prefers-reduced-motion` : aucune animation de mouvement résiduelle.
- [ ] Cibles mesurées ≥ 24 px (≥ 32 px inspecteur).
