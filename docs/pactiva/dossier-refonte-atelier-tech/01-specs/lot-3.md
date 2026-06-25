# Lot 3 · Icônes de thème monochromes + assainissement du chip

**Estimation** : M — Le helper pur + le wrapper ThemeGlyph sont rapides (S). Le coût réel est (a) le choix design des 20 glyphes univoques et mémorisables (validation daltonienne incluse), (b) la substitution propre aux 4 sites de rendu sans casser les data-testid ni les ~470 tests existants, (c) l'assainissement des 2 hex avec assertions. Pas de backend, pas de store, pas de migration → reste contenu. M et non L car aucune logique d'état ni d'API, périmètre front isolé et fortement testé. · **Dépendances** : Lot 0 — Garde anti-hex + lint token-only (PRÉREQUIS TRANSVERSE, NON encore livré : ni frontend/scripts/check-no-hex.mjs ni la conf eslint token-only n'existent). L'assainissement des 2 hex de ClauseChip doit s'aligner sur les tokens/variables CSS définis par Lot 0 ; à défaut, faire l'assainissement avec rgb(var(--sem-success)) et classes Tailwind existantes (text-info/border-info déjà présentes) et couvrir par un test unit en attendant la garde CI., Registre thème→icône (fondation transverse annoncée : getThemeToken + champ icon, lib/themeIcons.ts) — c'est précisément CE lot qui le matérialise ; aucune dépendance amont autre que lucide-react (déjà présent)., Coordination (non bloquante) avec Lot 4 (zone Document / bord gauche hiérarchisé) pour le rail coloré du DocumentPanel : si le rail adopte aussi l'icône monochrome, mutualiser getThemeIcon/ThemeGlyph plutôt que dupliquer. Le périmètre ClauseChip de ce lot n'attend pas Lot 4.

## Objectif technique

Désambiguïser les 20 thèmes (dont 9 teintes quasi-jumelles : 3 verts ACCEPTABLE_USE/USER_CONTENT/FEES_PAYMENT, 3 rouges WARRANTY/LIMITATION/DMCA, 5 violets/magenta PREAMBLE/GOVERNING_LAW/THIRD_PARTY/ARBITRATION/PROMOTIONS) par la FORME, pas par la couleur seule. On crée un registre PUR thème→icône Lucide (getThemeIcon(code): LucideIcon, un seul point d'injection comme getThemeToken) et on SUBSTITUE l'icône monochrome (currentColor/text-ink, size 14, strokeWidth ~1.75, aria-hidden) au point coloré rond aux emplacements actuels (ClauseChip, ThemePalette option + tooltip, ThemeMultiPicker option + tooltip). Aucun signal ajouté (même emplacement) donc zéro sur-densité, conforme « subtil sans fatigue ». En parallèle on assainit les 2 hex en dur de ClauseChip (#34D399 accent validé → token success ; #64B5F6 badge +N → token info) pour ne pas alourdir la dette couleur et basculer clair/sombre nativement. Le fond léger teinté du thème reste le « champ » (couleur), la forme devient le discriminant. Repli Tag générique pour les codes hors mapping (corpus tiers H4 / FALLBACK_THEME). A11y intégralement préservée : libellé textuel toujours présent, icône aria-hidden, contraste AA garanti par text-ink/readableTextColor. Frontière respectée : la couleur de thème (token métier) ne devient jamais success/info (token d'état) — l'icône reste neutre currentColor.

## Composants touchés

| Fichier | Nature du changement |
| --- | --- |
| frontend/src/components/ui/ClauseChip.tsx | Remplacer le <span> point rond (l.91-95) par <IconComp size={14} aria-hidden className='shrink-0'/> avec IconComp=getThemeIcon(themeCode), couleur HÉRITÉE (text-ink/currentColor, jamais token.color ; l'opacité 'pending' passe par une classe text-ink-muted, pas par un style hex). Remplacer le hex #34D399 (l.87, boxShadow accent validé) par la var CSS du token success : boxShadow validé = 'inset 3px 0 0 rgb(var(--sem-success))'. Remplacer le hex #64B5F6 + le rgb littéral (l.108-109, badge +N) par les classes Tailwind tokenisées 'text-info border-info/40' et retirer le style inline color/borderColor. Conserver TOUS les data-testid (clause-chip, multilabel-badge), data-theme, title, aria-pressed. Ajouter un data-testid='theme-icon' sur l'icône pour les tests E2E/unit. |
| frontend/src/components/ui/ThemePalette.tsx | Remplacer le point coloré de l'option (l.167-171, span h-3 w-3 rounded-full) par <IconComp size={14} aria-hidden className='shrink-0 text-ink-muted'/> via getThemeIcon(t.code). Idem dans l'info-bulle d'intention (l.196-200). Préserver data-testid theme-option-* et theme-tooltip, le ring AA et le marqueur ✓ de sélection (qui sera lui-même remplacé par <Check> Lucide si Lot 12 l'exige — hors périmètre ici, on garde le ✓ existant). |
| frontend/src/components/ui/ThemeMultiPicker.tsx | Remplacer le point coloré de l'option (l.208-212) par l'icône monochrome via getThemeIcon. Le pictogramme d'ORDRE secondaire (l.243-251, pastille numérotée colorée via readableTextColor) reste inchangé (c'est un signal de rôle, pas de thème). Remplacer le point du tooltip (l.289-293) par l'icône monochrome. Préserver data-testid theme-option-*, primary-badge-*, secondary-order-*, promote-*, llm-hint-*, theme-tooltip. |
| frontend/src/lib/tokens.ts | AUCUN changement de structure du ThemeToken requis (l'icône vit dans le registre séparé themeIcons.ts pour découpler couleur et forme). Optionnel : ré-exporter getThemeIcon depuis tokens.ts pour un point d'import unique. Le hex #94A3B8 du FALLBACK_THEME (l.47) n'est PAS dans le périmètre Lot 3 (couleur de repli légitime, à traiter en Lot 0/13). |
| frontend/src/components/workspace/DocumentPanel.tsx | Périmètre étendu OPTIONNEL (rail coloré gauche du document, cité par l'audit comme zone dense) : si un point/liseré de thème y est rendu via token.color, le doubler par l'icône monochrome de getThemeIcon. À cadrer avec Lot 4 (zone Document / bord gauche) pour éviter le double-travail — par défaut HORS périmètre de ce lot, qui se concentre sur le chip. |


## Store / données / types

- AUCUN changement de store Zustand. L'icône est une dérivée PURE et déterministe du themeCode (registre statique getThemeIcon), pas un état d'interaction ni une préférence. Rien dans le store workspace, prefs ou ui.
- AUCUN nouveau type métier dans types/contract.ts. Le seul type introduit est local au registre : type ThemeIconEntry = { icon: LucideIcon } (ou Record<string, LucideIcon>) dans lib/themeIcons.ts.
- Le miroir theme↔themes (withPrimaryTheme/sanitizeThemeSet) n'est pas touché : l'icône se lit au rendu depuis le code, sans muter la sélection.

## API (backend / endpoints)

- AUCUN changement backend / endpoint. Le mapping thème→icône est une décision de design 100 % front (lucide-react), il ne transite jamais par l'API. Les réponses restent camelCase inchangées.
- Le schéma de projet (setRuntimeThemes, codes/couleurs runtime H4) continue de fournir code/label/color/order ; getThemeIcon mappe sur le CODE (stable), avec repli Tag si le code d'un corpus tiers n'est pas dans le registre. Aucun champ icon attendu de l'API.

## Primitives nouvelles

- frontend/src/lib/themeIcons.ts (NOUVEAU, pur, sans 'use client') : const THEME_ICONS: Record<string, LucideIcon> mappant les 20 codes vers des glyphes Lucide univoques (ex. PRIVACY_DATA→Lock, FEES_PAYMENT→CreditCard, TERMINATION→DoorOpen, ARBITRATION_DISPUTES→Scale/Gavel, GOVERNING_LAW→Landmark, WARRANTY_DISCLAIMER→ShieldAlert, LIMITATION_LIABILITY→ShieldOff, DMCA→Copyright, LICENSE_IP→Copyright/BadgeCheck, MODIFICATION_OF_TERMS→FilePen, USER_CONTENT→FileText, ACCEPTABLE_USE→CircleCheck, ELIGIBILITY_ACCOUNT→UserCheck, THIRD_PARTY_SERVICES→Plug, COMMUNICATIONS→Mail, FEEDBACK→MessageSquare, PROMOTIONS→Tag/Percent, PREAMBLE_SCOPE→BookOpen, META→Hash, MISC_BOILERPLATE→Files). Distinguer INTRA-famille : les 3 rouges (ShieldAlert/ShieldOff/Copyright), les 3 verts (CircleCheck/FileText/CreditCard), les 5 violets (BookOpen/Landmark/Plug/Scale/Percent). Fonction pure exportée : export function getThemeIcon(code: string | null | undefined): LucideIcon { return THEME_ICONS[code ?? ''] ?? Tag; }. Repli Tag (pas Hash, réservé à META) pour codes inconnus.
- AUCUNE nouvelle primitive UI : on réutilise lucide-react directement (rendu <IconComp/>). Pas de composant ThemeIcon wrapper sauf si la répétition currentColor/size/aria-hidden aux 4 sites justifie un mini <ThemeGlyph code size/> — recommandé pour factoriser et garantir l'invariant 'jamais token.color' ; à créer dans frontend/src/components/ui/ThemeGlyph.tsx avec data-testid='theme-icon'.

## Plan de tests

### MSW (handlers / fixtures)
- AUCUN handler/fixture MSW nécessaire : zéro appel réseau, le mapping est statique. Les fixtures de schéma existantes (codes de thème runtime) suffisent ; vérifier qu'un code tiers absent du registre tombe bien sur le repli Tag (test pur, pas MSW).

### Vitest (unitaire & composant)
- tests/themeIcons.test.ts (NOUVEAU, pur) : getThemeIcon retourne un composant Lucide défini pour chacun des 20 codes ; les 9 teintes jumelles ont 9 icônes DISTINCTES (assert sur identité de référence, pas d'icône partagée intra-famille rouge/verte/violette) ; code inconnu/null/undefined → repli Tag ; déterminisme (mêmes appels = même référence).
- tests/clauseChip.test.tsx (ADAPTER, sans casser les 6 cas existants) : ajouter 'rend l'icône de thème monochrome (data-testid theme-icon) à la place du point coloré' ; 'icône en currentColor, jamais style backgroundColor=token.color' ; 'accent validé utilise rgb(var(--sem-success)) et plus #34D399' (assert boxShadow ne contient pas '#') ; 'badge +N porte les classes text-info/border-info et plus de style color hex' (assert style.color === '' et className contient 'text-info'). Conserver intacts les tests provenance/multilabel/pointillé.
- tests/components.test.tsx (VÉRIFIER) : ClauseChip y est rendu — s'assurer qu'aucune assertion ne dépend du <span> point rond supprimé.
- tests/tokens.test.ts (ÉTENDRE éventuellement) si getThemeIcon est ré-exporté depuis tokens.ts ; sinon laisser dans themeIcons.test.ts.
- tests/themePalette + multiPicker (AJOUTER cas) : l'option et le tooltip affichent l'icône de thème (theme-icon) en text-ink-muted, point coloré supprimé ; data-testid theme-option-* et theme-tooltip préservés.

### Playwright (E2E / a11y)
- e2e/themes-icons.spec.ts (NOUVEAU) : ouvrir l'atelier, vérifier que chaque clause-chip du plan/ToC contient un [data-testid=theme-icon] (SVG Lucide) et plus de point rond ; vérifier en mode .light ET sombre que l'icône hérite de la couleur de texte (pas de fill teinté). Run @axe-core/playwright sur le plan rempli : 0 violation, focus-visible et libellés préservés.
- e2e/themes-icons.spec.ts (suite) : ouvrir ThemePalette via le menu/inspecteur, confirmer theme-option-* affiche l'icône ; survol prolongé → theme-tooltip avec icône. Régression : les flux d'annotation existants (sélection de thème, valider) passent toujours (réutiliser un spec d'annotation existant comme garde).

## Risques & pièges

- Snapshots/tests ciblant le point rond : des tests (clauseChip.test.tsx, components.test.tsx, specs E2E) ou des sélecteurs CSS '.rounded-full' peuvent référencer le <span> point supprimé. Mitigation : grep des sélecteurs avant suppression, garder data-theme/data-testid, ajouter theme-icon.
- Lisibilité de l'icône fine à petite taille (size sm, text-[11px]) : un glyphe Lucide à strokeWidth 1.75 peut être moins lisible qu'un aplat. Mitigation : size 14 fixe (pas em), strokeWidth calibré, test daltonien (deuteranopia/protanopia) sur les 3 familles ; le libellé reste toujours présent.
- Choix des 20 glyphes : risque de collisions sémantiques (Copyright pour DMCA ET LICENSE_IP ; Tag pour repli ET PROMOTIONS). Mitigation : table univoque revue (DMCA→Copyright, LICENSE_IP→BadgeCheck ; PROMOTIONS→Percent, repli→Tag), 9 icônes distinctes garanties par test.
- Frontière token métier ≠ token d'état : tentation d'utiliser la couleur du thème pour teinter l'icône. Interdit — l'icône est currentColor. Garde : test 'jamais style color=token.color' + revue.
- Dépendance Lot 0 (garde anti-hex) : tant que check-no-hex.mjs n'existe pas, l'assainissement des 2 hex n'est pas vérifié en CI et peut régresser. Mitigation : faire l'assainissement quand même (var --sem-success / classes info) et ajouter un test unit asserttant l'absence de '#' dans le style.
- Bundle/import : importer 20 icônes Lucide nommées (tree-shaking OK avec lucide-react, imports nommés). Éviter un import dynamique non shakeable. Impact bundle négligeable (icônes SVG légères).
- ThemeMultiPicker : ne PAS confondre l'icône de THÈME (nouvelle) avec la pastille d'ORDRE secondaire colorée (signal de rôle, readableTextColor) — laisser cette dernière intacte.
- FALLBACK_THEME.color #94A3B8 dans tokens.ts reste un hex : ne pas le déclarer 'résolu par Lot 3' (hors périmètre), pour ne pas casser l'attendu du Lot 0/13.

## Étapes d'implémentation

1. 1. Créer frontend/src/lib/themeIcons.ts : importer les 20 glyphes nommés de lucide-react, définir THEME_ICONS (Record code→LucideIcon) en garantissant 9 icônes distinctes pour les familles jumelles, exporter getThemeIcon(code) avec repli Tag. Aucun 'use client'.
2. 2. Écrire tests/themeIcons.test.ts (pur) : 20 codes mappés, 9 distinctes, repli Tag pour inconnu/null, déterminisme. Faire passer en vert.
3. 3. (Optionnel recommandé) Créer frontend/src/components/ui/ThemeGlyph.tsx : wrapper minimal <ThemeGlyph code size=14 className/> rendant getThemeIcon(code) en currentColor, aria-hidden, data-testid='theme-icon'. Garantit l'invariant 'jamais token.color' à un seul endroit.
4. 4. ClauseChip.tsx : substituer le point rond par ThemeGlyph/IconComp ; tokeniser #34D399→rgb(var(--sem-success)) (boxShadow) et #64B5F6→classes text-info border-info/40 (badge +N) ; supprimer styles inline hex. Conserver data-testid/data-theme/title.
5. 5. Adapter tests/clauseChip.test.tsx : ajouter les cas icône + tokenisation (assert pas de '#' dans boxShadow/style), garder les 6 cas existants verts. Vérifier components.test.tsx.
6. 6. ThemePalette.tsx + ThemeMultiPicker.tsx : substituer points colorés (option + tooltip) par l'icône monochrome text-ink-muted ; préserver tous les data-testid et le ring AA. Ajouter cas de test dédiés.
7. 7. Lancer la suite vitest complète (cible ~470+ verts) et typecheck.
8. 8. Écrire e2e/themes-icons.spec.ts : présence des icônes dans plan/palette, héritage couleur clair/sombre, axe 0 violation ; régression flux annotation.
9. 9. Test daltonien manuel (simulateur) sur les 3 familles ; ajuster un glyphe si collision visuelle perçue.
10. 10. Quand Lot 0 est livré : ajouter ClauseChip à la couverture du linter anti-hex et retirer toute exception temporaire.
