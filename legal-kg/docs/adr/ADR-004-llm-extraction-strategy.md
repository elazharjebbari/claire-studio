# ADR-004 — Stratégie d'extraction par LLM : schema-guided, vérifiée, validée par des juristes, répliquée

**Statut** : accepté (14 septembre 2026) · **Révision** : après le pilote (Gate 5).

## Context
La couche normative (énoncés `Norm`) n'existe pas ; il faut la construire pour 2 450 clauses. Nos
juges LLM sur la tâche voisine (thème par phrase) atteignent κ 0,58 au mieux contre les humains et
s'accordent entre eux jusqu'à 0,80 ; l'ancrage des pré-annotations sur les humains est documenté. Le
budget humain de validation est le facteur limitant (~1 min/clause).

## Options considered
Zero-shot libre ; few-shot ; schema-guided avec sortie structurée ; génération contrainte locale ;
pipeline multi-étapes ; multi-agent extracteur/vérificateur ; LLM + règles ; LLM + classifieur ;
LLM + contraintes d'ontologie ; LLM + validation humaine (LLM_EXTRACTION §2).

## Decision
Pipeline **schema-guided + contraintes d'ontologie + vérification d'ancrage + validation humaine** sur
le hold-out (100 % des clauses cibles) et par échantillon sur la conception ; sorties brutes conservées
comme ablation ; **sélection du modèle par pilote** (100 clauses, 3 exécutions, score pondéré déclaré :
exactitude 40 %, hallucination 20 %, reproductibilité 15 %, coût 15 %, déployabilité 10 %) ; **réplication
obligatoire** avec un modèle ouvert épinglé ; prompts sans catégories ni items ; few-shot uniquement
depuis les 33 documents de conception.

## Rationale
La sortie structurée garantit la conformité au schéma ; l'ancrage obligatoire (evidence) rend
l'hallucination mesurable et filtrable ; la validation humaine est la seule source de vérité acceptable
pour une ressource publiée et pour RQ0 ; la réplication ouverte protège contre la dépendance à un
fournisseur et rend l'expérience rejouable.

## Consequences
Coût API modeste (< 100 $ pour plusieurs passages) ; coût humain dominant (hold-out ≈ 15 h) ; registre de
prompts avec empreintes ; enregistrement complet des runs ; un outil de validation (tableur/CLI puis
écran plateforme).

## Risks
Le modèle « remplit pour remplir » (parade : `not_stated`, vérificateur, rejet) ; biais partagé entre
extracteur et vérificateur (parade : vérificateur d'une autre famille + heuristiques lexicales) ;
consensus d'erreur validé par fatigue (parade : double validation sur 20 %, κ rapporté).
