# Dossier technique — InjusticeLens (survol clause abusive)

> Mise en œuvre de `02_proposition_finale.md`. Frontend uniquement : la donnée
> (`ReferenceLabel` par phrase) existe déjà côté backend/API. Zéro changement de schéma.

---

## 1. Architecture & flux de données

```
DocumentDetail.referenceLabels[]  (API, par phrase : {category, level, sentenceIndex})
        │
        ▼
useUnfairnessIndex(labels)  ──►  Map<sentenceIndex, UnfairnessMark[]>   (REFACTOR : tableau trié niveau ↓)
        │                                   │
        │ (dominant = marks[0])             │ (toutes les marques)
        ▼                                   ▼
overlay permanent (style phrase)     InjusticeLens (aperçu + fiche)
        │                                   │
        └── DocumentPanel / SentenceRow : la marque devient déclencheur (hover + clic/clavier)
                                            │
                            ┌───────────────┴───────────────┐
                            ▼                               ▼
                  unfairnessMeta.ts                 highlightEvidence(text, cats)
            (définitions, sévérité, thèmes,         (pur : segments + repères mots-clés)
             lexique de repérage)
```

**Aucune mutation, aucune écriture** : lecture seule. Pas de backend, pas de store
persistant (un état local d'épinglage dans DocumentPanel suffit).

---

## 2. Modules & fichiers

### 2.1 `src/lib/unfairnessMeta.ts` (NOUVEAU — pur, testable)
Source de vérité métier (aujourd'hui éparse : tokens = code+couleur seulement).
```ts
export interface UnfairnessCategoryMeta {
  code: UnfairnessCategory;          // A | CH | CR | J | LAW | LTD | TER | USE
  label: string;                     // "Limitation de responsabilité"
  sense: string;                     // "Clause qui limite/exclut la responsabilité…"
  relatedThemes: string[];           // codes de thèmes liés (indicatif)
  keywords: RegExp;                  // repérage intra-phrase (indicatif)
}
export const UNFAIRNESS_META: Record<UnfairnessCategory, UnfairnessCategoryMeta>;

export interface SeverityMeta {
  level: 1 | 2 | 3;
  label: string;                     // "Clairement injuste"
  tone: "low" | "mid" | "high";      // → classes sémantiques (emerald/amber/rose)
  icon: "shield-check" | "alert-triangle" | "shield-alert";
}
export const SEVERITY_META: Record<1|2|3, SeverityMeta>;
```
- `relatedThemes` : A→[ARBITRATION_DISPUTES] ; J,LAW→[GOVERNING_LAW] ;
  LTD→[LIMITATION_LIABILITY, WARRANTY_DISCLAIMER] ; TER→[TERMINATION] ;
  CH→[MODIFICATION_OF_TERMS] ; CR→[USER_CONTENT, ACCEPTABLE_USE] ; USE→[PREAMBLE_SCOPE].
- `keywords` (indicatif) : A→/arbitrat|binding arbitration/i ; TER→/terminat|suspend/i ;
  LTD→/(not|no).{0,4}liable|liability|disclaim|as is|warrant/i ; CH→/modify|change|amend/i ;
  CR→/remove|delete|block|take down/i ; J→/jurisdiction|courts? of/i ;
  LAW→/governed by|laws? of/i ; USE→/by using|continued use|accept.*by using/i.

### 2.2 `src/lib/highlightEvidence.ts` (NOUVEAU — pur, testable)
```ts
export interface Segment { text: string; mark: boolean }
// Découpe `text` en segments ; marque (indicatif) les fragments matchant les keywords
// des catégories présentes. Insensible casse, non destructif, sûr (échappe la regex globale).
export function highlightEvidence(text: string, categories: UnfairnessCategory[]): Segment[];
```
Rendu : `<mark>` ambre pointillé sur `mark:true`, texte nu sinon. Si aucun match →
1 segment `mark:false` (toute la phrase reste surlignée par le conteneur).

### 2.3 `src/components/workspace/useUnfairness.ts` (REFACTOR)
- Nouvelle fonction `useUnfairnessMarks(labels): Map<number, UnfairnessMark[]>` — conserve
  **toutes** les marques d'une phrase, **triées par niveau ↓** (puis catégorie pour
  déterminisme). `UnfairnessMark` gagne `sense`, `relatedThemes` (via meta).
- `useUnfairnessIndex` conservé (compat overlay) OU dérivé : `dominant = marks[0]`.
  `unfairnessStyle(dominant)` inchangé pour l'overlay permanent.

### 2.4 `src/components/workspace/InjusticeLens.tsx` (NOUVEAU)
Deux rendus, un composant :
- **Aperçu** (prop `mode="preview"`) : `role="tooltip"`, `pointer-events-none`,
  `fixed z-40 max-w-sm animate-fade-in rounded-lg border border-line bg-elevated p-3
  shadow-xl`, positionné par `useAnchoredPosition(x,y)`. Contenu : en-tête sévérité max +
  puces de catégories + « cliquez pour les détails ».
- **Fiche épinglée** (prop `mode="pinned"`) : `role="dialog" aria-modal aria-label`,
  `fixed z-50 max-w-sm max-h-[70vh] overflow-auto rounded-xl border border-line bg-elevated
  p-3.5 shadow-2xl`, Échap + clic-extérieur + focus initial (patron `BoundaryEvidence`).
  Anatomie complète (`02` §2) : en-tête, cartes par catégorie (badge sévérité glyphe+jauge,
  sens, thèmes), évidence surlignée (`highlightEvidence`), rappel pédagogique.
- Sous-composants internes : `SeverityBadge` (glyphe + N# + libellé + jauge ●●●),
  `CategoryCard`, `Gauge` (3 segments). Couleurs via `getUnfairnessToken`/`SEVERITY_META`/
  classes sémantiques ; `readableTextColor` si fond plein. **Zéro hex en dur.**

### 2.5 `src/components/workspace/DocumentPanel.tsx` (INTÉGRATION)
- Remplacer le `Map` dominant par `marksBySentence` (via `useUnfairnessMarks`).
- La `<span className="unfairness-mark">` devient le **déclencheur** :
  `tabIndex={0}`, `role="button"`, `aria-haspopup="dialog"`, `cursor-help`,
  `onMouseEnter/Leave` (aperçu, délai ~350 ms), `onClick` + `onKeyDown` (Entrée/Espace →
  épingle), `data-testid="unfairness-${index}"` conservé. Retirer l'attribut `title` natif
  (remplacé par la loupe ; garder un `aria-label` court).
- État local : `injusticeHover {index,x,y}` (timer) et `injusticePinned {index,x,y}`.
- Surlignage de l'évidence : quand une phrase est survolée/épinglée, son texte est rendu
  via `highlightEvidence` dans la fiche (et un `ring-1 ring-amber-300/50` sur la marque).
- Rendu de `<InjusticeLens>` au niveau du panel (comme `RationaleHover`).
- **Priorité hover** : sur une phrase marquée, ne pas déclencher `RationaleHover` au survol
  de la marque (la loupe prime).

### 2.6 `src/mocks/fixtures.ts` + `handlers.ts` (TESTS)
Ajouter à `FITBIT_REFERENCE_LABELS` une phrase **multi-catégories** (ex. LTD N3 + A N2 sur
le même `sentenceIndex`) pour tester la liste multi + la sévérité max + le tri.

---

## 3. Plan de tests

### Vitest (unitaires, purs & composant)
- `tests/unfairnessMeta.test.ts` : meta complète (8 catégories, sens, thèmes), SEVERITY_META
  (3 niveaux, tone/icon), keywords matchent des exemples connus.
- `tests/highlightEvidence.test.ts` : segments corrects (match/no-match), insensible casse,
  multi-catégories, texte sans match → 1 segment, échappement sûr.
- `tests/useUnfairness.test.ts` (étendu) : `useUnfairnessMarks` conserve **toutes** les
  marques d'une phrase, triées par niveau ↓ ; `dominant` = plus sévère (non-régression overlay).
- `tests/injusticeLens.test.tsx` : rendu aperçu (sévérité max, puces) ; rendu fiche (1 carte
  par catégorie triée, badge glyphe+libellé+jauge, sens, thèmes, évidence surlignée, rappel) ;
  a11y (role tooltip/dialog) ; état 1 vs multi catégories.

### Playwright (e2e — étend `unfairness-overlay.spec.ts` ou nouveau `injustice-lens.spec.ts`)
- survol d'une marque → aperçu visible (sévérité + catégorie) ;
- clic sur la marque → fiche épinglée visible, contenu complet (cartes, évidence surlignée),
  fermeture Échap/clic-extérieur ;
- phrase multi-catégories → plusieurs cartes ;
- toggle `toggle-unfairness` OFF → plus de marque → plus de loupe ;
- non-régression : `title`/overlay (adapter le test existant au nouveau `aria-label`).

### MSW
Données multi-catégories (cf. 2.6) pour alimenter les e2e/vitest composant.

---

## 4. Plan de développement (séquencé)

1. `unfairnessMeta.ts` + test. 2. `highlightEvidence.ts` + test. 3. Refactor
`useUnfairness` (`useUnfairnessMarks`) + test (+ non-régression overlay). 4. `InjusticeLens.tsx`
+ test composant. 5. Intégration `DocumentPanel` (déclencheur + état + rendu + priorité hover).
6. Fixtures/MSW multi-catégories. 7. e2e. 8. tsc + vitest + e2e verts. 9. revue
adversariale. 10. commit + déploiement (gate).

---

## 5. Risques & parades

| Risque | Parade |
|---|---|
| Repère mots-clés trompeur (faux vérité terrain) | étiquette « indicatif, non vérifié » + style pointillé distinct |
| Conflit hover (Rationale vs Lens) | la loupe prime sur la marque ; Rationale ailleurs |
| Régression overlay (multi-marks) | `dominant = marks[0]`, test de non-régression |
| a11y (2 rôles ARIA) | patrons éprouvés (RationaleHover=tooltip, BoundaryEvidence=dialog) |
| Perf survol | `highlightEvidence` lazy + mémoïsé par phrase |
| Hex en dur (charte) | tokens + classes sémantiques + lint visuel à la revue |
