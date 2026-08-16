# Expériences des deux papiers JURIX 2026 — analyse scientifique & plan d'exécution

**Objet.** Analyse scientifique approfondie des deux propositions d'articles (le *long*
« classifieur & hypergraphe » et le *short* « la mesure ») et préparation **complète** des
expérimentations nécessaires à chacun — pour disposer de **tout le matériel** d'analyse et de
rédaction. Les expérimentations sont exécutées **sur les données actuelles, en l'état**, pour
obtenir un **aperçu** des résultats avant les valeurs finales des annotations (V0/V2 de la
campagne humaine).

**Date d'analyse :** 16 août 2026 · **Cible :** JURIX 2026 (deadline ~5 septembre 2026).

## Contenu

| Document | Objet |
|---|---|
| [`01_ANALYSE_SCIENTIFIQUE.md`](01_ANALYSE_SCIENTIFIQUE.md) | L'analyse de fond : thèse, contributions et preuves requises de chaque papier ; état réel des preuves ; tensions entre dossiers **résolues** ; menaces de validité ; état de la valve mi-août ; chemin critique. |
| [`02_MATRICE_EXPERIENCES.md`](02_MATRICE_EXPERIENCES.md) | La matrice exhaustive : **chaque tableau et chaque figure** de chaque papier → l'expérience qui le produit → la source versionnée du chiffre → le statut (✅ acquis / 🔧 à implémenter / ▶ à exécuter) → les dépendances. |
| [`03_PLAN_TECHNIQUE.md`](03_PLAN_TECHNIQUE.md) | Le plan de mise en œuvre : extensions du dataset (votes bruts, gold), nouvelles tâches (`M1_agreement`, `M2_gold_cascade`, `G2_cooccurrence`), presets, programmes, interfaces ad-hoc, batterie de tests, protocole d'exécution « aperçu ». |

## Fondements

Ce dossier **consomme** et ne remplace pas :
- [`../pactiva-anomalies-graphe/`](../pactiva-anomalies-graphe/00_README.md) — la stratégie
  définitive du papier **long** (F1 + graphe multi-label) et l'ancrage plateforme (données
  réelles du 11 août).
- [`../pactiva-papier-ressource/`](../pactiva-papier-ressource/00_README.md) — la stratégie du
  papier **court** de mesure (E1–E5) et son plan opérationnel V0/V1/V2.
- [`../pactiva-lab/`](../pactiva-lab/00_README.md) — l'infrastructure d'expérimentation
  (14 presets validés le 15 août sur le dataset `d22e8722`, blocs & programmes).

## Le principe directeur

> **Règle des deux dossiers stratégiques, reprise ici :** chaque chiffre des papiers doit être
> reproductible par un code versionné exécuté sur un **export daté** (un dataset Lab figé par
> empreinte). Aucun chiffre saisi à la main, aucun chiffre issu d'une requête ad hoc non
> versionnée. Les mesures publiées dans `04_ANCRAGE_PLATEFORME.md` (α-MASI 0,635, κ 0,769,
> lifts 7,4×…) sont des **instantanés exploratoires** : ce dossier les transforme en
> **expériences Lab** rejouables, avec tests statistiques intégrés.
