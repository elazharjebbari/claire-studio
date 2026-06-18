# Ergonomie anti-fatigue (feature 6)

> CLAIRE Studio est un **outil de production** : un annotateur y passe plusieurs heures par jour à lire
> du texte juridique dense et à répéter le même micro-geste (frontière → thème → certitude). La fatigue
> oculaire, la charge cognitive et les troubles musculo-squelettiques sont des **risques produit de
> premier ordre**, pas des détails de finition. Ce document fixe des principes **mesurables** ; les
> valeurs concrètes (couleurs, espacements, polices) vivent dans `06_design_system/design_tokens.json`.

## Principe directeur

> *Réduire le coût marginal de chaque clause.* Tout ce qui se répète des milliers de fois (lire une
> phrase, poser une frontière, choisir un thème, noter une certitude) doit être optimisé à l'extrême ;
> tout le reste peut être ordinaire.

---

## 1. Lecture du texte (la colonne document)

| Paramètre | Règle | Justification |
|---|---|---|
| **Longueur de ligne** | 60–75 caractères (cible **~70ch**), plafonnée même en plein écran | Au-delà, l'œil perd la ligne au retour chariot ; en deçà, trop de sauts. Optimum lisibilité reconnu. |
| **Interlignage (line-height)** | **1.7** sur le corps du document | Aère le texte dense, réduit le crowding, facilite le suivi en lecture longue. |
| **Taille de corps** | ≥ 16 px (token `font-size-base`), réglable densité compacte/confort dans `/settings` | Évite l'accommodation forcée ; respecte les préférences individuelles. |
| **Graisse** | corps en regular ; phrases d'ancre / clauses en medium | Le poids hiérarchise sans crier. |
| **Justification** | **alignée à gauche** (jamais justifiée) | La justification crée des « rivières » blanches fatigantes et un crénage irrégulier. |
| **Espacement inter-phrases** | léger interstice vertical + numéro d'index `[n]` discret | Rend la structure phrase-par-phrase scannable (unité atomique du CONTRACT). |

---

## 2. Contraste & couleur (anti-éblouissement)

- **Thème sombre par défaut pour les longues sessions** : fond **gris très sombre, jamais noir pur**
  (`#0F1115`-like), texte **gris clair, jamais blanc pur** (`#E6E8EC`-like). Le contraste noir-pur /
  blanc-pur provoque du halation et de la fatigue ; on vise un contraste **élevé mais doux**.
- **Conformité AA garantie** : texte normal ≥ 4.5:1, texte large ≥ 3:1 (détaillé dans
  `06_design_system/color_system.md`). Vérifié automatiquement (test `a11y axe`, feature_traceability F6).
- **Couleurs de thèmes de clause** (vocabulary.yaml) : choisies pour rester **distinguables en thème
  sombre** et lisibles par les daltoniens — la couleur n'est **jamais le seul** porteur d'information
  (toujours doublée du code/label du thème ; voir `accessibility.md`).
- **Surlignages** (injustice CLAUDETTE feature 12, fantôme LLM feature 2) en **calques de faible opacité**
  + bordure/pictogramme, jamais en aplat saturé qui « brûle » la rétine.

---

## 3. Charge cognitive

- **Vocab fermé (ADR-0003)** : l'annotateur choisit dans un ensemble **fini et stable** de thèmes —
  pas de saisie libre, pas de décision « faut-il créer une catégorie ? ». La charge décisionnelle chute.
- **Une seule clause active à la fois** : l'inspecteur ne montre que la clause sélectionnée → focus.
- **Le LLM comme brouillon** (feature 2) : pré-remplir transforme une tâche de **création** (coûteuse)
  en tâche de **vérification** (moins coûteuse), tout en gardant l'humain décideur.
- **Certitude assumée, pas cachée** (feature 10) : pouvoir dire « incertain 🤔 » + commenter (feature 9)
  évite le blocage et la surcharge du « il faut être sûr ».
- **Progression visible** (barre, plan/TOC) : réduit l'anxiété du « combien il reste ».
- **États vides explicites** (navigation.md §5) : jamais d'écran ambigu.
- **Pas de pop-ups intempestives** : les confirmations destructrices seulement (supprimer une clause).

---

## 4. Thème sombre / clair

- Bascule **un clic** depuis la top bar, **persistée** dans `/settings` (préférence + `prefers-color-scheme`).
- Les deux thèmes respectent AA (tokens dédiés `light`/`dark` dans `design_tokens.json`).
- **Pas de flash** au chargement (thème appliqué avant le premier paint).
- Densité d'affichage réglable (confort / compact) indépendante du thème.

---

## 5. Raccourcis clavier (clé de l'anti-fatigue gestuelle)

Le but : **annoter sans lâcher le clavier**. Souris optionnelle pour les power-users (P1, P2).
Tous documentés dans l'aide `?` (navigation.md §3) et configurables dans `/settings`.

| Touche | Action | Feature |
|---|---|---|
| `j` / `k` | phrase suivante / précédente | F1 |
| `B` | poser une frontière de clause (ancre) sur la phrase courante | F1 |
| `T` | ouvrir la palette de thèmes puis frappe pour filtrer | F1 |
| `0` `1` `2` `3` | certitude de la clause sélectionnée | F10 |
| `C` | ouvrir/écrire un commentaire ancré | F9 |
| `⌘S` | snapshot manuel (version) | F3 |
| `g d` | document suivant | F1 |
| `⌘K` | palette de commandes (sauter, exporter, thème, aide) | navigation |
| `?` | aide / cheat-sheet des raccourcis | — |

**Principes raccourcis** : mnémotechniques (B=Boundary, T=Theme, C=Comment), homerow-friendly,
non destructifs par défaut, jamais en conflit avec les raccourcis navigateur/lecteur d'écran.

---

## 6. Rythme de travail & santé

- **Auto-save permanent** (optimiste) : aucun stress de perte de travail → pas de soumission précipitée.
- **Reprise exacte** : « reprendre où je m'étais arrêté » (Accueil) restaure document + position.
- **Micro-feedback discret** : confirmation visuelle légère après chaque clause (pas de son, pas de modal).
- **Suggestion de pause** (optionnelle, désactivable) après N minutes de session continue.
- **Pas de minuteur punitif** visible : la vitesse est une métrique d'amélioration outil, jamais une
  pression affichée à l'annotateur.

---

## 7. Critères d'acceptation mesurables (testables, F6)

1. Colonne document ∈ [60, 75] ch à toutes les largeurs ≥ 1024 px.
2. `line-height` du corps document = 1.7 (± 0.05).
3. Tous les couples texte/fond ≥ AA (axe-core sans violation de contraste).
4. 100 % des actions d'annotation du tableau §5 réalisables sans souris.
5. Bascule de thème sans flash (pas de FOUC) et persistée après reload.
6. Aucune information portée par la **seule** couleur (cf. accessibility.md).
