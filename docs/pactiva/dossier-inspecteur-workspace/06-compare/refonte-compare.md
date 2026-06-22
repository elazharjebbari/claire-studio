# Refonte du mode Comparer — bandeau N-way + barre de divergences sticky

> Axe 7 des besoins (`01-besoins/besoins.md:47-52`). Décision arrêtée : le `ComparePanel`
> est **déjà N-way** (Mistral inclus) ; il faut **corriger le bandeau pairwise → N-way**
> via `agreementNway` dans `lib/llmAgreement.ts`, **rendre la barre de divergences
> sticky** (toujours à l'écran), et **déprécier le pairwise** de `lib/divergence.ts`.
> Source d'audit : `00-audit/audit-uiux.json` (axe `compare`, lignes 484-569, verdict
> `sound: true`).

## 1. État réel : ce qui marche déjà, ce qui ment

Point essentiel pour ne pas refaire ce qui existe : **le panneau latéral `ComparePanel`
est déjà entièrement N-way**, Mistral compris, et testé (`tests/compareNway.test.ts`).

- `agreementSegments(byIndexList, judgeCount, n)` accepte N juges quelconques et produit
  un statut `agree` / `diverge` / `partial` par tranche (`ComparePanel.tsx:47-66`).
- Un `JudgeRail` est rendu **par juge sélectionné** (`:271-280`), largeur `w-96` si ≥3
  juges, `w-72` sinon (`:161-162`).
- Les ancres de conflit viennent de `conflictZones` **N-way** (`:148-151`, `runs.ts:188-212`).
- Côté `DocumentPanel`, la sélection suit la réglette « Modèles » :
  `selectedCompareIds` (`:274-280`), `compareJudgesData` (`:281-290`),
  `compareDataReady = availableCompareJudges.length >= 2` (`:292`), `divAnchors` via
  `conflictZones(compareJudgesData…)` (`:296-303`).

Le retard n'est donc **pas** dans le moteur de comparaison, mais dans trois points
périphériques :

| # | Problème | Ancre | Gravité |
|---|----------|-------|---------|
| 1 | **Bandeau `compare-banner` figé pairwise** : texte « Accord Claude / Codex » en dur, score `llm.kappa`/`llm.agreementPct` qui ne calculent QUE Claude↔Codex | `DocumentPanel.tsx:518-539,524-528` ; `hooks.ts:307-308,318` ; `llmAgreement.ts:96-123` | major |
| 2 | **Sticky à moitié fait** : `DivergenceNav` est sticky (`top-[3.25rem]`), mais le `compare-banner` juste au-dessus ne l'est pas → le score d'accord défile et disparaît | `DivergenceNav.tsx:30` vs `DocumentPanel.tsx:519-522` (`mb-4`, aucun sticky) | major |
| 3 | **Pairwise mort/incohérent** : `lib/divergence.ts` (`isDivergent`/`divergenceIndices`/`divergenceSegments`/`divergenceAnchors`) est strictement Claude/Codex et n'est plus importé que par ses tests | `divergence.ts:23-76` ; navigation réelle via `conflictZones` (`DocumentPanel.tsx:296-303`) | major |
| 4 | Légende du bandeau incomplète (`accord`/`divergence` seulement, pas `partiel` alors que le strip le rend) | `DocumentPanel.tsx:530-537` vs `ComparePanel.tsx:283-296` | minor |
| 5 | Doublon de nav : `compare-divergence-*` interne au panneau (`ComparePanel.tsx:196-232`) duplique `DivergenceNav` | `:196-232` vs `DocumentPanel.tsx:541-548` | minor |
| 6 | Panneau masqué sous `xl` (`hidden … xl:block`) → rails N-way perdus sur écran moyen | `DocumentPanel.tsx:835` | minor |
| 7 | Wording résiduel « Claude/Codex » sur le toggle | `DocumentPanel.tsx:446` | minor |
| 8 | Pas de mesure d'accord N-way honnête (ni Fleiss-κ, ni % « tous d'accord » sur N) | `llmAgreement.ts` (seulement `cohenKappa` 2 raters) | info |

### Le bandeau est la régression la plus visible

`llm.kappa`/`llm.agreementPct`/`llm.support` viennent de `useLlmAgreement` qui appelle
`agreement(toJudge(claudePre), toJudge(codexPre), n)` — **strictement deux juges**
(`hooks.ts:307-308,318`). Donc si l'utilisateur compare Claude + Mistral (sans Codex) ou
les trois, le bandeau affiche un κ Claude/Codex **sans aucun rapport** avec les modèles
réellement comparés. C'est un chiffre faux affiché avec autorité.

## 2. Options comparées

| Option | Principe | Forces | Faiblesses | Ergonomie | Effort |
|--------|----------|--------|------------|-----------|--------|
| **A — Patch minimal** | Bandeau dynamique (liste des modèles comparés) + sticky corrigé, sans toucher au moteur | Effort faible ; zéro risque sur la logique N-way du panneau ; lève l'incohérence la plus visible | Score reste pairwise (κ Claude/Codex) : à masquer si N≠2 ou rester trompeur ; `divergence.ts` reste mort ; pas de κ N-way | Bon, réutilise tokens/`data-testid` | **S** |
| **B — Unifier le moteur** ✅ | Une seule source de divergence (`conflictZones` N-way) ; `agreementNway()` (concordance globale + Fleiss-κ) ; barre sticky fusionnée bandeau+compteur ; pairwise déprécié | Score juste pour 2 OU N juges ; barre sticky unique ; légende complète ; supprime le doublon ; supprime le code mort | Touche `hooks`/`lib`/tests (migration `divergence.test.ts`) ; Fleiss-κ à implémenter+tester ; re-tester nav `n`/`p` | Très bon : barre sticky unique, score honnête, légende cohérente avec le strip | **M** |
| **C — Refonte interaction + arbitrage N-modèles** | Sur B : adopter au clavier la proposition de n'importe quel juge (touches 1..N), `InspectorJudgeCompare`/`adoptAtFocus` généralisés, chips de thème en conflit dans la barre, panneau en drawer < xl | Excellent à terme ; arbitrage complet N-modèles | Effort élevé ; surface de test large ; dépasse le strict besoin « N-way + sticky » ; risque d'over-engineering si <3 juges en pratique | Excellent mais hors périmètre immédiat | **L** |

**Choix retenu : option B**, avec **A comme premier commit de sécurité** (bandeau N-way
+ sticky d'abord, à livrer seul) et **C planifiée ensuite** (arbitrage 1..N). Le
`ComparePanel` étant déjà N-way et testé, B corrige exactement les trois vrais retards
(bandeau pairwise, sticky à moitié, double notion de divergence) sans sur-ingénierie. Le
verdict valide `sound: true` (`audit-uiux.json:566-568`) avec des reformulations de
cadrage reprises ci-dessous.

## 3. Détails d'implémentation

### 3.1 — `agreementNway()` dans `lib/llmAgreement.ts` (fonction pure)

Ajouter une fonction pure, alimentée par les projections déjà construites
(`compareJudgesData[].byIndex`, `DocumentPanel.tsx:281-290`) :

```ts
export interface NwayAgreement {
  /** % de phrases où TOUS les juges présents partagent le même thème (agree + partial). */
  fullAgreementPct: number;
  /** κ de Fleiss sur les labels de thème par phrase (catégories = thèmes + sentinelle ABSENT). */
  fleissKappa: number;
  /** Phrases couvertes par ≥ 1 juge (dénominateur honnête). */
  support: number;
}

export function agreementNway(byIndexList: (string | null)[][], n: number): NwayAgreement {
  // support = phrases couvertes par ≥1 juge ;
  // fullAgreementPct = % de phrases où Set(thèmes présents).size === 1 (réutilise la
  //   logique de agreementSegments : statut 'agree' OU 'partial') ;
  // fleissKappa = κ de Fleiss sur les labels par phrase, catégories = thèmes + ABSENT.
  …
}
```

Notes de conception (verdict) :
- La **sentinelle `ABSENT`** existe déjà (`llmAgreement.ts:41`) — la réutiliser pour
  marquer « phrase non couverte par ce juge » comme catégorie à part dans Fleiss-κ.
- **Garder `agreement()` 2-juges** pour rétro-compatibilité (le bandeau l'utilise
  aujourd'hui, et `useLlmAgreement` le ré-expose). On ajoute, on ne supprime pas.
- **Extraction propre de la logique partagée** : `agreementSegments` vit aujourd'hui
  dans `ComparePanel.tsx` (un `.tsx` de composant). Pour que `agreementNway` réutilise
  sa logique sans importer un composant, **déplacer `agreementSegments` vers `lib/`**
  (p. ex. `lib/llmAgreement.ts` ou `lib/agreement.ts`) et la ré-exporter depuis
  `ComparePanel` pour ne pas casser `tests/compareNway.test.ts` (qui importe
  `agreementSegments` depuis `@/components/workspace/ComparePanel`). Le verdict signale
  cette tension (`audit-uiux.json:568`, point 5) : c'est la voie la plus propre.

Fleiss-κ (rappel) : pour chaque phrase i, `n_ij` = nombre de juges ayant attribué la
catégorie j ; `P_i = (Σ_j n_ij² − N) / (N(N−1))` (N = nb de juges) ; `P̄ = moyenne des
P_i` ; `P̄_e = Σ_j p_j²` (p_j = proportion globale de la catégorie j) ;
`κ = (P̄ − P̄_e) / (1 − P̄_e)`. Sur 2 juges, Fleiss-κ coïncide avec Cohen-κ non pondéré :
cohérence garantie avec l'affichage actuel quand N=2.

Tester dans un **nouveau** `tests/llmAgreementNway.test.ts` : 3 juges tous d'accord →
`fullAgreementPct=100`, `fleissKappa=1` ; un conflit → `fullAgreementPct<100` ;
couverture partielle comptée dans le support. (Note : la docstring `llmAgreement.ts:3`
cite `tests/llmAgreement.test.ts` qui n'existe pas — il n'y a donc pas de fichier modèle,
on en crée un.)

### 3.2 — Bandeau `compare-banner` N-way (`DocumentPanel.tsx:518-539`)

```tsx
const nway = useMemo(
  () => agreementNway(compareJudgesData.map((j) => j.byIndex), n),
  [compareJudgesData, n],
);
const compareLabels = compareJudgesData.map((j) => j.label).join(" / ");
```

- Titre : `Accord ${compareLabels}` (plus de « Claude / Codex » en dur). Avec 1 seul
  juge sélectionné, le bandeau ne s'affiche pas (cas `compareDataReady`/sélection ≥2).
- Score : `κ (Fleiss) {nway.fleissKappa.toFixed(2)} · {Math.round(nway.fullAgreementPct)}%
  tous d'accord ({nway.support} phrases)`. Honnête pour 2 OU N juges.
- **Légende complétée** avec `partiel` (slate `#64748B`) en plus d'`accord`/`divergence`,
  pour matcher `STATUS_COLOR` du strip (`ComparePanel.tsx:68-72`). (Le verdict précise
  bien que c'est le **banner** qui manque `partiel`, pas le panneau — `:568` point 2.)
- Conserver `data-testid="compare-banner"` et `data-testid="compare-score"`.

### 3.3 — Barre de divergences **sticky** et unifiée (B7.2)

Aujourd'hui le conteneur scrollable central est `ResizablePanels.tsx:154` (`<section
… overflow-y-auto>`), et `document-controls` est `sticky top-0 z-20`
(`DocumentPanel.tsx:390`). `DivergenceNav` compense ce chrome avec un offset magique
`top-[3.25rem]` (`DivergenceNav.tsx:30`) ; le `compare-banner`, lui, n'a **aucun** sticky.

Solution retenue : **fusionner `compare-banner` + `DivergenceNav` en UN seul bloc
sticky** — un composant `CompareStickyHeader` regroupant `{score N-way + navigation des
divergences}` dans un seul conteneur `sticky top-[3.25rem] z-10 backdrop-blur` (juste
sous `document-controls`). Avantages :

- La barre de divergences reste **toujours à l'écran** quand le mode comparer est actif
  (exigence B7.2) — score d'accord ET compteur k/N visibles en permanence.
- On supprime la fragilité du double offset (un seul bloc à positionner sous le chrome
  sticky, plus de chevauchement possible bandeau↔nav).
- Le bloc est sticky **par rapport au conteneur scrollable central** (`ResizablePanels`
  `<section overflow-y-auto>`), comme l'est déjà `document-controls`.

Props du nouveau header :

```ts
interface CompareStickyHeaderProps {
  labels: string[];                                  // modèles comparés
  nway: { fleissKappa: number; fullAgreementPct: number; support: number };
  divCount: number;                                  // = divAnchors.length
  divOrdinal: number;                                // = divOrdinal
  onPrev: () => void;                                // = goPrevDivergence
  onNext: () => void;                                // = goNextDivergence
}
```

**Préserver les `data-testid`** de la nav pour ne pas casser les e2e :
`divergence-nav`, `divergence-counter`, `divergence-prev`, `divergence-next`
(`DivergenceNav.tsx:27,34,41,49`). Concrètement, `CompareStickyHeader` peut **réutiliser**
`DivergenceNav` à l'intérieur (en lui retirant son `sticky`/`mb-4` propres, désormais
portés par le conteneur parent) et lui adjoindre la ligne de score N-way. Conserver aussi
`compare-banner`/`compare-score` sur la partie score.

`top-[3.25rem]` reste justifié tant que `document-controls` mesure ~3.25rem
(`sticky top-0 z-20`, `:390`). On documente la dépendance ; si le chrome change de
hauteur, l'offset se règle au même endroit (un seul point désormais).

### 3.4 — Déprécier le pairwise de `lib/divergence.ts` (#3)

Reformulation du cadrage (verdict, `:568` point 1) : il n'y a **pas** deux notions de
divergence vivantes. `isDivergent`/`divergenceIndices`/`divergenceSegments`/
`divergenceAnchors` sont **déjà mortes** dans l'app — importées **nulle part** hors
`tests/divergence.test.ts`. `DocumentPanel`/`ComparePanel` n'importent que
`divergenceOrdinal`/`nextDivergence`/`prevDivergence` (agnostiques, N-way-safe). La vraie
duplication vivante est `agreement()` 2-juges (bandeau) vs `conflictZones` N-way —
résolue par §3.1/§3.2.

Action : **supprimer** les quatre fonctions pairwise de `divergence.ts` (ou les ré-exprimer
via `conflictZones` pour une source unique) et **conserver**
`nextDivergence`/`prevDivergence`/`divergenceOrdinal`. **Migrer `tests/divergence.test.ts`**
(`:3-7` importe les fonctions supprimées) : déplacer les cas pairwise vers
`tests/compareNway.test.ts` (déjà la maison du N-way) ou les retirer, et ne garder dans
`divergence.test.ts` que les tests de navigation (`next`/`prev`/`ordinal`). Sans risque :
suppression de code mort.

### 3.5 — Doublon de nav (#5)

Quand le panneau est ouvert ET le mode comparer actif, `compare-divergence-nav`
(`ComparePanel.tsx:196-232`) et la barre sticky font double emploi. Retirer la nav interne
du panneau (`:196-232`), OU ne la garder que lorsque le panneau est le **seul** moyen de
navigation visible (cas < xl, cf. #6). La signature de props de `ComparePanel`
(`{judges, n, focused, onJump, onClose}`, `:128-141`) **ne change pas** — on retire un
bloc interne. (Le verdict note la nuance, `:568` point 4 : la signature est intacte mais
le composant est bien modifié.)

### 3.6 — Wording (#7)

`DocumentPanel.tsx:446` : `title="Panneau comparatif Claude/Codex — g"` →
`title="Comparer les modèles sélectionnés — g"`.

### 3.7 — Panneau disponible sous `xl` (#6, optionnel dans le lot B)

`DocumentPanel.tsx:835` : `sticky top-4 hidden h-[calc(100vh-9rem)] self-start xl:block`.
Retirer `hidden … xl:block` au profit d'un **drawer/over-panel** sur petits écrans pour
ne pas perdre les rails N-way < xl. À traiter en fin de lot B ou début de lot C selon le
budget ; ne bloque pas la correction bandeau+sticky.

### 3.8 — Étape C (planifiée, hors lot immédiat)

Généraliser l'arbitrage : `adoptAtFocus(judgeId: string)` au lieu de
`'claude'|'codex'` figé (`DocumentPanel.tsx:315-321`) ; touches **1..N dynamiques** dans
`useDivergenceShortcuts` (aujourd'hui 1/2 = Claude/Codex en dur, `:61-70`) ; `Source`
N-modèles dans `InspectorJudgeCompare` en bouclant sur `LLM_JUDGES` (aujourd'hui type
figé `'human'|'claude'|'codex'`, `:17`). `preByJudge` expose déjà tout le nécessaire
(`hooks.ts:311-312`). Cohérent avec la décision 3 (inspecteur 2 lots) — l'arbitrage
N-modèles de l'inspecteur relève de ce chantier.

## 4. Impacts

### Frontend
- `lib/llmAgreement.ts` — ajout `agreementNway()` + `NwayAgreement` ; accueil de
  `agreementSegments` déplacée depuis `ComparePanel` (extraction lib).
- `ComparePanel.tsx` — ré-exporte `agreementSegments` (compat tests) ; retrait de la nav
  interne `compare-divergence-*` (#5). Signature de props inchangée.
- `DivergenceNav.tsx` — perd son `sticky`/`mb-4` propres (portés par le parent) ;
  réutilisé tel quel dans `CompareStickyHeader`. `data-testid` conservés.
- `DocumentPanel.tsx` — nouveau `CompareStickyHeader` (fusion bandeau+nav, sticky) ;
  `nway`/`compareLabels` mémoïsés ; wording toggle (#7) ; panneau < xl (#6, optionnel).
- `lib/divergence.ts` — suppression du pairwise mort (#4) ; conserve nav agnostique.
- `lib/api/hooks.ts` — `useLlmAgreement` peut conserver `agreement()` 2-juges (rétro-compat
  insights/admin) ; le bandeau N-way n'en dépend plus. Optionnel : exposer aussi un
  agrégat N-way si d'autres surfaces en ont besoin.
- `useDivergenceShortcuts.ts` / `InspectorJudgeCompare.tsx` — **étape C** (1..N
  dynamiques), pas dans le lot B.

### Backend / data
**Aucun.** Les pré-annotations N-modèles sont déjà disponibles
(`useLlmAgreement.preByJudge`, `hooks.ts:311-312`) ; `LLM_JUDGES` inclut déjà Mistral
(`llmJudges.ts:24`). Le seul « manque » est l'agrégat `agreementNway` calculé **côté
front**. Aucune route ni champ backend (`audit-uiux.json:564`).

### Accessibilité
- `CompareStickyHeader` garde `role="navigation"` + `aria-label` de `DivergenceNav`, et
  `role="status"` sur la partie score (annonce du changement de modèles comparés / κ).
- Barre sticky : ne pas masquer le contenu sous-jacent au clavier — le focus des phrases
  doit rester accessible (la barre est au-dessus du flux, pas en overlay capturant).
- Légende `accord`/`divergence`/`partiel` : ne pas reposer sur la seule couleur —
  conserver le libellé textuel à côté de chaque pastille (déjà le cas).
- `prefers-reduced-motion` : `backdrop-blur` ok ; pas d'animation de scroll forcée.

### Performance
- `agreementNway` est `O(phrases × juges)` mémoïsé sur `[compareJudgesData, n]` :
  négligeable (≤3 juges, 139+ phrases). Recalculé seulement à changement de sélection.
- Fusionner bandeau+nav en un conteneur sticky **réduit** le nombre de couches sticky
  empilées (un seul bloc au lieu de deux) — neutre à positif côté repaint au scroll.

## 5. Tests

Non-régression (doivent rester verts) :
- `tests/compareNway.test.ts` — `agreementSegments` (3 juges agree, ≥2 thèmes diverge,
  couverture partielle, phrase non couverte). À préserver via la ré-export depuis
  `ComparePanel` après extraction lib.
- e2e divergence nav — `divergence-nav`/`divergence-counter`/`divergence-prev`/
  `divergence-next` conservés dans `CompareStickyHeader`.

À ajouter / migrer :
- `tests/llmAgreementNway.test.ts` (nouveau) — `agreementNway` : 3 juges d'accord →
  `fleissKappa=1`, `fullAgreementPct=100` ; conflit → `<100` ; cohérence N=2 vs Cohen-κ ;
  support = phrases couvertes par ≥1 juge.
- `tests/divergence.test.ts` — **migrer** : retirer les cas pairwise supprimés (`:3-7`),
  conserver `next`/`prev`/`ordinal`. Reverser les cas pairwise pertinents vers
  `compareNway.test.ts` si on veut garder une couverture de la sémantique de conflit.
- Sticky : un test (RTL ou e2e) vérifiant que `CompareStickyHeader` porte la classe
  `sticky` et reste rendu après scroll du conteneur central.

## 6. Reformulations de cadrage (verdict)

Trois points du libellé d'audit à corriger sans changer le plan (`audit-uiux.json:568`) :

1. « Coexistence de deux notions de divergence via `divergence.ts` » : **imprécis**. Le
   pairwise de `divergence.ts` est déjà **mort** (importé nulle part hors ses tests). La
   vraie duplication vivante est `agreement()` 2-juges vs `conflictZones` N-way. La
   dépréciation est donc **sans risque** (juste migrer `divergence.test.ts`).
2. « Compléter la légende avec partiel » : viser le **`compare-banner`** (qui n'a
   qu'`accord`/`divergence`), **pas** le panneau (qui a déjà les trois,
   `ComparePanel.tsx:283-296`).
3. « ComparePanel n'a pas besoin de changer » : sa **signature de props** ne change pas,
   mais le composant est modifié (retrait nav interne, et < xl). Pas une contradiction,
   juste une précision.
