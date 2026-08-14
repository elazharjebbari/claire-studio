# Plan d'action et d'exécution — remédiation UI/UX Pactiva Lab

Référence : `01_AUDIT.md` (findings), `02_SOLUTIONS.md` (choix motivés). Ce document
est le plan d'exécution — phases, tests, critères de bascule, statut réel.

## Principes directeurs

1. **Aucun correctif visuel sans preuve.** Chaque finding de l'audit est sourcé
   (fichier+ligne ou capture d'écran) ; chaque correctif est vérifié par un test qui
   échouerait sans lui, pas seulement relu à l'œil.
2. **Le risque le plus élevé (sidebar globale) est traité en premier et isolément**,
   pour qu'un problème y soit détecté avant d'être noyé dans d'autres changements.
3. **Scope honnête.** Ce lot ne couvre que ce qui peut être conçu, codé, testé,
   déployé et validé visuellement dans une seule session — pas une promesse de refonte
   totale. Le backlog (phase 3) est documenté, pas exécuté ici.
4. **Aucune régression silencieuse.** Gate complet (pytest + tsc + vitest) avant tout
   déploiement ; healthcheck automatique avec rollback si l'un des deux échoue.

---

## Phase 1 — Correctif transverse : navigation mobile (Axe A)

**Pourquoi en premier** : c'est la cause racine dominante (§2.1), et c'est le
changement à plus large surface (composant monté sur 100 % des pages authentifiées) —
le tester tôt et isolément limite le risque.

| Tâche | Fichier(s) | Statut |
|---|---|---|
| État transitoire `mobileNavOpen` (jamais persisté) | `store/ui.ts` | ✅ fait |
| Sidebar → tiroir hors-flux sous `md`, backdrop, Échap, fermeture sur navigation | `components/shell/Sidebar.tsx` | ✅ fait |
| Bouton hamburger dans la TopBar (visible `md:hidden` uniquement) | `components/shell/TopBar.tsx` | ✅ fait |
| Tests : fermé par défaut, ouverture, backdrop, bouton dédié, Échap, non-persistance après navigation, labels toujours visibles en tiroir même si le desktop est replié, intégration TopBar→Sidebar via le hamburger réel | `tests/mobileNav.test.tsx` (8 tests) | ✅ fait |

**Piège corrigé en cours de route** : la fermeture automatique sur changement de route
(`useEffect` sur `pathname`) se déclenche aussi au **premier montage** — un test naïf
qui pré-positionne `mobileNavOpen=true` puis monte le composant observerait donc
toujours `false`, sans que ce soit un bug (c'est le scénario « ouverture par clic après
montage » qui doit être testé, pas « déjà ouvert avant montage »). Les 8 tests
distinguent explicitement les deux scénarios.

## Phase 2 — Correctifs ciblés Lab (Axes B, C, D)

| Tâche | Fichier(s) | Statut |
|---|---|---|
| Fil d'Ariane : labels `lab`/`runs`, `runs` ajouté à `NO_INDEX_SEGMENTS`, raccourcissement générique des segments UUID | `components/shell/Breadcrumbs.tsx` | ✅ fait |
| Tests : labels lisibles, UUID raccourci, segment `runs` non cliquable (régression 404), segment `lab` toujours cliquable, nom de projet résolu, non-régression sur une route non-Lab | `tests/breadcrumbs.test.tsx` (6 tests) | ✅ fait |
| `overflow-x-auto` sur les 4 tableaux non protégés | `LabWorkspace.tsx`, `RunList.tsx`, `RunResults.tsx`, `DatasetBuilder.tsx` | ✅ fait |
| `text-[10px]`/`text-[11px]` → `text-xs` (35 occurrences, 7 fichiers) | `ComputeSettings.tsx`, `DatasetBuilder.tsx`, `ExperimentLauncher.tsx`, `LabWorkspace.tsx`, `ReadinessPanel.tsx`, `RunList.tsx`, `RunResults.tsx` | ✅ fait |

Pas de nouveau test dédié pour les deux dernières lignes : ce sont des changements de
classes CSS mécaniques (présence d'`overflow-x-auto`, taille de police) — un test qui
vérifierait la présence littérale d'une classe Tailwind serait fragile et n'apporterait
pas de garantie fonctionnelle réelle au-delà de ce que le gate `tsc`+rendu existant
couvre déjà. Vérifiés par inspection visuelle directe (§ Validation, ci-dessous).

## Phase 3 — Backlog documenté (non exécuté dans ce lot)

Voir `02_SOLUTIONS.md` pour la justification de chaque report :

- Grilles responsive dédiées par composant (au-delà du strict nécessaire) — axe C2/A2 approfondi.
- Vue « carte » mobile pour les tableaux (au lieu du simple défilement horizontal).
- Équivalent tabulaire de la matrice de confusion : pivot en grille réelle (§2.6 audit).
- Résolution du nom de ressource dans le fil d'Ariane (axe B2).
- Migration `RunList`/`RunResults`/`ComputeSettings` vers `react-query` (axe E1).
- Extraction de `STATUS_META` (`RunList.tsx`) vers un module dédié, à l'image de `lib/gold/styling.ts`.
- Normalisation de l'espacement des cellules de tableau (4 valeurs relevées pour un même usage).

## Gate de qualité (avant tout déploiement)

```
backend : pytest -q                          → 733 passés (inchangé, aucun fichier backend touché)
frontend: tsc --noEmit                       → 0 erreur
frontend: vitest run                          → 667 passés (653 avant ce lot + 14 nouveaux : 8 mobileNav + 6 breadcrumbs)
```

## Déploiement

`./deploy/deploy-claire.sh` — gate de tests → push → VPS (migrate/collectstatic
backend inchangés, `npm run build` front) → restart des 4 services → healthcheck
API+frontend (10 tentatives, rollback automatique si échec). Aucune migration de
schéma dans ce lot (uniquement frontend + un ajout de state Zustand côté client).

## Validation visuelle post-déploiement

Re-capture de la page de run citée par l'utilisateur (même URL, même compte réel), aux
trois largeurs d'écran (375/768/1440), après déploiement — comparée capture-à-capture
avec l'état « avant » documenté dans `01_AUDIT.md` §2.1. Critères de réussite :

1. À 375px : la sidebar n'est plus visible par défaut (tiroir fermé), le contenu
   dispose de toute la largeur, les KPI ne se chevauchent plus.
2. Le hamburger ouvre le tiroir ; cliquer en dehors ou sur ✕ le referme.
3. Le fil d'Ariane affiche « Lab › Expériences › 754a17a3… » (pas les segments bruts,
   pas l'UUID complet), et « Expériences » n'est pas un lien cliquable.
4. Aucune requête réseau en échec (404) liée à `/lab/runs` dans la console.
5. Les tableaux ne débordent plus la largeur de l'écran sans possibilité de défilement.
