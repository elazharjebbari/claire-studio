# Pactiva → Détection d'anomalies dans les ToS par graphe **multi-label** — dossier corrigé (définitif)

**Objet.** Un dossier **entièrement neuf et auto-suffisant** qui reprend le programme « détection
d'anomalies dans les *Terms of Service* » en **corrigeant trois hypothèses de fond** des dossiers
précédents, après vérification dans le code et dans la littérature :

1. **La nature déontique n'est PAS une donnée.** CLAUDETTE ne la fournit pas (8 catégories d'abusivité
   + 3 niveaux de sévérité, *par phrase*) et **les annotateurs Pactiva ne la labellisent pas** (le champ
   `legal_nature` existe mais est **optionnel** et non renseigné en pratique). → Toute couche déontique
   est une **sous-tâche prédite, bruitée et évaluée** (macro-F1 ~0,6), jamais un axe structurant.
2. **Une clause porte PLUSIEURS thèmes.** Le modèle `ClauseTheme` est *multi-label natif* (un `primary`
   + des `secondary`). → La modélisation passe à un **hypergraphe / graphe biparti clause–thèmes**, et
   la **combinaison inhabituelle de thèmes devient un type d'anomalie à part entière** (co-occurrence).
3. **La fiabilité de l'annotation thématique est le PRÉREQUIS.** Sans thèmes fiables, aucun graphe
   fiable. → Le dossier fait de la **fiabilité (κ/α humain + effet de la formation + classifieur
   supervisé sans LLM)** une **contribution de premier plan**, en pont direct avec le « mur du κ ».

**Date :** 1ᵉʳ août 2026 · **Auteur pressenti :** Ahmed El Azhar Jebbari (LORIA) · **Cible :** JURIX
2026 (Toulouse, ~5 sept. 2026) + programme pluriannuel.

## Contenu

| Document | Objet |
|---|---|
| [`01_CADRE_ET_PROPOSITIONS.md`](01_CADRE_ET_PROPOSITIONS.md) | **(1)** Le cadre corrigé : *ToS → thèmes multi-label fiables → hypergraphe → détection d'anomalies*, avec l'état de l'art récent (hypergraphes/GAD, classification multi-label sans LLM, IAA MASI, déontique prédite) et le positionnement. **(2)** Le **long tableau** de 11 propositions d'articles scorées. |
| [`02_RECOMMANDATION_ET_ROADMAP.md`](02_RECOMMANDATION_ET_ROADMAP.md) | L'**analyse comparative**, la **recommandation** (portefeuille + article phare, plan, expériences, ablations), et la **feuille de route** pluriannuelle. |
| [`03_GOLD_ET_VALORISATION_DATASET.md`](03_GOLD_ET_VALORISATION_DATASET.md) | **Valoriser le dataset** d'annotation (3 annotateurs × 50 ToS = une ressource) + **comment résoudre les conflits inter-annotateurs** (fusion / démocratie / comité → **cascade tiérée déjà implémentée** dans `gold_scoring.py`, désaccord préservé) ; **révise le portefeuille** vers « ressource d'abord ». |
| [`04_ANCRAGE_PLATEFORME.md`](04_ANCRAGE_PLATEFORME.md) | **Confrontation aux données réelles de la prod (11 août 2026)** : ce que la plateforme fournit vraiment, **6 écarts mesurés** avec le dossier (dont : gisement multi-annotateur = **4 documents**, frontières non annotées, certitude/rationale = résidus LLM), la **fiabilité mesurée** (κ 0,769 humain vs 0,32–0,45 LLM ; **α-MASI 0,635**), et le **test préliminaire de l'hypothèse centrale** de B (lift **7,4×** sur certaines paires de thèmes, mais **1,09× pour le multi-label brut**). |

## Rapport avec les dossiers précédents

Ce dossier **remplace** [`../pactiva-recherche-anomalies/`](../pactiva-recherche-anomalies/00_README.md)
(v2) sur les trois points ci-dessus (v2 supposait à tort une nature déontique donnée et un thème unique
par clause). Il **conserve** l'acquis du « mur du κ » ([`../pactiva-jurix-2026/`](../pactiva-jurix-2026/00_README.md),
v1) comme **motivation** (le LLM seul échoue → peut-on faire fiable autrement ?). **Ce dossier-ci porte
la proposition définitive.**

## Sources

Vérification code (`backend/claire/annotations/models.py` : `Clause`, `ClauseTheme`, `legal_nature`
optionnel), matériau de thèse (`CLAIRE/docs/personnal/`), et **trois revues de littérature récentes**
commandées pour ce programme (graphes/déontique ; anomalies d'annotateurs ; **multi-label & fiabilité
d'annotation**), citées dans `01`. ⚠️ Citations et dates JURIX à **revérifier à la source**.
