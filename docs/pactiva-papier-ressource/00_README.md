# Papier « ressource » — dossier de stratégie (JURIX 2026)

**Objet.** Poser le contexte et la **stratégie d'exécution** du premier des deux objectifs
scientifiques : valoriser le travail d'annotation de phrases en thèmes multi-label réalisé par
les annotateurs de Pactiva. Le second objectif (hypergraphe / anomalies) est traité ailleurs
([`../pactiva-anomalies-graphe/`](../pactiva-anomalies-graphe/00_README.md)).

**Date :** 11 août 2026 · **Cible :** JURIX 2026 (deadline annoncée ~5 sept. 2026, **à
revérifier à la source**) · **Fenêtre réelle : ~25 jours.**

---

## La décision, en une page

> ### 🔻 Ce qu'il faut renoncer à faire
> **Un papier « ressource » long en 2026 n'est pas soutenable.** 90 % du corpus soumis vient
> d'**une seule annotatrice**, **4 documents** seulement ont ≥2 annotateurs soumis, et l'IAA
> publiable repose aujourd'hui sur **une unique paire** d'annotateurs. Un relecteur JURIX
> refusera un dataset présenté comme multi-annoté sur ces bases.
>
> ### 🔺 Ce qu'il faut faire à la place
> **Ne pas vendre la ressource — vendre ce que la ressource a permis de MESURER.** Trois
> résultats sont déjà acquis, chiffrés, et aucun n'exige de nouvelles données :
>
> | | Résultat mesuré | Chiffre |
> |---|---|---|
> | **R1** | Le passage au **multi-label coûte de la fiabilité** et fait passer sous le seuil d'acceptabilité | α-MASI **0,635** vs α nominal **0,701** (seuil 0,667) |
> | **R2** | Des humains formés s'accordent **bien plus entre eux** qu'avec le meilleur LLM | κ humain↔humain **0,769** (~80 % brut) vs **48–60 %** humain↔LLM |
> | **R3** | L'annotation assistée **n'est pas de la ratification** de LLM | **48–50 %** des phrases divergent du meilleur juge, sur des clauses validées à 98–100 % |
>
> **Format visé : short paper JURIX 2026** (≤6 p.), la ressource complète devenant un livrable
> **2027**. Un *long* reste atteignable **si et seulement si** la vague V0 + V2 (§`03`) est
> exécutée dans les 10 jours.
>
> ### ⚡ Le levier immédiat, à coût nul
> **Les 10 brouillons de `fatima.ouali` sont du travail humain abouti** (1 030/1 031 clauses
> validées ; 47,6 % de divergence avec le LLM le plus proche). Les faire **soumettre** fait
> passer la mesure de **1 paire d'annotateurs à 3**, et de **0 à 3 documents en triple
> annotation**. C'est l'action qui rend R1 et R2 statistiquement défendables. Coût : zéro
> annotation supplémentaire.

---

## Contenu du dossier

| Document | Objet |
|---|---|
| [`01_MATERIAU.md`](01_MATERIAU.md) | **L'inventaire honnête** : ce que contient réellement la base (mesures du 11 août 2026), document par document, annotateur par annotateur. Ce qui est publiable, ce qui ne l'est pas, et pourquoi. |
| [`02_STRATEGIE.md`](02_STRATEGIE.md) | **La proposition scientifique** : trois angles candidats comparés, l'angle recommandé, le titre, le plan du papier, les **cinq expériences** à mener et les tableaux à produire, les menaces de validité et leur traitement. |
| [`03_PLAN_OPERATIONNEL.md`](03_PLAN_OPERATIONNEL.md) | **Le calendrier sur 25 jours** : trois vagues (V0 gratuite / V1 correctifs plateforme / V2 sur-annotation ciblée), avec ce qui conditionne quoi, et les points de décision. |

## Rapport avec les autres dossiers

- **Amont.** [`../pactiva-anomalies-graphe/04_ANCRAGE_PLATEFORME.md`](../pactiva-anomalies-graphe/04_ANCRAGE_PLATEFORME.md)
  a établi les six écarts entre le programme et la plateforme ; ce dossier-ci en tire les
  conséquences pour le **seul** papier ressource.
- **Aval.** Le papier « graphe » (objectif B) consomme le gold produit ici. La recommandation
  d'y recentrer l'effort sur **G2 (co-occurrence)** plutôt que G1 (HGNN) tient toujours.
- **Périmé sur ce point.** [`../pactiva-anomalies-graphe/03_GOLD_ET_VALORISATION_DATASET.md`](../pactiva-anomalies-graphe/03_GOLD_ET_VALORISATION_DATASET.md)
  §4 pose « A en long, flagship » sur l'hypothèse « 3 annotateurs × 50 ToS disponibles courant
  août ». **Cette hypothèse est fausse** — voir [`01_MATERIAU.md`](01_MATERIAU.md).

## Note de fiabilité

Tous les chiffres proviennent de requêtes exécutées le **11 août 2026** sur la base de
production (`campagne-pactiva`). Ils bougeront avec la campagne. Les dates et quotas JURIX 2026
sont **à revérifier à la source** avant tout engagement de calendrier.
