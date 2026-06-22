# Plan d'action — lots, séquencement, jalons

Approche **incrémentale, derrière un feature flag** (`NEXT_PUBLIC_TRIAGE` / `TRIAGE_ENABLED`),
livrable lot par lot, chaque lot **testé et déployable** indépendamment. Le moteur pur et
les règles d'abord (valeur + tests sans UI), puis l'UX, puis la persistance multi-label.

## Lot 0 — Socle & règles (1 jour) · *aucune dépendance*
- `moteur/07-regles-routage.yaml` → script `build:rules` générant `rules.generated.ts` (front)
  et `rules.py` (back). **Figer le `theme_aliases`** avec l'équipe données (réconciliation
  vocabulaire protocole ↔ scheme app) — **bloquant** pour la justesse.
- Golden set d'items de référence (1/niveau + cas limites) en `plan/11-cas-tests.csv`.
- **Sortie** : règles versionnées + golden set. **Tests** : lint YAML + génération.

## Lot 1 — Moteur de triage (pur, TS) (1–2 jours) · *dépend de Lot 0*
- `src/lib/triage/engine.ts` (`triageEngine`) + types `TriageResult`/`Explanation`.
- Branche sur `preByJudge` + `agreementNway` + `runs` (existants).
- **Sortie** : moteur réactif (pas d'UI). **Tests** : Vitest exhaustif (les 5 niveaux,
  override, cluster, préséance/priorité, frontière dure/molle, < 2 juges) sur le golden set.

## Lot 2 — Backend multi-label + frontière + niveau (2–3 jours) · *parallélisable à Lot 1*
- Migrations `ClauseTheme` + `Clause.boundary_type/boundary_support/triage_level` + migration
  de données (legacy mono → 1 `ClauseTheme` primary).
- Serializers (themes[], boundary), invariants (exactly-one-primary, refuge≠secondary).
- Endpoints : `POST clauses:batch`, `PATCH /clauses` étendu, `swap-primary`, `boundary`.
- (option) service `triage.py` (miroir) + endpoint `GET …/triage` + parité.
- **Tests** : pytest (invariants, batch atomique/idempotent, rétro-compat lecture `theme`),
  parité front/back sur le golden set.

## Lot 3 — Store & types frontend (1–2 jours) · *dépend de Lot 1 + Lot 2*
- `contract.ts` : `Clause.theme→themes[]`, `boundary`, `triageLevel` ; helper `primaryOf`.
- `store/workspace.ts` : `DraftClause.themes`, actions `batchAccept`, `validateSet`,
  `swapPrimary`, `removeSecondary`, `setBoundaryType`, `acceptSuggestion`, `undoOverride`.
- Adapter `runs.ts` au multi-label (run = primaire ; secondaires en overlay).
- **Tests** : Vitest store (mutations + invariants client) ; MSW pour les endpoints.

## Lot 4 — Carte de suggestion inline (2 jours) · *dépend de Lot 1, 3*
- `SuggestionCard` (contexte/décision/logique + CTA + actions) montée dans `SentenceMenu`,
  `BoundaryEvidence`, `InspectorPanel` ; `MultiThemePalette` (extension `NaturePicker`).
- **Tests** : Vitest composant (rendu par niveau, explication, actions) ; a11y (rôles/labels).

## Lot 5 — Mode File de triage (2–3 jours) · *dépend de Lot 1, 3, 4*
- `TriageQueue` (split, regroupement par niveau, navigation + raccourcis clavier, lot C1).
- Bandeau d'état (progression, k/N, brouillon) ; intégration toolbar (bouton « File de triage »).
- **Tests** : Vitest (navigation/gestes) ; Playwright e2e (parcours C1→C5 complet, lot,
  permuter, fusion/scission, indécidable).

## Lot 6 — Mesure & oracle (1–2 jours) · *dépend de Lot 2*
- Consolidation oracle (clauses multi-label) ; `iaa_multilabel` (α MASI/κ/Pk) branché ;
  export multi-label additif (primaire conservé pour le legacy).
- **Tests** : pytest (α=κ sur mono ; α MASI sur multi) ; export contract shape.

## Lot 7 — Durcissement & sortie de flag (1–2 jours) · *dépend de tous*
- Batterie agressive (cf. `11-strategie-tests.md`) ; perf (file 200+ items virtualisée) ;
  a11y AA ; passe pilote (3 docs : facile/cluster/dur) → mesurer temps/clic réel par niveau.
- **Sortie de flag** progressive (cf. `13-strategie-prod.md`).

## Dépendances (graphe)
```
Lot0 ──▶ Lot1 ──┐
   └────▶ Lot2 ─┼─▶ Lot3 ─▶ Lot4 ─▶ Lot5 ─▶ Lot7
              Lot2 ─▶ Lot6 ───────────────▶ Lot7
```

## Jalons & critères de sortie (DoD)
| Jalon | Critère |
|---|---|
| M1 (Lot 0–1) | moteur pur vert sur golden set ; règles versionnées |
| M2 (Lot 2–3) | multi-label persistable + rétro-compat ; parité front/back |
| M3 (Lot 4–5) | UX file + carte fonctionnelles, a11y AA, e2e vert |
| M4 (Lot 6–7) | α MASI mesuré ; pilote 3 docs ; gate complet vert ; flag prêt à ouvrir |

## Estimation indicative
~10–14 jours-personne, parallélisable (back Lot 2 ∥ front Lot 1) → ~2 semaines calendaires.

## Risques & mitigations
| Risque | Mitigation |
|---|---|
| Réconciliation vocabulaire incorrecte | figer `theme_aliases` avec l'équipe données **avant** Lot 1 ; test sur corpus réel |
| Régression mono-label | rétro-compat (theme scalaire miroir) + tests legacy ; flag |
| Sur-segmentation persistante | frontière molle + multi-label intra-clause (mesurer Pk avant/après) |
| Charge perçue en C4/C5 | présélection minimale + explication ; mesurer temps/clic au pilote |
