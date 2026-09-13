# 03 — Runbook exécutable

> État : **exécuté le 13 septembre 2026**. Chaque lot indique son objectif, ses fichiers,
> ses tests et son critère de succès — et ce qui a été réellement obtenu.

## Vue d'ensemble

| Lot | Objectif | État |
|---|---|---|
| L1 | Spécification unique, versionnée, figée | ✅ |
| L2 | Projection pure Python + TypeScript, parité testée | ✅ |
| L3 | Partition conception/validation figée et qualifiée | ✅ |
| L4 | Axe expérimental dans le Lab (4 sources projetées) | ✅ |
| L5 | Pilote de matrice + exécution | ✅ |
| L6 | Interface : sélecteur, rendu projeté, légende de mapping | ✅ |
| L7 | Dossier et résultats publiables | ✅ |

---

## L1 — Spécification unique et versionnée ✅

| | |
|---|---|
| **Fichiers** | `frontend/src/lib/taxonomy/taxonomies.json` (nouveau) |
| **Contenu** | 4 taxonomies × catégories (code, libellé juridique, description, couleur, refuge, justification, membres T20) + 2 populations figées + `specVersion` |
| **Tests** | partition exacte des 20 thèmes, tailles 20/14/11/10, lisibilité des fusions |
| **Succès** | ✅ 18 tests Python + 18 TypeScript ; empreinte `f6cdd271…` |
| **Risque** | une 5ᵉ copie des mappings → **parade** : `docs/pactiva-fusion-classes/scripts/schemes.py` reste la trace datée de l'aperçu, à faire importer la source unique lors de sa prochaine évolution |
| **Rollback** | `git revert` du JSON |

## L2 — Projection pure, parité Python ↔ TypeScript ✅

| | |
|---|---|
| **Fichiers** | `research/pactiva_lab/taxonomy.py`, `frontend/src/lib/taxonomy/index.ts`, `presentation.ts` |
| **Modifications** | `project_theme`, `project_theme_set`, `project_primary_and_secondaries` (invariant « secondaire ≠ primaire ») ; côté rendu, résolution du libellé, de la couleur, de la description et du **glyphe** (thème-tête) |
| **Tests** | `research/tests/test_taxonomy.py`, `frontend/tests/taxonomy.test.ts` — mêmes invariants des deux côtés |
| **Succès** | ✅ déterminisme, idempotence, code inconnu préservé, refuges préservés |
| **Découvert au passage** | `membersOf` renvoyait le tableau INTERNE de la spécification : un `.sort()` d'appelant la corrompait durablement (l'ordre détermine le glyphe). Corrigé par copie défensive **et couvert par un test**. |
| **Rollback** | revert ; aucun appelant en production avant L6 |

## L3 — Partition conception / validation ✅

| | |
|---|---|
| **Source** | `manifest.coverage` des exports prod `13aa1fbf…` (33 doc. multi-annotés au 24 août) et `f68c4e9e…` (50 doc.) |
| **Résultat** | 33 + 17 = 50, intersection vide — **la liste nominative n'existait nulle part** dans le dépôt, elle est désormais figée dans la spécification |
| **Qualification** | Le hold-out est aveugle pour la STRUCTURE des fusions (C1 confusabilité, C2 fiabilité : calculées sur les seules phrases multi-annotées), **non aveugle** pour les supports (C4) et les strates (G) |
| **Vérification** | Critères contaminés recalculés sur les 33 seuls : **même décision** (limitation 3,43 vs garantie 0,32 ; fusions à 993/872/871/555 phrases) |
| **Succès** | ✅ partition disjointe testée des deux côtés + note d'honnêteté dans la spécification |

## L4 — Axe expérimental dans le Lab ✅

| | |
|---|---|
| **Fichiers** | `research/pactiva_lab/data.py`, `runner.py`, `measurement.py`, `cooccurrence.py` |
| **Modifications** | `data.taxonomy` et `data.population` lus depuis la config ; projection des **quatre** sources (phrases, vocabulaire, votes, gold + juges) ; vocabulaire dédoublonné ; **frontières recalculées** ; traçabilité dans chaque résultat |
| **Tests** | `research/tests/test_taxonomy_pipeline.py` (10 cas) |
| **Succès** | ✅ plis identiques entre taxonomies, fichiers jamais réécrits, `tally` du gold additionné par classe |
| **Risque** | remap PARTIEL (annotateurs projetés, juges non) → **parade** : un test dédié vérifie que les juges suivent le même mapping |
| **Rollback** | `taxonomy="T20"` (défaut) restaure le comportement exact d'avant |

## L5 — Matrice expérimentale ✅

| | |
|---|---|
| **Fichier** | `research/experiments/run_taxonomy_matrix.py` |
| **Matrice** | 4 taxonomies × 3 populations × 3 sources (annotations brutes, consensus, gold) = 12 cellules complètes |
| **Mesures** | α-MASI, α nominal, Δ apparié vs T20 avec IC bootstrap et stabilité de signe, désaccords, α et AC1 par classe, supports, taux multi-label, MI et AP LODO d'abusivité, cascade gold |
| **Commande** | `python research/experiments/run_taxonomy_matrix.py <dataset> <sortie.json>` |
| **Succès** | ✅ `docs/pactiva-taxonomies/resultats/taxonomy_matrix.json` — voir fascicule 02 |

## L6 — Interface ✅

| | |
|---|---|
| **Fichiers** | `components/taxonomy/{TaxonomySwitch,CategoryChip,TaxonomyLegend}.tsx`, `store/goldStore.ts`, atelier gold (4 composants) |
| **Modifications** | sélecteur T20/T14/T11/T10 dans la barre d'outils ; bandeau « lecture projetée, décisions en T20 » ; pastilles, libellés de plan, cartouches de bloc et compteurs projetés ; légende énumérant les thèmes T20 de chaque macro avec effectifs |
| **Garde-fou** | le chemin d'ÉCRITURE n'est jamais projeté — une note explicite le dit dans l'inspecteur |
| **Succès** | ✅ vitest, `tsc` et `eslint` propres |
| **Rollback** | le sélecteur revient à T20 ; aucun état persistant |

---

## Critères d'acceptation

| # | Critère | État |
|---|---|---|
| 1 | T20/T14/T11/T10 applicables aux annotations des 3 annotateurs | ✅ (12 cellules mesurées) |
| 2 | Les mêmes transformations appliquées au GOLD | ✅ (proposition, décision et `tally`) |
| 3 | Traçabilité complète vers les labels T20 d'origine | ✅ (`members`, `canonicalCode`, info-bulles, légende) |
| 4 | Noms de catégories intelligibles et juridiquement explicites | ✅ (testé : libellé + description substantielle + justification) |
| 5 | Sélection dynamique depuis l'UI, sans duplication ni altération | ✅ |
| 6 | Légendes, badges, couleurs, filtres, compteurs, info-bulles adaptés | ✅ |
| 7 | Mapping macro → thèmes T20 affiché clairement | ✅ (légende + info-bulle de chaque pastille) |
| 8 | Compatible annotateur / consensus / GOLD / comparaison | ✅ pour les trois premiers (l'atelier gold montre les trois) — ⚠ la vue « Comparer » n'est pas encore projetée |
| 9 | Transformations déterministes, versionnées, testables, reproductibles | ✅ (46 tests, empreintes journalisées) |
| 10 | Mesures sur 50 doc. / 17 doc. / brut / consensus / gold, distinguées | ✅ |
| 11 | Métriques du papier calculées | ✅ (α-MASI, α nominal, désaccords, IC bootstrap, Δ apparié, signal d'abusivité) |
| 12 | Annotations T20 jamais modifiées destructivement | ✅ **aucune écriture** |

## Reste à faire (déclaré)

1. **Vue « Comparer »** et atelier d'ANNOTATION : la projection n'y est pas branchée. Le
   chemin est balisé (`presentTheme` est le point de passage unique) mais l'atelier
   d'annotation porte les chemins d'écriture les plus sensibles : à traiter dans un lot
   dédié, pas en fin de chantier.
2. **`schemes.py` doit importer la source unique** pour ne pas devenir une copie divergente.
3. **Exposer la spécification par l'API** (`GET /taxonomies`) si un client tiers en a besoin ;
   inutile tant que le frontend l'importe statiquement.
4. **Rejouer la matrice après arbitrage manuel** des 462 cas : le gold mesuré ici est
   auto-résolu à 95,1 %.
