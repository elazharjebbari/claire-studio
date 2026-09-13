# Dossier d'exécution — module de résolution GOLD

> **Objectif** : rendre le module d'arbitrage réellement opérationnel pour produire un
> gold fiable et citable. Audité, corrigé, testé, déployé et mis en service le
> **13 septembre 2026**.

## Le résultat en trois lignes

Le module était **architecturalement sain mais totalement inopérant** : aucun des
50 documents n'était « prêt », ce qui désactivait en cascade l'auto-résolution, le verrou,
la décision (409) et la finalisation — sans que l'interface ne nomme jamais la cause.
Après correction, la production affiche **50/50 documents prêts, 8 952 phrases
auto-résolues (95,1 %) et 462 arbitrages réels** — et non 123, chiffre qui était l'état
stocké d'avant la fin de la campagne d'annotation.

## Les fascicules

| # | Fichier | Contenu |
|---|---|---|
| 01 | [01_DIAGNOSTIC_AS_IS.md](01_DIAGNOSTIC_AS_IS.md) | Diagnostic : cause racine du blocage, volume réel de travail, forces du socle, manques ergonomiques, risques scientifiques |
| 02 | [02_ARCHITECTURE_CIBLE.md](02_ARCHITECTURE_CIBLE.md) | Architecture cible, machine à états, invariants I1–I10, points d'extension utilisés |
| 03 | [03_SPEC_UI_UX.md](03_SPEC_UI_UX.md) | Spécification d'interaction : parcours, raccourcis, inspecteur, progression, erreurs, prévention de l'erreur humaine, accessibilité |
| 04 | [04_RUNBOOK.md](04_RUNBOOK.md) | Runbook exécutable : 7 lots avec objectif, fichiers, tests, critères de succès, dépendances, risques et rollback |
| 05 | [05_RAPPORT_EXECUTION.md](05_RAPPORT_EXECUTION.md) | Ce qui a été livré, les mesures de mise en service, la charge réelle, et **la décision de protocole qui vous revient** |

Annexes : [`annexes/`](annexes/) — synthèse de l'audit multi-agents (10 dimensions,
144 constats, 40 vérifications adversariales : 26 confirmés, 14 réfutés) et son détail.

## Les trois faits qu'il faut retenir

1. **La cause racine était une divergence entre qui vote et qui est attendu.** Un
   annotateur assigné n'a jamais participé, un lead a annoté à sa place : la complétude
   ne pouvait donc jamais être atteinte. Correctif : une liste de participants
   **déclarée** (sur le modèle de la liste d'arbitres), qui ne lève pas le garde-fou.
2. **Les 462 cas à trancher sont tous des égalités 1-1-1.** La « proposition » du moteur
   y est le vainqueur **alphabétique**. L'interface ne propose plus de la valider d'un
   clic : elle avertit et fait choisir.
3. **Il n'y avait rien à perdre.** Aucune décision humaine n'existait (`decided = 0`,
   `ArbitrationEvent = 0`) : les corrections de fond étaient sans risque. Cette fenêtre
   se referme au premier arbitrage réel.

## Principes d'exécution tenus

Inspecter avant de modifier · réutiliser l'existant (`ArbiterPicker`, `ThemeMultiPicker`,
`Disclosure`) · aucun refactoring gratuit · **moteur pur non modifié** (parité TS↔PY et
cas d'or intacts) · aucune donnée détruite · un test avant chaque correctif · chaque lot
vérifié avant le suivant.
