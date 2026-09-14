# ADR-005 — Stratégie d'explicabilité : l'explication est le sous-graphe témoin, évalué par des juristes

**Statut** : accepté (14 septembre 2026) · **Révision** : après E3.

## Context
L'explicabilité est une exigence centrale et le domaine attend des explications en termes juridiques
(Atkinson et al. 2020). Les explications existantes pour l'abusivité sont des rationales appris ; le
raisonnement interne d'un LLM n'est pas une explication scientifique.

## Options considered
1. Rationales par attention/saillance d'un classifieur ; 2. explications générées par LLM ; 3.
**sous-graphe témoin** (règle appariée, item, champs satisfaits, phrases d'evidence, clauses
co-impliquées) produit par construction ; 4. explications contrefactuelles (changement minimal éteignant
le signalement) ; 5. cas analogues (clauses similaires étiquetées).

## Decision
Option **3** comme explication principale, complétée par **4** (contrefactuel de champ pour R1/R2) et
**5** comme aide contextuelle ; option 1 comme **comparateur** dans l'étude humaine ; option 2 exclue
comme explication (autorisée seulement pour reformuler en langage naturel un sous-graphe déjà produit,
sans ajout d'information).

## Rationale
Le sous-graphe est observable, reproductible, fidèle par construction (test de suppression), formulé
dans le vocabulaire de l'annexe ; il rend l'erreur diagnosticable (template, règle ou référence) ; il est
évaluable par des juristes selon des dimensions déclarées (fidélité, suffisance, exactitude, stabilité,
utilité).

## Consequences
Le moteur de règles doit retourner l'evidence et les champs satisfaits ; le format d'explication est
figé (JSON + rendu texte) ; une étude humaine (2 juristes × 200 cas, contrebalancée, en aveugle sur la
méthode) fait partie du protocole ; les approches A7/A8 doivent fournir au minimum la règle déclenchée
ou les features dominantes pour rester comparables.

## Risks
Explications correctes mais insuffisantes pour trancher in concreto (c'est une mesure, pas un échec) ;
coût de l'étude humaine ; tentation d'habiller une sortie LLM en explication (parade : interdiction
écrite, revue adversariale).
