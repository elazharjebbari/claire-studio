# Accessibilité — WCAG 2.1 AA

> CLAIRE Studio vise la conformité **WCAG 2.1 niveau AA**. L'accessibilité n'est pas séparée de
> l'ergonomie (`ergonomics_anti_fatigue.md`) : un outil utilisable au clavier et lisible à fort
> contraste sert aussi bien l'annotateur fatigué que l'utilisateur en situation de handicap. Cible de
> conformité vérifiée automatiquement (`a11y axe`, feature_traceability F6) et manuellement (lecteur d'écran).

## Engagement de conformité

| Principe WCAG | Engagement CLAIRE |
|---|---|
| **Perceptible** | Contraste AA, info jamais portée par la seule couleur, alternatives textuelles, redimensionnement 200 % sans perte. |
| **Utilisable** | Tout au clavier, focus visible, pas de piège clavier, raccourcis remappables, pas de contenu clignotant. |
| **Compréhensible** | Langue déclarée, libellés explicites, erreurs identifiées et décrites, comportement prévisible. |
| **Robuste** | HTML sémantique + ARIA correct, compatible lecteurs d'écran et technologies d'assistance. |

---

## 1. Navigation clavier (Utilisable)

- **100 % des fonctions au clavier**, y compris le workspace 3 panneaux (cf. tableau de raccourcis
  dans `ergonomics_anti_fatigue.md §5`). Aucune action ne dépend exclusivement de la souris ou du drag.
- **Ordre de tabulation logique** : top bar → sidebar → plan/TOC → document → inspecteur → barre d'action.
- **Focus visible et net** : anneau de focus à fort contraste (token `--focus-ring`), jamais masqué
  (`outline: none` interdit sans remplacement équivalent).
- **Skip links** : « aller au document », « aller à l'inspecteur » en tête de page.
- **Pas de piège clavier** : on peut entrer/sortir de la palette de thèmes, des champs `rationale`/
  `evidence_span`, des fils de commentaires, et du `⌘K`.
- **Raccourcis non conflictuels** : les lettres simples (`j k B T C 0–3`) ne s'activent **pas** quand le
  focus est dans un champ de saisie ; remappables dans `/settings` pour éviter les collisions avec les
  raccourcis de technologies d'assistance.
- **Échap** ferme toujours le calque le plus haut (palette, modal, fil) et **rend le focus** à l'élément
  d'origine.

---

## 2. Lecteurs d'écran (Robuste)

- **Structure sémantique** : `header`, `nav`, `main`, `aside`, landmarks ARIA pour les 3 panneaux
  (`role="region"` + `aria-label` : « Plan », « Document », « Inspecteur »).
- **Le document comme liste sémantique** : chaque phrase est un élément de liste annoncé avec son index
  (`[6]`) ; une clause est un groupe (`role="group"` `aria-label="Clause PRIVACY_DATA, ancre phrase 6,
  certitude confiant"`).
- **Live regions** :
  - `aria-live="polite"` pour les confirmations d'auto-save, l'arrivée d'une clause, le résultat d'un export.
  - `aria-live="assertive"` réservé aux erreurs de validation bloquantes (thème hors-scheme, conflit 409).
- **État communiqué, pas seulement montré** : statut d'annotation (`draft/submitted/…`), certitude (0–3),
  overlays actifs (injustice/LLM) annoncés textuellement, pas uniquement par la couleur ou l'emoji.
- **Emojis de certitude** (🤔🙂😀💯) portent un `aria-label` textuel (« incertain », « plutôt », etc.) —
  l'emoji est décoratif, le label fait foi.
- **Palette de commandes (⌘K)** : pattern combobox ARIA (`role="combobox"` + `aria-activedescendant`),
  résultats annoncés au fil de la frappe.
- **Diff (`/compare`, DiffView)** : chaque différence a un label textuel (« thème diffère : A=LICENSE_IP,
  B=FEES_PAYMENT ») en plus du code couleur.

---

## 3. Couleur & contraste (Perceptible)

- **Jamais la couleur seule** : un thème de clause est toujours signalé par **couleur + code/label**
  (ex. pastille `●` + `PRIVACY_DATA`). Un niveau d'injustice par **couleur + chiffre 1/2/3 + libellé**.
  Une décision de review par **couleur + icône + texte**.
- **Contraste AA** : texte normal ≥ 4.5:1, texte large/UI ≥ 3:1 (détail et vérification dans
  `06_design_system/color_system.md`). Les pastilles de thème ont une bordure pour rester visibles sur
  fond clair comme sombre.
- **Daltonisme** : la palette de thèmes (vocabulary.yaml) reste distinguable en simulation
  protanopie/deutéranopie grâce au redoublement texte ; testé dans le design system.
- **Pas de dépendance au survol seul** : `rationale`/info-bulles accessibles aussi au focus clavier.

---

## 4. Formulaires & erreurs (Compréhensible)

- Champs (`evidence_span`, `rationale`, score de review, certitude) avec **`label` associé** et
  description (`aria-describedby`).
- **Erreurs** : message lié au champ (`aria-invalid` + texte d'erreur référencé), jamais une couleur seule.
  Exemple : tenter un thème hors `LabelScheme` → message « ce thème n'appartient pas au schéma du projet ».
- **Actions destructrices** (supprimer une clause) : confirmation explicite, annulable.

---

## 5. Zoom, redimensionnement, mouvement (Perceptible / Utilisable)

- **Zoom 200 %** : la mise en page reste utilisable, pas de perte de contenu ni de scroll horizontal
  involontaire (les panneaux se réorganisent / se replient).
- **Texte redimensionnable** : densité confort/compact + respect du `font-size` navigateur ; pas de
  taille en `px` figée sur le corps lisible.
- **`prefers-reduced-motion`** : transitions/animations réduites ou supprimées (panneaux, diff, toasts).
- **Cibles tactiles** ≥ 24×24 px (AA) ; toggles d'overlay et boutons de certitude largement cliquables.

---

## 6. Internationalisation (lien feature 8)

- `lang` déclaré sur `<html>` et sur les blocs de langue différente (document en anglais, UI en français).
- Les **traductions** (feature 8) affichées en overlay portent leur propre `lang` pour une prononciation
  correcte par le lecteur d'écran.

---

## 7. Critères d'acceptation testables

1. **axe-core** : 0 violation sur les écrans clés (workspace, review, compare, admin).
2. Parcours complet **J1 (annoter de zéro)** réalisable **au clavier seul**, focus toujours visible.
3. Parcours complet **J1** réalisable au **lecteur d'écran** (VoiceOver/NVDA) : statut, thème, certitude,
   commentaires tous annoncés.
4. Zoom **200 %** : aucun contenu tronqué ni inaccessible sur le workspace.
5. Toute information critique double la couleur d'un libellé/texte (audit manuel).
6. `prefers-reduced-motion` respecté (aucune animation non essentielle).
