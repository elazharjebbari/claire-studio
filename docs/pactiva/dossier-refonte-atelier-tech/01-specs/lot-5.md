# Lot 5 · Menu contextuel express (retrait LLM)

**Estimation** : M — Le cœur (retirer la section LLM + réordonner + tokeniser + relucider) est mécanique et localisé à un seul composant, sans toucher au store ni à l'API. Ce qui pousse vers M plutôt que S : (1) la mise à jour de 3 specs e2e qui dépendent explicitement du bloc LLM (document-ux, llm-compare, theme-multipicker) avec re-câblage de l'adoption sur le chemin clavier ; (2) la gestion fine du repli/focus a11y (Disclosure éventuellement non livrée → repli local propre) ; (3) la préservation chirurgicale des types exportés et des indices discrets pour ne pas casser BoundaryEvidence/RationaleHover/Compare. Pas de L : aucune migration de données, aucun nouveau flux, primitives largement réutilisées. · **Dépendances** : Lot 0 (Garde anti-hex + lint token-only + tokens sémantiques) : prérequis pour que bg-success/warning soient validés par la CI. Les tokens sont déjà exposés dans tailwind.config.ts (vérifié), donc ce lot peut avancer même si la garde CI complète n'est pas finalisée — mais idéalement Lot 0 livré avant., Primitive <Disclosure> (fondation transverse) : ABSENTE du repo à ce jour. Dépendance souple — si non livrée, repli local toggle aria-expanded/aria-controls tokenisé, à remplacer ensuite. Préférer la primitive livrée avant pour éviter la dette., Indépendant du Lot 'États des boutons' (Button state-machine) : Valider/Traduire peuvent être tokenisés directement sans attendre les variantes success/danger de <Button> ; migration ultérieure vers <Button variant=success/danger> = suivi cosmétique non bloquant., Pas de dépendance sur Lot Inspecteur ni Lot Arbitrage C1→C5 : l'arbitrage LLM retiré du menu vit déjà ailleurs (clavier 1/2, œil de frontière, Compare), surfaces en place AUJOURD'HUI ; ce lot ne crée pas de trou fonctionnel nécessitant l'inspecteur refondu au préalable.

## Objectif technique

Transformer le SentenceMenu (clic-droit / long-press) d'inspecteur miniaturisé en menu contextuel express. Concrètement : (1) RETIRER la section « Propositions LLM » (l'accord/divergence, les cartes JudgeBlock par juge et les boutons « Choisir <juge> » d'adoption) du menu — l'arbitrage LLM reste disponible ailleurs (survol RationaleHover, œil de frontière BoundaryEvidence, raccourcis clavier 1/2 → adoptAtFocus, mode Compare) ; (2) mettre le geste dominant au premier plan (poser/changer le thème PRINCIPAL en un clic + Valider) et REPLIER le reste (grille complète multi-label, CertaintyPicker) derrière une révélation progressive (Disclosure « Plus d'options ») ; (3) tokeniser tous les états couleur (emerald-400/amber-400 bruts → bg-success/warning + glyphe), remplacer les emojis Unicode (✕ ✓ ◷ 🙈 🌐) par des icônes Lucide aria-hidden avec sens porté par le libellé ; (4) borner la hauteur et fiabiliser la collision/tactile. Les indices LLM DISCRETS (micro-initiales judgeHints dans ThemeMultiPicker) sont CONSERVÉS — ce ne sont pas le « bloc Propositions LLM », ils restent un guide passif non intrusif. Aucune logique métier du store ne change : on change l'ordre, la saillance et le repli. Les types exportés JudgeDetail/JudgeEntry et la prop `judges` ne sont PAS supprimés du fichier (consommés par BoundaryEvidence/DocumentPanel) ; seul leur RENDU dans le menu disparaît.

## Composants touchés

| Fichier | Nature du changement |
| --- | --- |
| frontend/src/components/workspace/SentenceMenu.tsx | Refonte principale. RETIRER entièrement la section (b) « Propositions LLM » (lignes ~227-263 : <section data-testid="menu-llm">, le bloc multiPresent/allAgree avec data-testid=llm-agreement, le judges.map(JudgeBlock) avec menu-llm-<id>/-adopt/-toggle) et le composant interne JudgeBlock (lignes ~287-375) DEVENU mort. CONSERVER les interfaces exportées JudgeDetail/JudgeEntry (réimportées par BoundaryEvidence/DocumentPanel) et la prop `judges` (utilisée désormais seulement pour alimenter judgeHints des micro-initiales). Réorganiser la section (a) Annoter : niveau de repos = (i) raccourci 1-clic du thème principal suggéré (data-testid menu-primary-suggest ; heuristique : thème courant si déjà annoté, sinon consensus LLM unanime via judgeHints, sinon rien), (ii) bouton Valider/Dévalider promu au premier plan. REPLIER la grille ThemeMultiPicker complète + CertaintyPicker sous une <Disclosure> « Plus d'options / Multi-label » (data-testid menu-more-options) ; règle d'ouverture : grille visible si coveringDraft existe, repliée sinon. Retirer la notice d'aide permanente du titre. Tokeniser le bouton Valider (border-success/bg-success/10/text-success si validé ; border-warning/bg-warning/10/text-warning si à valider) et remplacer ✓/◷ par lucide Check/Clock aria-hidden. Tokeniser/relucider Traduire (🌐→Languages, 🙈→EyeOff). Remplacer ✕ du header par lucide X. Réduire max-h ~88vh→70vh. Conserver TOUS les data-testid restants : sentence-menu, theme-multipicker, menu-validate, menu-translate, certainty-picker. |
| frontend/src/components/workspace/DocumentPanel.tsx | Aucun changement de logique requis : le mapping `judges={LLM_JUDGES.map(...)}` (lignes ~1194-1204) reste valide car SentenceMenu garde la prop `judges` (alimente judgeHints). Laisser intact tout le plumbing LLM (detailAt/runsByJudge/detailMapByJudge/resolveDivergenceRange/adoptAtFocus) : il sert toujours RationaleHover, l'œil de frontière, le mode Compare et l'adoption clavier 1/2. Aucune référence au testid menu-llm ici (vérifié : aucune). |
| frontend/src/components/workspace/BoundaryEvidence.tsx | Aucun changement de code. Vérification seule : l'import `import type { JudgeEntry, JudgeDetail } from "./SentenceMenu"` doit continuer de résoudre — ces types restent exportés depuis SentenceMenu (contrainte forte sur le refactor). |
| frontend/e2e/document-ux.spec.ts | Mettre à jour le test « le clic-droit ouvre le menu de phrase avec le bloc LLM » (lignes ~30-37) : RETIRER `expect(menu-llm).toBeVisible()`, ajouter `expect(menu-llm).toHaveCount(0)`. Conserver sentence-menu visible, menu-translate visible, fermeture Échap. Renommer le test. |
| frontend/e2e/llm-compare.spec.ts | Mettre à jour « arbitre une divergence via le menu » (lignes ~42-52) : l'adoption ne passe plus par menu-llm-claude-adopt. Réécrire vers le chemin survivant clavier : clic sentence-1 + keyboard.press('1') → resolved-1[data-judge=claude] (déjà prouvé lignes 54-62). Renommer en « arbitre une divergence au clavier ». Le test viewport (lignes 102-115) reste valide. |
| frontend/e2e/theme-multipicker.spec.ts | Vérifier/adapter : si les tests cliquent theme-option-* dans le menu (lignes ~17-50) et que la grille est désormais repliée (cas non annoté), ajouter l'ouverture du pli (clic menu-more-options) avant d'atteindre la grille, OU s'appuyer sur la règle 'grille visible si déjà annoté'. Aligner le spec sur la règle retenue. |


## Store / données / types

- AUCUN changement de store/types Zustand. Tous les mutateurs utilisés restent identiques : setBoundary, setClauseThemes, removeBoundary, selectClause, setCertainty, setValidated, setTranslated (sections (a)/(c) fonctionnellement inchangées).
- resolveDivergenceRange N'EST PLUS appelé depuis SentenceMenu (le bouton 'Choisir <juge>' disparaît) mais le mutateur RESTE dans le store : toujours invoqué par DocumentPanel.adoptAtFocus (raccourcis 1/2) et BoundaryEvidence (œil de frontière). Ne pas le supprimer.
- Heuristique 'thème principal suggéré' = logique de PRÉSENTATION pure (helper pur ou fonction interne), PAS un nouvel état de store : dérivée de coveringDraft.theme (si annoté) > consensus judgeHints unanime (depuis la prop `judges` déjà passée) > null. Ne PAS introduire d'état neuf en V1.

## API (backend / endpoints)

- AUCUN changement backend / endpoint. Le retrait du bloc LLM est purement front (rendu). Les données LLM (preByJudge) continuent d'être chargées par DocumentPanel pour le survol, l'œil de frontière, le mode Compare et les indices discrets — aucune route, serializer, ni mapping camelCase à toucher. drf-camel-case déjà respecté (anchorIndex, legalNature) et inchangé.

## Primitives nouvelles

- DÉPENDANCE et non création : <Disclosure> (frontend/src/components/ui/Disclosure.tsx) est une fondation transverse listée mais ABSENTE du repo à ce jour (vérifié : le fichier n'existe pas). Option (a) consommer la primitive si le lot fondation est livré avant (dépendance dure) ; option (b) repli local minimal : <button aria-expanded/aria-controls> + section conditionnelle tokenisée, à remplacer par <Disclosure> dès dispo. Pas de nouvelle primitive partagée créée dans ce lot.
- Helper pur OPTIONNEL suggestPrimaryTheme(coveringDraft, judges) (ex. frontend/src/lib/sentenceMenu.ts) : retourne le code de thème à proposer en raccourci 1-clic (thème courant > consensus LLM unanime > null). Pur, testable isolément ; peut rester interne au composant, mais l'externaliser facilite le test vitest.
- Pas de nouveau composant lourd : réutilisation de ThemeMultiPicker (grille multi-label), CertaintyPicker, useAnchoredPosition (collision déjà gérée : flip vertical/horizontal + clamp en place — pas d'extension requise, le bornage de hauteur suffit). Icônes Lucide réutilisées (Check, Clock, Languages, EyeOff, X) — aucune lib ajoutée.

## Plan de tests

### MSW (handlers / fixtures)
- Aucun nouveau handler réseau requis (rien d'API ne change). Réutiliser les fixtures LLM existantes (preByJudge Claude/Codex/Mistral) servies par les handlers workspace pour : (1) prouver que les indices discrets judgeHints subsistent, (2) tester l'ABSENCE de bloc menu-llm avec des juges PRÉSENTS (sinon le test ne prouve rien).
- Réutiliser la fixture de divergence (phrase couverte par 2 juges en désaccord) déjà utilisée par llm-compare pour vérifier qu'aucun llm-agreement/menu-llm n'est rendu même en divergence.

### Vitest (unitaire & composant)
- tests/sentenceMenu.test.tsx (NOUVEAU) : (1) sentence-menu présent ; (2) menu-llm ABSENT (queryByTestId === null) MÊME avec `judges` divergents ; (3) llm-agreement ABSENT ; (4) aucun menu-llm-<id>-adopt ; (5) menu-validate togglable (aria-pressed bascule, appelle setValidated) ; (6) menu-translate présent, icônes Languages/EyeOff, aria-pressed cohérent ; (7) grille theme-multipicker REPLIÉE par défaut quand non annoté, révélée au clic menu-more-options (aria-expanded) ; (8) menu-primary-suggest appelle setBoundary/onToggleTheme avec le bon code ; (9) ZÉRO classe emerald-/amber- en dur (assert className → bg-success/bg-warning) ; (10) aucun emoji Unicode porteur de sens (✓/◷/🌐/🙈/✕ absents du textContent).
- tests/sentenceMenu.test.tsx : heuristique suggestPrimaryTheme (si externalisée) — thème courant prioritaire ; sinon consensus LLM unanime ; sinon null ; multi-juges divergents → null.
- tests/components.test.tsx (MAJ) : retirer toute attente sur le bloc LLM si un test agrégé y rend SentenceMenu (grep : aucun test vitest ne référence menu-llm aujourd'hui, risque faible).

### Playwright (E2E / a11y)
- e2e/document-ux.spec.ts (MAJ) : clic-droit ouvre sentence-menu, menu-translate visible, menu-llm count 0, fermeture Échap OK.
- e2e/llm-compare.spec.ts (MAJ) : adoption d'une divergence via CLAVIER (focus sentence-1 + press '1' → resolved-1[data-judge=claude]) au lieu de menu-llm-claude-adopt ; test viewport (clic-droit sentence-30, bas ≤ viewport) reste vert.
- e2e/theme-multipicker.spec.ts (VÉRIFIER/MAJ) : ouvrir le pli menu-more-options avant d'atteindre theme-option-* si la grille est repliée, OU s'appuyer sur la règle 'grille visible si déjà annoté'.
- e2e/a11y.spec.ts (VÉRIFIER) : passer axe sur le menu ouvert — aria-expanded/controls sur le pli, focus-visible, contraste AA des états success/warning en clair ET sombre.

## Risques & pièges

- RÉGRESSION E2E DURE : document-ux.spec.ts (ligne 33 `menu-llm visible`) et llm-compare.spec.ts (ligne 47 `menu-llm-claude-adopt`) ÉCHOUERONT si non mis à jour — les deux specs à corriger impérativement dans le même lot.
- Suppression d'une surface d'adoption : retirer 'Choisir <juge>' enlève UN chemin d'arbitrage. Vérifier que les chemins survivants (clavier 1/2 = adoptAtFocus, œil de frontière boundary-adopt-<juge>, mode Compare) couvrent le besoin ; découvrabilité côté menu en baisse (assumé par la décision design).
- Casse d'import de types : supprimer par mégarde les exports JudgeDetail/JudgeEntry casserait la compilation de BoundaryEvidence.tsx et DocumentPanel.tsx. Garder ces interfaces exportées même si JudgeBlock disparaît.
- Code mort : JudgeBlock devient inutilisé → l'éliminer pour éviter un warning lint no-unused ; ne pas le laisser orphelin.
- ThemeMultiPicker sous un pli : gérer le focus initial du menu (aujourd'hui ref.current?.focus() cible le popover) pour qu'il aille sur l'action dominante (suggestion ou Valider) et pas dans une zone cachée ; éviter le piège-focus si Disclosure absente.
- Indices discrets judgeHints : NE PAS les confondre avec le 'bloc LLM' à retirer. Les supprimer dégraderait le guidage. Délimiter le retrait à la section (b) uniquement.
- Heuristique de suggestion 1-clic mal calibrée (proposer un thème quand les LLM divergent) induirait en erreur. Règle sûre : suggérer QUE sur consensus unanime ou thème déjà posé ; sinon ouvrir la grille.
- Dépendance Disclosure absente : si la primitive n'est pas livrée, le repli local doit être tokenisé + a11y (aria-expanded/controls) pour ne pas réintroduire de dette.
- Garde anti-hex CI : les nouveaux états DOIVENT passer par bg-success/warning ; tout emerald-/amber- résiduel fera échouer check-no-hex/lint token-only.

## Étapes d'implémentation

1. 1. Geler le périmètre : le retrait concerne UNIQUEMENT la section (b) 'Propositions LLM' (menu-llm + JudgeBlock + adoption) ; judgeHints + types exportés + prop `judges` sont CONSERVÉS.
2. 2. SentenceMenu.tsx : supprimer la <section data-testid=menu-llm> et JudgeBlock (mort). Retirer les variables/imports devenus inutilisés (presentJudges, allAgree, resolveDivergenceRange, runAt/getThemeToken si plus utilisés hors hints) sans casser judgeHints.
3. 3. Réorganiser la section (a) : raccourci 1-clic thème principal suggéré (menu-primary-suggest) en tête, Valider/Dévalider promu, REPLIER ThemeMultiPicker + CertaintyPicker sous <Disclosure> (ou repli local) 'Plus d'options' (menu-more-options). Règle : grille visible si coveringDraft existe, repliée sinon.
4. 4. Tokeniser : bouton Valider → border-success/bg-success/10/text-success (validé) et border-warning/bg-warning/10/text-warning (à valider) ; vérifier AA via readableTextColor si fond dynamique.
5. 5. Iconographie Lucide : header ✕→X ; Valider ✓→Check, ◷→Clock ; Traduire 🌐→Languages, 🙈→EyeOff. size 14, currentColor, aria-hidden ; sens porté par le libellé.
6. 6. Hauteur/collision : réduire max-h ~70vh, conserver useAnchoredPosition ; vérifier scroll interne et long-press tactile.
7. 7. a11y : focus initial sur l'action dominante, aria-expanded/controls sur le pli, focus-visible, role=menu conservé, aria-pressed sur les toggles.
8. 8. DocumentPanel : confirmer que `judges` reste fourni (hints) ; ne RIEN retirer du plumbing LLM (consommé ailleurs).
9. 9. Mettre à jour les e2e : document-ux.spec.ts (menu-llm count 0), llm-compare.spec.ts (adoption clavier), theme-multipicker.spec.ts (ouvrir le pli si nécessaire).
10. 10. Écrire tests/sentenceMenu.test.tsx (absence du bloc LLM, repli/dépli, tokens, icônes, suggestion).
11. 11. Lancer vitest + check-no-hex + lint + e2e ciblés (document-ux, llm-compare, theme-multipicker, a11y) ; valider clair ET sombre.
