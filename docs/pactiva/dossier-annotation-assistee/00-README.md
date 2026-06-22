# Annotation assistée — accélérateur d'annotation (protocole C1–C5 multi-label)

> **But.** Concevoir et livrer un système qui **accélère fortement** l'annotation en
> appliquant **nativement** le protocole *« confiance graduée + multi-label »*
> (`CLAIRE/docs/reflexion/2026-06-22_protocole-annotation-multilabel/`). L'annotateur
> ne fait plus une relecture uniforme : la machine **triage** chaque phrase par niveau
> d'accord inter-juges (C1→C5), **propose** une annotation **en expliquant** le contexte
> (votes), la décision (set de thèmes + frontière) et la **logique** (règle qui s'applique),
> et l'humain **accepte en 1 geste** ou **ajuste** facilement.

## Promesse mesurée (calibration 3 juges, 50 docs, 9 414 phrases)
| Niveau | % corpus | Geste cible | Gain |
|---|---|---|---|
| C1 — Or | 22,9 % | acceptation **par lot** | quasi-zéro effort |
| C2 — Haute | 20,3 % | **1 clic** confirmer | secondes |
| C3 — Multi-label | 14,7 % | **valider le set** | 1–2 clics |
| C4 — Majorité | 25,8 % | confirmer / choisir l'autre | attention ciblée |
| C5 — Arbitrage | 16,3 % | décision complète | effort concentré |

→ **43 % auto/quasi-auto, 15 % multi-label assisté, 16 % seulement de vrai arbitrage.**
L'objectif produit : **vider C1+C2 en secondes** (file clavier), **valider C3 sans re-découper**,
**concentrer l'attention humaine sur C4/C5**.

## Ce que ce dossier décide (résumé exécutif)
1. **Moteur de règles pur & versionné** (spec YAML = source unique, moteur TS réactif
   côté front + miroir Python pour le batch). Il applique l'arbre C1–C5, l'override
   anti-refuge, le choix du primaire et la frontière dure/molle. → `architecture/` + `moteur/`.
2. **Multi-label additif** via une table enfant `ClauseTheme` (1 primaire + N secondaires,
   refuge jamais secondaire) — **rétro-compatible** (mono = 1 thème primaire). → `architecture/05-*`.
3. **Niveau de triage C1–C5 ≠ certitude 0–3** : deux signaux **orthogonaux** conservés
   (le protocole l'exige : la confiance vient de l'accord, pas de l'auto-déclaration).
4. **Frontière dure/molle** stockée + dérivée de l'accord N-way sur `is_block_start`
   (molle = fusion/scission proposée tant que non validée).
5. **UX hybride** : (a) un **mode File de triage** (l'accélérateur, clavier-first) +
   (b) une **carte de suggestion contextuelle** inline (dans le document/inspecteur)
   pour éditer sans changer d'écran. → `ux/`.
6. **Explication déterministe** dérivée de la règle qui s'applique (pas d'appel LLM
   supplémentaire) → traçable, journalisée, réversible.

## Organisation du dossier
```
00-README.md                       ← vous êtes ici (index + résumé exécutif)
01-comprehension-protocole.md      analyse fine du protocole (C1–C5, multi-label, frontières, overrides)
02-integration-existant.md         état claire-studio + analyse d'écart (gap) + ce qui se réutilise
comparatif/
  03-etude-comparative.md          options par composant : forces/faiblesses/pertinence/UX
  03-matrice-decision.csv          scoring pondéré des options → choix retenus
architecture/
  04-architecture.md               architecture cible (backend + moteur + frontend)
  04-composants.puml               diagramme de composants
  04-sequence-triage.puml          séquence : pré-annotation → triage → file → validation
  05-modele-donnees.md             extension multi-label + frontière + niveau (specs)
  05-clause-multilabel.schema.json JSON Schema de la clause multi-label
  05-queue-item.schema.json        JSON Schema de l'item de file (triage)
  06-api-contract.yaml             contrat d'API (queue, batch-accept, validate-set, swap, frontière)
moteur/
  07-moteur-regles.md              moteur : routage, override, primaire, frontière, explication
  07-regles-routage.yaml           règles versionnées (refuges, clusters, préséance, priorité)
ux/
  08-ux-ergonomie.md               parcours par niveau, principes, accessibilité, raccourcis
  08-maquettes.txt                 wireframes ASCII (file + carte de suggestion par niveau)
  09-design-systeme.md             tokens, couleurs niveau/rôle, composants, micro-interactions
plan/
  10-plan-action.md                lots, séquencement, jalons, dépendances
  11-strategie-tests.md            MSW / Vitest / Playwright / pytest (invariants protocole)
  11-cas-tests.csv                 matrice de cas de test par niveau
  12-runbook.md                    runbook d'exécution & déploiement
  13-strategie-prod.md             feature flag, rollout, métriques, rollback
```

## Périmètre de ce dossier
**Conception complète + plan livrable** (analyse, étude comparative, architecture retenue,
specs, plan d'action, tests, runbook, prod). L'**implémentation** est cadrée par lots
(`plan/10-*`) et reste à exécuter sur validation. Lié au dossier multi-annotation
existant (`docs/pactiva/dossier-tests-multi-annotation/`) et à l'inspecteur
(`docs/pactiva/dossier-inspecteur-workspace/`).
