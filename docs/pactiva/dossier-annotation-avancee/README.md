# Dossier — Annotation avancée (Pactiva)

> Dossier d'étude **niveau agence** (équipes senior backend / frontend / UI / UX /
> design / ergonomie / graphisme / QA). Objectif : cadrer **avant implémentation**
> deux fonctionnalités et corriger un bug bloquant, avec étude comparative, choix
> argumenté par aspect, proposition détaillée, plan de tests et runbook.

## Périmètre

1. **Bug bloquant (corrigé)** — 403 sur `PATCH/DELETE /clauses` du propriétaire
   (régression de la permission `IsAnnotationOwner`). Voir `00-audit/`.
2. **Feature A — Barre des frontières par modèle** : visualiser, dans une réglette
   compacte et togglable, où chaque modèle (Claude, Codex, demain Mistral…) place
   ses frontières de clause + (optionnel) la catégorie. Voir `02-feature-A-*`.
3. **Feature B — Annotation bloc/phrase** : pouvoir gérer son **propre découpage**,
   annoter **phrase par phrase** ET **par bloc** de façon ergonomique, simultanée
   et adaptée aux cas. Voir `03-feature-B-*`.

## Décisions clés (résumé exécutif)

| Aspect | Décision retenue | Pourquoi (synthèse) |
|--------|------------------|---------------------|
| **A — Visualisation** | **Réglette multi-pistes verticale** (une piste fine par modèle, alignée aux phrases), togglable, teinte catégorie optionnelle, tooltips au survol | Comparaison directe inter-modèles, compacte, n'empiète pas sur la lecture, extensible à N modèles |
| **B — Modèle d'annotation** | **Hybride : phrase = unité atomique + « bloc » = groupe contigu de même thème** (geste de groupe), sans migration de schéma | Concilie granularité par phrase (IAA juste, déjà en place C4) et ergonomie des spans ; override d'une phrase = « détache » du bloc |
| **B — Gestes** | clic = 1 phrase · glisser/Maj-clic = plage · double-clic = sélectionner le bloc · poignées de bord = étendre/réduire · clic-droit = override | Couvre tous les cas sans menu lourd ; cohérent desktop |
| **Backend** | Réutiliser le modèle `Clause` par phrase (pas d'`end_index`) ; un « bloc » est **dérivé** (clauses contiguës de même thème) | Zéro migration, IAA par phrase préservée, robustesse |
| **Tests** | MSW (contrats API) + vitest (unitaire/logique runs & store) + Playwright (parcours) | Pyramide de tests, parcours critiques couverts |

> Détail et alternatives écartées dans chaque sous-dossier (`*-etude-comparative.md`,
> `*-comparatif.csv`, `*-choix.md`).

## Arborescence du dossier

```
dossier-annotation-avancee/
├── README.md                         ← ce fichier (index + résumé exécutif)
├── 00-audit/                         ← état des lieux + bug 403 (cause/fix)
├── 01-besoins/                       ← besoins fonctionnels, user stories, personas
├── 02-feature-A-barre-frontieres-modeles/
├── 03-feature-B-annotation-bloc-phrase/
├── 04-architecture/                  ← backend, frontend, contrats API, diagrammes
├── 05-design-ux-ergonomie/           ← principes, a11y, design system, graphisme
├── 06-plan-tests/                    ← stratégie MSW/vitest/playwright + cas
└── 07-plan-action-runbook/           ← lots, séquencement, runbook d'exécution
```

## Conventions de format (par pertinence)
- `.md` : spécifications, études, décisions, principes (lecture humaine).
- `.csv` : matrices comparatives, user stories, cas de test, jalons (tabulable).
- `.puml` : diagrammes PlantUML (séquence, composants, états, modèle de données).
- `.txt` : wireframes ASCII (maquettes rapides, neutres).
- `.json` : tokens de design, exemples de payload/contrat.
- `.yaml` : contrats d'API et modèles de données (lisibles, diff-ables).

## Statut
- ✅ Bug 403 : **corrigé et déployé** (commit `bdb14ca`).
- 📋 Features A & B : **conception** (ce dossier) — **aucune implémentation** tant que
  le plan n'est pas validé. L'exécution suivra `07-plan-action-runbook/`.
