# Dossier technique — Refonte de l'atelier d'annotation Pactiva

> Volet **technique** (architecture, specs d'implémentation, tests, plan d'exécution).
> Le volet **design/produit** (audit, variantes, proposition finale) est dans `dossier-refonte-atelier/`.

**Date** : 2026-06-25 · **Pile** : Next.js App Router · Zustand · React Query · Tailwind (tokens) · MSW · Vitest · Playwright.

## Démarche

1. **Architecture** transverse — `00-architecture/` : fondations réutilisées par plusieurs lots
   (machine d'états `<Button>`, garde anti-hex, primitive `<Disclosure>`, helper de contraste,
   registre thème→icône, persistance layout par compte, registre de raccourcis), modèle de données,
   stratégie de tests, conventions.
2. **Specs par lot** — `01-specs/` (10 lots) : composants touchés, store/data, API,
   plan de tests **MSW · Vitest · Playwright**, risques, étapes, estimation, dépendances.
3. **Plan d'exécution** — `02-execution/` : jalons, séquencement, gates de test, definition of done,
   stratégie de branche/déploiement incrémental.

## Séquencement retenu

| Ordre | Lot | Raison |
| --- | --- | --- |
| 1 | Lot 0 | PRÉREQUIS transverse absolu : aucune dépendance entrante, mais tous les autres lots s'appuient sur la garde anti-hex (check-no-hex.mjs + eslint, ABSENTS du repo), les tokens d'état --sem-* validés AA (déjà déclarés mais pas prouvés par test) et la tokenisation des niveaux triage C1–C5. Sans cette garde, les emerald/amber/red retokénisés par les lots suivants re-fuient. Livré en premier, vert seul. |
| 2 | Lot 2 | Machine d'états <Button> (variants danger/success, isLoading, tone, aria-pressed) consommée par les Lots 6 et 8 (Valider/Supprimer/Soumettre) et réutilisée par 4/5/9. Le squelette de Button est posé au Lot 0 ; le Lot 2 le complète et migre les ~25 boutons ad hoc. Doit précéder tout lot qui utilise <Button> pour éviter une double migration. Aucune dépendance backend/store. |
| 3 | Lot 3 | Matérialise le registre getThemeIcon/themeIcons.ts (ABSENT) consommé par les Lots 4 (filtre par thème) et 7 (glyphe monochrome du bord gauche/BoundaryEvidence). Périmètre front isolé (ClauseChip + pickers), pas de store ni backend ; le faire tôt évite que 4 et 7 dupliquent le helper ou tombent en fallback point coloré. |
| 4 | Lot 5 | Premier consommateur de la primitive <Disclosure> (ABSENTE) : c'est le lot qui la livre (repli local a11y si pas déjà fait), avec le moindre risque (un seul composant SentenceMenu, store inchangé). Indépendant du layout. Établit <Disclosure> pour les Lots 4/6/7/8 qui suivent. Doit corriger 3 specs e2e dépendant du bloc LLM dans le même lot. |
| 5 | Lot 4 | Consomme <Disclosure> (Lot 5) + themeIcons (Lot 3) + prefs par compte (déjà présent). Introduit @tanstack/react-virtual (nouvelle dép build) ; à cadrer après que Disclosure soit stable. Indépendant du layout 3-panneaux (repli en rail du Plan explicitement hors périmètre, viendra avec Lot 1). Périmètre TocPanel borné. |
| 6 | Lot 6 | Dépend frontalement de <Disclosure> (Lot 5) ET de <Button> étendu (Lot 2) pour l'accordéon et Valider/Supprimer ; cohérent avec themeIcons (Lot 3). Lot L : refonte structurelle inspecteur + arbitrage ambiant useTriage + atomicité d'undo Adopter. Placé après que les 3 primitives fondatrices soient livrées et vertes. |
| 7 | Lot 7 | Lot L sur le composant le plus fragile (DocumentPanel ~1530 lignes). Dépend de themeIcons (Lot 3, glyphe bord gauche), <Disclosure>+<Kbd> (cheat-sheet) et tokens (Lot 0). Périmètre strictement disjoint du Lot 6 (ne touche pas triage/levels.ts) — séquencé APRÈS Lot 6 pour éviter tout chevauchement de PR sur le rendu triage du bord gauche. <Kbd> peut être livré minimal ici en attendant Lot 9. |
| 8 | Lot 1 | Infrastructure de contenant (dock 3 colonnes, plancher, rails, AuxDrawer, fusion bandeaux, persistance layout front+backend). Lot L à fort risque de non-régression (drag/clavier/ARIA + nombreux data-testid e2e). Placé tard pour refondre le contenant une fois les surfaces internes (inspecteur, document, plan, menu) stabilisées, évitant de réajuster le layout à chaque lot. Dépend de Lot 0 (tokens bandeaux) ; modif backend ui_prefs.py OBLIGATOIRE et testée. |
| 9 | Lot 8 | Refonte WorkspaceToolbar : dépend de <Button> warning/danger (Lot 2), <Disclosure> (tiroir, Lot 5) et tokens (Lot 0). Placé après Lot 1 car la barre vit dans le dock refondu ; mieux vaut refondre la barre une fois le contenant stable. Garder submit/snapshot/lock/unlock HORS tiroir pour ne pas casser les 5 specs e2e. |
| 10 | Lot 9 | Dernier : recommande Lot 8 livré pour héberger l'entrée discrète de la modale « ? » dans le tiroir Affichage/Outils. Crée la source de vérité shortcuts.ts + <Kbd> (consolide le minimal éventuellement posé au Lot 7) et refond les deux hooks globaux (collision n/1/2). Couronne le clavier-first une fois toutes les surfaces et boutons cibles en place ; purge les derniers hex/Unicode de TRIAGE_LEVEL_META dans QuickActionRail. |


## Arborescence

```
dossier-refonte-atelier-tech/
├── README.md
├── 00-architecture/   pile · fondations · modèle de données · tests · conventions
├── 01-specs/          1 spec par lot + matrice de tests CSV
└── 02-execution/      plan d'exécution (MD) · séquencement (CSV) · jalons (PUML)
```
