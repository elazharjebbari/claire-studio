# Audit d'interface — Outil de survol « clause abusive » (injustice CLAUDETTE)

> Objectif produit : au survol d'une **clause marquée injuste** (et uniquement là),
> afficher une fiche riche, structurée et élégante donnant **toute** l'information sur
> l'injustice — catégorie(s), sévérité, définition, correspondance thématique — et
> **mettre en évidence (jaune)** le passage qui porte l'évidence.

Cet audit établit l'état des lieux, les contraintes et les décisions à trancher dans
l'étude de design (`01_etude_options_design.md`). Il ne propose pas encore de solution.

---

## 1. Donnée disponible — le constat structurant

Les marques CLAUDETTE sont **strictement par phrase**. Modèle `ReferenceLabel`
(`backend/claire/corpora/models.py:82-102`) :

| Champ | Type | Dispo |
|---|---|---|
| `sentence` (FK) → `sentenceIndex` | int | ✅ |
| `category` | A/CH/CR/J/LAW/LTD/TER/USE | ✅ |
| `level` | 1 / 2 / 3 | ✅ |
| `source` | « claudette » | ✅ |
| **span / offset / texte d'évidence** | — | ❌ **inexistant** |

Confirmé sur toute la chaîne : format source (`Labels_<CAT>/<Doc>.txt` = un entier par
phrase, `loaders.py:3-7,122-134`), modèle, sérialiseur (`referenceLabels[]` = `{category,
level, sentenceIndex, sentenceId, source}`, `serializers.py:32-42`), type TS
(`contract.ts:85-92`), hook (`useUnfairness.ts:12-18`). **Aucun mécanisme substring→`<mark>`
n'existe nulle part dans le code.**

### Conséquence de conception (à valider dans l'étude)
Le « passage qui donne l'évidence » **n'a pas de donnée fine**. La granularité de vérité
terrain CLAUDETTE est **la phrase**. Trois voies (analysées en détail dans l'étude design,
domaine « Surlignage ») :

1. **La phrase marquée = l'évidence** → surligner la phrase entière (vérité terrain, zéro
   hypothèse). C'est la voie honnête par défaut.
2. **Emphase heuristique intra-phrase** → repérer côté front les tournures typiques de la
   catégorie (« arbitration », « terminate », « no liability »…) pour souligner un
   sous-passage *indicatif* (jamais présenté comme vérité terrain).
3. **Enrichissement backend** (nouveau champ evidence/offsets + nouvel import) → **hors
   périmètre** : aucune donnée source ne le permet aujourd'hui, gros chantier sans gain de
   fiabilité.

> Recommandation d'audit : **voie 1 par défaut** (surligner la phrase = l'évidence
> CLAUDETTE), **enrichie de la voie 2** comme aide *indicative* clairement étiquetée.

### Multi-catégories par phrase — perte d'information actuelle
`useUnfairnessIndex` (`useUnfairness.ts:20-39`) **ne garde que le label le plus sévère**
par phrase (`if (existing.level >= l.level) continue`). Or une phrase peut cumuler
plusieurs injustices (ex. LTD + A). Pour une fiche « complète », il faudra **conserver
toutes les marques** d'une phrase (refactor du hook → tableau par index).

---

## 2. État actuel de l'overlay injustice

- **Activation** : flag store `showUnfairness` (défaut **ON**, `workspace.ts:150,442`),
  toggle `toggle-unfairness` dans **TocPanel** (`TocPanel.tsx:207-215`).
- **Rendu** : par phrase, `unfairnessStyle(mark)` = fond teinté (alpha ∝ intensité du
  niveau) + soulignement `inset 0 -2px 0` sur **toute la phrase**
  (`useUnfairness.ts:41-48`, `DocumentPanel.tsx:1393-1404`).
- **Info au survol** : **attribut `title` natif uniquement** (`Injustice {label} · niveau
  {level}`). Aucun popover riche. `data-testid="unfairness-${index}"`.

→ Le besoin = **remplacer le `title` natif par une fiche custom riche**, déclenchée au
survol des marques d'injustice (et seulement elles).

---

## 3. Infrastructure réutilisable (ne rien réinventer)

| Brique | Fichier | Usage pour la feature |
|---|---|---|
| `useAnchoredPosition(x,y)` | `useAnchoredPosition.ts` | positionnement `fixed` borné au viewport, flip H/V, anti-flash (`visibility`) |
| `RationaleHover` | `RationaleHover.tsx` | **patron de tooltip passif** : `role="tooltip"`, `pointer-events-none fixed z-40 bg-elevated border rounded-lg shadow-xl animate-fade-in` |
| État `hover` du DocumentPanel | `DocumentPanel.tsx:416-427,1019-1020` | délai ouverture 300 ms / fermeture 120 ms déjà câblé sur `SentenceRow` (souris only) |
| Délai « intention » | `ThemePalette.tsx:57-71` (450 ms), `NaturePicker.tsx:38` (400 ms) | patron de timing de survol prolongé |
| `BoundaryEvidence` | `BoundaryEvidence.tsx` | **patron de popover riche** : en-tête icône+titre, bandeau coloré, onglets, cartes à liseré, Échap/clic-extérieur/focus |
| `SuggestionCard` / `TriageHelpModal` | `triage/` | patron de **badge de sévérité** coloré (`${color}22` + glyphe), fiche pédagogique dense |
| Tokens | `tokens.ts`, `design-tokens.json` | `getUnfairnessToken(cat)`, `getUnfairnessLevel(lvl)`, `readableTextColor`, `hexToRgbChannels` |
| Icônes | `lucide-react` | `AlertTriangle`, `Scale`, `ShieldCheck` déjà importées ; `ShieldAlert`, `Gavel` dispo |

---

## 4. Données métier à afficher (depuis la doc annotateur)

**8 catégories** : A (Arbitration), CH (Unilateral change), CR (Content removal),
J (Jurisdiction), LAW (Choice of law), LTD (Limitation of liability), TER (Unilateral
termination), USE (Contract by using). **3 niveaux** : 1 faible / 2 potentiellement injuste
/ 3 clairement injuste (intensité 0.25 / 0.55 / 0.9). **Correspondances thématiques
indicatives** : A→ARBITRATION_DISPUTES ; J/LAW→GOVERNING_LAW ; LTD→LIMITATION_LIABILITY,
WARRANTY_DISCLAIMER ; TER→TERMINATION ; CH→MODIFICATION_OF_TERMS ; CR→USER_CONTENT,
ACCEPTABLE_USE ; USE→PREAMBLE_SCOPE.

> Ces libellés/définitions/correspondances doivent être **centralisés** (un module de
> métadonnées d'injustice, type `unfairnessMeta.ts`) — aujourd'hui seuls code+couleur
> existent dans les tokens, pas les définitions ni les correspondances.

---

## 5. Contraintes de la charte (à respecter sans exception)

- **Zéro hex en dur** dans les nouveaux composants → passer par `getUnfairnessToken` /
  classes sémantiques (`docs/pactiva/.../palette-graphisme.md`).
- **La couleur ne suffit jamais** (daltonisme) → toujours doubler la sévérité d'un
  **glyphe + libellé** de niveau.
- **3 familles de couleur à ne pas mélanger** : thème (segmentation) vs identité de piste
  (modèle) vs **sémantique d'injustice**. La fiche doit visuellement distinguer
  « catégorie d'injustice » (overlay) de « thème » (segmentation) — les deux coexistent.
- **`prefers-reduced-motion`** : déjà neutralisé globalement (`globals.css:112-121`) →
  réutiliser `animate-fade-in` (le standard maison) suffit.
- Animation : **CSS/Tailwind only** (pas de framer-motion / Radix).

---

## 6. Portée & ergonomie demandées

- **Scope** : le survol enrichi ne s'active **qu'à proximité des clauses abusives**
  (phrases marquées) — pas sur les phrases neutres (qui gardent leur comportement actuel).
- **Exigence** : fiche **très structurée, complète, agréable**, usage pro, micro-soin des
  couleurs/espaces/animations.
- **Tests visés** : MSW (données injustice), vitest (logique meta + composant), Playwright
  (apparition au survol, contenu, surlignage, toggle).

---

## 7. Décisions à trancher dans l'étude de design (`01`)

1. **Surlignage de l'évidence** : phrase entière vs heuristique intra-phrase vs hybride.
2. **Déclenchement & positionnement** : délai, ancre, scope, clavier/tactile.
3. **Structure & hiérarchie** de la fiche (multi-catégories, niveau, définition, thème).
4. **Couleurs & sévérité** : encodage couleur+glyphe, intensité, daltonisme.
5. **Animation & micro-interactions**.
6. **Espaces, typographie, layout** (densité, dimensions, rythme).
7. **Ergonomie, accessibilité, états** (passif vs épinglable, a11y, états vides/multiples).

Chacune fait l'objet de **3 options analysées** (forces / faiblesses / pertinence) puis
d'une **recommandation finale argumentée** dans `01`, synthétisées en proposition unique
dans `02_proposition_finale.md`.
